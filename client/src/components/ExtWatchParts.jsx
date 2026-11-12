// LadyTube: 動画ページに足す拡張の部品。
// スクリーンショットの表示サイズ (v3.1.9 までの server/ext/public/ssresize.js): 見た目の幅だけを変え、画像は変えない。
// スクリーンショットの欄の末尾に置くと、欄 (親) に --wlext-ss-w / --wlext-ss-h を付け、womanlive-ext.css がカード・カバーに当てる。
// 標準モードでは右欄の列幅の最小値になる。スクリーンショットが無い動画では出さない (欄の幅も既定に戻る)。
import { useLayoutEffect, useRef, useState } from 'react';
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
