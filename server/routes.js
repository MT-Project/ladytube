const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');
const scanner = require('./services/scanner');
const videoService = require('./services/videoService');
const mediaService = require('./services/mediaService');
const logger = require('./logger');

// 画像生成の進捗管理 (メモリ上に保持)
// 構造: { [videoId]: { processed: number, total: number, controller: AbortController } }
const activeGenerations = {};

// --- Server Info Handling ---
const getServerInfo = (req, res) => {
    try {
        const interfaces = os.networkInterfaces();
        const ips = new Set();

        for (const devName in interfaces) {
            const iface = interfaces[devName];
            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    ips.add(alias.address);
                }
            }
        }

        // Convert Set to Array, Slice to max 4, and Sort for consistency
        const ipList = Array.from(ips).sort().slice(0, 4);

        if (ipList.length === 0) {
            ipList.push('localhost');
        }

        res.json({
            ips: ipList,
            port: 19190, // server/index.js で定義されているポート
        });
    } catch (err) {
        logger.error('サーバー情報取得エラー', err);
        res.status(500).json({ error: err.message });
    }
};


// --- Settings Handling ---
const getSettings = (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM settings');
        const settings = stmt.all();
        const settingsObj = {};
        settings.forEach(s => settingsObj[s.key] = JSON.parse(s.value));
        res.json(settingsObj);
    } catch (err) {
        logger.error('設定取得エラー', err);
        res.status(500).json({ error: err.message });
    }
};

const updateScanSettings = (req, res) => {
    const { scan_folders, video_extensions, ignore_patterns, allow_public } = req.body;
    try {
        db.transaction(() => {
            if (scan_folders !== undefined) {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('scan_folders', JSON.stringify(scan_folders));
            }
            if (video_extensions !== undefined) {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('video_extensions', JSON.stringify(video_extensions));
            }
            if (ignore_patterns !== undefined) {
                db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ignore_patterns', JSON.stringify(ignore_patterns));
            }
        })();
        res.json({ success: true });
    } catch (err) {
        logger.error('スキャン設定更新エラー', err);
        res.status(500).json({ error: err.message });
    }
};

const updateNetworkSettings = (req, res) => {
    const { allow_public } = req.body;
    try {
        if (allow_public !== undefined) {
            db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('allow_public', JSON.stringify(allow_public));
        }
        res.json({ success: true });
    } catch (err) {
        logger.error('ネットワーク設定更新エラー', err);
        res.status(500).json({ error: err.message });
    }
};

// --- Tags Handling ---
const getTags = (req, res) => {
    try {
        const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('preset_tags');
        const tags = row ? JSON.parse(row.value) : [];
        res.json(tags.map(name => ({ name })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createTag = (req, res) => {
    const { name } = req.body;
    try {
        db.prepare('INSERT OR IGNORE INTO known_tags (name) VALUES (?)').run(name);
        res.json({ success: true, name });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateTags = (req, res) => {
    // NOTE: This was 'updateTags' in maintenance previously, likely meant for bulk updating preset tags
    const { tags } = req.body; // Expecting array of strings
    try {
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('preset_tags', JSON.stringify(tags));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// --- Screenshot Handling ---

const captureScreenshot = async (req, res) => {
    const { id } = req.params;
    const { timestamp } = req.body;

    try {
        const video = db.prepare('SELECT f.path, f.filename, m.hash FROM files f JOIN metadata m ON f.hash = m.hash WHERE f.id = ?').get(id);
        if (!video) return res.status(404).json({ error: '動画が見つかりません' });

        const ts = parseFloat(timestamp) || 0;
        const processedBuffer = await mediaService.captureFrame(video.path, ts);

        if (!processedBuffer) {
            return res.status(500).json({ error: 'スクリーンショットの取得に失敗しました' });
        }

        const info = db.prepare('INSERT INTO screenshots (hash, timestamp, image_data) VALUES (?, ?, ?)')
            .run(video.hash, ts, processedBuffer);

        res.json({ success: true, screenshot_id: info.lastInsertRowid });

    } catch (err) {
        logger.error('スクリーンショット取得エラー', err, video?.filename);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
};

const getScreenshots = (req, res) => {
    const { id } = req.params;
    try {
        const video = db.prepare('SELECT hash FROM files WHERE id = ?').get(id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const shots = db.prepare('SELECT id, timestamp, created_at FROM screenshots WHERE hash = ? ORDER BY timestamp ASC').all(video.hash);
        res.json(shots);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPreviewFrame = (req, res) => {
    videoService.getPreviewFrame(req, res);
};

const deleteScreenshot = (req, res) => {
    const { id } = req.params;
    try {
        const info = db.prepare('DELETE FROM screenshots WHERE id = ?').run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'スクリーンショットが見つからないか、削除されています' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const setThumbnailFromScreenshot = (req, res) => {
    const { id } = req.params; // video id
    const { screenshot_id } = req.body;

    let video;
    try {
        video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const shot = db.prepare('SELECT image_data FROM screenshots WHERE id = ?').get(screenshot_id);
        if (!shot) return res.status(404).json({ error: 'スクリーンショットが見つからないか、削除されています' });

        db.prepare('UPDATE metadata SET thumbnail = ? WHERE hash = ?').run(shot.image_data, video.hash);
        res.json({ success: true, thumbnail: `/api/video/${id}/thumbnail?t=${Date.now()}` });
    } catch (err) {
        logger.error('スクリーンショットからのサムネイル設定エラー', err, video?.filename);
        res.status(500).json({ error: err.message });
    }
};

const setThumbnailFromTimestamp = async (req, res) => {
    const { id } = req.params;
    const { timestamp } = req.body;

    let video;
    try {
        video = db.prepare('SELECT f.path, f.filename, m.hash FROM files f JOIN metadata m ON f.hash = m.hash WHERE f.id = ?').get(id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const ts = parseFloat(timestamp) || 0;
        const processedBuffer = await mediaService.captureFrame(video.path, ts);

        if (!processedBuffer) {
            return res.status(500).json({ error: 'サムネイルの生成に失敗しました' });
        }

        db.prepare('UPDATE metadata SET thumbnail = ? WHERE hash = ?').run(processedBuffer, video.hash);

        // Return URL of the new thumbnail
        res.json({ success: true, thumbnail: `/api/video/${id}/thumbnail?t=${Date.now()}` });

    } catch (err) {
        logger.error('サムネイル生成エラー', err, video?.filename);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
};

const getScreenshotGallery = (req, res) => {
    const { sort = 'recent', page = 1, perPage = 30, seed } = req.query;
    const limit = parseInt(perPage, 10) || 30;
    const pageNum = parseInt(page, 10) || 1;
    const offset = Math.max(0, (pageNum - 1) * limit);

    try {
        let orderBy = 's.created_at DESC';
        const queryParams = [];

        if (sort === 'random') {
            const seedVal = parseInt(seed, 10);
            if (!isNaN(seedVal)) {
                orderBy = 'seeded_random(?, s.id)';
                queryParams.push(seedVal);
            } else {
                orderBy = 'RANDOM()';
            }
        }

        const totalRow = db.prepare(`
            SELECT COUNT(DISTINCT s.id) as count
            FROM screenshots s
            JOIN metadata m ON s.hash = m.hash
            JOIN files f ON f.hash = m.hash
        `).get();
        const total = totalRow ? totalRow.count : 0;

        queryParams.push(limit, offset);

        const rows = db.prepare(`
             SELECT s.id, s.timestamp, s.created_at, f.id as video_id, f.filename, f.path, m.display_name
             FROM screenshots s
             JOIN metadata m ON s.hash = m.hash
             JOIN files f ON f.hash = m.hash
             GROUP BY s.id
             ORDER BY ${orderBy}
             LIMIT ? OFFSET ?
         `).all(...queryParams);

        res.json({
            screenshots: rows,
            total
        });
    } catch (err) {
        logger.error('スクリーンショットリスト取得エラー', err);
        res.status(500).json({ error: err.message });
    }
};


const getUnreferencedMetadataCount = (req, res) => {
    try {
        const row = db.prepare(`
            SELECT COUNT(*) as count FROM metadata 
            WHERE hash NOT IN (SELECT hash FROM files)
        `).get();
        res.json({ success: true, count: row.count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const renameTag = (req, res) => {
    const { oldTag, newTag } = req.body;
    if (!oldTag || !newTag) {
        return res.status(400).json({ error: '新旧両方のタグ名が必要です' });
    }

    try {
        let changes = 0;
        db.transaction(() => {
            // Update metadata tags
            const info = db.prepare(`
                UPDATE metadata 
                SET tags = REPLACE(tags, '\n' || ? || '\n', '\n' || ? || '\n')
                WHERE tags LIKE '%\n' || ? || '\n%'
            `).run(oldTag, newTag, oldTag);
            changes = info.changes;

            // Update preset_tags in settings
            const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('preset_tags');
            if (row) {
                let tags = JSON.parse(row.value);
                let changed = false;
                tags = tags.map(t => {
                    if (t === oldTag) {
                        changed = true;
                        return newTag;
                    }
                    return t;
                });
                if (changed) {
                    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(tags), 'preset_tags');
                }
            }
        })();
        res.json({ success: true, changes });
    } catch (err) {
        logger.error('タグ変更エラー', err);
        res.status(500).json({ error: err.message });
    }
};

const cleanupMetadata = (req, res) => {
    console.log('Cleanup start');
    try {
        db.transaction(() => {
            // Delete screenshots first
            db.prepare(`
                DELETE FROM screenshots 
                WHERE hash NOT IN (SELECT hash FROM files)
            `).run();

            const result = db.prepare(`
                DELETE FROM metadata 
                WHERE hash NOT IN (SELECT hash FROM files)
            `).run();

            res.json({
                success: true,
                count: result.changes,
                message: `参照されていないメタデータ(${result.changes}件)と関連するスクリーンショットを削除しました。`
            });
        })();

        console.log('VACUUM...');
        db.prepare(`VACUUM`).run();
        console.log('cleanup end');

    } catch (err) {
        logger.error('メタデータクリーンアップエラー', err);
        res.status(500).json({ error: err.message });
    }
};





const getVideoProbeInfo = async (req, res) => {
    const { id } = req.params;
    let video;
    try {
        video = db.prepare('SELECT f.path, f.filename FROM files f WHERE f.id = ?').get(id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const info = await mediaService.getProbeInfo(video.path);
        if (!info) return res.status(500).json({ error: '動画の解析に失敗しました' });

        res.json(info);
    } catch (err) {
        logger.error('コーデック情報取得エラー', err, video?.filename);
        res.status(500).json({ error: err.message });
    }
};

const listDirectory = (req, res) => {
    const { path: queryPath } = req.query;
    if (!queryPath) {
        return res.status(400).json({ error: 'パスが指定されていません' });
    }

    try {
        if (queryPath === '/' && process.platform === 'win32') {
            require('child_process').exec('powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Select-Object -ExpandProperty DeviceID"', (err, stdout) => {
                if (err) {
                    return res.status(500).json({ error: err.message });
                }
                const drives = stdout.split(/\r?\n/)
                    .map(value => value.trim())
                    .filter(value => /^[A-Za-z]:$/.test(value))
                    .map(drive => ({
                        name: drive + path.sep,
                        path: drive + path.sep
                    }));
                res.json(drives);
            });
            return;
        }

        // List contents of the specified directory
        const targetPath = queryPath;
        if (!fs.existsSync(targetPath)) {
            return res.status(404).json({ error: 'ディレクトリが見つかりません' });
        }

        const items = fs.readdirSync(targetPath, { withFileTypes: true });
        const result = items.filter(item => item.isDirectory()).map(item => {
            return {
                name: item.name,
                path: path.join(targetPath, item.name)
            };
        });

        res.json(result);

    } catch (err) {
        logger.error('フォルダーリスト取得エラー', err);
        res.status(500).json({ error: err.message });
    }
};


const resolvePath = (req, res) => {
    const { base, target } = req.query;

    if (!base || !target) {
        return res.status(400).json({ error: 'ベースディレクトリと対象のパスの両方が必要です' });
    }

    try {
        let resultPath;
        const isDriveRoot = (path) => /^[a-zA-Z]:\\$/.test(path);

        if (target === '..') {
            // Move up
            if (base === '/') {
                return res.status(400).json({ error: 'ルートディレクトリより上位へは移動できません' });
            }

            // Windows Special Case: Drive Root "C:\" -> "/"
            if (process.platform === 'win32' && isDriveRoot(base)) {
                resultPath = '/';
            } else {
                resultPath = path.dirname(base);
            }

        } else {
            // Move down / specific target

            // Windows Special Case: base="/" and target="C:\" (Drive Root) -> "C:\"
            // We assume target provided is "C:\" (as returned by listDirectory for drives)
            if (process.platform === 'win32' && base === '/' && isDriveRoot(target)) {
                resultPath = target;
                // Ensure trailing slash
                if (!resultPath.endsWith(path.sep)) resultPath += path.sep;
            } else {
                // Non-windows root "/" -> join "/" + "video" -> "/video"
                resultPath = path.join(base, target);
            }
        }

        res.json({ path: resultPath });
    } catch (err) {
        logger.error('パス解決エラー', err);
        res.status(500).json({ error: err.message });
    }
};

const getVideoImageList = async (req, res) => {
    const { id } = req.params;
    const { max_count, force } = req.query;
    try {
        const video = db.prepare('SELECT f.path, m.hash, m.duration, f.filename FROM files f JOIN metadata m ON f.hash = m.hash WHERE f.id = ?').get(id);
        if (!video) return res.status(404).json({ error: '動画が見つかりません' });

        const { path: filePath, hash, duration, filename } = video;

        if (!duration || isNaN(duration) || duration <= 10) {
            return res.status(400).json({ error: '10秒以下の動画、または長さが不明な動画はイメージリストを作成できません。' });
        }

        if (force === 'true') {
            db.prepare('DELETE FROM imagelist WHERE hash = ?').run(hash);
        } else {
            // 登録済みかチェック
            const shots = db.prepare('SELECT position FROM imagelist WHERE hash = ? ORDER BY position ASC').all(hash);
            if (shots.length > 0) {
                const list = shots.map(s => ({
                    position: s.position,
                    url: `/api/video/${id}/imagelist/image?t=${s.position}`
                }));
                return res.json(list);
            }
        }

        // 二重起動防止
        if (activeGenerations[id]) {
            return res.status(409).json({ error: '画像生成が既に進行中です。' });
        }

        // クエリから最大枚数を取得、無ければデフォルトの30
        const maxCount = parseInt(max_count, 10) || 30;
        const interval = Math.max(10, duration / maxCount);
        const expectedCount = Math.floor(duration / interval);

        // AbortControllerを生成し、進捗管理オブジェクトを初期化
        const controller = new AbortController();
        activeGenerations[id] = { processed: 0, total: expectedCount, controller };
        console.log(`[ImageList] start... ${filename} (ID: ${id}, count: ${expectedCount}, interval: ${interval.toFixed(1)}s)`);

        // クライアントの切断検知による自動キャンセル
        const handleClientClose = () => {
            console.log(`[ImageList] クライアントが切断したため、画像生成をキャンセルします。(ID: ${id})`);
            controller.abort();
        };
        req.on('close', handleClientClose);

        try {
            // ffmpegを実行して画像を取得 (onProgressコールバック付き)
            const result = await mediaService.captureFrameList(filePath, interval, (count) => {
                if (activeGenerations[id]) activeGenerations[id].processed = count;
                const percent = Math.round((count / expectedCount) * 100);
                //console.log(`[ImageList] 生成中... ${count}/${expectedCount} (${percent}%)`);
            }, controller.signal);

            const { images, timedOut, cancelled } = result;

            if (cancelled) {
                console.log(`[ImageList] キャンセルされました: ${filename} (ID: ${id}, count: ${images.length})`);
                return res.status(499).json({ error: 'キャンセルされました' });
            }

            if (timedOut) {
                logger.warn('イメージリスト取得タイムアウト', new Error(`ID: ${id}, count: ${images.length}`), filename);
                return res.status(504).json({ error: `画像生成がタイムアウトしました。（${images.length} images）` });
            }

            if (!images || images.length === 0) {
                return res.status(500).json({ error: '動画からの画像取得に失敗しました。' });
            }

            // 仮想テーブルに登録
            const insertStmt = db.prepare('INSERT OR REPLACE INTO imagelist (hash, position, image_data) VALUES (?, ?, ?)');
            db.transaction(() => {
                for (let i = 0; i < images.length; i++) {
                    const pos = (i + 0.5) * interval;
                    if (pos < duration) {
                        insertStmt.run(hash, pos, images[i]);
                    }
                }
            })();

            console.log(`[ImageList] end... ${filename} (ID: ${id}, count: ${images.length})`);

            // 再度DBからロードして返す
            const updatedShots = db.prepare('SELECT position FROM imagelist WHERE hash = ? ORDER BY position ASC').all(hash);
            const list = updatedShots.map(s => ({
                position: s.position,
                url: `/api/video/${id}/imagelist/image?t=${s.position}`
            }));
            res.json(list);
        } finally {
            req.off('close', handleClientClose);
            // 進捗管理オブジェクトをクリア
            delete activeGenerations[id];
        }

    } catch (err) {
        logger.error('イメージリスト取得エラー', err, filename);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
};

const cancelVideoImageList = (req, res) => {
    const { id } = req.params;
    const gen = activeGenerations[id];
    if (!gen || !gen.controller) {
        return res.status(404).json({ error: '生成中のイメージリストが見つかりません' });
    }
    gen.controller.abort();
    console.log(`[ImageList] user cancel...: ID ${id}`);
    res.json({ success: true });
};

const getVideoImageListProgress = (req, res) => {
    const { id } = req.params;
    const gen = activeGenerations[id];
    if (!gen) {
        return res.json({ progress: 0 });
    }
    const progress = gen.total > 0 ? Math.round((gen.processed / gen.total) * 100) : 0;
    res.json({ progress });
};

const getVideoImageFromList = (req, res) => {
    const { id } = req.params;
    const { t } = req.query;
    let video;
    try {
        video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
        if (!video) return res.status(404).json({ error: 'Video not found' });

        const position = parseFloat(t);
        if (isNaN(position)) return res.status(400).json({ error: 'Invalid position' });

        const shot = db.prepare('SELECT image_data FROM imagelist WHERE hash = ? AND position = ?').get(video.hash, position);
        if (!shot) return res.status(404).json({ error: 'Image not found' });

        res.set('Content-Type', 'image/webp');
        res.send(shot.image_data);
    } catch (err) {
        logger.error('イメージリストからの画像取得エラー', err, video?.filename);
        res.status(500).json({ error: err.message });
    }
};

const openVideoFolder = (req, res) => {
    if (process.platform !== 'win32') {
        return res.status(400).json({ error: 'Windows OS以外ではこの機能を利用できません' });
    }
    const { id } = req.params;
    let video;
    try {
        video = db.prepare('SELECT path, filename FROM files WHERE id = ?').get(id);
        if (!video) return res.status(404).json({ error: '動画が見つかりません' });

        if (!fs.existsSync(video.path)) {
            return res.status(404).json({ error: '動画ファイルがディスク上に存在しません' });
        }

        const { exec } = require('child_process');
        // パスをダブルクォーテーションで囲む
        exec(`explorer.exe /select,"${video.path}"`);
        res.json({ success: true });
    } catch (err) {
        logger.error('フォルダーが開けません。', err, video?.filename);
        res.status(500).json({ error: err.message });
    }
};

const openVideoApp = (req, res) => {
    if (process.platform !== 'win32') {
        return res.status(400).json({ error: 'Windows OS以外ではこの機能を利用できません' });
    }
    const { id } = req.params;
    let video;
    try {
        video = db.prepare('SELECT path, filename FROM files WHERE id = ?').get(id);
        if (!video) return res.status(404).json({ error: '動画が見つかりません' });

        if (!fs.existsSync(video.path)) {
            return res.status(404).json({ error: '動画ファイルがディスク上に存在しません' });
        }

        const { exec } = require('child_process');
        // パスをダブルクォーテーションで囲む
        exec(`start "" "${video.path}"`);
        res.json({ success: true });
    } catch (err) {
        logger.error('アプリの起動に失敗しました。', err, video?.filename);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {

    getSettings,
    updateScanSettings,
    scanVideos: (req, res) => scanner.scan(req, res), // Delegate
    getVideos: (req, res) => videoService.getVideos(req, res), // Delegate
    getVideoCount: (req, res) => videoService.getVideoCount(req, res), // Delegate
    getVideo: (req, res) => videoService.getVideo(req, res), // Delegate
    getThumbnail: (req, res) => videoService.getThumbnail(req, res), // Delegate
    streamVideo: (req, res) => videoService.streamVideo(req, res), // Delegate
    getTags,
    createTag,
    updateTags,
    addTagToVideo: (req, res) => videoService.addTagToVideo(req, res), // Delegate
    removeTagFromVideo: (req, res) => videoService.removeTagFromVideo(req, res), // Delegate

    updateVideoDisplayName: (req, res) => videoService.updateVideoDisplayName(req, res), // Delegate
    updateTranscodeSettings: (req, res) => videoService.updateTranscodeSettings(req, res), // Delegate
    incrementPlayCount: (req, res) => videoService.incrementPlayCount(req, res), // Delegate
    updateVideoLastPos: (req, res) => videoService.updateVideoLastPos(req, res), // Delegate

    captureScreenshot,
    getScreenshots,
    getScreenshotImage: (req, res) => videoService.getScreenshotImage(req, res), // Delegate
    getPreviewFrame,
    deleteScreenshot,
    setThumbnailFromScreenshot,
    setThumbnailFromTimestamp,
    getScreenshotGallery,
    cleanupMetadata,
    getUnreferencedMetadataCount,
    renameTag,
    saveSearchHistory: (q) => { }, // Noop
    getServerInfo,
    getVideoProbeInfo,
    listDirectory,
    resolvePath,
    getVideoCountsByMonth: (req, res) => videoService.getVideoCountsByMonth(req, res),
    getFolderTree: (req, res) => videoService.getFolderTree(req, res),
    getFolders: (req, res) => videoService.getFolders(req, res),
    getScanProgress: (req, res) => res.json(scanner.getProgress()),
    cancelScan: (req, res) => scanner.cancelScan(req, res),
    updateNetworkSettings,
    getVideoImageList,
    getVideoImageFromList,
    getVideoImageListProgress,
    cancelVideoImageList,
    openVideoFolder,
    openVideoApp,
    getSubtitle: (req, res) => videoService.getSubtitle(req, res)
};
