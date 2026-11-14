// LadyTube: シリーズ一覧 (/series)。シリーズ別にサムネイル・名前 (本数)・平均評価。押すとそのシリーズを検索。
// 選択モードで選んだシリーズを、全動画のメタデータから取り除ける (メニューと確認は拡張の listselect.js の WL.toggleListMenu)。
// v3.2.1 までは拡張の server/ext/public/serieslist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExtListPage, ExtPageTitle, ExtSortRow } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import ExtSelectionFabs from '../components/ExtSelection';
import { storedSort } from '../utils/formatters';

const SORTS = [['name', 'シリーズ名', 'asc'], ['count', '動画本数', 'desc'], ['rating', '評価', 'desc']];
const STORE = 'wlext_sort_series';
const muted = { color: 'var(--text-secondary,#888)' };

function compare(order) {
    const dir = order.dir === 'asc' ? 1 : -1;
    return (a, b) => {
        const byName = window.WLExt.nameCompare(a.name, b.name);
        if (order.sort === 'name') return byName * dir;
        if (order.sort === 'count') return ((a.count || 0) - (b.count || 0)) * dir || byName;
        // 評価: 未評価 (null) は向きによらず末尾
        const ra = a.avgRating, rb = b.avgRating;
        if (ra == null && rb == null) return byName;
        if (ra == null) return 1;
        if (rb == null) return -1;
        return (ra - rb) * dir || byName;
    };
}

function SeriesCard({ s, mode, on, onToggle }) {
    const url = '/search?q=' + encodeURIComponent('@series:"' + s.name + '"');
    return (
        <Link to={url} className={'wlext-series-card' + (on ? ' wlext-sel-on' : '')} title={'「' + s.name + '」で検索'}
            style={mode ? { position: 'relative' } : undefined}
            onClick={mode ? (e) => { e.preventDefault(); onToggle(); } : undefined}>
            <div className="wlext-video-thumb">
                {s.thumbId
                    ? <img src={'/api/video/' + s.thumbId + '/thumbnail'} loading="lazy" alt={s.name} />
                    : <div className="noimg">NO IMAGE</div>}
                <div className="wlext-series-count" title={s.count + '本'}>{String(s.count)}</div>
            </div>
            <div className="wlext-series-name">{s.name || '(無題)'}</div>
            <div className="wlext-series-rating">
                {s.avgRating != null
                    ? <><ExtStars value={Math.round(s.avgRating)} /><span className="wlext-series-ratingnum">{s.avgRating.toFixed(1)}</span></>
                    : <span style={{ ...muted, fontSize: '0.75rem' }}>評価なし</span>}
            </div>
            {mode && <div className={'wlext-sel-badge' + (on ? ' on' : '')}>{on ? '✓' : ''}</div>}
        </Link>
    );
}

export default function SeriesPage() {
    const [list, setList] = useState(null);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(() => storedSort(STORE, SORTS, { sort: 'name', dir: 'asc' }));
    const [mode, setMode] = useState(false);
    const [selected, setSelected] = useState(() => new Map());   // シリーズ名 -> 表示名

    useEffect(() => {
        fetch('/ext/api/series')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(setList, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="シリーズ一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="シリーズ一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const sorted = list.slice().sort(compare(order));
    const toggle = (name) => setSelected(prev => {
        const next = new Map(prev);
        if (next.has(name)) next.delete(name); else next.set(name, name);
        return next;
    });
    return (
        <ExtListPage title="シリーズ一覧">
            <ExtPageTitle icon="library" text={'シリーズ一覧（' + list.length + '件）'} />
            <div className="wlext-plist-controls">
                <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
            </div>
            <div className="wlext-series-grid">
                {sorted.length
                    ? sorted.map(s => <SeriesCard key={s.name} s={s} mode={mode} on={selected.has(s.name)} onToggle={() => toggle(s.name)} />)
                    : <div style={muted}>シリーズが設定された動画がありません</div>}
            </div>
            <ExtSelectionFabs selectionMode={mode} selectedIds={selected}
                onToggleMode={() => { window.WLExt?.closeListMenu?.(); setMode(!mode); setSelected(new Map()); }}
                onSelectAll={() => setSelected(new Map(sorted.map(s => [s.name, s.name])))}
                onDeselectAll={() => setSelected(new Map())}
                onMenu={() => window.WLExt?.toggleListMenu?.({ kind: 'series', kindLabel: 'シリーズ' }, selected)} />
        </ExtListPage>
    );
}
