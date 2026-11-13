// LadyTube: 動画ページに足す拡張の部品。
// カバー画像 (v3.1.10 までの server/ext/public/cover.js): スクリーンショットの欄の先頭に置き、押すと拡大する。
// 画像は /ext/api/video/:id/cover (フォルダの同名画像 → DB の順)。無ければカードごと消す。
// DMM の情報を反映したあとは videometa.js が window に wlext-cover-refresh ({ id }) を投げるので、取り直す。
// スクリーンショットの表示サイズ (v3.1.9 までの server/ext/public/ssresize.js): 見た目の幅だけを変え、画像は変えない。
// スクリーンショットの欄の末尾に置くと、欄 (親) に --wlext-ss-w / --wlext-ss-h を付け、womanlive-ext.css がカード・カバーに当てる。
// 標準モードでは右欄の列幅の最小値になる。スクリーンショットが無い動画では出さない (欄の幅も既定に戻る)。
// モバイルの操作 (v3.1.11 までの server/ext/public/mobileact.js): 本体の「フォルダーを開く」「アプリで再生」はサーバー機で
// 開くものなので、タッチ端末では代わりに「端末に保存」(ブラウザのダウンロード) と「アプリで開く」(Android は intent:、
// ほかは別タブ) を出す。置くかどうかは WatchPage が決める。
// 個人用モジュールなどの欄 (ExtWatchExtras): WLExt.watchExtras に足された「欄を作る関数 ({ id, boxClass, buttonClass }) => 要素」を、
// 足した順に「コーデック情報」の箱 (タッチ端末では MobileActions) の後ろへ置く。クラスは本体の箱とボタンのもの。
// 動画が変わると作り直す (v3.1.15 までは private の metacheck.js が「コーデック情報」のボタンを探して足していた)。
// コマ送り (v3.1.12 までの server/ext/public/framestep.js): Player がプレイヤーの枠の最後に置く。
//  ・「,」で1コマ戻し / 「.」で1コマ送り (本体は Space と矢印しか使っていない)
//  ・プレイヤー上の Shift+ホイールでも同じ。本体のホイール (5秒送り) は修飾キーを見ないので、document のキャプチャ段階で先に取る
//  ・タッチ端末では一時停止中に「左端=コマ戻し / 中央=再生 / 右端=コマ送り」を重ねる。本体のスワイプシークは枠の
//    touchstart (addEventListener) で始まるので、ボタンの touchstart を同じく addEventListener で止めて競合させない
//  ・フレームレートは /ext/api/video/:id/frameinfo (ffprobe)。変換再生の動画はコマ送りできないので、操作されたら一度だけ知らせる
//  ・時刻とフレーム番号の表示は body に出す。全画面の間はプレイヤーの枠の中 (v3.1.12 までは全画面で枠の後ろに隠れていた)
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ExtIcon';

const SS_KEY = 'wlext_ss_size';
const SS_MIN = 80, SS_MAX = 640, SS_DEFAULT = 160;   // 160px(本体の既定) の半分から横 640px まで

function readSsWidth() {
    try {
        const v = parseInt(localStorage.getItem(SS_KEY), 10);
        return v >= SS_MIN && v <= SS_MAX ? v : SS_DEFAULT;
    } catch { return SS_DEFAULT; }
}

export function ScreenshotSizeSlider() {
    const [width, setWidth] = useState(readSsWidth);
    const ref = useRef(null);
    useLayoutEffect(() => {
        const sec = ref.current.parentElement;   // 欄は本体の要素で style を持たないので、ここで直に付けても React とぶつからない
        sec.style.position = 'relative';         // スライダーを右上に重ねる基準
        sec.style.setProperty('--wlext-ss-w', width + 'px');
        sec.style.setProperty('--wlext-ss-h', Math.round(width * 9 / 16) + 'px');   // 16:9 を保つ
        return () => { ['position', '--wlext-ss-w', '--wlext-ss-h'].forEach(p => sec.style.removeProperty(p)); };
    }, [width]);
    const change = (e) => {
        const w = parseInt(e.target.value, 10);
        setWidth(w);
        try { localStorage.setItem(SS_KEY, String(w)); } catch { /* 保存できなくても表示は変わる */ }
    };
    return (
        <div ref={ref} className="wlext-ss-resize" title="スクリーンショットの表示サイズ">
            <Icon name="image" size={14} />
            <input type="range" min={SS_MIN} max={SS_MAX} step="10" value={width} className="wlext-ss-resize-input" onChange={change} />
            <span className="wlext-ss-resize-val">{width}px</span>
        </div>
    );
}

const noCover = new Set();   // カバーの無かった動画。開き直しても取りに行かない (取り直しの知らせで消す)

export function CoverCard({ videoId }) {
    const id = String(videoId);
    const [missing, setMissing] = useState(() => noCover.has(id));
    const [gen, setGen] = useState(0);   // 取り直すたびに増やして img を作り直す
    useEffect(() => {
        const onRefresh = (e) => {
            if (String(e.detail && e.detail.id) !== id) return;
            noCover.delete(id);
            setMissing(false);
            setGen(g => g + 1);
        };
        window.addEventListener('wlext-cover-refresh', onRefresh);
        return () => window.removeEventListener('wlext-cover-refresh', onRefresh);
    }, [id]);
    if (missing) return null;
    const url = '/ext/api/video/' + id + '/cover';
    return (
        <div key={gen} className="wlext-cover-card" title="カバー画像 (クリックで拡大)" onClick={() => window.WLExt.lightbox(url)}>
            <img alt="カバー画像" src={url} onError={() => { noCover.add(id); setMissing(true); }} />
            <div className="wlext-cover-badge">カバー</div>
        </div>
    );
}

// Android は intent: でアプリ選択に渡せる。開けなければ元の URL へ戻る (browser_fallback_url)。
// iOS などは別タブで開く (標準プレイヤーで再生し、共有メニューから他アプリへ渡せる)。
function openInApp(url) {
    if (/Android/i.test(navigator.userAgent)) {
        const scheme = location.protocol.replace(':', '');
        location.href = 'intent://' + url.replace(/^https?:\/\//, '') +
            '#Intent;scheme=' + scheme +
            ';action=android.intent.action.VIEW;type=video/*' +
            ';S.browser_fallback_url=' + encodeURIComponent(url) + ';end';
        return;
    }
    window.open(url, '_blank', 'noopener');
}

export function MobileActions({ videoId, boxClassName, buttonClassName }) {
    const url = location.origin + '/ext/api/video/' + videoId + '/file';   // 常に元ファイル (routes/file.js)
    return (
        <div className={boxClassName + ' wlext-mobileact'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <a className={buttonClassName} href={url + '?dl=1'} download="" style={{ textDecoration: 'none', display: 'inline-block' }}>端末に保存</a>
                <button className={buttonClassName} onClick={() => openInApp(url)}>アプリで開く</button>
            </div>
        </div>
    );
}

export function ExtWatchExtras({ videoId, boxClassName, buttonClassName }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const marker = ref.current;
        const nodes = new Map();
        const mount = () => {
            const extras = (window.WLExt && window.WLExt.watchExtras) || {};
            for (const [key, make] of Object.entries(extras)) {
                if (nodes.has(key) || !marker.parentNode) continue;
                const node = make({ id: String(videoId), boxClass: boxClassName, buttonClass: buttonClassName });
                nodes.set(key, node);
                marker.parentNode.insertBefore(node, marker);
            }
        };
        mount();
        window.addEventListener('DOMContentLoaded', mount, { once: true });   // 拡張は defer で読むので、まだの分は読み終わってから
        return () => { window.removeEventListener('DOMContentLoaded', mount); nodes.forEach(n => n.remove()); };
    }, [videoId, boxClassName, buttonClassName]);
    return <template ref={ref} />;
}

function fmtFrameTime(t) {
    const s = Math.max(0, t);
    const m = Math.floor(s / 60);
    return m + ':' + String(Math.floor(s % 60)).padStart(2, '0') + '.' + String(Math.floor((s % 1) * 1000)).padStart(3, '0');
}
// 入力欄にいるときと、拡張のダイアログが開いているときはキーを取らない
function typing() {
    const a = document.activeElement;
    if (a && ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName)) return true;
    if (a && a.isContentEditable) return true;
    return !!document.querySelector('.wlext-overlay');
}

// React の onClick では、本体が枠に addEventListener した touchstart (スワイプ) を止められないので直に付ける
function FrameZone({ cls, icon, onTap }) {
    return (
        <div className={'wlext-frame-z ' + cls} ref={(el) => {
            if (!el) return;
            const stop = (e) => e.stopPropagation();
            const click = (e) => { e.stopPropagation(); e.preventDefault(); onTap(); };
            el.addEventListener('touchstart', stop, { passive: true });
            el.addEventListener('click', click);
            return () => { el.removeEventListener('touchstart', stop); el.removeEventListener('click', click); };
        }}>
            <Icon name={icon} size={30} />
        </div>
    );
}

// videoRef / containerRef は Player の video 要素と枠。動画が変わると Player が key で作り直す
export function FrameStep({ videoId, videoRef, containerRef }) {
    const [info, setInfo] = useState(null);       // { native, fps }
    const [paused, setPaused] = useState(true);
    const [ind, setInd] = useState(null);         // コマ送りの表示 { text, host, on }
    const notified = useRef(false);
    const indTimer = useRef(null);

    useEffect(() => {
        fetch('/ext/api/video/' + videoId + '/frameinfo')
            .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
            .then(setInfo, () => setInfo({ native: false, fps: null }));
    }, [videoId]);

    // 本体と同じく video の play / pause を見る
    useEffect(() => {
        const v = videoRef.current; if (!v) return;
        const sync = () => setPaused(v.paused);
        const types = ['play', 'pause', 'emptied'];
        types.forEach(t => v.addEventListener(t, sync));
        return () => types.forEach(t => v.removeEventListener(t, sync));
    }, [videoRef]);

    const step = useCallback((dir) => {
        const v = videoRef.current;
        if (!v || !info) return;
        if (!info.native || !info.fps) {
            if (!notified.current && window.WLExt) {
                notified.current = true;
                window.WLExt.toast(info.native ? 'フレームレートを取得できないためコマ送りできません' : 'この動画は変換再生のためコマ送りできません', 'error');
            }
            return;
        }
        v.pause();
        const dt = 1 / info.fps;
        const dur = isFinite(v.duration) ? v.duration : 0;
        // 端で止める。最終フレームを踏み越えて ended にしないよう 1コマ手前までにする
        const next = Math.min(dur > 0 ? dur - dt : Infinity, Math.max(0, v.currentTime + dir * dt));
        v.currentTime = next;
        const frame = Math.round(next * info.fps) + 1;
        // 全画面では、本体がページ (html) を全画面にしてプレイヤーの枠を z-index: 9999 で前に出すので、
        // body や html に置くと枠の後ろに隠れる。全画面の間は枠の中に出す
        const host = document.fullscreenElement ? (containerRef.current || document.body) : document.body;
        setInd({ text: (dir < 0 ? '◀ ' : '▶ ') + fmtFrameTime(next) + '  (' + frame + 'F / ' + info.fps.toFixed(2) + 'fps)', host, on: true });
        clearTimeout(indTimer.current);
        indTimer.current = setTimeout(() => setInd(s => s && { ...s, on: false }), 900);
    }, [info, videoRef, containerRef]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== ',' && e.key !== '.') return;
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            if (typing() || !videoRef.current) return;
            e.preventDefault();
            step(e.key === ',' ? -1 : 1);
        };
        const onWheel = (e) => {
            if (!e.shiftKey || !e.deltaY) return;
            const box = containerRef.current;
            if (!box || !box.contains(e.target)) return;
            e.preventDefault();
            e.stopPropagation();
            step(e.deltaY < 0 ? -1 : 1);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('wheel', onWheel, { capture: true, passive: false });
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('wheel', onWheel, { capture: true });
        };
    }, [step, videoRef, containerRef]);

    const canStep = !!(info && info.native && info.fps);
    return (
        <>
            {/* 表示はタッチ端末だけ (womanlive-ext.css の @media (pointer: coarse)) */}
            <div className={'wlext-frame-ov' + (paused ? ' on' : '') + (canStep ? '' : ' nostep')}>
                <FrameZone cls="back" icon="step-back" onTap={() => step(-1)} />
                <FrameZone cls="play" icon="play" onTap={() => { const v = videoRef.current; if (v) v.play().catch(() => { }); }} />
                <FrameZone cls="fwd" icon="step-forward" onTap={() => step(1)} />
            </div>
            {ind && createPortal(<div className={'wlext-frame-ind' + (ind.on ? ' on' : '')}>{ind.text}</div>, ind.host)}
        </>
    );
}
