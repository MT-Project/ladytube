// LadyTube: シリーズ一覧 (/series)。シリーズ別にサムネイル・名前 (本数)・平均評価。押すとそのシリーズを検索。
// 選択モードで選んだシリーズを、全動画のメタデータから取り除ける (メニューと確認は ExtListParts.jsx の ExtListFabs)。
// 「メーカーでまとめる」で、メーカーごとに見出し (タグ一覧のプリセット順と同じ .wlext-taglist-sep) を入れて区切る。
// 複数のメーカーにまたがるシリーズは、それぞれのメーカーに出す。「複数のメーカーのみ」は、またがるシリーズだけに絞る (メーカー名も出す)。
// 選択モードのメニューの「タグを自動で付ける」で、シリーズに入る動画へ自動で付けるタグを決める (v3.17.0。server/ext/routes/seriestags.js)。
// ルールのあるシリーズには、付けるタグを名前の下に出す
// v3.2.1 までは拡張の server/ext/public/serieslist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス
import { Fragment, useEffect, useState } from 'react';
import { ExtListCard, ExtListFabs, ExtListPage, ExtNameList, ExtPageTitle, ExtSortRow, ExtViewToggle } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import ExtPresetTagDialog from '../components/ExtPresetTagDialog';
import { Icon } from '../components/ExtIcon';
import { extGet, extSend } from '../services/extApi';
import { storedSort, storedView, searchToken } from '../utils/formatters';
import { nameCompare } from '../utils/namekey';
import { openExtDialog } from '../utils/extDialog';
import { loadVideoTagPresets, saveVideoTagPresets } from '../utils/tagPresets';
import { toast } from '../utils/toast';

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
// シリーズ名の照合は検索・サーバーと同じ (大文字小文字を区別しない。ASCII だけ)
const fold = (s) => String(s == null ? '' : s).trim().replace(/[A-Z]/g, c => c.toLowerCase());
const RuleTags = ({ tags }) => tags && (
    <div className="wlext-series-rule" title={'自動で付けるタグ: ' + tags.join('、')}><Icon name="tag" size={12} /><span>{tags.join('、')}</span></div>
);

function SeriesCard({ s, sel, showMakers, tags }) {
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
            <RuleTags tags={tags} />
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
    const [rules, setRules] = useState([]);   // [{ name, tags }]。読めなくても一覧は出す
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
        extGet('/ext/api/series-tags').then(r => setRules(r.rules || []), () => { });
    }, []);

    if (error) return <ExtListPage title="シリーズ一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="シリーズ一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const toggleGroup = () => {
        try { localStorage.setItem(GROUP_STORE, group ? '0' : '1'); } catch { /* 保存できなくても切り替える */ }
        setGroup(!group);
    };
    const ruleTags = (name) => { const r = rules.find(x => fold(x.name) === fold(name)); return r ? r.tags : null; };
    // 選んだシリーズ 1件ならそのルールを編集 (外したタグをルールから外す。空で OK ならルールを外す)、複数なら選んだタグを各ルールに足す
    const editRules = (selected) => {
        const names = [...selected.keys()];
        const one = names.length === 1;
        const current = one ? (ruleTags(names[0]) || []) : [];
        openExtDialog(ExtPresetTagDialog, {
            title: one ? 'タグを自動で付ける' : 'タグを自動で付ける（' + names.length + '件）',
            note: (one ? '「' + names[0] + '」に入る動画へ、選んだタグを足します。' : '選んだ ' + names.length + '件のシリーズそれぞれのルールに、選んだタグを足します（今のルールは残ります）。')
                + 'OK で、今そのシリーズにある動画にも足します。あとからシリーズがこれに変わった動画にも足します（シリーズが変わらない保存では足しません）。'
                + 'タグは足すだけで、ルールから外したタグを動画から外すことはしません。',
            current,
            loadPresets: loadVideoTagPresets,
            savePresets: saveVideoTagPresets,
            onSave: async (tags) => {
                if (!tags.length && !current.length) { toast('付けるタグを選んでください', 'error'); return; }
                try {
                    const r = await extSend('PUT', '/ext/api/series-tags', { names, tags, mode: one ? 'set' : 'add' });
                    setRules(r.rules || []);
                    toast(tags.length ? 'ルールを保存しました（動画 ' + r.members + '本のうち ' + r.changed + '本にタグを追加）' : 'ルールを外しました（動画のタグはそのままです）', 'success');
                } catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
            },
        });
    };
    const extraItems = [{ icon: 'tag', label: 'タグを自動で付ける', run: editRules }];
    const multiCount = list.filter(s => s.makers.length > 1).length;
    const sorted = (multiOnly ? list.filter(s => s.makers.length > 1) : list).slice().sort(compare(order));
    const sections = group ? byMaker(sorted) : [{ key: '', label: '', items: sorted }];
    const nameItems = (items) => items.map(s => ({
        id: s.name, name: s.name || '(無題)', count: s.count, title: '「' + s.name + '」で検索', to: searchHref(s),
        extra: <>{multiOnly && <Makers s={s} />}<RuleTags tags={ruleTags(s.name)} /></>,
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
                                {sec.items.map(s => <SeriesCard key={sec.key + '\n' + s.name} s={s} sel={sel} showMakers={multiOnly} tags={ruleTags(s.name)} />)}
                            </Fragment>
                        ))}
                    </div>}
            <ExtListFabs sel={sel} items={sorted.map(s => [s.name, s.name])} kind="series" kindLabel="シリーズ" extraItems={extraItems} />
        </ExtListPage>
    );
}
