// LadyTube: 検索結果のサイドメニュー (絞り込み)。v3.1.6 までの server/ext/public/searchfacets.js を移したもの。
// 評価と再生時間 (範囲スライダー) と ジャンル / タグ / メーカー / 出演者 / シリーズ を出し、押すと今の検索に足す (もう一度押すと外す)。
// 上位5件を出し、残りは折りたたむ。候補はサーバーの /ext/api/search/facets (一覧と同じ母集団を数える)。
// 画面左上の「絞り込み」ボタンで開閉 (位置は固定)。既定は PC=開く / モバイル=閉じる、切り替えた状態はその端末に覚える。
// 見た目は womanlive-ext.css の .wlext-facets* (管理画面のサイドメニュー ExtSettingsParts.jsx の ExtSettingsNav と共用) と、body の
// wlext-facets-on / wlext-facets-open。一覧 (contentRef) の左の余白はここで決める。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ExtIcon';
import { searchToken } from '../utils/formatters';

// 表示順は上から 視聴 → タグ → ジャンル → メーカー → 出演者 → シリーズ → URL (評価と再生時間はその上)。
// 各項目の先頭の「未設定」は値 none (サーバーの search.js の @xxx:none)。URL は「未設定」と「設定あり」(any) だけ (v3.15.1)
const SECTIONS = [
    { key: 'play', field: 'play', label: '視聴', icon: 'play' },
    { key: 'tag', field: 'tag', label: 'タグ', icon: 'tag' },
    { key: 'genre', field: 'genre', label: 'ジャンル', icon: 'layers' },
    { key: 'maker', field: 'maker', label: 'メーカー', icon: 'factory' },
    { key: 'performer', field: 'performer', label: '出演者', icon: 'users' },
    { key: 'series', field: 'series', label: 'シリーズ', icon: 'library' },
    { key: 'url', field: 'url', label: 'URL', icon: 'globe' },
];
const TOP_N = 5;
const MAX_RATING = 5;

/* ---------- 検索語 (項目トークン + キーワード) の読み書き ---------- */
// サーバー側 search.js の splitQuery と同じ分解をする。'@' で始まらないものは丸ごとキーワード。
function parseQuery(q) {
    const s = String(q || '').trim();
    if (!s) return { tokens: [], keyword: '' };
    if (!s.startsWith('@')) return { tokens: [], keyword: s };
    const re = /(\w+)\s*:\s*("((?:[^"\\]|\\.)*)"|[^\s]+)/g;
    const body = s.slice(1);
    const tokens = [];
    let m, last = 0, rest = '';
    while ((m = re.exec(body)) !== null) {
        rest += body.slice(last, m.index);
        last = m.index + m[0].length;
        tokens.push({ field: m[1].toLowerCase(), value: m[3] !== undefined ? m[3].replace(/\\(.)/g, '$1') : m[2] });
    }
    rest += body.slice(last);
    return { tokens, keyword: rest.trim() };
}
// キーワードは末尾に残す。絞り込みを全部外したら '@' を付けず本家の検索語の形に戻す
function buildQuery(tokens, keyword) {
    if (!tokens.length) return keyword || '';
    const parts = tokens.map(t => searchToken(t.field, t.value));
    if (keyword) parts.push(keyword);
    return '@' + parts.join(' ');
}

/* ---------- 範囲のスライダー (評価 0〜5 と、再生時間の分) ---------- */
// トークンは AND なので、範囲は ">=下限" と "<=上限" の2つで表せる。つまみは目盛り (stops) の上だけを動く。
// 下限が先頭の目盛りなら下限のトークンを付けない (評価は未評価、再生時間は長さがわからない動画も含む)。
// 上限が最後の目盛りなら上限のトークンを付けない (再生時間の最後の目盛りは「上限なし」)
const RANGES = {
    rating: {
        field: 'rating', label: '評価', icon: 'star', stops: [0, 1, 2, 3, 4, 5], scale: ['0', String(MAX_RATING)],
        text: (lo, hi, all) => (all ? 'すべて' : (lo === hi ? String(lo) : lo + '〜' + hi)),
    },
    // 再生時間 (v3.13.0)。目盛りは等間隔でない (短い動画の多いライブラリと長い動画の多いライブラリのどちらでも使えるように)
    duration: {
        field: 'duration', label: '再生時間', icon: 'clock', stops: [0, 15, 30, 45, 60, 90, 120, 180, 240], scale: ['0分', '240分〜'],
        text: (lo, hi, all, top) => (all ? 'すべて' : top ? lo + '分〜' : lo === 0 ? '〜' + hi + '分' : (lo === hi ? lo + '分' : lo + '〜' + hi + '分')),
    },
};
// トークン → 目盛りの番号。目盛りに無い値 (手で書いたもの) は、その値を含む広めの範囲として読む
function rangeOf(tokens, { field, stops }) {
    let lo = stops[0], hi = Infinity;
    tokens.filter(t => t.field === field).forEach(t => {
        const m = /^(>=|<=|>|<|=)?\s*(\d+)/.exec(String(t.value).trim());
        if (!m) return;
        const op = m[1] || '=', n = parseInt(m[2], 10);
        if (op === '>=') lo = Math.max(lo, n);
        else if (op === '>') lo = Math.max(lo, n + 1);
        else if (op === '<=') hi = Math.min(hi, n);
        else if (op === '<') hi = Math.min(hi, n - 1);
        else { lo = Math.max(lo, n); hi = Math.min(hi, n); }
    });
    const last = stops.length - 1;
    const min = Math.max(0, stops.findLastIndex(s => s <= lo));
    const at = stops.findIndex(s => s >= hi);
    return { min, max: Math.max(min, at < 0 ? last : at) };
}
function withRange(tokens, { field, stops }, min, max) {
    const rest = tokens.filter(t => t.field !== field);
    if (min > 0) rest.push({ field, value: '>=' + stops[min] });
    if (max < stops.length - 1) rest.push({ field, value: '<=' + stops[max] });
    return rest;
}

// 目盛りの点を並べ、両端のつまみをドラッグ (またはクリック) して範囲を決める。指を離した時点で検索し直す
function RangeSection({ spec, tokens, keyword, onApply }) {
    const cur = rangeOf(tokens, spec);
    const [range, setRange] = useState(cur);
    const trackRef = useRef(null);
    const dragging = useRef(null);   // 'min' | 'max'
    const last = spec.stops.length - 1;
    const indexAt = (e) => {
        const r = trackRef.current.getBoundingClientRect();
        const ratio = r.width ? (e.clientX - r.left) / r.width : 0;
        return Math.round(Math.min(1, Math.max(0, ratio)) * last);
    };
    // 範囲の外を押したらその側、内側なら近いほうのつまみを動かす
    const grab = (i, { min, max }) => (i < min ? 'min' : i > max ? 'max' : ((i - min) <= (max - i) ? 'min' : 'max'));
    const moved = (i, r) => (dragging.current === 'min' ? { min: Math.min(i, r.max), max: r.max } : { min: r.min, max: Math.max(i, r.min) });
    const latest = useRef(cur);   // 押している間の範囲 (条件が変わると key で作り直すので、初期値は cur のままでよい)
    const move = (i) => { const next = moved(i, latest.current); latest.current = next; setRange(next); };
    const release = () => {
        if (!dragging.current) return;
        dragging.current = null;
        const { min, max } = latest.current;
        if (min !== cur.min || max !== cur.max) onApply(buildQuery(withRange(tokens, spec, min, max), keyword));
    };
    const { min, max } = range;
    return (
        <div className="wlext-facet-section wlext-facet-range">
            <div className="wlext-facet-title"><Icon name={spec.icon} size={15} /><span>{spec.label}</span></div>
            <div className="wlext-facet-range-value">{spec.text(spec.stops[min], spec.stops[max], min === 0 && max === last, max === last)}</div>
            <div ref={trackRef} className="wlext-facet-track" title="ドラッグで範囲を変更"
                onPointerDown={(e) => {
                    const i = indexAt(e);
                    dragging.current = grab(i, latest.current);
                    move(i);
                    try { trackRef.current.setPointerCapture(e.pointerId); } catch { /* 古いブラウザ */ }
                }}
                onPointerMove={(e) => { if (dragging.current) move(indexAt(e)); }}
                onPointerUp={release} onPointerCancel={release}
            >
                <div className="wlext-facet-track-fill" style={{ left: (min / last * 100) + '%', width: ((max - min) / last * 100) + '%' }} />
                {spec.stops.map((_, i) => (
                    <div key={i} className={'wlext-facet-dot' + (i >= min && i <= max ? ' on' : '') + (i === min || i === max ? ' handle' : '')}
                        style={{ left: (i / last * 100) + '%' }} />
                ))}
            </div>
            <div className="wlext-facet-scale"><span>{spec.scale[0]}</span><span>{spec.scale[1]}</span></div>
        </div>
    );
}

function Section({ sec, items, tokens, keyword, onApply }) {
    const [moreOpen, setMoreOpen] = useState(false);
    const [restBuilt, setRestBuilt] = useState(false);   // 残りは初めて開いたときに作る (出演者は数百件になるため)
    const row = (it, i) => {
        const active = tokens.some(t => t.field === sec.field && t.value === it.value);
        return (
            <div key={i} className={'wlext-facet-item' + (active ? ' active' : '') + (it.value === 'none' ? ' none' : '')} title={active ? 'この絞り込みを外す' : (it.label + ' で絞り込む')}
                onClick={() => onApply(buildQuery(active
                    ? tokens.filter(t => !(t.field === sec.field && t.value === it.value))
                    : tokens.concat([{ field: sec.field, value: it.value }]), keyword))}
            >
                <span className="wlext-facet-name">{it.label}</span>
                <span className="wlext-facet-count">{String(it.count)}</span>
            </div>
        );
    };
    const restLabel = 'すべて表示（他 ' + (items.length - TOP_N) + ' 件）';
    return (
        <div className="wlext-facet-section">
            <div className="wlext-facet-title"><Icon name={sec.icon} size={15} /><span>{sec.label}</span></div>
            <div className="wlext-facet-list">{items.slice(0, TOP_N).map(row)}</div>
            {items.length > TOP_N && (
                <>
                    <div className={'wlext-facet-rest' + (moreOpen ? ' open' : '')}>{restBuilt && items.slice(TOP_N).map(row)}</div>
                    <div className="wlext-facet-more" onClick={() => { setRestBuilt(true); setMoreOpen(!moreOpen); }}>{moreOpen ? '閉じる' : restLabel}</div>
                </>
            )}
        </div>
    );
}

const NARROW_DEFAULT = '(max-width: 900px), (pointer: coarse)';   // 既定で閉じる画面
const NARROW_OVERLAY = '(max-width: 900px)';                      // 一覧を押し出さずに重ねる画面 (CSS と同じ)
const OPEN_KEY = 'wlext_facets_open';
function initialOpen() {
    try {
        const v = localStorage.getItem(OPEN_KEY);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch { /* 使えなければ既定 */ }
    return !window.matchMedia(NARROW_DEFAULT).matches;
}

export default function ExtFacets({ q, path, sort, group, onApply, contentRef }) {
    const [open, setOpen] = useState(initialOpen);
    const scopeKey = [q, path, sort, group].join('|');   // 条件が変わったら取り直して作り直す (開いていた「すべて表示」も閉じる)
    const [result, setResult] = useState({ key: null });   // 取れた候補 (key が今の条件と違う間は「読み込み中」)
    const panelRef = useRef(null), btnRef = useRef(null), backdropRef = useRef(null);
    const toggle = (on) => {
        try { localStorage.setItem(OPEN_KEY, on ? '1' : '0'); } catch { /* 覚えられなくても開閉はする */ }
        setOpen(on);
    };

    // body のクラスは CSS (パネルの表示・狭い画面の背景) が見る。下の実測より先に付ける (付ける前はパネルが display:none)
    useLayoutEffect(() => {
        document.body.classList.add('wlext-facets-on');
        return () => document.body.classList.remove('wlext-facets-on', 'wlext-facets-open');
    }, []);
    useLayoutEffect(() => { document.body.classList.toggle('wlext-facets-open', open); }, [open]);

    // 候補: 開いているときだけ、検索語・フォルダ・並び替え・まとめ表示が変わるたびに取り直す
    useEffect(() => {
        if (!open) return;
        let stale = false;
        const p = new URLSearchParams({ q: q || '' });
        if (path) p.set('path', path);
        if (sort) p.set('sort', sort);
        if (group) p.set('group', '1');
        fetch('/ext/api/search/facets?' + p.toString())
            .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
            .then(j => { if (!stale) setResult({ key: scopeKey, data: j }); })
            .catch(e => { if (!stale) setResult({ key: scopeKey, data: { error: e.message } }); });
        return () => { stale = true; };
    }, [open, q, path, sort, group, scopeKey]);
    const data = result.key === scopeKey ? result.data : null;   // null=読み込み中 / {error} / 候補

    // ボタンとパネルはヘッダーのすぐ下 (ヘッダーの高さは実測)。一覧は、開いているぶん (パネルの右端 + 16px) だけ右へ寄せる。
    // 狭い画面では一覧を押し出さずに重ねる
    useLayoutEffect(() => {
        const layout = () => {
            const nav = document.querySelector('#root nav');
            const top = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().bottom)) : 56;
            if (btnRef.current) btnRef.current.style.top = (top + 8) + 'px';
            if (panelRef.current) panelRef.current.style.top = (top + 46) + 'px';
            if (backdropRef.current) backdropRef.current.style.top = top + 'px';
            const content = contentRef.current;
            if (!content) return;
            if (!open) { content.style.paddingLeft = ''; return; }
            if (window.matchMedia(NARROW_OVERLAY).matches) { content.style.paddingLeft = '22px'; return; }
            const panelRight = panelRef.current ? panelRef.current.getBoundingClientRect().right : 241;
            content.style.paddingLeft = Math.max(0, Math.round(panelRight + 16 - content.getBoundingClientRect().left)) + 'px';
        };
        layout();
        window.addEventListener('resize', layout);
        return () => window.removeEventListener('resize', layout);
    }, [open, contentRef]);

    const { tokens, keyword } = parseQuery(q);
    const sections = data && !data.error ? SECTIONS.filter(sec => (data[sec.key] || []).length) : [];
    return createPortal(
        <>
            <div ref={backdropRef} className="wlext-facets-backdrop" onClick={() => toggle(false)} />
            <div ref={btnRef} className={'wlext-facets-btn' + (open ? ' on' : '')} title="絞り込みメニューの開閉" onClick={() => toggle(!open)}>
                <Icon name="filter" size={15} /><span>絞り込み</span>
            </div>
            {open && (
                <aside ref={panelRef} className="wlext-facets">
                    <div className="wlext-facets-body">
                        {!data && <div className="wlext-facets-msg">読み込み中...</div>}
                        {data && data.error && <div className="wlext-facets-msg">{'読み込みに失敗しました: ' + data.error}</div>}
                        {data && !data.error && (
                            <>
                                {/* 評価と再生時間はジャンルの上。候補が無くても (結果0件でも) 出して、範囲を広げ直せるようにする */}
                                <RangeSection key={'rating|' + scopeKey} spec={RANGES.rating} tokens={tokens} keyword={keyword} onApply={onApply} />
                                <RangeSection key={'duration|' + scopeKey} spec={RANGES.duration} tokens={tokens} keyword={keyword} onApply={onApply} />
                                {sections.map(sec => (
                                    <Section key={sec.key + '|' + scopeKey}sec={sec} items={data[sec.key]} tokens={tokens} keyword={keyword} onApply={onApply} />
                                ))}
                                {!sections.length && <div className="wlext-facets-msg">絞り込める項目がありません</div>}
                            </>
                        )}
                    </div>
                </aside>
            )}
        </>,
        document.body
    );
}
