// LadyTube: シリーズ一覧 (/series)。シリーズ別にサムネイル・名前 (本数)・平均評価。押すとそのシリーズを検索。
// 選択モードで選んだシリーズを、全動画のメタデータから取り除ける (メニューと確認は拡張の listselect.js の WL.toggleListMenu)。
// v3.2.1 までは拡張の server/ext/public/serieslist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス
import { useEffect, useState } from 'react';
import { ExtListCard, ExtListFabs, ExtListPage, ExtPageTitle, ExtSortRow } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
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

function SeriesCard({ s, sel }) {
    return (
        <ExtListCard to={'/search?q=' + encodeURIComponent('@series:"' + s.name + '"')} className="wlext-series-card"
            title={'「' + s.name + '」で検索'} sel={sel} id={s.name} name={s.name}>
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
        </ExtListCard>
    );
}

export default function SeriesPage() {
    const [list, setList] = useState(null);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(() => storedSort(STORE, SORTS, { sort: 'name', dir: 'asc' }));
    const [mode, setMode] = useState(false);
    const [selected, setSelected] = useState(() => new Map());
    const sel = { mode, setMode, selected, setSelected };

    useEffect(() => {
        fetch('/ext/api/series')
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(setList, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="シリーズ一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="シリーズ一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const sorted = list.slice().sort(compare(order));
    return (
        <ExtListPage title="シリーズ一覧">
            <ExtPageTitle icon="library" text={'シリーズ一覧（' + list.length + '件）'} />
            <div className="wlext-plist-controls">
                <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
            </div>
            <div className="wlext-series-grid">
                {sorted.length
                    ? sorted.map(s => <SeriesCard key={s.name} s={s} sel={sel} />)
                    : <div style={muted}>シリーズが設定された動画がありません</div>}
            </div>
            <ExtListFabs sel={sel} items={sorted.map(s => [s.name, s.name])} kind="series" kindLabel="シリーズ" />
        </ExtListPage>
    );
}
