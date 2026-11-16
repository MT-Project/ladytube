// LadyTube: 画像の拡大表示と切り取り (v3.2.1 までは拡張の core.js の WL.lightbox / WL.cropDialog)。
// 開くのは utils/imageDialogs.js の lightbox(src, { onEdit, onReset }) / cropDialog(dataUrl, onDone, opts)。
// 見た目は womanlive-ext.css の .wlext-lightbox* / .wlext-cropper-*。
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ExtDialog } from './ExtDialog';

// 画像を画面いっぱいに出す。どこを押しても・Esc でも閉じる。onEdit / onReset があればそのボタンも出す (押すと閉じてから呼ぶ)
export function ExtLightbox({ src, onEdit, onReset, onClose }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    const btn = (cls, label, run) => (
        <button className={cls} onClick={(e) => { e.stopPropagation(); onClose(); if (run) run(); }}>{label}</button>
    );
    return createPortal(
        <div className="wlext-lightbox" onClick={onClose}>
            <img src={src} />
            <div className="wlext-lightbox-actions">
                {onEdit && btn('wlext-btn wlext-btn-primary', '画像を変更', onEdit)}
                {onReset && btn('wlext-btn', 'デフォルトに戻す', onReset)}
                {btn('wlext-btn', '閉じる')}
            </div>
        </div>,
        document.body
    );
}

// 指定の比率に切り取る。ドラッグで位置、スライダーで拡大。「登録」で onDone(dataURL (PNG), view) を待ってから閉じる。
//  aspect: [幅, 高さ] (既定 1:1) / outW: 書き出す幅 (既定 600) / title / hint
//  fit: 'contain' は最初に画像全体を枠の中央に収める (余白は透明)。拡大すると切り取りになる
//  view: 枠に写っている範囲を、元の画像の幅・高さに対する割合で表したもの { x, y, w, h } (余白があると x,y<0・w,h>1)
export function ExtCropDialog({ src, onDone, aspect = [1, 1], outW = 600, fit, title, hint, onClose }) {
    const STAGE_W = 320;
    const STAGE_H = Math.max(80, Math.round(STAGE_W * aspect[1] / aspect[0]));
    const OUT_H = Math.round(outW * aspect[1] / aspect[0]);
    const stage = useRef(null), zoom = useRef(null);
    const st = useRef(null);   // { img, scale, minScale, coverScale, ox, oy, nw, nh } (描くたびに作り直さないので ref)

    useEffect(() => {
        const box = stage.current, range = zoom.current;
        const img = new Image();
        const s = st.current = { img, scale: 1, minScale: 1, coverScale: 1, ox: 0, oy: 0, nw: 0, nh: 0 };
        // 枠より大きい向きは枠を埋める範囲、小さい向きは枠の中だけ動かせる
        const paint = () => {
            if (s.scale < s.minScale) s.scale = s.minScale;
            const w = s.nw * s.scale, hh = s.nh * s.scale;
            s.ox = Math.min(Math.max(s.ox, Math.min(0, STAGE_W - w)), Math.max(0, STAGE_W - w));
            s.oy = Math.min(Math.max(s.oy, Math.min(0, STAGE_H - hh)), Math.max(0, STAGE_H - hh));
            img.style.width = w + 'px';
            img.style.height = hh + 'px';
            img.style.left = s.ox + 'px';
            img.style.top = s.oy + 'px';
        };
        s.center = (k) => {
            s.scale = k;
            s.ox = (STAGE_W - s.nw * k) / 2; s.oy = (STAGE_H - s.nh * k) / 2;
            range.value = String(k / s.minScale);
            paint();
        };
        img.onload = () => {
            s.nw = img.naturalWidth; s.nh = img.naturalHeight;
            s.coverScale = Math.max(STAGE_W / s.nw, STAGE_H / s.nh);
            s.minScale = fit === 'contain' ? Math.min(STAGE_W / s.nw, STAGE_H / s.nh) : s.coverScale;
            range.max = String(4 * s.coverScale / s.minScale);
            img.style.position = 'absolute';
            box.appendChild(img);
            s.center(s.minScale);
        };
        img.src = src;

        let dragging = false, sx = 0, sy = 0;
        const pt = (e) => { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; };
        const down = (e) => { dragging = true; const p = pt(e); sx = p.x - s.ox; sy = p.y - s.oy; box.style.cursor = 'grabbing'; e.preventDefault(); };
        const move = (e) => { if (!dragging) return; const p = pt(e); s.ox = p.x - sx; s.oy = p.y - sy; paint(); };
        const tmove = (e) => { move(e); e.preventDefault(); };
        const up = () => { dragging = false; box.style.cursor = 'grab'; };
        const onZoom = () => { s.scale = s.minScale * parseFloat(range.value); paint(); };
        // タッチはスクロールを止めたいので passive: false で付ける (React の onTouchStart では止められない)
        box.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
        box.addEventListener('touchstart', down, { passive: false }); box.addEventListener('touchmove', tmove, { passive: false }); box.addEventListener('touchend', up);
        range.addEventListener('input', onZoom);
        return () => {
            box.removeEventListener('mousedown', down); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
            box.removeEventListener('touchstart', down); box.removeEventListener('touchmove', tmove); box.removeEventListener('touchend', up);
            range.removeEventListener('input', onZoom);
            img.remove();
        };
    }, [src, fit, STAGE_H]);

    const save = async () => {
        const s = st.current;
        const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = OUT_H;
        const k = outW / STAGE_W;
        canvas.getContext('2d').drawImage(s.img, s.ox * k, s.oy * k, s.nw * s.scale * k, s.nh * s.scale * k);
        const view = { x: -s.ox / s.scale / s.nw, y: -s.oy / s.scale / s.nh, w: STAGE_W / s.scale / s.nw, h: STAGE_H / s.scale / s.nh };
        await onDone(canvas.toDataURL('image/png'), view);
        onClose();
    };
    return (
        <ExtDialog title={title || '画像を切り取り'} onClose={onClose} onSave={save} saveLabel="登録">
            <div>
                <div ref={stage} className="wlext-cropper-stage" style={{ width: STAGE_W + 'px', height: STAGE_H + 'px' }} />
                <div className="wlext-cropper-controls"><span>拡大</span><input ref={zoom} type="range" min="1" max="4" step="0.01" defaultValue="1" style={{ flex: '1' }} /></div>
                {fit === 'contain' && (
                    <div className="wlext-cropper-fit">
                        <button type="button" className="wlext-btn" onClick={() => st.current.center(st.current.minScale)}>全体を表示</button>
                        <button type="button" className="wlext-btn" onClick={() => st.current.center(st.current.coverScale)}>枠いっぱいに切り取る</button>
                    </div>
                )}
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary,#888)', marginTop: '0.4rem' }}>{hint || 'ドラッグで位置調整・スライダーで拡大して切り取ります。'}</div>
            </div>
        </ExtDialog>
    );
}
