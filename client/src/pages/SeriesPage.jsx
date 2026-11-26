// LadyTube: シリーズ一覧 (/series)。シリーズ別にサムネイル・名前 (本数)・平均評価。押すとそのシリーズを検索。
// 選択モードで選んだシリーズを、全動画のメタデータから取り除ける (メニューと確認は ExtListParts.jsx の ExtListFabs)。
// 「メーカーでまとめる」で、メーカーごとに見出し (タグ一覧のプリセット順と同じ .wlext-taglist-sep) を入れて区切る。
// 複数のメーカーにまたがるシリーズは、それぞれのメーカーに出す。「複数のメーカーのみ」は、またがるシリーズだけに絞る (メーカー名も出す)。
// v3.2.1 までは拡張の server/ext/public/serieslist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス
import { Fragment, useEffect, useState } from 'react';
import { ExtListCard, ExtListFabs, ExtListPage, ExtNameList, ExtPageTitle, ExtSortRow, ExtViewToggle } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import { Icon } from '../components/ExtIcon';
import { storedSort, storedView, searchToken } from '../utils/formatters';
import { nameCompare } from '../utils/namekey';

const SORTS = [['name', 'シリーズ名', 'asc'], ['count', '動画本数', 'desc'], ['rating', '評価', 'desc']];
const STORE = 'wlext_sort_series';
const VIEW_STORE = 'wlext_view_series';
const GROUP_STORE = 'wlext_group_series';   // 「メーカーでまとめる」(覚える。「複数のメーカーのみ」は覚えない)
const muted = { color: 'var(--text-secondary,#888)' };

function compare(order) {
    const dir = order.dir === 'asc' ? 1 : -1;
    return (a, b) => {
        const byName = nameCompare(a.name, b.name);
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

// メーカーごとの区切り [{ label, items }]。見出しはメーカー名の順 (並び替えの向きによらない)、メーカーが無いシリーズは末尾の「メーカー未設定」。
// 中の並びは渡された items のまま (並び替えのとおり)
function byMaker(items) {
    const map = new Map();
    items.forEach(s => (s.makers.length ? s.makers : ['']).forEach(m => { if (!map.has(m)) map.set(m, []); map.get(m).push(s); }));
    return [...map.keys()].sort((a, b) => (!a) - (!b) || nameCompare(a, b))
        .map(m => ({ key: m, label: (m || 'メーカー未設定') + '（' + map.get(m).length + '）', items: map.get(m) }));
}

const searchHref = (s) => '/search?q=' + encodeURIComponent('@' + searchToken('series', s.name));
const Makers = ({ s }) => <div className="wlext-series-makers" title={s.makers.join(' / ')}>{s.makers.join(' / ')}</div>;

function SeriesCard({ s, sel, showMakers }) {
    return (
        <ExtListCard to={searchHref(s)} className="wlext-series-card"
            title={'「' + s.name + '」で検索'} sel={sel} id={s.name} name={s.name}>
            <div className="wlext-video-thumb">
                {s.thumbId
                    ? <img src={'/api/video/' + s.thumbId + '/thumbnail'} loading="lazy" alt={s.name} />
                    : <div className="noimg">NO IMAGE</div>}
                <div className="wlext-series-count" title={s.count + '本'}>{String(s.count)}</div>
            </div>
            <div className="wlext-series-name">{s.name || '(無題)'}</div>
            {showMakers && <Makers s={s} />}
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
    const [view, setView] = useState(() => storedView(VIEW_STORE));
    const [group, setGroup] = useState(() => { try { return localStorage.getItem(GROUP_STORE) === '1'; } catch { return false; } });
    const [multiOnly, setMultiOnly] = useState(false);
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

    const toggleGroup = () => {
        try { localStorage.setItem(GROUP_STORE, group ? '0' : '1'); } catch { /* 保存できなくても切り替える */ }
        setGroup(!group);
    };
    const multiCount = list.filter(s => s.makers.length > 1).length;
    const sorted = (multiOnly ? list.filter(s => s.makers.length > 1) : list).slice().sort(compare(order));
    const sections = group ? byMaker(sorted) : [{ key: '', label: '', items: sorted }];
    const nameItems = (items) => items.map(s => ({
        id: s.name, name: s.name || '(無題)', count: s.count, title: '「' + s.name + '」で検索', to: searchHref(s),
        extra: multiOnly ? <Makers s={s} /> : null,
    }));
    return (
        <ExtListPage title="シリーズ一覧">
            <ExtPageTitle icon="library" text={'シリーズ一覧（' + list.length + '件）'} />
            <div className="wlext-plist-controls">
                <div className="wlext-plist-ctlrow">
                    <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
                    <ExtViewToggle view={view} onChange={setView} storeKey={VIEW_STORE} />
                    <div className="wlext-plist-sortrow">
                        <span className="wlext-plist-ctl-label">メーカー:</span>
                        <div className={'wlext-plist-sortbtn wlext-plist-viewbtn' + (group ? ' active' : '')} onClick={toggleGroup}
                            title="メーカーごとに見出しを入れて区切る（複数のメーカーにまたがるシリーズは、それぞれに出す）">
                            <Icon name="factory" size={14} /><span>まとめる</span>
                        </div>
                        {(multiCount > 0 || multiOnly) && <div className={'wlext-plist-sortbtn wlext-plist-viewbtn' + (multiOnly ? ' active' : '')}
                            onClick={() => setMultiOnly(!multiOnly)} title="複数のメーカーにまたがるシリーズだけを出す">
                            <Icon name="layers" size={14} /><span>{'複数のメーカーのみ（' + multiCount + '）'}</span>
                        </div>}
                    </div>
                </div>
            </div>
            {!sorted.length ? <div style={muted}>{multiOnly ? '複数のメーカーにまたがるシリーズはありません' : 'シリーズが設定された動画がありません'}</div>
                : view === 'names'
                    ? sections.map(sec => (
                        <Fragment key={sec.key}>
                            {sec.label && <div className="wlext-taglist-sep">{sec.label}</div>}
                            <ExtNameList sel={sel} items={nameItems(sec.items)} />
                        </Fragment>
                    ))
                    : <div className="wlext-series-grid">
                        {sections.map(sec => (
                            <Fragment key={sec.key}>
                                {sec.label && <div className="wlext-taglist-sep">{sec.label}</div>}
                                {sec.items.map(s => <SeriesCard key={sec.key + '\n' + s.name} s={s} sel={sel} showMakers={multiOnly} />)}
                            </Fragment>
                        ))}
                    </div>}
            <ExtListFabs sel={sel} items={sorted.map(s => [s.name, s.name])} kind="series" kindLabel="シリーズ" />
        </ExtListPage>
    );
}
