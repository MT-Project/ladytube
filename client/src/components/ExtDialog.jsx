// LadyTube: 拡張と同じ見た目のダイアログ (拡張の core.js の WL.dialog と同じ形。見た目は womanlive-ext.css の .wlext-dialog)。
// 外側・✕・「キャンセル」・Esc で閉じる。ExtDialogHost は utils/extDialog.js の openExtDialog で開いたものを置く (App.jsx)。
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { closeExtDialog, extDialogSnapshot, subscribeExtDialog } from '../utils/extDialog';

// onSave を渡すと「キャンセル」の右に saveLabel (既定「保存」) のボタンを置き、終わるまで押せなくする。danger は赤いボタン。
// cancelLabel は「キャンセル」の文字を替える (一括取得の「中止」「閉じる」)
export function ExtDialog({ title, onClose, onSave, saveLabel, cancelLabel, danger, children }) {
    const [busy, setBusy] = useState(false);
    const save = async () => { setBusy(true); try { await onSave(); } finally { setBusy(false); } };
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
                <div className="wlext-dialog-footer"><button className="wlext-btn" onClick={onClose}>{cancelLabel || 'キャンセル'}</button>
                    {onSave && <button className={'wlext-btn ' + (danger ? 'wlext-btn-danger' : 'wlext-btn-primary')} disabled={busy} onClick={save}>{saveLabel || '保存'}</button>}
                </div>
            </div>
        </div>,
        document.body
    );
}

// 確かめるだけのダイアログ (拡張の WL.dialog(title, body, { onSave, saveLabel, danger }) と同じ使い方)。
// openExtDialog(ExtConfirm, { title, body, saveLabel, danger, onSave: async (close) => ... }) で開く
export function ExtConfirm({ title, body, saveLabel, danger, onSave, onClose }) {
    return <ExtDialog title={title} onClose={onClose} onSave={() => onSave(onClose)} saveLabel={saveLabel} danger={danger}>{body}</ExtDialog>;
}

export function ExtDialogHost() {
    const cur = useSyncExternalStore(subscribeExtDialog, extDialogSnapshot);
    if (!cur) return null;
    const { Component, props } = cur;
    return <Component {...props} onClose={closeExtDialog} />;
}
