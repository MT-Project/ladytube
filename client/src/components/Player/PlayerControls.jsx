import React, { useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Camera, Settings, Maximize } from 'lucide-react';
import { css } from '@linaria/core';
import { theme } from '../../theme';

// Linaria styles
const styles = {
    controlsContainer: css`
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(to top, rgba(0,0,0,0.9), transparent);
        padding: 0 1.25rem 0.25rem 1.25rem;
        transition: opacity 0.3s;
        padding-bottom: 0.25rem;
        z-index: 20;
    `,
    seekBarContainer: css`
        position: relative;
        width: 100%;
        height: 40px;
        cursor: pointer;
        display: flex;
        align-items: center;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
    `,
    previewContainer: css`
        position: absolute;
        bottom: 100%;
        transform: translateX(-50%);
        margin-bottom: 10px;
        background-color: black;
        border: 2px solid rgba(255, 255, 255, 0.4);
        border-radius: 4px;
        overflow: hidden;
        pointer-events: none;
        z-index: 30;
        display: flex;
        flex-direction: column;
        align-items: center;
    `,
    previewImageWrapper: css`
        position: relative;
        width: 160px;
        height: 90px;
    `,
    previewImage: css`
        width: 160px;
        height: 90px;
        object-fit: cover;
    `,
    previewError: css`
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #333;
        color: #9ca3af;
        font-size: 12px;
    `,
    previewEmpty: css`
        width: 160px;
        height: 90px;
        background-color: #333;
    `,
    previewTime: css`
        padding: 2px 6px;
        font-size: 11px;
        color: white;
        background-color: rgba(0,0,0,0.7);
        font-weight: bold;
    `,
    controlsRow: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        color: white;
        padding: 0.1rem 0.5rem 0.25rem;
    `,
    controlButton: css`
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        border-radius: 0.35rem;
        padding: 0.35rem;
        &:hover {
            background: rgba(120, 120, 120, 0.6);
        }
    `,
    volumeContainer: css`
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
    `,
    volumeBarContainer: css`
        width: 80px;
        height: 24px;
        display: flex;
        align-items: center;
        margin-left: 0.25rem;
        cursor: pointer;
        position: relative;
        user-select: none;
        -webkit-user-select: none;
        -webkit-tap-highlight-color: transparent;
        touch-action: none;
    `,
    volumeTrack: css`
        width: 100%;
        height: 4px;
        background-color: #4b5563;
        border-radius: 2px;
        position: relative;
    `,
    volumeFill: css`
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background-color: white;
        border-radius: 2px;
    `,
    volumeKnob: css`
        position: absolute;
        top: 50%;
        transform: translate(-50%, -50%);
        width: 12px;
        height: 12px;
        background-color: white;
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    `,
    timeDisplay: css`
        font-size: 0.75rem;
        font-family: monospace;
        opacity: 0.9;
        user-select: none;
    `,
    leftControls: css`
        display: flex;
        align-items: center;
        gap: 1rem;
    `,
    rightControls: css`
        display: flex;
        align-items: center;
        gap: 1rem;
    `,
    seekBarBackground: css`
        position: absolute;
        left: 0;
        right: 0;
        background-color: rgba(255,255,255,0.3);
        transition: height 0.1s;
    `,
    seekBarBuffer: css`
        position: absolute;
        height: 2px;
        background-color: transparent;
        bottom: 12px;
        opacity: 0.8;
        pointer-events: none;
    `,
    seekBarProgress: css`
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        background-color: #ff0000;
        transition: height 0.1s, width 0.1s linear;
    `,
    seekBarKnob: css`
        position: absolute;
        top: 50%;
        width: 15px;
        height: 15px;
        background-color: #ff0000;
        border-radius: 50%;
        transition: transform 0.1s, left 0.1s linear;
    `,
    screenshotMarker: css`
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 4px;
        background-color: white;
        border-radius: 1px;
        pointer-events: none;
        z-index: 5;
    `,
};

const PlayerControls = ({
    showControls,
    isInitiallyReady,
    isPlaying,
    togglePlay,
    currentTime,
    duration,
    formatTime,
    isMuted,
    toggleMute,
    volume,
    volumeBarRef,
    handleVolumeDragStart,
    isCapturing,
    onScreenshot,
    showSettings,
    setShowSettings,
    handleFullScreen,
    progressBarRef,
    handleSeekBarMouseMove,
    handleSeekBarMouseLeave,
    isSeekHovered,
    setIsSeekHovered,
    previewTime,
    previewPos,
    previewImage,
    isDraggingRef,
    onSeekStart,
    playbackSpeed,
    bufferedRanges = [],
    hasVideo = true,
    screenshots = []
}) => {
    const [isImageLoaded, setIsImageLoaded] = useState(false);
    const [hasImageError, setHasImageError] = useState(false);

    useEffect(() => {
        setIsImageLoaded(false);
        setHasImageError(false);
    }, [previewImage]);

    return (
        <div
            className={styles.controlsContainer}
            style={{
                opacity: showControls ? (isInitiallyReady ? 1 : 0.6) : 0,
                pointerEvents: isInitiallyReady ? 'auto' : 'none'
            }}
        >
            {/* Seek Bar */}
            <div
                className={styles.seekBarContainer}
                onMouseMove={handleSeekBarMouseMove}
                onMouseEnter={() => setIsSeekHovered(true)}
                onMouseLeave={() => {
                    setIsSeekHovered(false);
                    handleSeekBarMouseLeave();
                }}
                onMouseDown={onSeekStart}
                onTouchStart={onSeekStart}
                ref={progressBarRef}
            >
                {/* Preview Image */}
                {hasVideo && previewTime !== null && (
                    <div className={styles.previewContainer} style={{ left: previewPos }}>
                        {previewImage ? (
                            <div className={styles.previewImageWrapper}>
                                <img
                                    src={previewImage}
                                    onLoad={() => setIsImageLoaded(true)}
                                    onError={() => setHasImageError(true)}
                                    className={styles.previewImage}
                                    style={{
                                        filter: isImageLoaded ? 'none' : 'brightness(0.4)',
                                        display: hasImageError ? 'none' : 'block'
                                    }}
                                    alt="Preview"
                                />
                                {hasImageError && (
                                    <div className={styles.previewError}>
                                        取得できません
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.previewEmpty} />
                        )}
                        <div className={styles.previewTime}>
                            {formatTime(previewTime)}
                        </div>
                    </div>
                )}

                {/* Background Line */}
                <div className={styles.seekBarBackground} style={{
                    height: isSeekHovered ? '6px' : '2px'
                }}></div>

                {/* MSE Buffer Bars (Debug) */}
                {duration > 0 && bufferedRanges.map((range, idx) => (
                    <div
                        key={idx}
                        className={styles.seekBarBuffer}
                        style={{
                            left: `${(range.start / duration) * 100}%`,
                            width: `${((range.end - range.start) / duration) * 100}%`,
                        }}
                    />
                ))}

                {/* Progress Line */}
                <div
                    className={styles.seekBarProgress}
                    style={{
                        height: isDraggingRef.current || isSeekHovered ? '6px' : '2px',
                        width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    }}
                />

                {/* Screenshot Markers */}
                {duration > 0 && screenshots.map((shot, idx) => (
                    <div
                        key={shot.id || idx}
                        className={styles.screenshotMarker}
                        style={{
                            left: `${(shot.timestamp / duration) * 100}%`,
                            height: isDraggingRef.current || isSeekHovered ? '6px' : '0px',
                        }}
                    />
                ))}

                {/* Knob */}
                <div
                    className={styles.seekBarKnob}
                    style={{
                        left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                        transform: `translate(-50%, -50%) scale(${isDraggingRef.current || isSeekHovered ? 1 : 0})`,
                    }}
                />
            </div>

            {/* Controls Row */}
            <div className={styles.controlsRow}>

                {/* Left Controls */}
                <div className={styles.leftControls}>
                    <button onClick={togglePlay} className={styles.controlButton}>
                        {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                    </button>

                    <div className={styles.volumeContainer}>
                        <button onClick={toggleMute} className={styles.controlButton}>
                            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                        </button>

                        <div
                            ref={volumeBarRef}
                            className={styles.volumeBarContainer}
                            onMouseDown={handleVolumeDragStart}
                            onTouchStart={handleVolumeDragStart}
                        >
                            {/* Visual Track */}
                            <div className={styles.volumeTrack}>
                                {/* Filled Part */}
                                <div className={styles.volumeFill} style={{ width: `${volume * 100}%` }}></div>

                                {/* Knob */}
                                <div className={styles.volumeKnob} style={{ left: `${volume * 100}%` }}></div>
                            </div>
                        </div>
                    </div>

                    <span className={styles.timeDisplay}>
                        {formatTime(currentTime)}
                        <span className="player-duration-hide-mobile">
                            <span style={{ color: '#9ca3af', margin: '0 0.25rem' }}>/</span>
                            {formatTime(duration)}
                        </span>
                        {playbackSpeed && playbackSpeed !== 1 && (
                            <span className="player-duration-hide-mobile" style={{ marginLeft: '0.5rem', opacity: 0.8 }}>
                                {playbackSpeed}x
                            </span>
                        )}
                    </span>
                </div>

                {/* Right Controls */}
                <div className={styles.rightControls}>
                    {hasVideo && onScreenshot && (
                        <button
                            onClick={onScreenshot}
                            className={styles.controlButton}
                            style={{
                                cursor: isCapturing ? 'wait' : 'pointer',
                                opacity: isCapturing ? 0.6 : 1
                            }}
                            title="スクリーンショット"
                            disabled={isCapturing}
                        >
                            <Camera size={20} />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowSettings(!showSettings);
                        }}
                        className={styles.controlButton}
                        title="プレイヤー設定"
                    >
                        <Settings size={20} />
                    </button>
                    <button onClick={handleFullScreen} className={styles.controlButton} title="フルスクリーン">
                        <Maximize size={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PlayerControls;
