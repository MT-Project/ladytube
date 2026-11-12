// LadyTube: 動画ページに足す拡張の部品。
// カバー画像 (v3.1.10 までの server/ext/public/cover.js): スクリーンショットの欄の先頭に置き、押すと拡大する。
// 画像は /ext/api/video/:id/cover (フォルダの同名画像 → DB の順)。無ければカードごと消す。
// DMM の情報を反映したあとは videometa.js が window に wlext-cover-refresh ({ id }) を投げるので、取り直す。
// スクリーンショットの表示サイズ (v3.1.9 までの server/ext/public/ssresize.js): 見た目の幅だけを変え、画像は変えない。
// スクリーンショットの欄の末尾に置くと、欄 (親) に --wlext-ss-w / --wlext-ss-h を付け、womanlive-ext.css がカード・カバーに当てる。
// 標準モードでは右欄の列幅の最小値になる。スクリーンショットが無い動画では出さない (欄の幅も既定に戻る)。
// モバイルの操作 (v3.1.11 までの server/ext/public/mobileact.js): 本体の「フォルダーを開く」「アプリで再生」はサーバー機で
// 開くものなので、タッチ端末では代わりに「端末に保存」(ブラウザのダウンロード) と「アプリで開く」(Android は intent:、
// ほかは別タブ) を出す。置くかどうかは WatchPage が決める。class の wlext-mobileact は private の metacheck.js も目印にする。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
