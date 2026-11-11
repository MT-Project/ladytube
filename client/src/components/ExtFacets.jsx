// LadyTube: 検索結果のサイドメニュー (絞り込み)。v3.1.6 までの server/ext/public/searchfacets.js を移したもの。
// 評価 (範囲スライダー) と ジャンル / タグ / メーカー / 出演者 / シリーズ を出し、押すと今の検索に足す (もう一度押すと外す)。
// 上位5件を出し、残りは折りたたむ。候補はサーバーの /ext/api/search/facets (一覧と同じ母集団を数える)。
// 画面左上の「絞り込み」ボタンで開閉 (位置は固定)。既定は PC=開く / モバイル=閉じる、切り替えた状態はその端末に覚える。
// 見た目は womanlive-ext.css の .wlext-facets* (設定画面のサイドメニュー settingsnav.js と共用) と、body の
// wlext-facets-on / wlext-facets-open。一覧 (contentRef) の左の余白はここで決める。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// アイコンは拡張のアイコン表 (server/ext/public/nav.js の ICONS) と同じ形にそろえる
const ICONS = {
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    factory: '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
};
function Icon({ name, size }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={'wlext-ico wlext-ico-' + name}
            dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
    );
}

// 表示順は上から ジャンル → タグ → メーカー → 出演者 → シリーズ
const SECTIONS = [
    { key: 'genre', field: 'genre', label: 'ジャンル', icon: 'layers' },
    { key: 'tag', field: 'tag', label: 'タグ', icon: 'tag' },
    { key: 'maker', field: 'maker', label: 'メーカー', icon: 'factory' },
    { key: 'performer', field: 'performer', label: '出演者', icon: 'users' },
    { key: 'series', field: 'series', label: 'シリーズ', icon: 'library' },
];
const TOP_N = 5;
const MAX_RATING = 5;

/* ---------- 検索語 (項目トークン + キーワード) の読み書き ---------- */
// サーバー側 search.js の splitQuery と同じ分解をする。'@' で始まらないものは丸ごとキーワード。
function parseQuery(q) {
    const s = String(q || '').trim();
    if (!s) return { tokens: [], keyword: '' };
    if (!s.startsWith('@')) return { tokens: [], keyword: s };
    const re = /(\w+)\s*:\s*("([^"]*)"|[^\s]+)/g;
    const body = s.slice(1);
    const tokens = [];
    let m, last = 0, rest = '';
    while ((m = re.exec(body)) !== null) {
        rest += body.slice(last, m.index);
        last = m.index + m[0].length;
        tokens.push({ field: m[1].toLowerCase(), value: m[3] !== undefined ? m[3] : m[2] });
    }
    rest += body.slice(last);
    return { tokens, keyword: rest.trim() };
}
// キーワードは末尾に残す。絞り込みを全部外したら '@' を付けず本家の検索語の形に戻す
function buildQuery(tokens, keyword) {
    if (!tokens.length) return keyword || '';
    const parts = tokens.map(t => t.field + ':"' + t.value + '"');
    if (keyword) parts.push(keyword);
    return '@' + parts.join(' ');
}

/* ---------- 評価の範囲 (rating トークン ⇔ 0〜5) ---------- */
// rating トークンは AND なので、範囲は ">=下限" と "<=上限" の2つで表せる。下限0は未評価も含む
function ratingRange(tokens) {
    let min = 0, max = MAX_RATING;
    tokens.filter(t => t.field === 'rating').forEach(t => {
        const m = /^(>=|<=|>|<|=)?\s*(\d)/.exec(String(t.value).trim());
        if (!m) return;
        const op = m[1] || '=', n = parseInt(m[2], 10);
        if (op === '>=') min = Math.max(min, n);
        else if (op === '>') min = Math.max(min, n + 1);
        else if (op === '<=') max = Math.min(max, n);
        else if (op === '<') max = Math.min(max, n - 1);
        else { min = Math.max(min, n); max = Math.min(max, n); }
    });
    min = Math.max(0, Math.min(MAX_RATING, min));
    max = Math.max(min, Math.min(MAX_RATING, max));
    return { min, max };
}
function withRating(tokens, min, max) {
    const rest = tokens.filter(t => t.field !== 'rating');
    if (min > 0) rest.push({ field: 'rating', value: '>=' + min });
    if (max < MAX_RATING) rest.push({ field: 'rating', value: '<=' + max });
    return rest;
}

// 0〜5 の点を並べ、両端のつまみをドラッグ (またはクリック) して範囲を決める。指を離した時点で検索し直す
function RatingSection({ tokens, keyword, onApply }) {
    const cur = ratingRange(tokens);
    const [range, setRange] = useState(cur);
    const trackRef = useRef(null);
    const dragging = useRef(null);   // 'min' | 'max'
    const indexAt = (e) => {
        const r = trackRef.current.getBoundingClientRect();
        const ratio = r.width ? (e.clientX - r.left) / r.width : 0;
        return Math.round(Math.min(1, Math.max(0, ratio)) * MAX_RATING);
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
        if (min !== cur.min || max !== cur.max) onApply(buildQuery(withRating(tokens, min, max), keyword));
    };
    const { min, max } = range;
    return (
        <div className="wlext-facet-section wlext-facet-range">
            <div className="wlext-facet-title"><Icon name="star" size={15} /><span>評価</span></div>
            <div className="wlext-facet-range-value">{(min === 0 && max === MAX_RATING) ? 'すべて' : (min === max ? String(min) : min + '〜' + max)}</div>
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
                <div className="wlext-facet-track-fill" style={{ left: (min / MAX_RATING * 100) + '%', width: ((max - min) / MAX_RATING * 100) + '%' }} />
                {Array.from({ length: MAX_RATING + 1 }, (_, i) => (
                    <div key={i} className={'wlext-facet-dot' + (i >= min && i <= max ? ' on' : '') + (i === min || i === max ? ' handle' : '')}
                        style={{ left: (i / MAX_RATING * 100) + '%' }} />
                ))}
            </div>
            <div className="wlext-facet-scale"><span>0</span><span>{String(MAX_RATING)}</span></div>
        </div>
    );
}

function Section({ sec, items, tokens, keyword, onApply }) {
    const [moreOpen, setMoreOpen] = useState(false);
    const [restBuilt, setRestBuilt] = useState(false);   // 残りは初めて開いたときに作る (出演者は数百件になるため)
    const row = (it, i) => {
        const active = tokens.some(t => t.field === sec.field && t.value === it.value);
        return (
            <div key={i} className={'wlext-facet-item' + (active ? ' active' : '')} title={active ? 'この絞り込みを外す' : (it.label + ' で絞り込む')}
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
                                {/* 評価はジャンルの上。候補が無くても (結果0件でも) 出して、範囲を広げ直せるようにする */}
                                <RatingSection key={scopeKey}tokens={tokens} keyword={keyword} onApply={onApply} />
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
