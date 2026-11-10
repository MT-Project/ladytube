const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('../db');
const { NATIVE_EXTENSIONS } = require('../constants');
const mediaService = require('./mediaService');
const logger = require('../logger');

class VideoScanner {
    constructor() {
        this.isScanning = false;
        this.currentScanCanceller = null;
        this.abortController = null;
        this.totalFiles = 0;
        this.processedFiles = 0;
    }

    getProgress() {
        return {
            total: this.totalFiles,
            processed: this.processedFiles,
            isScanning: this.isScanning
        };
    }

    async countFiles(folders, videoExtensions, ignorePatterns, checkCancel) {
        let count = 0;
        const stack = [...folders];

        while (stack.length > 0) {
            if (checkCancel()) break;
            const dir = stack.pop();
            try {
                if (!fs.existsSync(dir)) continue;
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (checkCancel()) break;
                    const entryName = typeof entry === 'string' ? entry : entry.name;
                    if (!entryName) continue;
                    const fullPath = path.join(dir, entryName);

                    // Check ignore patterns
                    const isIgnored = ignorePatterns.some(line => {
                        const andTerms = line.split(/\s+/).filter(t => t.length > 0);
                        if (andTerms.length === 0) return false;
                        return andTerms.every(term => fullPath.toLowerCase().includes(term.toLowerCase()));
                    });
                    if (isIgnored) continue;

                    let isDir = entry.isDirectory ? entry.isDirectory() : false;
                    let isFile = entry.isFile ? entry.isFile() : false;

                    if (!entry.isDirectory && !entry.isFile) {
                        try {
                            const stat = await fsPromises.stat(fullPath);
                            isDir = stat.isDirectory();
                            isFile = stat.isFile();
                        } catch {
                            continue;
                        }
                    }

                    if (isDir) {
                        stack.push(fullPath);
                    } else if (isFile) {
                        const ext = path.extname(fullPath).toLowerCase();
                        if (videoExtensions.has(ext)) {
                            count++;
                        }
                    }
                }
            } catch (err) {
                logger.error(`${dir} ファイル数カウントエラー`, err);
            }
        }
        return count;
    }

    async scan(req, res) {
        const repair = req.body && req.body.repair === true;
        if (repair) console.log('修復スキャンモードが有効です。');

        // 1. Get folders and settings from Settings
        let folders = [];
        let videoExtensions = new Set();
        let ignorePatterns = [];

        try {
            const settings = db.prepare("SELECT * FROM settings").all();
            for (const s of settings) {
                try {
                    const val = JSON.parse(s.value);
                    if (s.key === 'scan_folders') folders = val;
                    if (s.key === 'video_extensions' && Array.isArray(val) && val.length > 0) videoExtensions = new Set(val);
                    if (s.key === 'ignore_patterns') ignorePatterns = val;
                } catch (err) {
                    logger.error(`設定 ${s.key} 解析エラー`, err);
                }
            }
        } catch (e) {
            logger.error('設定の読み込みエラー', e);
        }

        if (!folders || folders.length === 0) {
            logger.warn('スキャン中止', new Error('フォルダの設定がないためスキャンを中止しました。'));
            return res.status(400).json({ error: 'スキャン対象のフォルダーが設定されていません。' });
        }

        if (this.isScanning) {
            return res.status(409).json({ error: 'スキャンが既に進行中です。' });
        }

        this.isScanning = true;
        this.abortController = new AbortController();
        const signal = this.abortController.signal;

        let isCancelled = false;
        const checkCancel = () => isCancelled || signal.aborted;
        this.currentScanCanceller = () => { isCancelled = true; };

        this.totalFiles = 0;
        this.processedFiles = 0;

        try {
            console.log('Counting files...');
            this.totalFiles = await this.countFiles(folders, videoExtensions, ignorePatterns, checkCancel);
            console.log(`Total files to process: ${this.totalFiles}`);

            // Create TEMP TABLE
            db.exec(`
                CREATE TEMP TABLE IF NOT EXISTS temp_files (
                    id INTEGER PRIMARY KEY
                );
                DELETE FROM temp_files;
            `);

            const insertTempFile = db.prepare('INSERT OR IGNORE INTO temp_files (id) VALUES (?)');
            const checkFileStmt = db.prepare('SELECT id, size, updated_at, hash FROM files WHERE path = ?');
            const insertFileStmt = db.prepare('INSERT INTO files (path, filename, size, hash, updated_at) VALUES (?, ?, ?, ?, ?)');
            const updateFileStmt = db.prepare('UPDATE files SET filename = ?, size = ?, hash = ?, updated_at = ? WHERE id = ?');
            const checkMetaStmt = db.prepare('SELECT duration, thumbnail FROM metadata WHERE hash = ?');
            const insertMetadataStmt = db.prepare('INSERT OR IGNORE INTO metadata (hash, duration, thumbnail, use_transcode) VALUES (?, ?, ?, ?)');
            const updateMetadataRepairStmt = db.prepare(`
                UPDATE metadata SET 
                    duration = COALESCE(?, duration),
                    thumbnail = COALESCE(?, thumbnail)
                WHERE hash = ?
            `);

            const stmts = {
                insertTempFile,
                checkFileStmt,
                insertFileStmt,
                updateFileStmt,
                checkMetaStmt,
                insertMetadataStmt,
                updateMetadataRepairStmt
            };

            console.log('Start scan...');
            for (const folder of folders) {
                if (checkCancel()) break;
                if (fs.existsSync(folder)) {
                    await this.scanDirectory(folder, videoExtensions, ignorePatterns, checkCancel, stmts, repair, signal);
                }
            }

            if (checkCancel()) {
                console.log('ユーザーによってスキャンがキャンセルされました。');
                return res.status(499).json({ error: 'スキャンが中断されました' });
            }

            console.log(`Scan complete. Deleting removed files from database...`);

            // Delete files that are no longer present in the scan
            db.prepare(`
                DELETE FROM files 
                WHERE id NOT IN (SELECT id FROM temp_files)
            `).run();

            console.log('Database sync complete.');

            // DB最適化
            db.pragma('optimize');
            console.log('Database optimization executed.');

            const finalCount = db.prepare('SELECT count(*) as count FROM files').get().count;

            res.json({
                message: `Scan complete. Total videos: ${finalCount}`,
                count: finalCount
            });
        } catch (error) {
            if (error.message === 'Cancelled' || error.name === 'AbortError' || signal.aborted) {
                console.log('スキャンの実行が中断されました。');
                if (!res.headersSent) {
                    return res.status(499).json({ error: 'スキャンが中断されました' });
                }
                return;
            }
            logger.error('スキャンエラー', error);
            if (!res.headersSent) {
                res.status(500).json({ error: error.message || String(error) });
            }
        } finally {
            this.isScanning = false;
            this.currentScanCanceller = null;
            this.abortController = null;
            console.log('Scan end.');
        }
    }

    async cancelScan(req, res) {
        if (!this.isScanning) {
            return res.status(400).json({ error: 'スキャンは実行されていません。' });
        }

        console.log('スキャン中止リクエストを受信しました。');
        if (this.abortController) {
            this.abortController.abort();
        }
        if (this.currentScanCanceller) {
            this.currentScanCanceller();
        }

        // Wait for the scan to finish cancelling
        const maxWait = 10000;
        const startTime = Date.now();
        while (this.isScanning && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (this.isScanning) {
            return res.status(500).json({ error: 'スキャンの中止に失敗しました。' });
        }

        res.json({ message: 'スキャンを中止しました。' });
    }

    async ensureMetadata(fullPath, filename, ext, videoHash, stmts, repair, signal) {
        if (signal?.aborted) throw new Error('Cancelled');
        const existingMeta = stmts.checkMetaStmt.get(videoHash);
        if (!existingMeta) {
            const duration = await mediaService.getVideoDuration(fullPath, signal);

            let thumbnail = null;
            if (duration && duration > 0) {
                // 3分の位置を取得 (15分以下は20%の位置)
                const seekTime = duration > 15 * 60 ? 180 : duration * 0.2;
                //console.log(`Generating thumbnail for ${filename} at ${seekTime}s...`);
                thumbnail = await mediaService.captureFrame(fullPath, seekTime, signal, { fast: true });
                if (thumbnail) {
                    //console.log(`Thumbnail generated for ${filename}, size: ${thumbnail.length} bytes`);
                }
            }

            const useTranscode = NATIVE_EXTENSIONS[ext] ? 0 : 1;
            stmts.insertMetadataStmt.run(videoHash, duration, thumbnail, useTranscode);
        } else if (repair) {
            await this.repairMetadata(fullPath, filename, videoHash, stmts, signal, existingMeta);
        }
    }

    async repairMetadata(fullPath, filename, videoHash, stmts, signal, existingMeta = null) {
        if (signal?.aborted) throw new Error('Cancelled');
        const meta = existingMeta || stmts.checkMetaStmt.get(videoHash);
        if (!meta) return;

        let repairDuration = null;
        let repairThumbnail = null;

        if (meta.duration === null || meta.duration === 0) {
            repairDuration = await mediaService.getVideoDuration(fullPath, signal);
        }
        if (meta.thumbnail === null) {
            const dur = repairDuration !== null ? repairDuration : meta.duration;
            if (dur && dur > 0) {
                const seekTime = dur * 0.2;
                console.log(`Generating thumbnail for ${filename} at ${seekTime}s (repair)...`);
                repairThumbnail = await mediaService.captureFrame(fullPath, seekTime, signal, { fast: true });
            }
        }

        if (repairDuration !== null || repairThumbnail !== null) {
            stmts.updateMetadataRepairStmt.run(
                repairDuration,
                repairThumbnail,
                videoHash
            );
        }
    }

    async scanDirectory(dir, videoExtensions, ignorePatterns, checkCancel, stmts, repair, signal) {
        if (checkCancel()) throw new Error('Cancelled');

        let dirExists = false;
        try {
            await fsPromises.access(dir);
            dirExists = true;
        } catch {
            return;
        }

        if (!dirExists) return;

        const files = await fsPromises.readdir(dir);

        for (const file of files) {
            if (checkCancel()) throw new Error('Cancelled');
            const fullPath = path.join(dir, file);

            // Check ignore patterns
            const isIgnored = ignorePatterns.some(line => {
                const andTerms = line.split(/\s+/).filter(t => t.length > 0);
                if (andTerms.length === 0) return false;
                return andTerms.every(term => fullPath.toLowerCase().includes(term.toLowerCase()));
            });
            if (isIgnored) continue;

            try {
                const stat = await fsPromises.stat(fullPath);
                if (stat.isDirectory()) {
                    await this.scanDirectory(fullPath, videoExtensions, ignorePatterns, checkCancel, stmts, repair, signal);
                } else {
                    const ext = path.extname(fullPath).toLowerCase();
                    if (videoExtensions.has(ext)) {
                        this.processedFiles++;
                        if (checkCancel()) throw new Error('Cancelled');

                        const updatedAt = stat.mtime.toISOString().replace('T', ' ').substring(0, 19);
                        const existing = stmts.checkFileStmt.get(fullPath);

                        if (!existing) {
                            // 新規ファイル
                            if (checkCancel()) throw new Error('Cancelled');
                            const videoHash = await this.calculateVideoHash(fullPath, stat.size, signal);
                            if (!videoHash) continue;

                            await this.ensureMetadata(fullPath, file, ext, videoHash, stmts, repair, signal);

                            if (checkCancel()) throw new Error('Cancelled');
                            const res = stmts.insertFileStmt.run(fullPath, file, stat.size, videoHash, updatedAt);
                            stmts.insertTempFile.run(res.lastInsertRowid);
                        } else {
                            // 既存ファイル
                            stmts.insertTempFile.run(existing.id);

                            if (existing.size === stat.size && existing.updated_at === updatedAt) {
                                // 変更なし
                                if (repair && existing.hash) {
                                    await this.repairMetadata(fullPath, file, existing.hash, stmts, signal);
                                }
                            } else {
                                // ファイルサイズまたは更新日時が変更されている
                                if (checkCancel()) throw new Error('Cancelled');
                                const videoHash = await this.calculateVideoHash(fullPath, stat.size, signal);
                                if (!videoHash) continue;

                                await this.ensureMetadata(fullPath, file, ext, videoHash, stmts, repair, signal);

                                if (checkCancel()) throw new Error('Cancelled');
                                stmts.updateFileStmt.run(file, stat.size, videoHash, updatedAt, existing.id);
                            }
                        }
                    }
                }
            } catch (e) {
                if (e.message === 'Cancelled' || e.name === 'AbortError' || signal?.aborted) {
                    throw new Error('Cancelled');
                }
                logger.error('スキャンエラー', e, path.basename(fullPath));
            }
        }
    }

    async calculateVideoHash(filePath, fileSize, signal) {
        if (fileSize === 0) return 'empty_file';

        try {
            let buffer;
            if (Math.floor(fileSize / 2) < 1024) {
                buffer = await fsPromises.readFile(filePath);
            } else {
                const chunkSize = 1024;
                const position = Math.floor(fileSize / 2);
                buffer = Buffer.alloc(chunkSize);
                const fileHandle = await fsPromises.open(filePath, 'r');
                try {
                    await fileHandle.read(buffer, 0, buffer.length, position);
                } finally {
                    await fileHandle.close();
                }
            }
            if (signal?.aborted) throw new Error('Cancelled');
            return crypto.createHash('md5').update(buffer).update(String(fileSize)).digest('hex');
        } catch (err) {
            if (err.message === 'Cancelled') throw err;
            logger.error('ハッシュ計算エラー', err, path.basename(filePath));
            return null;
        }
    }
}

module.exports = new VideoScanner();
