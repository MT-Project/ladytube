import { useState, useRef, useEffect, useCallback, forwardRef } from 'react';
import { MoreVertical, Check, Volume2, VolumeX, Music, Layers } from 'lucide-react';
import { ExtThumbOverlays, ExtCardMeta, ExtPerformers, ExtTagRow } from './ExtCardParts';
import { Link } from 'react-router-dom';
import { css } from '@linaria/core';
import { useUI } from '../contexts/UIContext';
import { api } from '../services/api';
import { theme } from '../theme';
import { getFolderName, videoName } from '../utils/formatters';
import { useMsePlayback } from './Player/useMsePlayback';
import LoadingDots from './LoadingDots';

// Linaria styles
const styles = {
    menuBtn: css`
        padding: 7px;
        cursor: pointer;
        color: ${theme.colors.text.secondary};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: transparent;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    cardGrid: css`
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        margin-bottom: 0.5rem;

        .small &,
        .home & {
            gap: 0.3rem;
        }
        .poster & {
            margin-bottom: 0.7rem;
        }
        .list & {
            flex-direction: row;
            background-color: ${theme.colors.bg.modal};
            padding: 0.4rem 0.8rem;
            border-radius: 0.25rem;
            gap: 0.2rem;
            cursor: pointer;
            margin-bottom: 0rem;
            align-items: start;
        }
        width: 100%;
        text-decoration: none;
        color: inherit;
    `,
    menuBtnActive: css`
        background-color: ${theme.colors.bg.hover};
    `,
    tagMenu: css`
        position: absolute;
        top: 30px;
        right: 0;
        background-color: ${theme.colors.bg.modal};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 2000;
        min-width: 150px;
        max-height: 300px;
        overflow-y: auto;
        padding: 0.5rem 0;
    `,
    tagMenuItem: css`
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            color: ${theme.colors.accent.primary};
        }
    `,
    emptyTags: css`
        padding: 0.5rem 0.75rem;
        font-size: 0.875rem;
        color: ${theme.colors.text.secondary};
    `,
    filename: css`
        color: ${theme.colors.text.primary};
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        font-size: 0.9rem;
        word-break: break-all;        
        
        .small &,
        .home & {
            font-size: 0.85rem;
        }
        .list & {
            font-size: 0.9rem;
        }
    `,
    folderName: css`
        color: ${theme.colors.text.secondary};
        font-size: 0.9rem;
        .small &,
        .home & {
            font-size: 0.85rem;
        }
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 0.2rem;
    `,
    tagBadgeContainer: css`
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        margin-top: 0.4rem;
        .home & {
            display: none;
        }
    `,
    tagBadge: css`
        padding: 0.125rem 0.375rem;
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        font-size: 0.625rem;
        color: ${theme.colors.text.secondary};
        white-space: nowrap;
    `,
    grid: css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 0.9rem;
        width: 100%;
        &.small {
            gap: 0.7rem;
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        }
        &.poster {
            gap: 0.5rem;
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        }
        &.home {
            gap: 0.7rem;
            grid-template-columns: repeat(auto-fill, minmax(40%, 1fr));
            @media (min-width: 640px) {
                grid-template-columns: repeat(auto-fill, minmax(30%, 1fr));
            }
            @media (min-width: 840px) {
                grid-template-columns: repeat(auto-fill, minmax(20%, 1fr));
            }
        }
    `,
    listView: css`
        display: flex;
        flex-direction: column;
        width: 100%;
        margin: 0 auto;
    `,
    thumbnailWrapper: css`
        width: 100%;
        aspect-ratio: 16/9;
        background-color: black;
        position: relative;
        overflow: hidden;
        border-radius: 0.4rem;
        .list & {
            width: 180px;
            flex-shrink: 0;
        }
    `,
    noImage: css`
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #1a1a1a;
        color: #4b5563;
        font-size: 0.65rem;
        font-weight: bold;
    `,
    thumbnailImg: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    durationBadge: css`
        position: absolute;
        bottom: 4px;
        right: 4px;
        background: rgba(0,0,0,0.8);
        color: white;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 2px;
        font-family: monospace;
        line-height: 1.2;
    `,
    progressBarContainer: css`
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background-color: rgba(255,255,255,0.2);
        z-index: 1;
    `,
    progressBarFill: css`
        height: 100%;
        background-color: rgba(255,0,0,0.8);
    `,
    infoContainer: css`
        padding: 0 0.6rem 0 0.5rem;
        position: relative;
        .list & {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            padding-right: 0.6rem;
        }
        .poster & {
            display: none;
        }
    `,
    menuBtnWrapper: css`
        position: absolute;
        top: -0.3rem;
        right: -0.5rem;
        display: flex;
        align-items: center;
        .list & {
            top: 0;
            right: 0;
        }
    `,
    gridThumbnailWrapper: css`
        width: 100%;
        aspect-ratio: 16/9;
        background-color: black;
        position: relative;
        overflow: hidden;
        border-radius: 0.4rem;
    `,
    videoPreview: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    loadingDotsOverlay: css`
        position: absolute;
        top: 5px;
        right: 5px;
        z-index: 15;
        color: rgba(255,255,255,0.7);
        font-size: 1rem;
        font-weight: bold;
    `,
    seekBarContainer: css`
        display: flex;
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 28px;
        background-color: transparent;
        cursor: pointer;
        z-index: 10;
        align-items: flex-end;
        &:hover > div {
            background-color: rgba(255,255,255,0.6);
        }
    `,
    seekBarRail: css`
        width: 100%;
        height: 4px;
        bottom: 12px;
        background-color: rgba(255,255,255,0.3);
        position: relative;
    `,
    seekBarFill: css`
        height: 100%;
        background-color: rgba(255,0,0,0.7);
    `,
    nextBadge: css`
        position: absolute;
        top: 4px;
        left: 4px;
        background: ${theme.colors.accent.primary};
        color: white;
        font-size: 0.9rem;
        padding: 1px 6px;
        border-radius: 4px;
        font-weight: normal;
        z-index: 1;
    `,
    hoverOverlay: css`
        position: absolute;
        inset: 0;
        background-color: rgba(0,0,0,0.1);
    `,
    quickThumbnailButton: css`
        position: absolute;
        top: 50%;
        right: 10px;
        transform: translateY(-50%);
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background-color: transparent;
        border: 3px solid rgba(255,255,255,0.8);
        cursor: pointer;
        z-index: 20;
        &:hover {
            border: 3px solid rgba(255,255,255,1);
        }
    `,
    volumeButton: css`
        position: absolute;
        top: 4px;
        left: 4px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 20;
        color: rgba(255,255,255,0.5);
        &.active {
            background-color: rgba(0,0,0,0.3);
        }
        &:hover {
            color: rgba(255,255,255,0.8);
            background-color: rgba(0,0,0,0.5);
        }
    `,
    gridInfoContainer: css`
        padding: 0 0.6rem 0 0.5rem;
        position: relative;

    `,
    gridMenuBtnWrapper: css`
        position: absolute;
        top: -0.3rem;
        right: -0.5rem;
        display: flex;
        align-items: center;
    `,
    modalBackdrop: css`
        position: fixed;
        inset: 0;
        z-index: 1000;
        background-color: transparent;
        cursor: default;
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
    posterTitle: css`
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0,  0.5));
        color: #fff;
        padding: 0.5rem 0.5rem 0.3rem;
        font-size: 0.8rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        z-index: 5;
        font-weight: 500;
    `,
};

function formatDuration(seconds) {
    if (!seconds) return "---";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

const VideoPreview = forwardRef(({ src, isNative, playing, muted, volume, ...props }, ref) => {
    const internalRef = useRef(null);

    // Maintain stable ref with robust cleanup on unmount
    const setVideoRef = useCallback((node) => {
        // If unmounting (node is null) and we have a current ref, clean it up immediately
        if (!node && internalRef.current) {
            const v = internalRef.current;
            try { v.pause(); } catch (e) { }
            v.removeAttribute('src'); // Remove attribute first
            v.load(); // Trigger load to cancel network
            console.log('[VideoPreview] Cleanup executed via ref callback');
        }

        internalRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    // Handle play/pause via prop
    useEffect(() => {
        const v = internalRef.current;
        if (!v) return;
        if (playing) {
            v.play().catch(() => { });
        } else {
            v.pause();
        }
    }, [playing]);

    // Manage src/muted/volume separately to avoid remount/reset flicker
    useEffect(() => {
        const v = internalRef.current;
        if (!v) return;

        if (src && v.getAttribute('src') !== src) {
            v.setAttribute('src', src);
            v.load();
            v.muted = muted;
            v.volume = volume;
            if (playing) {
                v.play().catch(() => { });
            }
        } else {
            v.muted = muted;
            v.volume = volume;
        }
    }, [src, playing, muted, volume]);

    return <video ref={setVideoRef} {...props} onLoadedMetadata={(e) => {
        if (props.onLoadedMetadata) props.onLoadedMetadata(e);
    }} onError={(e) => {
        if (props.onError) props.onError(e);
    }} />;
});


function VideoCard({
    video,
    onClick,
    viewMode,
    isHighlighted,
    onUpdate,
    showThumbnailButton = true,
    isLastPreviewed = false,
    setLastPreviewedId,
    allTags = [],
    activeMenuId = null,
    setActiveMenuId = () => { },
    isPreviewMuted = true,
    setIsPreviewMuted = () => { },
    volume = 1,
    extMeta = false   // LadyTube: 検索画面のカードだけメーカー・評価・出演者などを足す (ExtCardParts.jsx)
}) {
    const { showToast, showExtension, showDisplayName } = useUI();
    const [isHovered, setIsHovered] = useState(false);
    const [isThumbnailHovered, setIsThumbnailHovered] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [thumbnailBuster, setThumbnailBuster] = useState(null);
    const [hasVideo, setHasVideo] = useState(true);
    const [imageError, setImageError] = useState(false);
    const [isVideoLoading, setIsVideoLoading] = useState(false);
    const hoverTimeoutRef = useRef(null);
    const videoRef = useRef(null);
    const seekBarRef = useRef(null);
    const cardRef = useRef(null);
    const isInteractingWithSeekBar = useRef(false);

    const [isSpacePaused, setIsSpacePaused] = useState(false);
    const transcodeSeekTimeoutRef = useRef(null);
    const isSeekingRef = useRef(null);
    const isPausedRef = useRef(false);
    const showTagMenu = activeMenuId === video.id;
    const tagMenuRef = useRef(null);
    const isHoveredRef = useRef(false);

    const isNative = video && video.use_transcode === 0;

    // Reset progress when preview is discarded (neither hovered nor last previewed)
    useEffect(() => {
        if (!isHovered && !isLastPreviewed) {
            setProgress(0);
        }
    }, [isHovered, isLastPreviewed]);

    // MSE for Previews (Lazy)
    const mse = useMsePlayback({
        video,
        quality: 1,
        hwDecode: localStorage.getItem('player_hw_decode') === 'true',
        isNative,
        videoElementRef: videoRef,
        enabled: isHovered || isLastPreviewed
    });
    const { mseUrl, isLoading: isMseLoading, seek: mseSeek } = mse;

    const handleMouseEnter = () => {
        if (showTagMenu) return;
        hoverTimeoutRef.current = setTimeout(() => {
            setIsHovered(true);
            isHoveredRef.current = true;
            setLastPreviewedId(null);
        }, 500);
    };

    // Force exit hover when tag menu is opened
    useEffect(() => {
        if (showTagMenu) {
            setIsHovered(false);
            isHoveredRef.current = false;
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
            setIsSpacePaused(false);
        }
    }, [showTagMenu]);

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        if (transcodeSeekTimeoutRef.current) clearTimeout(transcodeSeekTimeoutRef.current);
        if (isHovered) setLastPreviewedId(video.id);
        setIsHovered(false);
        isHoveredRef.current = false;
        setIsThumbnailHovered(false);
        setIsSpacePaused(false);
    };

    const handlePreviewError = (e) => {
        console.error('Preview error:', e);
    };

    // Safely check if the mouse is still over the card, because sometimes mouseleave is missed.
    useEffect(() => {
        if (!isHovered) return;

        const handleKeyDown = (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                setIsSpacePaused(prev => !prev);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                if (!videoRef.current) return;
                e.preventDefault();

                const currentTime = videoRef.current.currentTime;
                const duration = video.duration || videoRef.current.duration || 0;
                const newTime = e.key === 'ArrowLeft'
                    ? Math.max(0, currentTime - 5)
                    : Math.min(duration, currentTime + 5);

                // Use player's transcode debounce setting
                const transcodeSeekDebounce = parseInt(localStorage.getItem('player_transcode_debounce')) || 300;

                if (isNative) {
                    videoRef.current.currentTime = newTime;
                    setProgress((newTime / duration) * 100);
                } else {
                    if (transcodeSeekTimeoutRef.current) clearTimeout(transcodeSeekTimeoutRef.current);
                    transcodeSeekTimeoutRef.current = setTimeout(() => {
                        if (videoRef.current) {
                            videoRef.current.currentTime = newTime;
                            setProgress((newTime / duration) * 100);
                        }
                        mseSeek(newTime);
                        transcodeSeekTimeoutRef.current = null;
                    }, transcodeSeekDebounce);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        const interval = setInterval(() => {
            if (cardRef.current && !cardRef.current.matches(':hover') && !showTagMenu) {
                handleMouseLeave();
            }
        }, 1000);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearInterval(interval);
        }
    }, [isHovered, showTagMenu, videoRef, isNative, video.duration, mseSeek]);

    const lastMSESeekTimeRef = useRef(-1);

    const handleSeek = useCallback((e) => {
        if (!videoRef.current || !seekBarRef.current || isPausedRef.current) return;

        const rect = seekBarRef.current.getBoundingClientRect();
        const clientX = e.clientX;
        const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        const duration = video.duration || videoRef.current.duration || 0;
        const time = pos * duration;

        setProgress(pos * 100);
        isSeekingRef.current = true;

        if (isNative) {
            isSeekingRef.current = true;
            videoRef.current.currentTime = time;
        } else {
            if (isDragging && Math.abs(lastMSESeekTimeRef.current - time) < 0.5) return;
            isSeekingRef.current = true;
            if (transcodeSeekTimeoutRef.current) clearTimeout(transcodeSeekTimeoutRef.current);

            // Use player's transcode debounce setting
            const transcodeSeekDebounce = parseInt(localStorage.getItem('player_transcode_debounce')) || 300;

            transcodeSeekTimeoutRef.current = setTimeout(() => {
                lastMSESeekTimeRef.current = time;
                if (videoRef.current) videoRef.current.currentTime = time;
                mseSeek(time);
                transcodeSeekTimeoutRef.current = null;
            }, isDragging ? 100 : transcodeSeekDebounce);
        }
    }, [video.duration, isNative, mseSeek, isDragging]);

    const handleMouseDown = (e) => {
        e.stopPropagation();
        isInteractingWithSeekBar.current = true;
        setIsDragging(true);
        handleSeek(e);
    };

    useEffect(() => {
        const handleMouseMove = (e) => { if (isDragging) handleSeek(e); };
        const handleMouseUp = () => {
            if (isInteractingWithSeekBar.current) {
                setIsDragging(false);
                setTimeout(() => { isInteractingWithSeekBar.current = false; }, 100);
            }
        };
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, handleSeek]);

    const handleSetThumbnail = async (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!isHovered || !videoRef.current) return;
        isPausedRef.current = true;
        videoRef.current.pause();
        setTimeout(() => {
            isPausedRef.current = false;
            if (isHoveredRef.current && videoRef.current) videoRef.current.play().catch(() => { });
        }, 1000);
        const timestamp = videoRef.current.currentTime;
        try {
            const res = await api.setThumbnailFromTimestamp(video.id, timestamp);
            if (res.success && res.thumbnail) {
                setThumbnailBuster(Date.now());
                onUpdate && onUpdate({ ...video, has_thumbnail: 1 });
                showToast('サムネイルを設定しました。', 'success', (
                    <img src={res.thumbnail} alt="Thumbnail" className={css`width: auto; height: 50px; border-radius: 0.25rem; border: 1px solid #333;`} />
                ));
            }
        } catch (err) { console.error('Failed to set thumbnail:', err); }
    };

    const toggleTag = async (e, tagName) => {
        e.preventDefault();
        e.stopPropagation();
        const currentTags = video.tags ? video.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
        const hasTag = currentTags.includes(tagName);

        try {
            if (hasTag) {
                await api.removeTag(video.id, tagName);
            } else {
                await api.addTag(video.id, tagName);
            }

            const nextTags = hasTag
                ? currentTags.filter(t => t !== tagName)
                : [...currentTags, tagName];

            onUpdate && onUpdate({
                ...video,
                tags: nextTags.join('\n')
            });
            showToast(`${hasTag ? '削除' : '追加'}しました: ${tagName}`, 'success');
        } catch (err) {
            console.error('Failed to toggle tag:', err);
            showToast('タグの更新に失敗しました: ' + err.message, 'error');
        }
    };

    const tags = video.tags ? video.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
    const src = isNative ? `/api/stream/${video.id}` : (mseUrl || null);
    const filenameToDisplay = videoName(video, showExtension, showDisplayName);

    const renderTagMenu = () => {
        if (!showTagMenu) return null;
        return (
            <div
                ref={tagMenuRef}
                className={styles.tagMenu}
                onClick={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
            >
                {allTags.map((tagName, i) => {
                    const active = tags.includes(tagName);
                    return (
                        <div
                            key={i}
                            onClick={(e) => toggleTag(e, tagName)}
                            className={`${styles.tagMenuItem} ${active ? 'active' : ''}`}
                        >
                            <span>{tagName}</span>
                            {active && <Check size={14} />}
                        </div>
                    );
                })}
                {allTags.length === 0 && (
                    <div className={styles.emptyTags}>タグがありません</div>
                )}
            </div>
        );
    };

    return (
        <Link to={`/watch/${video.id}`} draggable="false" onDragStart={(e) => e.preventDefault()}
            ref={cardRef}
            className={`${styles.cardGrid} ${isHighlighted ? 'highlighted' : ''}`}
            onClick={(e) => {
                if (isInteractingWithSeekBar.current) { e.preventDefault(); e.stopPropagation(); return; }
                if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); onClick(video); }
            }}
            onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}
        >
            <div className={styles.thumbnailWrapper}
                onMouseEnter={() => setIsThumbnailHovered(true)}
                onMouseLeave={() => setIsThumbnailHovered(false)}
            >
                {(isHovered || isLastPreviewed) ? (
                    <>
                        <VideoPreview key={video.id} ref={videoRef} src={src} playing={isHovered && !isSpacePaused}
                            className={styles.videoPreview}
                            style={{ display: isHovered ? 'block' : 'none' }}
                            muted={isPreviewMuted} volume={volume} playsInline controls={false}
                            onLoadedMetadata={(e) => {
                                setHasVideo(e.target.videoWidth > 0);
                            }}
                            onTimeUpdate={(e) => {
                                if (isSeekingRef.current) return;
                                const d = video.duration || e.target.duration;
                                if (d) setProgress((e.target.currentTime / d) * 100);
                            }}
                            onPlaying={() => { isSeekingRef.current = false; setIsVideoLoading(false); }}
                            onSeeked={() => { isSeekingRef.current = false; setIsVideoLoading(false); }}
                            onCanPlay={() => { isSeekingRef.current = false; setIsVideoLoading(false); }}
                            onWaiting={() => setIsVideoLoading(true)}
                            onLoadStart={() => setIsVideoLoading(true)}
                            onError={handlePreviewError}
                        />
                        {isHovered && (isMseLoading || isVideoLoading) && (
                            <LoadingDots
                                className={styles.loadingDotsOverlay}
                                dotStyle={{ textShadow: '0 0 4px rgba(0,0,0,0.5)' }}
                            />
                        )}
                        {!hasVideo && isHovered && (
                            <div className={styles.musicalNote}>
                                <Music size={32} />
                            </div>
                        )}
                        {!isHovered && isLastPreviewed && (
                            <>
                                {(!video.has_thumbnail || imageError) ? (
                                    <div className={styles.noImage}>NO IMAGE</div>
                                ) : (
                                    video.id && (<img src={`/api/video/${video.id}/thumbnail?s=${video.thumbnail_size || 0}${thumbnailBuster ? `&t=${thumbnailBuster}` : ''}`} alt={videoName(video, true, showDisplayName)} loading="lazy" className={styles.thumbnailImg} onError={() => setImageError(true)} />)
                                )}
                                {viewMode !== 'grid-poster' && (
                                    <div className={styles.durationBadge} style={{ fontSize: '11px', lineHeight: 1 }}>{formatDuration(video.duration)}</div>
                                )}
                                {video.last_pos > 0 && video.duration > 0 && (
                                    <div className={styles.progressBarContainer}>
                                        <div className={styles.progressBarFill} style={{ width: `${Math.min(100, (video.last_pos / video.duration) * 100)}%` }} />
                                    </div>
                                )}
                                {viewMode === 'grid-poster' && (
                                    <div className={styles.posterTitle} title={videoName(video, true, showDisplayName)}>
                                        {filenameToDisplay}{video.display_name ? ` ${video.display_name}` : ''}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                ) : (
                    <>
                        {(!video.has_thumbnail || imageError) ? (
                            <div className={styles.noImage} style={{ fontSize: '0.75rem' }}>NO IMAGE</div>
                        ) : (
                            video.id && (<img src={`/api/video/${video.id}/thumbnail?s=${video.thumbnail_size || 0}${thumbnailBuster ? `&t=${thumbnailBuster}` : ''}`} alt={videoName(video, true, showDisplayName)} loading="lazy" className={styles.thumbnailImg} onError={() => setImageError(true)} />)
                        )}
                        {viewMode !== 'grid-poster' && (
                            <div className={styles.durationBadge} style={{ fontSize: '11px', lineHeight: 1 }}>{formatDuration(video.duration)}</div>
                        )}
                        {video.last_pos > 0 && video.duration > 0 && (
                            <div className={styles.progressBarContainer}>
                                <div className={styles.progressBarFill} style={{ width: `${Math.min(100, (video.last_pos / video.duration) * 100)}%` }} />
                            </div>
                        )}
                        {viewMode === 'grid-poster' && (
                            <div className={styles.posterTitle} title={videoName(video, true, showDisplayName)}>
                                {filenameToDisplay}{video.display_name ? ` ${video.display_name}` : ''}
                            </div>
                        )}
                    </>
                )}
                {!isHovered && isHighlighted && (
                    <div className={styles.nextBadge}>NEXT</div>
                )}
                {!isHovered && <div className={styles.hoverOverlay} style={{ opacity: isHovered ? 0 : 1 }} />}
                {extMeta && (
                    <ExtThumbOverlays video={video} folder={viewMode === 'grid-poster' ? '' : getFolderName(video.path)} durationClass={styles.durationBadge} />
                )}
                {extMeta && viewMode === 'grid-poster' && <ExtCardMeta video={video} poster />}
                {(isHovered && isThumbnailHovered) && (
                    <>
                        {showThumbnailButton && hasVideo && (
                            <div onClick={handleSetThumbnail} onMouseDown={(e) => e.stopPropagation()} className={styles.quickThumbnailButton} title="クイックサムネイル" />
                        )}
                        <div
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPreviewMuted(!isPreviewMuted); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`${styles.volumeButton} ${!isPreviewMuted ? 'active' : ''}`}
                            title={isPreviewMuted ? 'ミュート' : '音声あり (動画が開始できない場合はミュートにしてください)'}
                        >
                            {isPreviewMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </div>
                        <div ref={seekBarRef}
                            className={styles.seekBarContainer}
                            onMouseDown={handleMouseDown} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        >
                            <div className={styles.seekBarRail}>
                                <div className={styles.seekBarFill} style={{ width: `${progress}%`, transition: isDragging ? 'none' : 'width 0.1s linear' }} />
                            </div>
                        </div>
                    </>
                )}
                {/* LadyTube: 品番でまとめたカードの「N本」(サーバーが group=1 のときだけ ext_group_count を返す)。
                    押すとまとめた動画の一覧を出す (server/ext/public/groupview.js)。見た目は womanlive-ext.css の .wlext-group-badge */}
                {video.ext_group_count > 1 && (
                    <div className="wlext-group-badge" title="まとめた動画を一覧で表示"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.WLExt?.openGroupMembers?.(video.id); }}
                    >
                        <Layers size={12} /><span>{video.ext_group_count}本</span>
                    </div>
                )}
            </div>
            {
                <div title={`${video.path}${video.display_name ? ' ' + video.display_name : ''}`} className={styles.infoContainer}>
                    <div className={css`overflow: hidden;`}>
                        <div className={styles.filename}>{filenameToDisplay}{video.display_name ? ` ${video.display_name}` : ''}</div>
                        {/* LadyTube: 検索画面ではフォルダ名をサムネ左下へ移し、ここには評価の行と出演者の行を置く */}
                        {!extMeta && <div className={styles.folderName}>{getFolderName(video.path)}</div>}
                        {extMeta && viewMode !== 'grid-poster' && <ExtCardMeta video={video} list={viewMode === 'list'} />}
                        {extMeta && viewMode === 'list' && <ExtPerformers video={video} />}
                    </div>
                    <div
                        className={styles.menuBtnWrapper}
                        onClick={e => e.preventDefault()}
                    >
                        <div
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveMenuId(showTagMenu ? null : video.id); }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={`${styles.menuBtn} ${showTagMenu ? styles.menuBtnActive : ''}`}
                        >
                            <MoreVertical size={18} />
                        </div>
                        {renderTagMenu()}
                    </div>
                    {tags.length > 0 && extMeta && viewMode === 'list' && (
                        <ExtTagRow genres={video.ext_genres || []} tags={tags} className={styles.tagBadgeContainer} badgeClass={styles.tagBadge} />
                    )}
                    {tags.length > 0 && !(extMeta && viewMode === 'list') && (
                        <div className={styles.tagBadgeContainer}>
                            {tags.slice(0, 5).map((tag, i) => (
                                <span key={i} className={styles.tagBadge}>{tag}</span>
                            ))}
                            {tags.length > 5 && (<span className={styles.tagBadge} style={{ cursor: 'help' }} title={tags.slice(5).join(', ')}>...</span>)}
                        </div>
                    )}
                </div>
            }
        </Link >
    );
}

export default function VideoList({ videos, onPlay, viewMode = 'grid-lg', highlightedId, onVideoUpdate, extMeta = false }) {
    const { showThumbnailButton } = useUI();
    const [lastPreviewedId, setLastPreviewedId] = useState(null);
    const [allTags, setAllTags] = useState([]);
    const [activeMenuId, setActiveMenuId] = useState(null);
    const [isPreviewMuted, setIsPreviewMuted] = useState(() => {
        return localStorage.getItem('preview_muted') !== 'false'; // Default true
    });
    const [volume] = useState(() => {
        const saved = localStorage.getItem('player_volume');
        return saved !== null ? parseFloat(saved) : 1;
    });

    useEffect(() => {
        localStorage.setItem('preview_muted', isPreviewMuted.toString());
    }, [isPreviewMuted]);

    useEffect(() => {
        api.getTags()
            .then(tags => {
                if (Array.isArray(tags)) {
                    setAllTags(tags.map(t => t.name));
                }
            })
            .catch(err => console.error('Failed to fetch tags for menu:', err));
    }, []);

    const containerClass = viewMode === 'list' ? styles.listView : styles.grid;
    if (videos.length === 0) return (<div className={containerClass}></div>);
    return (
        <div className={`${containerClass} ${viewMode === 'grid-sm' ? 'small' : ''} ${viewMode === 'grid-poster' ? 'poster' : ''} ${viewMode === 'home' ? 'home' : ''} ${viewMode === 'list' ? 'list' : ''}`}>
            {activeMenuId && (
                <div
                    className={styles.modalBackdrop}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveMenuId(null);
                    }}
                />
            )}
            {
                videos.map((video) => (
                    <VideoCard key={video.id} video={video} onClick={onPlay} viewMode={viewMode} isHighlighted={highlightedId && video.id.toString() === highlightedId.toString()} onUpdate={onVideoUpdate} showThumbnailButton={showThumbnailButton} isLastPreviewed={lastPreviewedId === video.id} setLastPreviewedId={setLastPreviewedId} allTags={allTags} activeMenuId={activeMenuId} setActiveMenuId={setActiveMenuId} isPreviewMuted={isPreviewMuted} setIsPreviewMuted={setIsPreviewMuted} volume={volume} extMeta={extMeta} />
                ))
            }
        </div >
    );
}
