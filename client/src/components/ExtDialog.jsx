// LadyTube: 拡張と同じ見た目のダイアログ (拡張の core.js の WL.dialog と同じ形。見た目は womanlive-ext.css の .wlext-dialog)。
// 外側・✕・「キャンセル」・Esc で閉じる。ExtDialogHost は utils/extDialog.js の openExtDialog で開いたものを置く (App.jsx)。
import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { closeExtDialog, extDialogSnapshot, subscribeExtDialog } from '../utils/extDialog';

export function ExtDialog({ title, onClose, children }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return createPortal(
        <div className="wlext-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="wlext-dialog">
                <div className="wlext-dialog-header"><span className="wlext-dialog-title">{title}</span><span className="wlext-close-x" onClick={onClose}>✕</span></div>
                <div className="wlext-dialog-body">{children}</div>
                <div className="wlext-dialog-footer"><button className="wlext-btn" onClick={onClose}>キャンセル</button></div>
            </div>
        </div>,
        document.body
    );
}

export function ExtDialogHost() {
    const cur = useSyncExternalStore(subscribeExtDialog, extDialogSnapshot);
    if (!cur) return null;
    const { Component, props } = cur;
    return <Component {...props} onClose={closeExtDialog} />;
}
