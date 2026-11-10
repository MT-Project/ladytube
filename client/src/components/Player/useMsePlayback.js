import { useState, useEffect, useRef, useCallback } from 'react';

export const useMsePlayback = ({ video, quality, hwDecode, isNative, videoElementRef, enabled = true }) => {
    const [isMseReady, setIsMseReady] = useState(false);
    const [mseUrl, setMseUrl] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const mediaSourceRef = useRef(null);
    const sourceBufferRef = useRef(null);
    const abortControllerRef = useRef(null);
    const queueRef = useRef([]);
    const isAppendingRef = useRef(false);
    const generationRef = useRef(0);

    const SEGMENT_DURATION = 30;
    const fetchLoopActiveRef = useRef(false);
    const stopFetchLoopRef = useRef(false);
    const isInternalSeekingRef = useRef(false);
    const isEndOfStreamRef = useRef(false);
    const seekFetchActiveRef = useRef(false);

    const waitForUpdate = useCallback(() => {
        return new Promise((resolve) => {
            const sb = sourceBufferRef.current;
            if (!sb || !sb.updating) return resolve();
            let timeoutId = null;
            const onEnd = () => {
                if (timeoutId) clearTimeout(timeoutId);
                sb.removeEventListener('updateend', onEnd);
                resolve();
            };
            timeoutId = setTimeout(() => {
                sb.removeEventListener('updateend', onEnd);
                resolve();
            }, 1000);
            sb.addEventListener('updateend', onEnd);
        });
    }, []);

    const cleanup = useCallback(() => {
        generationRef.current += 1;
        stopFetchLoopRef.current = true;
        if (mseUrl) {
            URL.revokeObjectURL(mseUrl);
            setMseUrl(null);
        }
        setIsMseReady(false);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        mediaSourceRef.current = null;
        sourceBufferRef.current = null;
        queueRef.current = [];
        isAppendingRef.current = false;
        fetchLoopActiveRef.current = false;
        isInternalSeekingRef.current = false;
        isEndOfStreamRef.current = false;
        seekFetchActiveRef.current = false;
        setIsLoading(false);
    }, [mseUrl]);

    const isBuffered = useCallback((time) => {
        const sb = sourceBufferRef.current;
        if (!sb) return false;
        try {
            const b = sb.buffered;
            for (let i = 0; i < b.length; i++) {
                // 最低4秒以上の余裕がある場合のみ「既にバッファされている」と判定
                if (time >= b.start(i) && time <= (b.end(i) - 4.0)) {
                    return true;
                }
            }
        } catch (e) { }
        return false;
    }, []);

    const processQueue = useCallback(async () => {
        if (!sourceBufferRef.current || isAppendingRef.current || queueRef.current.length === 0) return;

        const currentGen = generationRef.current;
        const item = queueRef.current.shift();
        if (!item) return;
        const { chunk, resolve, reject, gen } = item;

        if (gen !== currentGen) {
            resolve();
            return processQueue();
        }

        isAppendingRef.current = true;

        try {
            await waitForUpdate();
            if (!sourceBufferRef.current || gen !== generationRef.current) {
                isAppendingRef.current = false;
                resolve();
                return;
            }

            const sb = sourceBufferRef.current;
            const onUpdateEnd = () => {
                isAppendingRef.current = false;
                resolve();
                if (gen === generationRef.current) {
                    processQueue();
                }
            };
            sb.addEventListener('updateend', onUpdateEnd, { once: true });
            sb.appendBuffer(chunk);
        } catch (err) {
            isAppendingRef.current = false;
            if (err.name === 'QuotaExceededError') {
                const sb = sourceBufferRef.current;
                if (sb && !sb.updating) {
                    try {
                        const cur = videoElementRef.current?.currentTime || 0;
                        const removeEnd = Math.max(0, cur - 15);
                        if (removeEnd > 1) {
                            sb.remove(0, removeEnd);
                            await waitForUpdate();
                        } else {
                            const duration = mediaSourceRef.current?.duration || 1000000;
                            sb.remove(Math.min(cur + 60, duration - 1), duration);
                            await waitForUpdate();
                        }
                    } catch (e) { }
                    queueRef.current.unshift({ chunk, resolve, reject, gen: generationRef.current });
                    processQueue();
                    return;
                }
            }
            resolve(); // エラー時もチェーンを止めずに解決する
        }
    }, [videoElementRef, waitForUpdate]);

    const appendChunk = useCallback((chunk) => {
        return new Promise((resolve, reject) => {
            queueRef.current.push({ chunk, resolve, reject, gen: generationRef.current });
            processQueue();
        });
    }, [processQueue]);

    const fetchSegment = async (startTime) => {
        if (!video?.id || !sourceBufferRef.current || isNative) return;

        if (abortControllerRef.current) abortControllerRef.current.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsLoading(true);

        const sb = sourceBufferRef.current;
        await waitForUpdate();
        if (!sourceBufferRef.current) {
            setIsLoading(false);
            return;
        }

        const currentGen = generationRef.current;

        return new Promise(async (resolve, reject) => {
            try {
                if (sb.updating) {
                    try { sb.abort(); } catch (e) { }
                    await waitForUpdate();
                }

                if (mediaSourceRef.current?.readyState === 'open' && !sb.updating) {
                    try {
                        sb.abort(); // パーサー状態を WAITING_FOR_INIT_SEGMENT にリセット
                        await waitForUpdate();
                    } catch (e) { }
                }

                if (currentGen !== generationRef.current) {
                    resolve();
                    return;
                }

                try {
                    sb.timestampOffset = startTime;
                } catch (e) {
                    console.warn("timestampOffset set failed:", e);
                }

                const url = `/api/stream/${video.id}?t=${startTime}&d=${SEGMENT_DURATION}&q=${quality || 3}${hwDecode ? '&hw=1' : ''}`;
                const response = await fetch(url, { signal: controller.signal });

                if (!response.ok) throw new Error(`Fetch status: ${response.status}`);
                const reader = response.body.getReader();

                let firstChunkResolved = false;

                while (true) {
                    if (currentGen !== generationRef.current || stopFetchLoopRef.current) break;
                    const { done, value } = await reader.read();
                    if (done) break;

                    await appendChunk(value);

                    if (!firstChunkResolved) {
                        firstChunkResolved = true;
                        resolve();
                    }
                }
                resolve();
            } catch (err) {
                // エラー時も呼び出し元をブロックしない
                resolve();
            } finally {
                if (abortControllerRef.current === controller) {
                    abortControllerRef.current = null;
                }
                setIsLoading(false);
            }
        });
    };

    const fetchLoop = useCallback(async () => {
        if (fetchLoopActiveRef.current) return;
        fetchLoopActiveRef.current = true;
        stopFetchLoopRef.current = false;

        while (!stopFetchLoopRef.current) {
            if (!isMseReady || !videoElementRef.current || isInternalSeekingRef.current) {
                await new Promise(r => setTimeout(r, 500));
                continue;
            }

            const videoEl = videoElementRef.current;
            const cur = videoEl.currentTime;
            const sb = sourceBufferRef.current;
            const ms = mediaSourceRef.current;
            const duration = video?.duration || ms?.duration || 0;

            let bufferedEnd = 0;
            let currentRangeIndex = -1;

            if (sb) {
                try {
                    const b = sb.buffered;
                    for (let i = 0; i < b.length; i++) {
                        if (cur >= (b.start(i) - 1.0) && cur <= (b.end(i) + 0.1)) {
                            bufferedEnd = b.end(i);
                            currentRangeIndex = i;
                            break;
                        }
                    }

                    // Check for end of stream
                    if (duration > 0 && bufferedEnd >= (duration - 0.5)) {
                        if (!isEndOfStreamRef.current && ms && ms.readyState === 'open' && !sb.updating) {
                            try {
                                ms.endOfStream();
                                isEndOfStreamRef.current = true;
                            } catch (e) { }
                        }
                    } else {
                        isEndOfStreamRef.current = false;
                    }

                    if (!videoEl.paused) {
                        if (currentRangeIndex !== -1) {
                            const rangeEnd = b.end(currentRangeIndex);
                            if (Math.abs(cur - rangeEnd) < 0.15) {
                                for (let i = 0; i < b.length; i++) {
                                    if (b.start(i) > rangeEnd && (b.start(i) - rangeEnd) < 0.5) {
                                        videoEl.currentTime = b.start(i);
                                        break;
                                    }
                                }
                            }
                        } else {
                            for (let i = 0; i < b.length; i++) {
                                if (cur < b.start(i) && (b.start(i) - cur) < 0.5) {
                                    videoEl.currentTime = b.start(i);
                                    break;
                                }
                            }
                        }
                    }
                } catch (e) { }
            }

            const remaining = bufferedEnd - cur;

            const needsBuffer = bufferedEnd === 0 && currentRangeIndex === -1;
            if ((!videoEl.paused || needsBuffer) && remaining < 15 && !isInternalSeekingRef.current && !isEndOfStreamRef.current && !seekFetchActiveRef.current) {
                const overlap = bufferedEnd === 0 ? 0 : 1.0;
                const startRaw = bufferedEnd === 0 ? cur : (bufferedEnd - overlap);
                const start = Math.max(0, startRaw);

                // Only fetch if we are not already at the very end
                if (duration === 0 || start < (duration - 0.2)) {
                    try {
                        await fetchSegment(start);
                    } catch (err) { }
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }
        fetchLoopActiveRef.current = false;
    }, [isMseReady, videoElementRef, video?.id, quality, hwDecode, isNative, appendChunk]);

    const initMse = useCallback(() => {
        if (isNative || !enabled) return;

        const MediaSourceClass = typeof window !== 'undefined' && window.ManagedMediaSource
            ? window.ManagedMediaSource
            : typeof window !== 'undefined' && window.MediaSource
            ? window.MediaSource
            : null;

        if (!MediaSourceClass) {
            setError(new Error('MediaSource and ManagedMediaSource are not supported in this browser.'));
            return;
        }

        const mediaSource = new MediaSourceClass();
        mediaSourceRef.current = mediaSource;

        if (videoElementRef?.current) {
            videoElementRef.current.disableRemotePlayback = true;
        }

        const handleStartStreaming = () => {
            stopFetchLoopRef.current = false;
        };

        if (typeof window !== 'undefined' && window.ManagedMediaSource && mediaSource instanceof window.ManagedMediaSource) {
            mediaSource.addEventListener('startstreaming', handleStartStreaming);
        }

        const url = URL.createObjectURL(mediaSource);
        setMseUrl(url);

        mediaSource.addEventListener('sourceopen', () => {
            if (mediaSource.sourceBuffers.length === 0) {
                const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
                try {
                    const sb = mediaSource.addSourceBuffer(mimeCodec);
                    sb.mode = 'sequence';
                    if (video?.duration) mediaSource.duration = video.duration;
                    sourceBufferRef.current = sb;
                    setIsMseReady(true);
                } catch (e) {
                    setError(e);
                }
            }
        }, { once: true });
    }, [isNative, video, enabled, videoElementRef]);

    useEffect(() => {
        initMse();
        return cleanup;
    }, [video?.id, quality, hwDecode, isNative, enabled]);

    useEffect(() => {
        if (isMseReady) fetchLoop();
    }, [isMseReady, fetchLoop]);

    const seek = useCallback(async (time) => {
        if (!sourceBufferRef.current) return;

        if (isBuffered(time)) {
            return;
        }

        generationRef.current += 1;
        isInternalSeekingRef.current = true;
        isEndOfStreamRef.current = false;
        seekFetchActiveRef.current = true;

        try {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            queueRef.current = [];
            isAppendingRef.current = false;

            const sb = sourceBufferRef.current;
            const ms = mediaSourceRef.current;
            try {
                if (sb.updating) {
                    sb.abort();
                    await waitForUpdate();
                }
                if (ms && ms.readyState === 'ended') {
                    ms.duration = video?.duration || ms.duration || 0;
                }
                if (ms && ms.readyState === 'open' && sb.buffered.length > 0 && !sb.updating) {
                    sb.remove(0, 1000000);
                    await waitForUpdate();
                }
                if (ms && ms.readyState === 'open' && !sb.updating) {
                    sb.abort();
                    await waitForUpdate();
                }
            } catch (e) { }

            await fetchSegment(time);
        } catch (e) {
            console.warn("MSE seek encountered an error:", e);
        } finally {
            isInternalSeekingRef.current = false;
            setTimeout(() => { seekFetchActiveRef.current = false; }, 2000);
        }
    }, [video?.id, quality, hwDecode, isNative, waitForUpdate, isBuffered]);

    return { mseUrl, isMseReady, seek, isLoading, error };
};
