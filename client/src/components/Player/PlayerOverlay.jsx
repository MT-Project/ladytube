import React from 'react';
import { X, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { css } from '@linaria/core';
import LoadingDots from '../LoadingDots';

// Linaria styles
const styles = {
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
        &:hover {
            background-color: rgba(0,0,0,0.7);
        }
    `,
    loadingCenter: css`
        position: absolute;
        z-index: 55;
        color: rgba(255,255,255,0.7);
        font-size: 1.5rem;
        font-weight: bold;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
    `,
    loadingCorner: css`
        position: absolute;
        z-index: 55;
        color: rgba(255,255,255,0.7);
        font-size: 1.5rem;
        font-weight: bold;
        top: 1rem;
    `,
    seekIndicatorLeft: css`
        position: absolute;
        left: 2rem;
        top: 45%;
        color: rgba(255, 255, 255, 0.7);
        pointer-events: none;
        animation: slideFadeOutLeft 0.5s ease-out forwards;
        z-index: 30;
    `,
    seekIndicatorRight: css`
        position: absolute;
        right: 2rem;
        top: 45%;
        color: rgba(255, 255, 255, 0.7);
        pointer-events: none;
        animation: slideFadeOutRight 0.5s ease-out forwards;
        z-index: 30;
    `,
    swipePreviewBadge: css`
        position: absolute;
        top: 10%;
        left: 50%;
        transform: translateX(-50%);
        z-index: 40;
        pointer-events: none;
        background-color: rgba(0, 0, 0, 0.6);
        color: #ffffff;
        padding: 0.6rem 1.2rem;
        border-radius: .4rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 1.25rem;
        font-weight: bold;
        border: 1px solid rgba(255, 255, 255, 0.15);
    `,
    toastsContainer: css`
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        z-index: 100;
        pointer-events: none;
    `,
    toast: css`
        background-color: #1e1e1e;
        color: white;
        padding: 0.75rem 1rem;
        border-radius: 0.375rem;
        border: 1px solid rgba(255, 255, 255, 0.45);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: center;
        gap: 0.75rem;
        min-width: 240px;
        animation: slideIn 0.3s ease-out;
        pointer-events: auto;
    `,
    toastMessage: css`
        font-size: 0.875rem;
    `,
};

const PlayerOverlay = ({
    isEmbedded,
    onClose,
    isInitiallyReady,
    isReady,
    seekIndicator,
    swipePreview,
    playerToasts
}) => {
    return (
        <>
            {!isEmbedded && (
                <button onClick={onClose} className={styles.closeButton}>
                    <X size={24} />
                </button>
            )}

            {/* Waiting Indicator ("...") */}
            {!isReady && (
                <LoadingDots
                    style={isInitiallyReady ? { right: isEmbedded ? '1rem' : '4rem' } : {}}
                    className={isInitiallyReady ? styles.loadingCorner : styles.loadingCenter}
                    dotStyle={{ textShadow: '0 0 4px rgba(0,0,0,0.5)' }}
                />
            )}

            <style>{`
                @keyframes slideFadeOutLeft { 
                    0% { opacity: 1; transform: translate(0, -50%); } 
                    100% { opacity: 0; transform: translate(-20px, -50%); } 
                }
                @keyframes slideFadeOutRight { 
                    0% { opacity: 1; transform: translate(0, -50%); } 
                    100% { opacity: 0; transform: translate(20px, -50%); } 
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>

            {/* Swipe Preview Badge (Displayed during touchmove swipe, top-center) */}
            {swipePreview && (
                <div className={styles.swipePreviewBadge}>
                    {swipePreview.direction === 'left' ? (
                        <>
                            <span>-{swipePreview.seconds}s</span>
                        </>
                    ) : (
                        <>
                            <span>+{swipePreview.seconds}s</span>
                        </>
                    )}
                </div>
            )}

            {/* Seek Indicators (Triggered on seek end or shortcut) */}
            {!swipePreview && seekIndicator === 'left' && (
                <div className={styles.seekIndicatorLeft}>
                    <ChevronLeft size={64} />
                </div>
            )}
            {!swipePreview && seekIndicator === 'right' && (
                <div className={styles.seekIndicatorRight}>
                    <ChevronRight size={64} />
                </div>
            )}

            {/* Player Toasts (for fullscreen) */}
            <div className={styles.toastsContainer}>
                {playerToasts && playerToasts.map(toast => (
                    <div key={toast.id} className={styles.toast}>
                        <CheckCircle size={20} color="#4ade80" />
                        {toast.customContent && (
                            <div style={{ flexShrink: 0 }}>
                                {toast.customContent}
                            </div>
                        )}
                        <span className={styles.toastMessage}>{toast.message}</span>
                    </div>
                ))}
            </div>
        </>
    );
};

export default PlayerOverlay;
