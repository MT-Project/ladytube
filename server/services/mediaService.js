const { spawn } = require('child_process');
const ffmpegPath = 'ffmpeg';
const ffprobePath = 'ffprobe';
const path = require('path');
const sharp = require('sharp');
const logger = require('../logger');

class MediaService {

    /**
     * Gets the duration of a video file in seconds.
     * @param {string} filePath 
     * @param {AbortSignal} [signal]
     * @returns {Promise<number|null>} Duration in seconds, or null if failed.
     */
    async getVideoDuration(filePath, signal) {
        return new Promise((resolve) => {
            const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                filePath
            ], {
                signal,
                timeout: 10000,
                killSignal: 'SIGKILL'
            });

            let resolved = false;
            let output = '';
            ffprobe.stdout?.on('data', (data) => output += data.toString());

            ffprobe.on('close', (code) => {
                if (resolved) return;
                resolved = true;
                const duration = parseFloat(output.trim());
                resolve(isNaN(duration) ? null : duration);
            });

            ffprobe.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    if (err.code === 'ETIMEDOUT') {
                        logger.warn('再生時間取得タイムアウト', err, path.basename(filePath));
                    } else if (err.name === 'AbortError') {
                        console.log(`${path.basename(filePath)} の解析を中断`);
                    } else {
                        logger.error('解析エラー', err, path.basename(filePath));
                    }
                    resolve(null);
                }
            });
        });
    }

    /**
     * Captures a frame from a video at a specific timestamp.
     * Resizes to height 360px and converts to WebP (quality 80).
     * @param {string} filePath 
     * @param {number} timestamp 
     * @param {AbortSignal} [signal]
     * @param {object} [options]
     * @param {boolean} [options.fast] When true, passes '-discard nokey' to ffmpeg for faster seeking.
     * @returns {Promise<Buffer|null>} The image buffer, or null if failed.
     */
    // 表示アスペクト比を考慮した画像を取得する。
    // scale=-1:360 だけだと表示アスペクト比が考慮されず、横方向が潰れることがある。
    async captureFrame(filePath, timestamp, signal, options = {}) {
        return new Promise((resolve) => {
            const chunks = [];
            const args = ['-loglevel', 'error'];

            if (options?.fast) {
                args.push('-discard', 'nokey');
            }

            args.push(
                '-ss', timestamp.toString(),
                '-i', filePath,
                '-vf', 'scale=iw*sar:ih,scale=-1:360',
                '-frames:v', '1',
                '-f', 'image2',
                '-c:v', 'png',
                'pipe:1'
            );
            const ffmpeg = spawn(ffmpegPath, args, {
                signal,
                timeout: 10000,
                killSignal: 'SIGKILL'
            });

            let resolved = false;

            ffmpeg.stdout?.on('data', chunk => chunks.push(chunk));
            ffmpeg.stderr?.on('data', (data) => {
                // console.error(`ffmpeg stderr: ${data}`);
            });

            ffmpeg.on('close', async (code) => {
                if (resolved) return;
                resolved = true;

                if (code === 0) {
                    const buffer = Buffer.concat(chunks);
                    if (buffer.length === 0) {
                        logger.error('画像処理エラー', new Error('Empty output'), path.basename(filePath));
                        return resolve(null);
                    }

                    try {
                        const processedBuffer = await sharp(buffer)
                            .webp({ quality: 80 })
                            .toBuffer();
                        resolve(processedBuffer);
                    } catch (err) {
                        logger.error('画像処理エラー', err, path.basename(filePath));
                        resolve(null);
                    }
                } else {
                    if (code === null) {
                        // Likely killed by signal or timeout
                    } else {
                        logger.error('画像取得エラー', new Error(`code: ${code}`), path.basename(filePath));
                    }
                    resolve(null);
                }
            });

            ffmpeg.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    if (err.code === 'ETIMEDOUT') {
                        logger.warn('画像取得タイムアウト', err, path.basename(filePath));
                    } else if (err.name === 'AbortError') {
                        console.log(`${path.basename(filePath)} の解析を中断`);
                    } else {
                        logger.error('画像取得エラー', err, path.basename(filePath));
                    }
                    resolve(null);
                }
            });
        });
    }

    /**
     * Gets detailed format information using ffprobe.
     * @param {string} filePath 
     * @param {AbortSignal} [signal]
     * @returns {Promise<object|null>} The JSON output from ffprobe, or null if failed.
     */
    async getProbeInfo(filePath, signal) {
        return new Promise((resolve) => {
            const ffprobe = spawn(ffprobePath, [
                '-v', 'error',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                filePath
            ], {
                signal,
                timeout: 10000,
                killSignal: 'SIGKILL'
            });

            let resolved = false;
            let output = '';
            ffprobe.stdout?.on('data', (data) => output += data.toString());

            ffprobe.on('close', (code) => {
                if (resolved) return;
                resolved = true;
                try {
                    const data = JSON.parse(output);
                    resolve(data);
                } catch (e) {
                    if (code !== 0) {
                        // Likely aborted or error already logged
                    } else {
                        logger.error('動画情報取得失敗', e, path.basename(filePath));
                    }
                    resolve(null);
                }
            });

            ffprobe.on('error', (err) => {
                if (!resolved) {
                    resolved = true;
                    if (err.code === 'ETIMEDOUT') {
                        logger.warn('動画情報取得タイムアウト', err, path.basename(filePath));
                    } else if (err.name === 'AbortError') {
                        console.log(`${path.basename(filePath)} の解析を中断`);
                    } else {
                        logger.error('動画情報取得エラー', err, path.basename(filePath));
                    }
                    resolve(null);
                }
            });
        });
    }

    /**
     * Captures multiple frames from a video at a regular interval.
     * Uses ffmpeg's fps filter to output webp images into stdout.
     * Parses the stdout stream to split into individual WebP buffers.
     * @param {string} filePath 
     * @param {number} interval 
     * @param {function(number):void} [onProgress] - Called with current image count each time an image is extracted.
     * @param {AbortSignal} [signal]
     * @returns {Promise<Buffer[]>} Array of image buffers.
     */
    async captureFrameList(filePath, interval, onProgress, signal) {
        return new Promise((resolve) => {
            const ffmpeg = spawn(ffmpegPath, [
                '-loglevel', 'error',
                '-discard', 'nokey',
                '-i', filePath,
                '-vf', `fps=1/${interval},scale=iw*sar:ih,scale=-1:180`,
                '-f', 'image2pipe',
                '-c:v', 'libwebp',
                //'-quality', '50',
                'pipe:1'
            ], { signal });

            const chunks = [];
            const images = [];
            let resolved = false;
            // アダプティブタイムアウト: 進捗があるたびにリセット。初回は60秒、以降は30秒。
            const INITIAL_TIMEOUT_MS = 60000;
            const PROGRESS_TIMEOUT_MS = 30000;
            let timeoutMs = INITIAL_TIMEOUT_MS;

            const resetTimeout = () => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                timeoutHandle = setTimeout(() => {
                    if (!resolved) {
                        logger.warn('画像リスト取得タイムアウト', new Error(`${images.length} 枚取得済み`), path.basename(filePath));
                        ffmpeg.kill('SIGKILL');
                        resolved = true;
                        resolve({ images, timedOut: true, cancelled: false });
                    }
                }, timeoutMs);
                // 最初の画像が届いたら以降のタイムアウトは短く
                timeoutMs = PROGRESS_TIMEOUT_MS;
            };

            let timeoutHandle = null;
            resetTimeout();

            ffmpeg.stdout?.on('data', chunk => {
                chunks.push(chunk);
                const buffer = Buffer.concat(chunks);

                let processedLength = 0;
                while (buffer.length - processedLength >= 12) {
                    const startIdx = processedLength;
                    if (buffer.toString('ascii', startIdx, startIdx + 4) !== 'RIFF' ||
                        buffer.toString('ascii', startIdx + 8, startIdx + 12) !== 'WEBP') {
                        // RIFF/WEBP が一致しない場合はストリームが破損しているとみなして中断
                        break;
                    }
                    const size = buffer.readUInt32LE(startIdx + 4);
                    const webpSize = size + 8;
                    if (buffer.length - startIdx < webpSize) {
                        break;
                    }
                    const webpBuffer = buffer.subarray(startIdx, startIdx + webpSize);
                    const newBuf = Buffer.alloc(webpSize);
                    webpBuffer.copy(newBuf);
                    images.push(newBuf);
                    // 画像が届くたびにタイムアウトをリセット
                    resetTimeout();
                    if (onProgress) onProgress(images.length);
                    processedLength += webpSize;
                }

                if (processedLength > 0) {
                    const remaining = buffer.subarray(processedLength);
                    chunks.length = 0;
                    if (remaining.length > 0) {
                        chunks.push(remaining);
                    }
                }
            });

            ffmpeg.on('close', (code) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (resolved) return;
                resolved = true;

                if (code === 0 || code === null) {
                    resolve({ images, timedOut: false, cancelled: false });
                } else {
                    logger.error('画像リスト取得エラー', new Error(`code: ${code}`), path.basename(filePath));
                    resolve({ images: [], timedOut: false, cancelled: false });
                }
            });

            ffmpeg.on('error', (err) => {
                if (timeoutHandle) clearTimeout(timeoutHandle);
                if (!resolved) {
                    resolved = true;
                    if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
                        // signal による中断は正常なキャンセル
                        resolve({ images, timedOut: false, cancelled: true });
                    } else {
                        logger.error('画像リスト取得エラー', err, path.basename(filePath));
                        resolve({ images: [], timedOut: false, cancelled: false });
                    }
                }
            });
        });
    }
}

module.exports = new MediaService();
