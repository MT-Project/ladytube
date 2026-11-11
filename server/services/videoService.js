const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const db = require('../db');
const { VIDEO_EXTENSIONS, NATIVE_EXTENSIONS } = require('../constants');
const logger = require('../logger');

class VideoService {
    // LadyTube: 一覧と件数は拡張の検索で返す (server/ext/routes/search.js)。
    //   項目検索 (@maker:"X" など)・表示動画名の照合・拡張のソート・品番でまとめる (group=1) を扱う。
    //   本体の buildSearchQuery は削除した。本体の検索仕様 (キーワードの ! - ~ > < OR、path、
    //   history_desc の未再生除外) は server/ext/routes/fullsearch.js に同じものがある。
    getVideos(req, res) {
        return require('../ext/routes/search').videos(req, res);
    }

    getVideoCount(req, res) {
        return require('../ext/routes/search').count(req, res);
    }

    getVideo(req, res) {
        const { id } = req.params;
        try {
            const video = db.prepare(`
                SELECT 
                    f.id, f.path, f.filename, f.size, f.updated_at,
                    m.hash, m.duration, (m.thumbnail IS NOT NULL) AS has_thumbnail, LENGTH(m.thumbnail) as thumbnail_size, m.play_count, m.tags, m.last_played_at, m.created_at, m.use_transcode, m.display_name, m.last_pos,
                    e.display_name AS ext_display_name
                FROM files f
                JOIN metadata m ON f.hash = m.hash
                LEFT JOIN ext_video_meta e ON e.hash = f.hash   -- LadyTube: 表示動画名 (画面が ext_display_name で出す)
                WHERE f.id = ?
            `).get(id);

            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            const neigborsTable = `
                SELECT f.id, f.path, f.filename, (m.thumbnail IS NOT NULL) AS has_thumbnail, LENGTH(m.thumbnail) as thumbnail_size, m.duration, m.tags, m.display_name, m.last_pos, m.use_transcode,
                    e.display_name AS ext_display_name
                FROM files f
                JOIN metadata m ON f.hash = m.hash
                LEFT JOIN ext_video_meta e ON e.hash = f.hash   -- LadyTube: 表示動画名
            `;

            const neighborsBefore = db.prepare(neigborsTable + `
                WHERE f.path < ?
                ORDER BY f.path DESC
                LIMIT 6
            `).all(video.path).reverse();

            const neighborsAfter = db.prepare(neigborsTable + `
                WHERE f.path > ?
                ORDER BY f.path ASC
                LIMIT 6
            `).all(video.path);

            const neighbors = [...neighborsBefore, ...neighborsAfter];
            const nextVideoId = neighborsAfter.length > 0 ? neighborsAfter[0].id : null;

            // Remove Base64 thumbnail generation for neighbors
            res.json({
                video,
                relatedVideos: neighbors,
                nextVideoId
            });
        } catch (err) {
            logger.error("動画取得エラー", err);
            res.status(500).json({ error: err.message });
        }
    }

    streamVideo(req, res) {
        const { id } = req.params;
        const stmt = db.prepare('SELECT f.path, f.filename, m.hash, m.use_transcode FROM files f JOIN metadata m ON f.hash = m.hash WHERE f.id = ?');
        const video = stmt.get(id);

        if (!video || !fs.existsSync(video.path)) {
            return res.status(404).send('Video not found');
        }

        const videoPath = video.path;
        const ext = path.extname(videoPath).toLowerCase();
        const useTranscode = video.use_transcode;

        if (useTranscode === 0 || (useTranscode !== 1 && NATIVE_EXTENSIONS[ext])) {
            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;
            const contentType = VIDEO_EXTENSIONS[ext] || 'video/mp4';

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(videoPath, { start, end });
                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': contentType,
                };
                res.writeHead(206, head);
                file.pipe(res);

                req.on('close', () => {
                    file.destroy();
                });
                file.on('error', (err) => {
                    logger.error('ビデオ送信エラー', err, video.filename);
                    if (!res.headersSent) res.status(500).end();
                    file.destroy();
                });
            } else {
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                };
                res.writeHead(200, head);
                const file = fs.createReadStream(videoPath);
                file.pipe(res);

                req.on('close', () => {
                    file.destroy();
                });
                file.on('error', (err) => {
                    logger.error('ビデオ送信エラー', err, video.filename);
                    if (!res.headersSent) res.status(500).end();
                    file.destroy();
                });
            }
        } else {
            // Transcoding logic would go here, simplified for this extraction to avoid spawn clutter if not needed, 
            // but for full feature parity reusing the spawn logic is best.
            // Since the original code had extensive transcoding logic, we should probably keep it or move it to a helper.
            // For now, I'll assume we keep it inline or import a helper if it gets too complex.
            // ... (Insert transcoding logic from original routes.js here)
            // For brevity in this artifact, I will just call the handler in routes.js or assume it's moved fully.
            // NOTE: To ensure full functionality, I will place the full transcoding logic here.

            const startTime = req.query.t || 0;
            const duration = req.query.d; // Duration in seconds
            const qParam = parseInt(req.query.q, 10) || 5;
            const useHwAccel = req.query.hw === '1';

            //console.log(`Transcoding ${video.filename} to mp4 starting at ${startTime}s ${duration ? `(len: ${duration}s)` : ''} (Quality Level: ${qParam}, HW Accel: ${useHwAccel})...`);

            res.writeHead(200, {
                'Content-Type': 'video/mp4',
            });

            const crfMap = { 1: 30, 2: 27, 3: 23, 4: 19, 5: 16 };
            const resolutionMap = { 1: 480, 2: 540, 3: 720, 4: 1080, 5: null };

            const crf = crfMap[qParam] || 23;
            const targetHeight = resolutionMap[qParam];

            const args = [];
            if (useHwAccel) {
                args.push('-hwaccel', 'auto');
            }

            // Input seeking (-ss before -i) is much faster
            args.push(
                '-ss', startTime.toString(),
                '-i', videoPath
            );

            if (duration) {
                args.push('-t', duration.toString());
            }

            args.push(
                '-f', 'mp4',
                '-c:v', 'libx264',
                '-c:a', 'aac',
                '-af', 'aresample=async=1:min_hard_comp=0.01:first_pts=0', // More aggressive sync
                '-g', '60', // 2s GOP for moderate seek granularity
                '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                '-avoid_negative_ts', 'make_zero',
                '-profile:v', 'baseline',
                '-level', '3.0',
                '-preset', 'ultrafast',
                '-crf', crf.toString(),
                '-pix_fmt', 'yuv420p'
            );

            if (targetHeight) {
                args.push('-vf', `scale=-2:${targetHeight}`);
            }

            args.push('pipe:1');

            const ffmpegPath = 'ffmpeg';
            const { spawn } = require('child_process');
            const ffmpeg = spawn(ffmpegPath, args);

            ffmpeg.stdout.pipe(res);

            ffmpeg.stderr.on('data', (data) => {
                // console.log(`ffmpeg stderr: ${data}`); // Optional logging
            });

            let isFinished = false;
            ffmpeg.on('close', () => {
                isFinished = true;
            });

            ffmpeg.on('error', (err) => {
                logger.error('ビデオ送信エラー (transcode)', err, video.filename);
                if (!res.headersSent) res.status(500).end();
            });

            ffmpeg.stdout.on('error', (err) => {
                logger.error('ビデオ送信エラー (transcode)', err, video.filename);
            });

            res.on('error', (err) => {
                logger.error('ビデオ送信エラー (transcode)', err, video.filename);
                if (!isFinished) ffmpeg.kill('SIGKILL');
            });

            req.on('close', () => {
                if (!isFinished) ffmpeg.kill('SIGKILL');
            });
        }
    }

    async getPreviewFrame(req, res) {
        const { id } = req.params;
        const timestamp = req.query.t;

        if (timestamp === undefined) {
            return res.status(400).send('Missing timestamp');
        }

        try {
            const video = db.prepare('SELECT f.path, f.filename FROM files f WHERE f.id = ?').get(id);
            if (!video) return res.status(404).send('Video not found');

            const videoPath = video.path;
            const ffmpegPath = 'ffmpeg';
            const { spawn } = require('child_process');

            // 表示アスペクト比を考慮した画像を取得する。
            // scale=-1:360 だけだと表示アスペクト比が考慮されず、横方向が潰れることがある。
            const args = [
                '-ss', timestamp.toString(),
                '-i', videoPath,
                '-vf', 'scale=iw*sar:ih,scale=-1:180', // Small height for preview
                '-frames:v', '1',
                '-f', 'image2',
                '-c:v', 'mjpeg',
                '-q:v', '5', // Quality ~75
                'pipe:1'
            ];

            const ffmpeg = spawn(ffmpegPath, args);

            res.writeHead(200, { 'Content-Type': 'image/jpeg' });
            ffmpeg.stdout.pipe(res);

            ffmpeg.stderr.on('data', () => { }); // Consume stderr to prevent blocking

            let isFinished = false;
            ffmpeg.on('close', () => {
                isFinished = true;
            });

            ffmpeg.on('error', (err) => {
                logger.error('プレビュー生成エラー', err, video.filename);
                if (!res.headersSent) res.status(500).end();
            });

            ffmpeg.stdout.on('error', (err) => {
                logger.error('プレビュー生成エラー', err, video.filename);
            });

            res.on('error', (err) => {
                logger.error('プレビュー生成エラー', err, video.filename);
                if (!isFinished) ffmpeg.kill('SIGKILL');
            });

            req.on('close', () => {
                if (!isFinished) ffmpeg.kill('SIGKILL');
            });

        } catch (err) {
            logger.error('プレビュー生成エラー', err, video?.filename);
            if (!res.headersSent) res.status(500).send(err.message);
        }
    }

    addTagToVideo(req, res) {
        const { id } = req.params;
        const { tag } = req.body;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            const hash = video.hash;
            const meta = db.prepare('SELECT tags FROM metadata WHERE hash = ?').get(hash);

            let tags = meta.tags ? meta.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
            if (!tags.includes(tag.trim())) {
                tags.push(tag.trim());
                const newTags = tags.length > 0 ? '\n' + tags.join('\n') + '\n' : null;
                db.prepare('UPDATE metadata SET tags = ? WHERE hash = ?').run(newTags, hash);
            }
            res.json({ success: true, tags });
        } catch (err) {
            logger.error('タグ追加エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }

    removeTagFromVideo(req, res) {
        const { id } = req.params;
        const { tag } = req.body;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            const hash = video.hash;
            const meta = db.prepare('SELECT tags FROM metadata WHERE hash = ?').get(hash);

            let tags = meta.tags ? meta.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
            const cleanTag = tag.trim();
            if (tags.includes(cleanTag)) {
                tags = tags.filter(t => t !== cleanTag);
                const newTags = tags.length > 0 ? '\n' + tags.join('\n') + '\n' : null;
                db.prepare('UPDATE metadata SET tags = ? WHERE hash = ?').run(newTags, hash);
            }
            res.json({ success: true, tags });
        } catch (err) {
            logger.error('タグ削除エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }



    updateVideoDisplayName(req, res) {
        const { id } = req.params;
        const { display_name } = req.body;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            db.prepare('UPDATE metadata SET display_name = ? WHERE hash = ?').run(display_name, video.hash);
            res.json({ success: true });
        } catch (err) {
            logger.error('追加名更新エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }

    updateTranscodeSettings(req, res) {
        const { id } = req.params;
        const { use_transcode } = req.body;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            db.prepare('UPDATE metadata SET use_transcode = ? WHERE hash = ?').run(use_transcode, video.hash);
            res.json({ success: true });
        } catch (err) {
            logger.error('トランスコード設定更新エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }

    incrementPlayCount(req, res) {
        const { id } = req.params;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            db.prepare('UPDATE metadata SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE hash = ?').run(video.hash);
            res.json({ success: true });
        } catch (err) {
            logger.error('再生回数加算エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }



    updateVideoLastPos(req, res) {
        const { id } = req.params;
        const { pos } = req.body;
        try {
            const video = db.prepare('SELECT hash, filename FROM files WHERE id = ?').get(id);
            if (!video) return res.status(404).json({ error: '動画が見つかりません' });

            db.prepare('UPDATE metadata SET last_pos = ? WHERE hash = ?').run(pos || 0, video.hash);
            res.json({ success: true });
        } catch (err) {
            logger.error('再生位置更新エラー', err, video.filename);
            res.status(500).json({ error: err.message });
        }
    }

    getThumbnail(req, res) {
        const { id } = req.params;
        try {
            const row = db.prepare(`
                SELECT m.thumbnail, LENGTH(m.thumbnail) as size, f.filename
                FROM files f
                JOIN metadata m ON f.hash = m.hash
                WHERE f.id = ?
            `).get(id);

            if (!row || !row.thumbnail) {
                return res.status(404).send('No thumbnail');
            }

            const etag = `W/"${row.size}"`;
            res.set('ETag', etag);
            res.set('Cache-Control', 'no-cache');

            if (req.headers['if-none-match'] === etag) {
                return res.status(304).end();
            }

            // Detect mime type
            const isPng = row.thumbnail[0] === 0x89;
            const isJpeg = row.thumbnail[0] === 0xFF && row.thumbnail[1] === 0xD8;
            const mime = isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : 'image/webp');

            res.set('Content-Type', mime);
            res.send(row.thumbnail);
        } catch (err) {
            logger.error("サムネイル取得エラー", err, row?.filename);
            res.status(500).send(err.message);
        }
    }

    getScreenshotImage(req, res) {
        const { id } = req.params;
        try {
            const row = db.prepare('SELECT image_data FROM screenshots WHERE id = ?').get(id);
            if (!row || !row.image_data) {
                return res.status(404).send('No screenshot');
            }

            // Detect mime type
            const isPng = row.image_data[0] === 0x89;
            const isJpeg = row.image_data[0] === 0xFF && row.image_data[1] === 0xD8;
            const mime = isPng ? 'image/png' : (isJpeg ? 'image/jpeg' : 'image/webp');

            res.set('Content-Type', mime);
            res.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
            res.send(row.image_data);
        } catch (err) {
            logger.error("スクリーンショット画像取得エラー", err);
            res.status(500).send(err.message);
        }
    }


    getVideoCountsByMonth(req, res) {
        try {
            const query = `
                SELECT 
                    strftime('%Y', updated_at) as year, 
                    strftime('%m', updated_at) as month, 
                    COUNT(*) as count 
                FROM files 
                GROUP BY year, month 
                HAVING count > 0 
                ORDER BY year DESC, month ASC
            `;
            const rows = db.prepare(query).all();
            res.json(rows);
        } catch (err) {
            logger.error("月別動画数取得エラー", err);
            res.status(500).json({ error: err.message });
        }
    }

    async getSubtitle(req, res) {
        const { id } = req.params;

        try {
            const video = db.prepare('SELECT f.path, f.filename FROM files f WHERE f.id = ?').get(id);
            if (!video) return res.status(404).send('Video not found');

            const videoPath = video.path;
            const base = videoPath.replace(/\.[^.]+$/, '');

            // 優先順位: .ass > .vtt > .srt
            const candidates = [
                { path: base + '.ass', format: 'ass' },
                { path: base + '.vtt', format: 'vtt' },
                { path: base + '.srt', format: 'srt' },
            ];

            const found = candidates.find(c => fs.existsSync(c.path));

            if (found) {
                console.log(`[Subtitle] 外部字幕を送信 (${found.format}): ${found.path}`);
                res.set('Content-Type', 'text/x-ass; charset=utf-8');
                res.set('Cache-Control', 'no-cache');
                if (found.format === 'ass') {
                    const stream = fs.createReadStream(found.path);
                    stream.pipe(res);
                    stream.on('error', (err) => {
                        logger.error('字幕ストリームエラー', err, video.filename);
                        if (!res.headersSent) res.status(500).end();
                    });
                    req.on('close', () => stream.destroy());
                    return;
                }

                // VTT / SRT → FFmpeg で ass に変換して送信
                const ffmpeg = spawn('ffmpeg', [
                    '-i', found.path,
                    '-f', 'ass',
                    'pipe:1'
                ]);

                ffmpeg.stdout.pipe(res);
                ffmpeg.stderr.on('data', () => { });
                ffmpeg.on('error', (err) => {
                    logger.error('字幕変換エラー', err, video.filename);
                    if (!res.headersSent) res.status(500).end();
                });
                req.on('close', () => ffmpeg.kill('SIGKILL'));
                return;
            }

            // --- 内蔵字幕フォールバック ---
            // ffprobe で字幕ストリームの有無を確認 (全動画拡張子対象)
            let isAborted = false;
            let currentProcess = null;

            const onClose = () => {
                isAborted = true;
                if (currentProcess) {
                    try {
                        currentProcess.kill('SIGKILL');
                    } catch (e) { }
                }
            };
            req.on('close', onClose);

            let isFfprobeTimedOut = false;
            const subtitleStreamIndex = await new Promise((resolve) => {
                const ffprobe = spawn('ffprobe', [
                    '-v', 'error',
                    '-print_format', 'json',
                    '-show_streams',
                    '-select_streams', 's',
                    videoPath
                ], { timeout: 10000, killSignal: 'SIGKILL' });
                currentProcess = ffprobe;

                let output = '';
                ffprobe.stdout.on('data', (data) => output += data.toString());
                ffprobe.stderr.on('data', () => { });

                ffprobe.on('error', (err) => {
                    if (err.code === 'ETIMEDOUT' || ffprobe.killed) {
                        isFfprobeTimedOut = true;
                    }
                    if (currentProcess === ffprobe) currentProcess = null;
                    resolve(null);
                });

                ffprobe.on('close', (code, signal) => {
                    if (currentProcess === ffprobe) currentProcess = null;
                    if (signal === 'SIGKILL' || signal === 'SIGTERM' || ffprobe.killed || isFfprobeTimedOut) {
                        isFfprobeTimedOut = true;
                        return resolve(null);
                    }
                    try {
                        const data = JSON.parse(output);
                        if (data.streams && data.streams.length > 0) {
                            resolve(data.streams[0].index);
                        } else {
                            resolve(null);
                        }
                    } catch {
                        resolve(null);
                    }
                });
            });

            if (isFfprobeTimedOut) {
                logger.error('字幕の取得がタイムアウトしました。', new Error('ffprobe timed out'), video.filename);
                req.off('close', onClose);
                if (!res.headersSent) {
                    return res.status(500).send('字幕の取得がタイムアウトしました。');
                }
                return;
            }

            if (isAborted || req.destroyed) {
                req.off('close', onClose);
                return;
            }

            if (subtitleStreamIndex === null) {
                req.off('close', onClose);
                return res.status(404).send('Subtitle not found');
            }

            console.log(`[Subtitle] 内蔵字幕を抽出 (ASS): ${videoPath} (stream index: ${subtitleStreamIndex})`);

            // ffmpeg で内蔵字幕ストリームを ass に変換 (完了後にレスポンスを送信)
            let isFfmpegTimedOut = false;
            const subtitleData = await new Promise((resolve) => {
                const ffmpeg = spawn('ffmpeg', [
                    '-fix_sub_duration',
                    '-i', videoPath,
                    '-map', `0:${subtitleStreamIndex}`,
                    '-f', 'ass',
                    'pipe:1'
                ], { timeout: 10000, killSignal: 'SIGKILL' });
                currentProcess = ffmpeg;

                let content = '';
                ffmpeg.stdout.on('data', (data) => content += data.toString());
                ffmpeg.stderr.on('data', () => { });

                ffmpeg.on('error', (err) => {
                    if (err.code === 'ETIMEDOUT' || ffmpeg.killed) {
                        isFfmpegTimedOut = true;
                    }
                    if (currentProcess === ffmpeg) currentProcess = null;
                    resolve(null);
                });

                ffmpeg.on('close', (code, signal) => {
                    if (currentProcess === ffmpeg) currentProcess = null;
                    if (signal === 'SIGKILL' || signal === 'SIGTERM' || ffmpeg.killed || isFfmpegTimedOut) {
                        isFfmpegTimedOut = true;
                        return resolve(null);
                    }
                    if (code === 0) {
                        resolve(content);
                    } else {
                        resolve(null);
                    }
                });
            });

            req.off('close', onClose);

            if (isFfmpegTimedOut) {
                logger.error('字幕の取得がタイムアウトしました。', new Error('ffmpeg timed out'), video.filename);
                if (!res.headersSent) {
                    return res.status(500).send('字幕の取得がタイムアウトしました。');
                }
                return;
            }

            if (subtitleData === null) {
                if (!res.headersSent) {
                    return res.status(500).send('字幕取得エラー:字幕の抽出に失敗しました');
                }
                return;
            }

            res.set('Content-Type', 'text/x-ass; charset=utf-8');
            res.set('Cache-Control', 'no-cache');
            return res.send(subtitleData);

        } catch (err) {
            logger.error('字幕取得エラー', err, video?.filename);
            if (!res.headersSent) res.status(500).send(err.message);
        }

    }


    getFolderTree(req, res) {
        const { parentPath = "" } = req.query;
        try {
            if (!parentPath) {
                // Get root folders from settings
                const row = db.prepare("SELECT value FROM settings WHERE key = 'scan_folders'").get();
                if (!row) return res.json([]);
                const folders = JSON.parse(row.value);

                const results = folders.map(f => {
                    const prefix = f.endsWith(path.sep) ? f : f + path.sep;
                    const countRow = db.prepare("SELECT count(*) as count FROM files WHERE path LIKE ?").get(prefix + '%');
                    const hasSubRow = db.prepare("SELECT count(*) as count FROM files WHERE path LIKE ?").get(prefix + '%' + path.sep + '%');

                    return {
                        name: f,
                        path: f,
                        count: countRow ? countRow.count : 0,
                        hasChildren: hasSubRow && hasSubRow.count > 0
                    };
                }).filter(r => r.count > 0);

                return res.json(results);
            } else {
                // Get subfolders of parentPath
                const sep = path.sep;
                const prefix = parentPath.endsWith(sep) ? parentPath : parentPath + sep;
                const prefixLen = prefix.length;

                // Use SQLite string functions to find the next directory level
                // INSTR returns 1-based index, or 0 if not found
                const query = `
                    SELECT 
                        SUBSTR(path, ${prefixLen + 1}, INSTR(SUBSTR(path, ${prefixLen + 1}), '${sep}') - 1) as subfolder,
                        COUNT(*) as count
                    FROM files
                    WHERE path LIKE ?
                    GROUP BY subfolder
                    HAVING subfolder IS NOT NULL AND subfolder != ''
                `;

                const rows = db.prepare(query).all(prefix + '%' + sep + '%');

                const results = rows.map(r => {
                    const fullPath = prefix + r.subfolder;
                    const hasSubRow = db.prepare("SELECT count(*) as count FROM files WHERE path LIKE ?").get(fullPath + sep + '%' + sep + '%');

                    return {
                        name: r.subfolder,
                        path: fullPath,
                        count: r.count,
                        hasChildren: hasSubRow && hasSubRow.count > 0
                    };
                });

                return res.json(results);
            }
        } catch (err) {
            logger.error("フォルダツリー取得エラー", err);
            res.status(500).json({ error: err.message });
        }
    }

    getFolders(req, res) {
        const { path: reqPath } = req.query;
        try {
            const sep = path.sep;
            if (!reqPath || reqPath === 'root') {
                // Get root folders from settings
                const row = db.prepare("SELECT value FROM settings WHERE key = 'scan_folders'").get();
                if (!row) return res.json([]);
                const folders = JSON.parse(row.value || '[]');

                const results = folders.map(f => {
                    const prefix = f.endsWith(sep) ? f : f + sep;
                    const countRow = db.prepare("SELECT count(*) as count FROM files WHERE path LIKE ?").get(prefix + '%');
                    return {
                        subfolder: f,
                        count: countRow ? countRow.count : 0
                    };
                });

                return res.json(results);
            } else {
                const targetPath = reqPath.endsWith(sep) ? reqPath.slice(0, -1) : reqPath;
                const query = `
                    WITH subfolders AS (
                        SELECT DISTINCT
                            RTRIM(path, REPLACE(path, ?, '')) AS subfolder
                        FROM files
                        WHERE path LIKE ?
                          AND path NOT LIKE ?
                    )
                    SELECT 
                        s.subfolder,
                        COUNT(f.path) AS count
                    FROM subfolders s
                    LEFT JOIN files f ON f.path LIKE s.subfolder || '%'
                    GROUP BY s.subfolder
                    ORDER BY s.subfolder ASC
                `;

                const param1 = sep;
                const param2 = `${targetPath}${sep}%${sep}%`;
                const param3 = `${targetPath}${sep}%${sep}%${sep}%`;

                const rows = db.prepare(query).all(param1, param2, param3);

                // 末尾のセパレータを統一（取り除くか整える）
                const results = rows.map(r => {
                    let sub = r.subfolder;
                    if (sub && sub.endsWith(sep)) {
                        sub = sub.slice(0, -1);
                    }
                    return {
                        subfolder: sub,
                        count: r.count
                    };
                });

                return res.json(results);
            }
        } catch (err) {
            logger.error("フォルダー取得エラー", err);
            res.status(500).json({ error: err.message });
        }
    }
}

module.exports = new VideoService();
