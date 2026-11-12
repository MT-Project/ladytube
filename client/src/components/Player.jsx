import { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback, Fragment } from 'react';
import { X, Maximize, Music } from 'lucide-react';
import { api } from '../services/api';
import { useUI } from '../contexts/UIContext';
import SettingsDialog from './Player/SettingsDialog';
import PlayerControls from './Player/PlayerControls';
import PlayerOverlay from './Player/PlayerOverlay';
import VideoRecommendation from './Player/VideoRecommendation';
import { useDraggable } from './Player/useDraggable';
import { useMsePlayback } from './Player/useMsePlayback';
import { FrameStep } from './ExtWatchParts';
import { css } from '@linaria/core';
import { theme } from '../theme';
import ASS from 'assjs';

const styles = {
    container: css`
        position: relative;
        background-color: black;
        width: 100%;
        height: 100%;
        overflow: hidden;
        display: var(--display, flex);
        align-items: var(--align-items, center);
        justify-content: var(--justify-content, center);
        z-index: var(--z-index, 50);
        cursor: var(--cursor, auto);
        -webkit-tap-highlight-color: transparent;
        -webkit-user-select: none;
        user-select: none;

        &.embedded {
            z-index: 5;
            -webkit-transform: translateZ(0);
        }
        &.fullscreen {
            position: fixed;
            inset: 0;
        }
        &.page-fullscreen {
            position: fixed !important;
            inset: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            z-index: 9999 !important;
        }
    `,
    closeButton: css`
        position: absolute;
        top: 1rem;
        right: 1rem;
        z-index: 60;
        padding: 0.5rem;
        border-radius: 9999px;
        background-color: rgba(0,0,0,0.5);
        color: white;
        border: none;
        cursor: pointer;
    `,
    video: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
        z-index: 1;
        -webkit-transform: translateZ(0);
    `,
    fsFallback: css`
        position: absolute;
        inset: 0;
        background-color: rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 9000;
        cursor: pointer;
    `,
    fsFallbackIcon: css`
        background-color: white;
        padding: 1rem;
        border-radius: 50%;
        margin-bottom: 1rem;
    `,
    fsFallbackText: css`
        color: white;
        font-weight: bold;
        font-size: 1.2rem;
    `,
    musicalNote: css`
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: rgba(85, 85, 85, 1);
        z-index: 2;
        pointer-events: none;
    `,
};


const Player = forwardRef(({ video, onClose, isEmbedded = false, onCapture, isCapturing = false, initialTime, onLoadedMetadata, onLoadedData, onCanPlay, onVideoUpdate, onVideoSelect, screenshots: propScreenshots, renderExtraControls }, ref) => {
    // Settings State
    const [quality, setQuality] = useState(() => {
        const saved = localStorage.getItem('player_quality');
        const parsed = parseInt(saved, 10);
        return isNaN(parsed) ? 5 : parsed;
    });

    const [hwDecode, setHwDecode] = useState(() => localStorage.getItem('player_hw_decode') === 'true');
    const [transcodeSeekDebounce, setTranscodeSeekDebounce] = useState(() => {
        const saved = localStorage.getItem('player_transcode_debounce');
        return saved ? parseInt(saved, 10) : 300;
    });

    // use_transcode: 1 means force transcode, 0 means force native.
    const isNative = video && video.use_transcode === 0;

    const videoElementRef = useRef(null);
    const containerRef = useRef(null);

    // MSE Hook (Main Player)
    const mseMain = useMsePlayback({
        video,
        quality,
        hwDecode,
        isNative,
        videoElementRef
    });
    const { mseUrl, isMseReady, seek: mseSeek, isLoading: isMseLoading, error: mseError } = mseMain;

    const src = isNative
        ? (video ? `/api/stream/${video.id}` : '')
        : (mseUrl || null);

    const videoRef = useCallback((node) => {
        if (node) {
            videoElementRef.current = node;
            if (src && !node.getAttribute('src')) {
                node.setAttribute('src', src);
            }
        } else {
            // Unmount - Cleanup for Firefox
            if (videoElementRef.current) {
                const v = videoElementRef.current;
                try {
                    v.pause();
                } catch (e) { }
                v.removeAttribute('src');
                v.load();
                videoElementRef.current = null;
            }
        }
    }, [src]);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(() => {
        const saved = localStorage.getItem('player_volume');
        return saved !== null ? parseFloat(saved) : 1;
    });
    const [isMuted, setIsMuted] = useState(() => {
        const saved = localStorage.getItem('player_volume');
        return saved !== null ? parseFloat(saved) === 0 : false;
    });
    const [isInitiallyReady, setIsInitiallyReady] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const isPlayingRef = useRef(isPlaying);
    useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

    const offsetRef = useRef(0);
    const playCountTracked = useRef(false);
    const controlsTimeoutRef = useRef(null);
    const isDraggingRef = useRef(false);
    const isSeekingRef = useRef(false);
    const pendingSeekTimeRef = useRef(null); // Ref for restore time
    const seekTimeoutRef = useRef(null); // Debounce for transcoding seek
    const [seekIndicator, setSeekIndicator] = useState(null); // 'left' | 'right' | null
    const indicatorTimeoutRef = useRef(null);
    const [playerToasts, setPlayerToasts] = useState([]); // Internal toasts for fullscreen
    const clickTimeoutRef = useRef(null);
    const { showToast } = useUI();

    const [playbackSpeed, setPlaybackSpeed] = useState(() => parseFloat(localStorage.getItem('player_speed')) || 1.0);
    const [autoFullScreen, setAutoFullScreen] = useState(() => localStorage.getItem('player_auto_fullscreen') === 'true');
    const [swipePreview, setSwipePreview] = useState(null); // { direction: 'left'|'right', seconds: number } | null
    const swipePreviewRef = useRef(null);
    const [showSettings, setShowSettings] = useState(false);
    const [subtitlesEnabled, setSubtitlesEnabled] = useState(() => localStorage.getItem('player_subtitles_enabled') === 'true');
    const [isSeekBarDragging, setIsSeekBarDragging] = useState(false);
    const [isVolumeDragging, setIsVolumeDragging] = useState(false);
    const [hasVideo, setHasVideo] = useState(true);

    // Seek Preview State
    const [previewTime, setPreviewTime] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);
    const [previewPos, setPreviewPos] = useState(0);
    const [bufferedRanges, setBufferedRanges] = useState([]);
    const [internalScreenshots, setInternalScreenshots] = useState([]);
    const screenshots = propScreenshots !== undefined ? propScreenshots : internalScreenshots;
    const previewTimeoutRef = useRef(null);
    // 動画紹介表示用の状態
    const [showRecommendation, setShowRecommendation] = useState(false);
    const [nextVideoId, setNextVideoId] = useState(null);
    // 動画の最後に到達したかどうかのフラグ（一度立てたらリセットまで維持）
    const hasReachedEndRef = useRef(false);

    const assInstanceRef = useRef(null);

    // ASS Subtitle handling with assjs
    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const destroyAss = () => {
            if (assInstanceRef.current) {
                try {
                    assInstanceRef.current.destroy();
                } catch (e) {
                    console.error('Failed to destroy ASS instance:', e);
                }
                assInstanceRef.current = null;
            }
        };

        destroyAss();

        if (!subtitlesEnabled || !video || !videoElementRef.current || !containerRef.current) {
            return;
        }

        const videoEl = videoElementRef.current;
        const containerEl = containerRef.current;

        fetch(`/api/video/${video.id}/subtitle`, { signal: controller.signal })
            .then(async res => {
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    if (res.status === 500 || text.includes('字幕取得エラー')) {
                        const errMsg = text || '字幕取得エラー:字幕の取得がタイムアウトしました';
                        showToast(errMsg, 'error');
                    }
                    throw new Error(text || 'Subtitle not found');
                }
                return res.text();
            })
            .then(content => {
                if (!isMounted || !content.trim()) return;
                try {
                    assInstanceRef.current = new ASS(content, videoEl, {
                        container: containerEl,
                        resampling: 'video_height'
                    });
                    if (!videoEl.paused && !videoEl.ended) {
                        videoEl.dispatchEvent(new Event('playing'));
                    }
                } catch (e) {
                    console.error('Failed to initialize ASS subtitle:', e);
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return;
            });

        return () => {
            isMounted = false;
            controller.abort();
            destroyAss();
        };
    }, [video?.id, subtitlesEnabled]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
        getCurrentTime: () => {
            if (!videoElementRef.current) return 0;
            return videoElementRef.current.currentTime;
        },
        seekTo: (time) => {
            handleSeek(time);
        },
        showToast: (message, customContent = null) => {
            const id = Date.now() + Math.random();
            setPlayerToasts(prev => [...prev, { id, message, customContent }]);
            setTimeout(() => {
                setPlayerToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        }
    }));

    const initializedVideoIdRef = useRef(null);

    // 1. Video Initialization & Position Restore
    useEffect(() => {
        if (video) {
            // Only initialize if it's a new video ID
            if (initializedVideoIdRef.current === video.id) return;
            initializedVideoIdRef.current = video.id;

            let savedTime = initialTime !== undefined ? initialTime : (video.last_pos || 0);
            if (video.duration && savedTime >= video.duration - 2) {
                if (initialTime === undefined) savedTime = 0;
            }

            playCountTracked.current = false;
            pendingSeekTimeRef.current = savedTime;

            setCurrentTime(savedTime);
            setIsPlaying(true);
            setIsReady(false);
            setIsInitiallyReady(false);
            setShowRecommendation(false);
            hasReachedEndRef.current = false;

            // 次の動画IDを取得
            api.getVideo(video.id).then(data => {
                setNextVideoId(data.nextVideoId);
            }).catch(err => {
                console.error('Failed to get next video:', err);
            });

            if (videoElementRef.current && isNative && videoElementRef.current.readyState >= 1) {
                videoElementRef.current.currentTime = savedTime;
                pendingSeekTimeRef.current = null;
                setIsReady(true);
                setIsInitiallyReady(true);
            }
        }
    }, [video?.id, initialTime, isNative]);

    const initializedMseVideoIdRef = useRef(null);

    // Initial Seek for MSE
    useEffect(() => {
        if (!isNative && mseUrl && video && isMseReady) {
            // Only perform initial seek if we haven't for this ID/URL combination
            if (initializedMseVideoIdRef.current === `${video.id}-${mseUrl}`) return;
            initializedMseVideoIdRef.current = `${video.id}-${mseUrl}`;

            let savedTime = initialTime !== undefined ? initialTime : (video.last_pos || 0);
            if (video.duration && savedTime >= video.duration - 2) {
                if (initialTime === undefined) savedTime = 0;
            }

            if (videoElementRef.current) {
                videoElementRef.current.currentTime = savedTime;
            }
            mseSeek(savedTime);
            pendingSeekTimeRef.current = null;

            if (videoElementRef.current) {
                videoElementRef.current.play().catch(e => {
                    if (e.name !== 'AbortError') console.warn("Auto-play failed", e);
                });
            }
        }
    }, [mseUrl, isNative, video?.id, initialTime, mseSeek, isMseReady]);

    // スクリーンショットリストを取得
    useEffect(() => {
        if (propScreenshots !== undefined) return;
        if (video?.id) {
            api.getScreenshots(video.id)
                .then(data => setInternalScreenshots(data || []))
                .catch(err => {
                    console.error('Failed to fetch screenshots:', err);
                    setInternalScreenshots([]);
                });
        } else {
            setInternalScreenshots([]);
        }
    }, [video?.id, propScreenshots]);

    const actualTimeRef = useRef(0);
    useEffect(() => { actualTimeRef.current = currentTime; }, [currentTime]);

    useEffect(() => {
        return () => {
            if (video && actualTimeRef.current > 0) {
                api.updateVideoLastPos(video.id, actualTimeRef.current).catch(() => { });
            }
        };
    }, [video?.id]);

    const [isPageFullscreen, setIsPageFullscreen] = useState(() => document.fullscreenElement !== null);

    useEffect(() => {
        const handleFsChange = () => {
            const isFs = document.fullscreenElement !== null;
            setIsPageFullscreen(isFs);
            if (isFs) {
                document.documentElement.style.overflow = 'hidden';
                document.body.style.overflow = 'hidden';
            } else {
                document.documentElement.style.overflow = '';
                document.body.style.overflow = '';
            }
        };
        handleFsChange();
        document.addEventListener('fullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
        };
    }, []);

    const [showFsFallback, setShowFsFallback] = useState(false);

    // Auto Fullscreen Logic
    useEffect(() => {
        if (!autoFullScreen) return;
        const mediaQuery = window.matchMedia('(orientation: landscape)');
        const handleChange = (e) => {
            if (e.matches) {
                if (!document.fullscreenElement) {
                    document.documentElement?.requestFullscreen().then(() => {
                        setShowFsFallback(false);
                    }).catch(err => {
                        console.warn('[Player] Auto fullscreen failed:', err);
                        setShowFsFallback(true);
                    });
                }
            } else {
                setShowFsFallback(false);
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(() => { });
                }
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [autoFullScreen]);

    // Volume & Mute Synchronization
    useEffect(() => {
        if (videoElementRef.current) {
            videoElementRef.current.volume = isMuted ? 0 : volume;
            videoElementRef.current.muted = isMuted;
        }
    }, [video?.id, volume, isMuted]);

    // Playback Speed Update
    useEffect(() => {
        if (videoElementRef.current) {
            videoElementRef.current.playbackRate = playbackSpeed;
        }
        localStorage.setItem('player_speed', playbackSpeed.toString());
    }, [playbackSpeed, video?.id]);

    // Keyboard Listeners
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName)) return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    triggerSeekIndicator('left');
                    handleSeek(Math.max(0, currentTime - 5));
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    if (duration > 0 && currentTime >= duration) break;
                    triggerSeekIndicator('right');
                    handleSeek(Math.min(duration, currentTime + 5));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    updateVolume(Math.min(1, volume + 0.1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    updateVolume(Math.max(0, volume - 0.1));
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [duration, currentTime, volume]);

    const updateVolume = useCallback((newVol) => {
        const v = parseFloat(newVol.toFixed(2));
        setVolume(v);
        setIsMuted(v === 0);
        if (videoElementRef.current) videoElementRef.current.volume = v;
        localStorage.setItem('player_volume', v);
    }, []);

    const triggerSeekIndicator = (directionOrObject) => {
        setSeekIndicator(directionOrObject);
        if (indicatorTimeoutRef.current) clearTimeout(indicatorTimeoutRef.current);
        indicatorTimeoutRef.current = setTimeout(() => setSeekIndicator(null), 600);
    };

    const lastMSESeekTimeRef = useRef(-1);

    const handleSeek = (time) => {
        if (!videoElementRef.current) return;

        // 最後に到達済みの場合、戻る方向のシークのみダイアログを消す
        // 進む方向（終端へ向かう）シークではダイアログを維持する
        if (hasReachedEndRef.current) {
            const maxDuration = duration || 0;
            const isForwardSeek = maxDuration > 0 && time >= maxDuration - 0.5;
            if (!isForwardSeek) {
                // 戻る方向へのシーク → ダイアログを消し、フラグもリセット
                setShowRecommendation(false);
                hasReachedEndRef.current = false;
            }
            // 進む方向（終端）へのシークはダイアログをそのまま維持
        } else {
            // まだ終端未到達なら常にダイアログを非表示にし、フラグもリセット
            setShowRecommendation(false);
            hasReachedEndRef.current = false;
        }

        const atEnd = duration > 0 && time >= duration;

        // シーク操作で終端に到達した場合もダイアログを表示する
        // （timeupdate/ended イベントは発火しないため、ここで確実に設定する）
        if (atEnd && !hasReachedEndRef.current) {
            hasReachedEndRef.current = true;
            setShowRecommendation(true);
        }


        if (isNative) {
            isSeekingRef.current = true;
            videoElementRef.current.currentTime = time;
            if (atEnd) {
                videoElementRef.current.pause();
                setIsPlaying(false);
            } else {
                videoElementRef.current.play().then(() => setIsPlaying(true)).catch(err => {
                    if (err.name !== 'AbortError') console.error('Play error:', err);
                });
            }
            setCurrentTime(time);
        } else {
            if (isDraggingRef.current && Math.abs(lastMSESeekTimeRef.current - time) < 0.5) {
                setCurrentTime(time);
                return;
            }
            lastMSESeekTimeRef.current = time;

            isSeekingRef.current = true;
            setCurrentTime(time);
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

            seekTimeoutRef.current = setTimeout(async () => {
                try {
                    lastMSESeekTimeRef.current = time;

                    // Wait for seek to complete (fetch first segment)
                    await mseSeek(time);

                    if (videoElementRef.current) {
                        videoElementRef.current.currentTime = time;

                        if (atEnd) {
                            videoElementRef.current.pause();
                            setIsPlaying(false);
                        } else {
                            videoElementRef.current.play()
                                .then(() => setIsPlaying(true))
                                .catch(err => {
                                    if (err.name !== 'AbortError') console.error('Play error (mse):', err);
                                });
                        }
                    }
                } catch (err) {
                    console.warn('MSE Seek error:', err);
                } finally {
                    seekTimeoutRef.current = null;
                    isSeekingRef.current = false;
                }
            }, isDraggingRef.current ? 100 : transcodeSeekDebounce);
        }
    };

    const handleSeeked = () => {
        isSeekingRef.current = false;
        // シーク完了後、assjs のアニメーションループを再起動する
        // assjs は seeking イベントでリセットするが、seeked 後に playing を再dispatch して再開が必要
        if (assInstanceRef.current && videoElementRef.current) {
            try {
                const v = videoElementRef.current;
                if (!v.paused && !v.ended) {
                    v.dispatchEvent(new Event('playing'));
                }
            } catch (e) { }
        }
    };

    const handleVideoClick = (e) => {
        e.stopPropagation();
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
            handleFullScreen(e);
        } else {
            clickTimeoutRef.current = setTimeout(() => {
                clickTimeoutRef.current = null;
                togglePlay();
            }, 250);
        }
    };

    const togglePlay = (e) => {
        e?.stopPropagation();
        if (videoElementRef.current) {
            if (videoElementRef.current.paused || videoElementRef.current.ended) {
                videoElementRef.current.play()
                    .then(() => setIsPlaying(true))
                    .catch(err => {
                        if (err.name !== 'AbortError') console.error('TogglePlay error:', err);
                    });
            } else {
                videoElementRef.current.pause();
                setIsPlaying(false);
            }
        }
    };

    const toggleMute = (e) => {
        e?.stopPropagation();
        if (videoElementRef.current) {
            const newMuted = !isMuted;
            videoElementRef.current.muted = newMuted;
            setIsMuted(newMuted);
        }
    };

    const updateBufferedRanges = useCallback(() => {
        if (!videoElementRef.current) return;
        const buffered = videoElementRef.current.buffered;
        const ranges = [];
        for (let i = 0; i < buffered.length; i++) {
            ranges.push({
                start: buffered.start(i),
                end: buffered.end(i)
            });
        }
        setBufferedRanges(ranges);
    }, []);

    const handleTimeUpdate = () => {
        if (!videoElementRef.current || isDraggingRef.current || isSeekingRef.current || seekTimeoutRef.current) return;
        if (!isReady && videoElementRef.current.currentTime > 0) setIsReady(true);

        const actualTime = videoElementRef.current.currentTime;
        setCurrentTime(actualTime);

        // 動画紹介表示の制御：最後に到達したら一度フラグを立ててダイアログを表示する。中盤に戻ったらダイアログを消す
        const maxDuration = duration || videoElementRef.current.duration || 0;
        const isAtEnd = maxDuration > 0 && actualTime >= maxDuration - 0.5;
        if (isAtEnd) {
            if (!hasReachedEndRef.current) {
                hasReachedEndRef.current = true;
                setShowRecommendation(true);
            }
        } else {
            if (hasReachedEndRef.current) {
                hasReachedEndRef.current = false;
                setShowRecommendation(false);
            }
        }

        const shouldSave = !isSeekingRef.current && (
            (Math.floor(actualTime) % 5 === 0 && Math.floor(currentTime) !== Math.floor(actualTime)) ||
            (!playCountTracked.current && actualTime >= 5)
        );

        if (shouldSave) {
            api.updateVideoLastPos(video.id, actualTime).catch(() => { });
        }

        setDuration(video.duration || videoElementRef.current.duration || 0);
        if (!playCountTracked.current && actualTime >= 5) {
            playCountTracked.current = true;
            api.incrementPlayCount(video.id).catch(() => { });
        }

        updateBufferedRanges();
    };

    const handleProgress = () => {
        updateBufferedRanges();
    };

    const handleLoadedMetadata = (e) => {
        if (videoElementRef.current) {
            setIsReady(true);
            setDuration(video.duration || videoElementRef.current.duration);
            setHasVideo(videoElementRef.current.videoWidth > 0);
            if (pendingSeekTimeRef.current !== null && isNative) {
                videoElementRef.current.currentTime = pendingSeekTimeRef.current;
                pendingSeekTimeRef.current = null;
            }
            if (isPlaying) videoElementRef.current.play().catch(() => { });
            videoElementRef.current.playbackRate = playbackSpeed;
            setIsInitiallyReady(true);
            if (onLoadedMetadata) onLoadedMetadata(e);
        }
    };

    const handleLoadedData = () => {
        setIsReady(true);
        setIsInitiallyReady(true);
        if (!isNative && isSeekingRef.current) isSeekingRef.current = false;
    };

    // ManagedMediaSource（iOS Safari）では loadedmetadata 時点で videoWidth が 0 になる場合がある。
    // resize イベントは videoWidth が実際に確定したときに発火するので、ここで hasVideo を更新する。
    // hasVideo が既に true の場合は不要なチェックをスキップする。
    const handleVideoResize = () => {
        if (!hasVideo && videoElementRef.current && videoElementRef.current.videoWidth > 0) {
            setHasVideo(true);
        }
    };

    const handleVideoError = () => {
        const err = videoElementRef.current?.error;
        const msg = err ? ` (Code: ${err.code}${err.message ? ', ' + err.message : ''})` : '';
        showToast('この動画は再生できません。' + msg, 'error');
        console.error('Video error:', err);
    };

    const handleFullScreen = (e) => {
        e?.stopPropagation();
        if (!document.fullscreenElement) document.documentElement?.requestFullscreen();
        else document.exitFullscreen();
    };

    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlayingRef.current && !isDraggingRef.current && !isVolumeDraggingRef.current) {
                setShowControls(false);
            }
        }, 3000);
    };

    useEffect(() => {
        if (isPlaying && showControls) {
            if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            controlsTimeoutRef.current = setTimeout(() => {
                if (isPlayingRef.current && !isDraggingRef.current && !isVolumeDraggingRef.current) {
                    setShowControls(false);
                }
            }, 3000);
        }
    }, [isPlaying]);

    const handleSeekRef = useRef(handleSeek);
    useEffect(() => { handleSeekRef.current = handleSeek; });

    const currentTimeRef = useRef(currentTime);
    useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);

    const volumeRef = useRef(volume);
    useEffect(() => { volumeRef.current = volume; }, [volume]);

    const touchStartXRef = useRef(null);
    const touchStartYRef = useRef(null);
    const isSwipingRef = useRef(false);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e) => {
            if (volumeBarRef.current && volumeBarRef.current.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            const delta = Math.sign(e.deltaY);
            const baseTime = currentTimeRef.current;
            const maxDuration = duration || 0;
            // 末尾に到達済みで進む方向のホイール操作は無視する
            if (delta > 0 && maxDuration > 0 && baseTime >= maxDuration) return;
            let newTime = delta < 0 ? Math.max(0, baseTime - 5) : Math.min(maxDuration, baseTime + 5);
            triggerSeekIndicator(delta < 0 ? 'left' : 'right');
            handleSeekRef.current(newTime);
        };

        const calculateSwipeSeconds = (absDeltaX) => {
            if (absDeltaX < 30) return 0;
            if (absDeltaX < 70) return 5;
            if (absDeltaX < 120) return 10;
            if (absDeltaX < 180) return 30;
            if (absDeltaX < 250) return 60;
            if (absDeltaX < 320) return 120;
            return 180;
        };

        const onTouchStart = (e) => {
            if (isSeekBarDragging || (progressBarRef.current && progressBarRef.current.contains(e.target))) return;
            if (e.touches.length > 1) return;
            handleMouseMove();
            touchStartXRef.current = e.touches[0].clientX;
            touchStartYRef.current = e.touches[0].clientY;
            isSwipingRef.current = false;
            swipePreviewRef.current = null;
            setSwipePreview(null);
        };

        const onTouchMove = (e) => {
            if (isSeekBarDragging || (progressBarRef.current && progressBarRef.current.contains(e.target))) return;
            if (touchStartXRef.current === null || e.touches.length > 1) return;
            const deltaX = e.touches[0].clientX - touchStartXRef.current;
            const deltaY = e.touches[0].clientY - touchStartYRef.current;
            if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
                isSwipingRef.current = true;
                if (e.cancelable) e.preventDefault();

                const seconds = calculateSwipeSeconds(Math.abs(deltaX));
                if (seconds > 0) {
                    const direction = deltaX < 0 ? 'right' : 'left';
                    const preview = { direction, seconds };
                    swipePreviewRef.current = preview;
                    setSwipePreview(preview);
                } else {
                    swipePreviewRef.current = null;
                    setSwipePreview(null);
                }
            }
        };

        const onTouchEnd = (e) => {
            if (isSeekBarDragging || (progressBarRef.current && progressBarRef.current.contains(e.target))) {
                touchStartXRef.current = null; touchStartYRef.current = null; isSwipingRef.current = false;
                swipePreviewRef.current = null; setSwipePreview(null);
                return;
            }
            if (touchStartXRef.current === null || !isSwipingRef.current) {
                touchStartXRef.current = null; touchStartYRef.current = null;
                swipePreviewRef.current = null; setSwipePreview(null);
                return;
            }

            const preview = swipePreviewRef.current;
            if (preview && preview.seconds > 0) {
                const baseTime = currentTimeRef.current;
                const maxDuration = duration || 0;
                let newTime = preview.direction === 'right'
                    ? Math.min(maxDuration, baseTime + preview.seconds)
                    : Math.max(0, baseTime - preview.seconds);

                triggerSeekIndicator(preview.direction);
                handleSeekRef.current(newTime);
                if (e.cancelable) e.preventDefault();
                e.stopPropagation();
            }

            touchStartXRef.current = null; touchStartYRef.current = null; isSwipingRef.current = false;
            swipePreviewRef.current = null; setSwipePreview(null);
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd, { passive: false });
        container.addEventListener('touchcancel', onTouchEnd, { passive: false });
        return () => {
            container.removeEventListener('wheel', onWheel);
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            container.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [duration, isSeekBarDragging]);

    const formatTime = (seconds) => {
        if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "---";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const onScreenshot = (e) => {
        e?.stopPropagation();
        if ((duration || 0) <= 0 && (currentTime || 0) <= 0) {
            showToast('動画の情報を取得中です...', 'info');
            return;
        }
        if (onCapture) onCapture();
        else showToast('エラー: キャプチャ機能が準備できていません', 'error');
    };

    const progressBarRef = useRef(null);
    const [isSeekHovered, setIsSeekHovered] = useState(false);
    const durationRef = useRef(0);
    useEffect(() => { durationRef.current = duration; }, [duration]);

    const fetchPreview = useCallback((time) => {
        if (!video?.id || time === null || time === undefined) return;
        try {
            const url = `/api/video/${video.id}/preview?t=${Number(time).toFixed(2)}`;
            setPreviewImage(url);
        } catch (err) { console.error('Fetch preview error:', err); }
    }, [video?.id]);

    const handleSeekStart = useCallback((e) => {
        if (!isInitiallyReady || !duration) return;
        if (isDraggingRef.current || isSeekBarDragging || isVolumeDragging) return;
        if (e.type === 'touchstart') e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        setIsSeekBarDragging(true);
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        if (progressBarRef.current) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const newTime = pos * (duration || 0);
            setCurrentTime(newTime);
            setPreviewTime(newTime);
            setPreviewPos(clientX - rect.left);
            fetchPreview(newTime);
        }
    }, [isInitiallyReady, duration, isSeekBarDragging, isVolumeDragging, fetchPreview]);

    const handleSeekMove = useCallback((e) => {
        if (!progressBarRef.current) return;

        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const newTime = pos * (durationRef.current || 0);

        const currentPos = clientX - rect.left;
        setPreviewTime(newTime);
        setPreviewPos(currentPos);

        // Update video while dragging
        handleSeek(newTime);

        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => fetchPreview(newTime), 80);
    }, [fetchPreview, handleSeek]);

    const handleSeekEnd = useCallback((e) => {
        const clientX = e.type.startsWith('touch') ? (e.changedTouches?.[0]?.clientX || touchStartXRef.current || 0) : e.clientX;
        if (progressBarRef.current) {
            const rect = progressBarRef.current.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const newTime = pos * (durationRef.current || 0);
            handleSeek(newTime);
        }
        setIsSeekBarDragging(false);
        isDraggingRef.current = false;
        setPreviewTime(null);
        setPreviewImage(null);
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    }, [handleSeek]);

    useDraggable({
        ref: progressBarRef, isActive: isSeekBarDragging,
        onStart: handleSeekStart, onMove: handleSeekMove, onEnd: handleSeekEnd
    });

    const handleSeekBarMouseMove = (e) => {
        if (!isInitiallyReady || isDraggingRef.current || !progressBarRef.current || !hasVideo) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = Math.max(0, Math.min(1, pos)) * (duration || 0);
        setPreviewTime(time);
        setPreviewPos(e.clientX - rect.left);
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = setTimeout(() => fetchPreview(time), 80);
    };

    const handleSeekBarMouseLeave = () => {
        if (isDraggingRef.current) return;
        setPreviewTime(null);
        setPreviewImage(null);
        if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };

    const volumeBarRef = useRef(null);
    const isVolumeDraggingRef = useRef(false);
    const handleVolumeMove = useCallback((e) => {
        if (!volumeBarRef.current) return;
        const rect = volumeBarRef.current.getBoundingClientRect();
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const v = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        updateVolume(v);
    }, [updateVolume]);

    const handleVolumeEnd = useCallback((e) => {
        if (volumeBarRef.current) {
            const rect = volumeBarRef.current.getBoundingClientRect();
            const clientX = e.type.startsWith('touch') ? (e.changedTouches?.[0]?.clientX || 0) : e.clientX;
            const v = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            updateVolume(v);
        }
        setIsVolumeDragging(false);
        isVolumeDraggingRef.current = false;
        isDraggingRef.current = false;
    }, [updateVolume]);

    const handleVolumeDragStart = useCallback((e) => {
        if (isVolumeDraggingRef.current || isVolumeDragging) return;
        e.stopPropagation();
        isVolumeDraggingRef.current = true;
        setIsVolumeDragging(true);
        isDraggingRef.current = true;
        const rect = volumeBarRef.current.getBoundingClientRect();
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const v = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        updateVolume(v);
    }, [isVolumeDragging, updateVolume]);

    useDraggable({
        ref: volumeBarRef, isActive: isVolumeDragging,
        onStart: handleVolumeDragStart, onMove: handleVolumeMove, onEnd: handleVolumeEnd
    });

    useEffect(() => {
        const volumeBar = volumeBarRef.current;
        if (!volumeBar) return;
        const onVolumeWheel = (e) => {
            e.preventDefault(); e.stopPropagation();
            const delta = -Math.sign(e.deltaY) * 0.05;
            const newVol = Math.max(0, Math.min(1, volumeRef.current + delta));
            updateVolume(newVol);
        };
        volumeBar.addEventListener('wheel', onVolumeWheel, { passive: false });
        return () => volumeBar.removeEventListener('wheel', onVolumeWheel);
    }, [updateVolume]);

    useEffect(() => {
        const cleanup = () => {
            if (isSeekBarDragging || isVolumeDragging) {
                setIsSeekBarDragging(false); setIsVolumeDragging(false);
                isDraggingRef.current = false; isVolumeDraggingRef.current = false;
                setPreviewTime(null);
            }
        };
        window.addEventListener('touchend', cleanup);
        window.addEventListener('touchcancel', cleanup);
        return () => {
            window.removeEventListener('touchend', cleanup);
            window.removeEventListener('touchcancel', cleanup);
        };
    }, [isSeekBarDragging, isVolumeDragging]);

    if (!video) return null;

    return (
        <Fragment>
            <div
                ref={containerRef}
                className={`${styles.container} ${isEmbedded ? 'embedded' : 'fullscreen'} ${isPageFullscreen ? 'page-fullscreen' : ''}`}
                style={{
                    '--display': isEmbedded ? 'block' : 'flex',
                    '--align-items': isEmbedded ? 'unset' : 'center',
                    '--justify-content': isEmbedded ? 'unset' : 'center',
                    '--z-index': isEmbedded ? 'auto' : 50,
                    '--cursor': (showControls || !isPlaying) ? 'auto' : 'none'
                }}
                onMouseMove={handleMouseMove}
                onPointerDown={handleMouseMove}
                onMouseLeave={() => {
                    if (isPlaying) setShowControls(false);
                }}
            >
                {!isEmbedded && (
                    <button
                        onClick={onClose}
                        className={styles.closeButton}
                    >
                        <X size={24} />
                    </button>
                )}

                {!hasVideo && (
                    <div className={styles.musicalNote}>
                        <Music size={isEmbedded ? 64 : 128} />
                    </div>
                )}
                <video
                    key={video ? video.id : 'no-video'}
                    ref={videoRef}
                    src={src}
                    className={styles.video}
                    style={{
                        opacity: isInitiallyReady ? 1 : 0.5
                    }}
                    onClick={handleVideoClick}
                    onContextMenu={(e) => e.preventDefault()}
                    onTimeUpdate={handleTimeUpdate}
                    onProgress={handleProgress}
                    onLoadedMetadata={handleLoadedMetadata}
                    onLoadedData={handleLoadedData}
                    onCanPlay={() => { setIsReady(true); setIsInitiallyReady(true); updateBufferedRanges(); }}
                    onSeeked={(e) => { handleSeeked(e); updateBufferedRanges(); }}
                    onWaiting={() => setIsReady(false)}
                    onPlaying={() => { setIsReady(true); setIsInitiallyReady(true); setIsPlaying(true); }}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onEnded={() => {
                        setIsReady(true);
                        // 動画終了時に確実にダイアログを表示する（timeupdateが終端をスキップした場合の保険）
                        // シーク中やドラッグ中ではなく、かつ実際の時間が終端付近であることを確認する
                        const maxDuration = duration || (videoElementRef.current ? videoElementRef.current.duration : 0);
                        const actualTime = videoElementRef.current ? videoElementRef.current.currentTime : 0;
                        const isAtEnd = maxDuration > 0 && actualTime >= maxDuration - 0.5;
                        if (isAtEnd && !hasReachedEndRef.current && !isSeekingRef.current && !isDraggingRef.current) {
                            hasReachedEndRef.current = true;
                            setShowRecommendation(true);
                        }
                    }}
                    onResize={handleVideoResize}
                    onError={handleVideoError}
                    autoPlay={isNative}
                    playsInline
                    muted={isMuted}
                />

                <PlayerOverlay
                    isEmbedded={isEmbedded}
                    onClose={onClose}
                    isInitiallyReady={isInitiallyReady}
                    isReady={(isReady && !isMseLoading) || showRecommendation}
                    seekIndicator={seekIndicator}
                    swipePreview={swipePreview}
                    playerToasts={playerToasts}
                />

                <PlayerControls
                    showControls={showControls}
                    isInitiallyReady={isInitiallyReady}
                    isPlaying={isPlaying}
                    togglePlay={togglePlay}
                    currentTime={currentTime}
                    duration={duration}
                    formatTime={formatTime}
                    isMuted={isMuted}
                    toggleMute={toggleMute}
                    volume={volume}
                    volumeBarRef={volumeBarRef}
                    handleVolumeDragStart={handleVolumeDragStart}
                    isCapturing={isCapturing}
                    onScreenshot={onScreenshot}
                    showSettings={showSettings}
                    setShowSettings={setShowSettings}
                    handleFullScreen={handleFullScreen}
                    progressBarRef={progressBarRef}
                    handleSeekBarMouseMove={handleSeekBarMouseMove}
                    handleSeekBarMouseLeave={handleSeekBarMouseLeave}
                    isSeekHovered={isSeekHovered}
                    setIsSeekHovered={setIsSeekHovered}
                    previewTime={previewTime}
                    previewPos={previewPos}
                    previewImage={previewImage}
                    isDraggingRef={isDraggingRef}
                    onSeekStart={handleSeekStart}
                    playbackSpeed={playbackSpeed}
                    bufferedRanges={bufferedRanges}
                    hasVideo={hasVideo}
                    screenshots={screenshots}
                    renderExtraControls={renderExtraControls}
                />

                {showRecommendation && (
                    <VideoRecommendation
                        currentVideo={video}
                        nextVideoId={nextVideoId}
                        onVideoSelect={(selectedVideo) => {
                            if (onVideoSelect) {
                                onVideoSelect(selectedVideo);
                            }
                        }}
                    />
                )}

                {showFsFallback && (
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            if (containerRef.current) {
                                containerRef.current.requestFullscreen().then(() => {
                                    setShowFsFallback(false);
                                }).catch(() => setShowFsFallback(true));
                            }
                        }}
                        className={styles.fsFallback}
                    >
                        <div className={styles.fsFallbackIcon}>
                            <Maximize size={32} color="black" />
                        </div>
                        <div className={styles.fsFallbackText}>タップしてフルスクリーン</div>
                    </div>
                )}

                <SettingsDialog
                    showSettings={showSettings} setShowSettings={setShowSettings}
                    quality={quality} setQuality={setQuality}
                    transcodeSeekDebounce={transcodeSeekDebounce} setTranscodeSeekDebounce={setTranscodeSeekDebounce}
                    playbackSpeed={playbackSpeed} setPlaybackSpeed={setPlaybackSpeed}
                    hwDecode={hwDecode} setHwDecode={setHwDecode}
                    autoFullScreen={autoFullScreen} setAutoFullScreen={setAutoFullScreen}
                    isNative={isNative} handleSeek={handleSeek} currentTime={currentTime}
                    subtitlesEnabled={subtitlesEnabled} setSubtitlesEnabled={setSubtitlesEnabled}
                />

                {/* LadyTube: コマ送り (キー・Shift+ホイール・タッチ端末のボタン。ExtWatchParts.jsx)。
                    key は兄弟の <video key={video.id}> と重ねない (重なると再描画のたびに video が増えて落ちる) */}
                <FrameStep key={'framestep-' + video.id} videoId={video.id} videoRef={videoElementRef} containerRef={containerRef} />
            </div>
        </Fragment>
    );
});

export default Player;
