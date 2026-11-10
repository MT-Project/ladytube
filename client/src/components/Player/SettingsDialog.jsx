import React, { useEffect, useRef } from 'react';
import { css } from '@linaria/core';
import { theme } from '../../theme';

// Linaria styles
const styles = {
    overlay: css`
        position: absolute;
        inset: 0;
        z-index: 100;
        pointer-events: auto;
    `,
    dialog: css`
        position: absolute;
        bottom: 50px;
        right: 1rem;
        width: 300px;
        max-height: 80%;
        background-color: ${theme.colors.bg.modal};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow: hidden;
        z-index: 101;
    `,
    content: css`
        padding: 1.25rem 1.25rem 1.5rem;
        overflow-y: auto;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    `,
    section: css`
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
    `,
    sectionTitle: css`
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: ${theme.colors.text.secondary};
        border-bottom: 1px solid ${theme.colors.border.primary};
        padding-bottom: 0.25rem;
    `,
    settingRow: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    `,
    label: css`
        font-size: 0.875rem;
        color: ${theme.colors.text.primary};
        white-space: nowrap;
    `,
    select: css`
        padding: 0.25rem 0.5rem;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 4px;
        font-size: 0.875rem;
        outline: none;
        cursor: pointer;
        transition: border-color 0.2s;
        &:focus {
            border-color: ${theme.colors.border.focus};
        }
    `,
    toggleRow: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
    `,
    toggleLabel: css`
        font-size: 0.875rem;
        color: ${theme.colors.text.primary};
    `,
    toggle: css`
        width: 40px;
        height: 20px;
        border-radius: 10px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s;
    `,
    toggleKnob: css`
        position: absolute;
        top: 2px;
        width: 16px;
        height: 16px;
        background-color: white;
        border-radius: 50%;
        transition: left 0.2s;
        box-shadow: 0 1px 2px rgba(0,0,0,0.3);
    `,
};

const SettingsDialog = ({
    showSettings,
    setShowSettings,
    quality,
    setQuality,
    transcodeSeekDebounce,
    setTranscodeSeekDebounce,
    playbackSpeed,
    setPlaybackSpeed,
    hwDecode,
    setHwDecode,
    autoFullScreen,
    setAutoFullScreen,
    isNative,
    handleSeek,
    currentTime,
    subtitlesEnabled,
    setSubtitlesEnabled
}) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!showSettings || !dialogRef.current) return;

        const handleWheel = (e) => {
            e.stopPropagation();
        };

        const dialog = dialogRef.current;
        dialog.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            dialog.removeEventListener('wheel', handleWheel);
        };
    }, [showSettings]);

    if (!showSettings) return null;

    const stopPropagation = (e) => {
        e.stopPropagation();
    };

    // 再生速度オプション (0.5x ~ 3.0x, 0.1刻み)
    const speedOptions = [];
    for (let s = 0.5; s <= 3.05; s += 0.1) {
        const val = Math.round(s * 10) / 10;
        speedOptions.push(val);
    }

    // シーク遅延オプション (100ms ~ 400ms, 50ms刻み)
    const seekDebounceOptions = [100, 150, 200, 250, 300, 350, 400];

    return (
        <div
            className={styles.overlay}
            onClick={() => setShowSettings(false)}
            onKeyDown={stopPropagation}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
        >
            <div
                ref={dialogRef}
                className={styles.dialog}
                onClick={stopPropagation}
            >
                <div className={styles.content}>
                    {/* 一般 Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>一般</div>

                        {/* Speed Setting */}
                        <div className={styles.settingRow}>
                            <span className={styles.label}>再生速度</span>
                            <select
                                className={styles.select}
                                value={playbackSpeed}
                                onChange={(e) => {
                                    const v = parseFloat(e.target.value);
                                    setPlaybackSpeed(v);
                                    localStorage.setItem('player_speed', v.toString());
                                }}
                            >
                                {speedOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}x
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Subtitles Setting */}
                        <div className={styles.toggleRow}>
                            <span className={styles.toggleLabel}>字幕</span>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newVal = !subtitlesEnabled;
                                    setSubtitlesEnabled(newVal);
                                    localStorage.setItem('player_subtitles_enabled', newVal.toString());
                                }}
                                className={styles.toggle}
                                style={{ backgroundColor: subtitlesEnabled ? theme.colors.accent.primary : '#4b5563' }}
                            >
                                <div className={styles.toggleKnob} style={{ left: subtitlesEnabled ? '22px' : '2px' }}></div>
                            </div>
                        </div>

                        {/* Auto Fullscreen Setting */}
                        <div className={styles.toggleRow}>
                            <span className={styles.toggleLabel}>横向きフルスクリーン</span>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newVal = !autoFullScreen;
                                    setAutoFullScreen(newVal);
                                    localStorage.setItem('player_auto_fullscreen', newVal.toString());
                                }}
                                className={styles.toggle}
                                style={{ backgroundColor: autoFullScreen ? theme.colors.accent.primary : '#4b5563' }}
                            >
                                <div className={styles.toggleKnob} style={{ left: autoFullScreen ? '22px' : '2px' }}></div>
                            </div>
                        </div>
                    </div>

                    {/* トランスコード Section */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>トランスコード</div>

                        {/* Quality Setting */}
                        <div className={styles.settingRow}>
                            <span className={styles.label}>画質</span>
                            <select
                                className={styles.select}
                                value={quality}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setQuality(val);
                                    localStorage.setItem('player_quality', val.toString());
                                    if (!isNative) setTimeout(() => handleSeek(currentTime), 0);
                                }}
                            >
                                <option value={5}>5 (最高)</option>
                                <option value={4}>4 (高)</option>
                                <option value={3}>3 (中)</option>
                                <option value={2}>2 (低)</option>
                                <option value={1}>1 (最低)</option>
                            </select>
                        </div>

                        {/* Seek Debounce Setting */}
                        <div className={styles.settingRow}>
                            <span className={styles.label}>シーク遅延</span>
                            <select
                                className={styles.select}
                                value={transcodeSeekDebounce}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    setTranscodeSeekDebounce(val);
                                    localStorage.setItem('player_transcode_debounce', val.toString());
                                }}
                            >
                                {seekDebounceOptions.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}ms
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Hardware Decode Setting */}
                        <div className={styles.toggleRow}>
                            <span className={styles.toggleLabel}>ハードウェアデコード</span>
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newVal = !hwDecode;
                                    setHwDecode(newVal);
                                    localStorage.setItem('player_hw_decode', newVal.toString());
                                    if (!isNative) {
                                        setTimeout(() => handleSeek(currentTime), 0);
                                    }
                                }}
                                className={styles.toggle}
                                style={{ backgroundColor: hwDecode ? theme.colors.accent.primary : '#4b5563' }}
                            >
                                <div className={styles.toggleKnob} style={{ left: hwDecode ? '22px' : '2px' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsDialog;

