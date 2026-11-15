// LadyTube: 動画ページの標準モード (v3.1.7 までの server/ext/public/standard.js を移したもの)。
// 動画が横いっぱいの本家の表示 (シアターモード) に、動画の右へ情報欄を置く「標準モード」を足す。
//  ・切替はプレイヤーの「プレイヤー設定」の右 (ExtLayoutButton)。状態は端末に保存 (既定はシアター)
//  ・標準モードは ヘッダー / 動画 / 右の情報欄 / タイトルの行 だけを1画面に収める
//  ・右の情報欄は上の矢印か項目名で切り替え、欄の中だけスクロールする
//      サムネイル = 本体のスクリーンショット欄 (カバーも) / 動画情報 = 本体の詳細欄 / イメージリスト = 本体のイメージリスト
//      (開いている間だけ項目が出る) / 同じシリーズ・関連動画 = ExtVideoRow.jsx の ExtStdSeries / ExtStdRelated (v3.2.1 までは拡張の standard.js)
// 本体の要素は動かさず、womanlive-ext.css の body.wlext-std の規則で右欄の位置へ重ねる。目印は WatchPage が付ける
// data-wlext-std。狭い画面 (幅1000px未満) とフルスクリーン中はシアターモードのまま。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, RectangleHorizontal, PanelRight } from 'lucide-react';
import { ExtStdRelated, ExtStdSeries } from './ExtVideoRow';

const TAB_KEY = 'wlext_std_tab';
const WIDE = '(min-width: 1000px)';
const TABS = [
    // 名前は右欄の幅 (画面の27%) に4つが収まるよう短くしてある
    { key: 'media', label: 'サムネイル' },     // カバーとスクリーンショット
    { key: 'series', label: '同じシリーズ' },   // 同じ品番のパートと、同じシリーズの作品
    { key: 'related', label: '関連' },         // 関連動画
    { key: 'info', label: '情報' },            // 動画情報 (タグ・詳細)
    { key: 'images', label: 'イメージリスト' },   // イメージリストを開いている間だけ
];

function useWide() {
    const [wide, setWide] = useState(() => window.matchMedia(WIDE).matches);
    useEffect(() => {
        const mq = window.matchMedia(WIDE);
        const update = () => setWide(mq.matches);
        mq.addEventListener('change', update);
        window.addEventListener('resize', update);
        return () => { mq.removeEventListener('change', update); window.removeEventListener('resize', update); };
    }, []);
    return wide;
}

// 切替ボタン。className はプレイヤーの他のボタンと同じもの (PlayerControls が渡す)
export function ExtLayoutButton({ className, standard, onToggle }) {
    const wide = useWide();
    return (
        <button className={className + ' wlext-layout-btn'} title={standard ? 'シアターモードへ変更' : '標準モードへ変更'}
            style={{ display: wide ? '' : 'none' }} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
            {standard ? <RectangleHorizontal size={20} /> : <PanelRight size={20} />}
        </button>
    );
}

export default function ExtStandard({ vid, standard, imageListOpen, relatedIds, nextVideoId }) {
    const wide = useWide();
    const [fullscreen, setFullscreen] = useState(() => !!document.fullscreenElement);
    useEffect(() => {
        const update = () => setTimeout(() => setFullscreen(!!document.fullscreenElement), 50);
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    const active = standard && wide && !fullscreen;

    const [tab, setTab] = useState(() => { try { return localStorage.getItem(TAB_KEY) || 'media'; } catch { return 'media'; } });
    // イメージリストを開いたらその項目へ、閉じたら元の項目へ (標準モードの間だけ追う)
    const [imagesSeen, setImagesSeen] = useState(false);
    const [tabBeforeImages, setTabBeforeImages] = useState(null);
    if (active && imagesSeen !== imageListOpen) {
        setImagesSeen(imageListOpen);
        if (imageListOpen) { setTabBeforeImages(tab); setTab('images'); }
        else if (tab === 'images') setTab(tabBeforeImages || 'media');
    }
    const visible = TABS.filter(t => t.key !== 'images' || imageListOpen);
    const curTab = visible.some(t => t.key === tab) ? tab : 'media';
    const select = (key) => {
        setTab(key);
        if (key !== 'images') { try { localStorage.setItem(TAB_KEY, key); } catch { /* 覚えられなくても切り替えはする */ } }   // イメージリストは開いている間だけなので覚えない
    };
    const step = (dir) => {
        const i = Math.max(0, visible.findIndex(t => t.key === curTab));
        select(visible[(i + dir + visible.length) % visible.length].key);
    };

    // 右欄の見出しと一覧は、初めて標準モードにしたときに作り、あとは CSS で出し入れする
    const [built, setBuilt] = useState(false);
    if (active && !built) setBuilt(true);
    // 「同じシリーズ」「関連」は、選んだときにその動画で描く (同じ動画のあいだは描き直さない)
    const [seriesFor, setSeriesFor] = useState(null);
    const [relatedFor, setRelatedFor] = useState(null);   // { vid, ids, next }
    if (active && curTab === 'series' && seriesFor !== vid) setSeriesFor(vid);
    if (active && curTab === 'related' && (!relatedFor || relatedFor.vid !== vid)) setRelatedFor({ vid, ids: relatedIds || [], next: nextVideoId });

    // body のクラスと選んでいる項目は CSS が見る
    useLayoutEffect(() => {
        document.body.classList.toggle('wlext-std', active);
        if (active) document.body.dataset.wlextTab = curTab;
    }, [active, curTab]);
    useLayoutEffect(() => () => document.body.classList.remove('wlext-std'), []);

    // 大きさ: 動画の高さを「画面 − タイトルの行」に収める
    useLayoutEffect(() => {
        if (!active) return;
        const layout = () => {
            const nav = document.querySelector('#root nav');
            document.body.style.setProperty('--wlext-std-top', ((nav ? Math.round(nav.getBoundingClientRect().bottom) : 48) + 8) + 'px');
            const player = document.querySelector('#root [data-wlext-std="player"]');
            const title = document.querySelector('#root [data-wlext-std="title"]');
            if (!player || !title) return;
            // 動画の下端からタイトルの行の下端までは動画の高さに依らないので、その分を画面から引く
            const reserve = title.getBoundingClientRect().bottom - player.getBoundingClientRect().bottom + 16;
            const hgt = Math.max(200, Math.floor(window.innerHeight - player.getBoundingClientRect().top - reserve));
            document.body.style.setProperty('--wlext-std-player-h', hgt + 'px');
        };
        layout();
        const title = document.querySelector('#root [data-wlext-std="title"]');
        const ro = title ? new ResizeObserver(layout) : null;
        if (ro) ro.observe(title);
        window.addEventListener('resize', layout);
        return () => { if (ro) ro.disconnect(); window.removeEventListener('resize', layout); };
    }, [active, curTab, vid, imageListOpen]);

    const chipsRef = useRef(null);

    // 選んでいる項目名が見えるように横へ送る
    useEffect(() => {
        if (!active || !chipsRef.current) return;
        const c = chipsRef.current.querySelector('.wlext-std-chip.active');
        if (c) requestAnimationFrame(() => c.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
    }, [active, curTab, imageListOpen, built]);

    if (!built) return null;
    return createPortal(
        <>
            <div className="wlext-std-head">
                <div className="wlext-std-arrow" title="前の項目" onClick={() => step(-1)}><ChevronLeft size={18} /></div>
                <div className="wlext-std-chips" ref={chipsRef}>
                    {visible.map(t => (
                        <div key={t.key} className={'wlext-std-chip' + (t.key === curTab ? ' active' : '')} onClick={() => select(t.key)}>{t.label}</div>
                    ))}
                </div>
                <div className="wlext-std-arrow" title="次の項目" onClick={() => step(1)}><ChevronRight size={18} /></div>
            </div>
            <div className="wlext-std-pane" data-pane="series">{seriesFor && <ExtStdSeries key={seriesFor} vid={seriesFor} />}</div>
            <div className="wlext-std-pane" data-pane="related">
                {relatedFor && <ExtStdRelated key={relatedFor.vid} ids={relatedFor.ids} nextVideoId={relatedFor.next} />}
            </div>
        </>,
        document.body
    );
}
