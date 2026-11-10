import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { css } from '@linaria/core';
import { theme } from '../theme';

// Linaria styles
// Linaria styles
const styles = {
    overlayContainer: css`
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 2147483647;
    `,
    toastsContainer: css`
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        pointer-events: auto;
    `,
    toast: css`
        background-color: ${theme.colors.bg.modal};
        color: ${theme.colors.text.primary};
        padding: 0.75rem 1rem;
        border-radius: 2px;
        border: 1px solid ${theme.colors.border.primary};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        min-width: 240px;
        animation: slideIn 0.3s ease-out;
    `,
    toastMessage: css`
        font-size: 0.875rem;
        white-space: pre-wrap;
    `,
    toastCustomContent: css`
        flex-shrink: 0;
    `,
    dialogOverlay: css`
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
    `,
    dialogBox: css`
        background-color: ${theme.colors.bg.modal};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 4px;
        padding: 1.5rem;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        transform: scale(1);
        animation: fadeIn 0.2s ease-out;
    `,
    dialogTitle: css`
        font-size: 1.125rem;
        font-weight: 400;
        color: ${theme.colors.text.primary};
        margin-bottom: 0.5rem;
    `,
    dialogMessage: css`
        color: ${theme.colors.text.secondary};
        margin-bottom: 1.5rem;
        font-size: 0.95rem;
        white-space: pre-wrap;
    `,
    dialogActions: css`
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
    `,
    cancelButton: css`
        padding: 0.3rem 1rem;
        background-color: transparent;
        color: ${theme.colors.text.secondary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 2px;
        cursor: pointer;
        font-size: 0.875rem;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    confirmButton: css`
        padding: 0.3rem 1rem;
        background-color: ${theme.colors.accent.primary};
        color: white;
        border: none;
        border-radius: 2px;
        cursor: pointer;
        font-size: 0.875rem;
        &:hover {
            background-color: ${theme.colors.accent.hover};
        }
    `,
    displaySettingsDialog: css`
        background-color: ${theme.colors.bg.modal};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 4px;
        max-width: 23rem;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        position: relative;
        padding: 0.4rem;
    `,
    closeButton: css`
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        background: transparent;
        border: none;
        color: ${theme.colors.text.secondary};
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        &:hover {
            color: ${theme.colors.text.primary};
        }
    `,
    dialogBody: css`
        padding: 0.7rem 1rem 2rem;
    `,

    settingsRow: css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 1.25rem;
        gap: 1.5rem;
    `,
    settingsLabel: css`
        font-size: 0.95rem;
        color: ${theme.colors.text.primary};
    `,
    switchTrack: css`
        position: relative;
        width: 36px;
        height: 20px;
        background-color: #4b5563;
        border-radius: 20px;
        cursor: pointer;
        transition: background-color 0.2s;
        flex-shrink: 0;
        &.active {
            background-color: ${theme.colors.accent.primary};
        }
    `,
    switchThumb: css`
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        background-color: white;
        border-radius: 50%;
        transition: left 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.4);
        &.active {
            left: 18px;
        }
    `,
    keyframes: css`
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `,
};

export default function UIOverlay({
    toasts,
    dialog,
    onDialogConfirm,
    onDialogCancel,
    isDisplaySettingsOpen,
    setIsDisplaySettingsOpen,
    showExtension,
    showThumbnailButton,
    toggleExtension,
    toggleThumbnailButton
}) {
    return (
        <div className={styles.overlayContainer}>

            {/* Toasts Container (Top Right) */}
            <div className={styles.toastsContainer}>
                {toasts.map(toast => (
                    <div key={toast.id} className={styles.toast}>
                        {toast.type === 'success' && <CheckCircle size={20} color={theme.colors.status.success} />}
                        {toast.type === 'error' && <AlertCircle size={20} color={theme.colors.status.error} />}
                        {toast.type === 'info' && <Info size={20} color={theme.colors.status.info} />}
                        {toast.customContent && (
                            <div className={styles.toastCustomContent}>
                                {toast.customContent}
                            </div>
                        )}
                        <span className={styles.toastMessage}>{toast.message}</span>
                    </div>
                ))}
            </div>

            {/* Dialog Overlay */}
            {dialog.isOpen && (
                <div
                    className={styles.dialogOverlay}
                    onClick={dialog.type === 'confirm' ? onDialogCancel : onDialogConfirm}
                >
                    <div className={styles.dialogBox} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.dialogTitle}>{dialog.title}</h3>
                        <p className={styles.dialogMessage}>{dialog.message}</p>
                        <div className={styles.dialogActions}>
                            {dialog.type === 'confirm' && !dialog.hideCancel && (
                                <button onClick={onDialogCancel} className={styles.cancelButton}>
                                    {dialog.cancelLabel}
                                </button>
                            )}
                            <button onClick={onDialogConfirm} className={styles.confirmButton}>
                                {dialog.confirmLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Display Settings Dialog */}
            {isDisplaySettingsOpen && (
                <div
                    className={styles.dialogOverlay}
                    onClick={() => setIsDisplaySettingsOpen(false)}
                >
                    <div className={styles.displaySettingsDialog} onClick={e => e.stopPropagation()}>
                        <button
                            onClick={() => setIsDisplaySettingsOpen(false)}
                            className={styles.closeButton}
                            title="閉じる"
                        >
                            <X size={24} />
                        </button>
                        <div className={styles.dialogTitle} style={{ margin: '0 0.4rem 1rem', fontSize: '1rem' }}>表示設定</div>
                        <div className={styles.dialogBody}>
                            <div className={styles.settingsRow}>
                                <span className={styles.settingsLabel}>拡張子を表示する</span>
                                <div
                                    className={`${styles.switchTrack} ${showExtension ? 'active' : ''}`}
                                    onClick={toggleExtension}
                                >
                                    <div className={`${styles.switchThumb} ${showExtension ? 'active' : ''}`} />
                                </div>
                            </div>

                            <div className={styles.settingsRow}>
                                <span className={styles.settingsLabel}>クイックサムネイルボタンを表示する</span>
                                <div
                                    className={`${styles.switchTrack} ${showThumbnailButton ? 'active' : ''}`}
                                    onClick={toggleThumbnailButton}
                                >
                                    <div className={`${styles.switchThumb} ${showThumbnailButton ? 'active' : ''}`} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
