// LadyTube: 出演者一覧 (/performers)。出演者を写真・名前・ふりがな・評価・年齢で並べる。押すと出演者のページ (/performer/:id)。
// 並び替え: 評価 / 出演数 / ふりがな / 身長 / 体重 / バスト / カップ数 / ウェスト / ヒップ / 年齢 (身長などは補助の行に値を出す)。
// 絞り込み: タグ / 別名・氏名が重複する出演者 / このライブラリに出演作がある出演者 (ライブラリが複数あるときだけ。既定でオン)。
// v3.2.1 までは拡張の server/ext/public/performerlist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス。
// API・確認のダイアログ・通知・日付の読み取りは拡張の WL.* (api.js・core.js。React より先に読まれる)
import { useEffect, useState } from 'react';
import { ExtListCard, ExtListFabs, ExtListPage, ExtPageTitle, ExtSortRow } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import { storedSort, parseYmd } from '../utils/formatters';
import { toast } from '../utils/toast';
import { extApi } from '../services/extApi';

const SORTS = [
    ['rating', '評価', 'desc'], ['videoCount', '出演数', 'desc'], ['furigana', 'ふりがな', 'asc'], ['height', '身長', 'asc'], ['weight', '体重', 'asc'],
    ['bust', 'バスト', 'asc'], ['cup', 'カップ数', 'asc'], ['waist', 'ウェスト', 'asc'], ['hip', 'ヒップ', 'asc'], ['age', '年齢', 'desc'],
];
const STORE = 'wlext_sort_performers';
const muted = { color: 'var(--text-secondary,#888)' };

function numOrNull(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }
function ageMonths(birthday) {
    const d = parseYmd(birthday); if (!d) return null;
    const now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (now.getDate() < d.getDate()) m--;
    return m < 0 ? null : m;
}

function sortVal(p, sort) {
    switch (sort) {
        case 'rating': return p.rating || 0;
        case 'videoCount': return p.videoCount || 0;
        case 'furigana': return p.furigana || p.name || '';
        case 'height': return numOrNull(p.height);
        case 'weight': return numOrNull(p.weight);
        case 'bust': return numOrNull(p.bust);
        case 'waist': return numOrNull(p.waist);
        case 'hip': return numOrNull(p.hip);
        case 'cup': return p.cup || '';
        case 'age': return ageMonths(p.birthday);
        default: return '';
    }
}
// 未設定は向きによらず末尾
function compare(order) {
    const nameCompare = window.WLExt.nameCompare;
    const dir = order.dir === 'asc' ? 1 : -1;
    return (a, b) => {
        const va = sortVal(a, order.sort), vb = sortVal(b, order.sort);
        const ea = (va === null || va === ''), eb = (vb === null || vb === '');
        if (ea && eb) return nameCompare(a.name, b.name);
        if (ea) return 1;
        if (eb) return -1;
        if (typeof va === 'number') return (va - vb) * dir;
        return nameCompare(String(va), String(vb)) * dir;
    };
}
// 並び替えの基準に応じた補助の行
function metaLine(p, sort) {
    switch (sort) {
        case 'height': return p.height ? p.height + 'cm' : '';
        case 'weight': return p.weight ? p.weight + 'kg' : '';
        case 'bust': return p.bust ? 'B' + p.bust + (p.cup ? '(' + p.cup + ')' : '') : '';
        case 'cup': return p.cup ? 'カップ ' + p.cup : '';
        case 'waist': return p.waist ? 'W' + p.waist : '';
        case 'hip': return p.hip ? 'H' + p.hip : '';
        default: return '';
    }
}

// 関連動画の無い出演者をまとめて消す (先に数を問い合わせ、確認してから)
async function cleanupUnused(multiLib, onDone) {
    const WL = window.WLExt;
    let pv;
    try { pv = await extApi.cleanupUnusedPerformers(true); }
    catch (e) { toast('取得に失敗: ' + e.message, 'error'); return; }
    if (!pv.count) { toast('関連動画のない出演者はいません', 'success'); return; }
    WL.dialog('関連動画のない出演者を削除',
        WL.h('div', { style: { fontSize: '0.9rem', lineHeight: '1.6' } },
            '関連動画が無い出演者 ' + pv.count + ' 名（全 ' + pv.total + ' 名中）を削除します。'
            + (multiLib ? '\n出演者は全ライブラリ共通のため、どのライブラリの動画にも登録されていない人だけが対象です。' : '')
            + '\nこの操作は元に戻せません。よろしいですか？'),
        {
            saveLabel: '削除する',
            onSave: async (close) => {
                try { const r = await extApi.cleanupUnusedPerformers(false); toast(r.deleted + ' 名を削除しました', 'success'); close(); onDone(); }
                catch (e) { toast('削除に失敗: ' + e.message, 'error'); }
            },
        });
}

function PerformerCard({ p, sort, sel }) {
    const [broken, setBroken] = useState(false);
    const name = p.name || '(無名)';
    const m = ageMonths(p.birthday);
    const meta = metaLine(p, sort);
    return (
        <ExtListCard to={'/performer/' + p.id} className={'wlext-plist-card' + (p.dup ? ' dup' : '')} title="出演者ページを開く"
            sel={sel} id={String(p.id)} name={name}>
            <div className="wlext-plist-img">
                {p.has_image && !broken
                    ? <img alt={p.name} loading="lazy" src={extApi.performerImageUrl(p.id)} onError={() => setBroken(true)} />
                    : '👤'}
                <div className="wlext-series-count" title={(p.videoCount || 0) + '本'}>{String(p.videoCount || 0)}</div>
            </div>
            <div className="wlext-plist-name">{name}</div>
            {p.furigana && <div className="wlext-plist-furi">{p.furigana}</div>}
            <div className="wlext-plist-stars"><ExtStars value={p.rating || 0} /></div>
            {m != null && <div className="wlext-plist-age">{Math.floor(m / 12) + '歳' + (m % 12) + 'ヶ月'}</div>}
            {meta && <div className="wlext-plist-stat">{meta}</div>}
        </ExtListCard>
    );
}

export default function PerformersPage() {
    // 出演者は全ライブラリ共通。ライブラリが複数あるときは、既定で今のライブラリに出演作がある人だけ出す
    const multiLib = !!(window.WLExt.library && window.WLExt.library.count > 1);
    const [all, setAll] = useState(null);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(() => storedSort(STORE, SORTS, { sort: 'furigana', dir: 'asc' }));
    const [tag, setTag] = useState('');
    const [dupOnly, setDupOnly] = useState(false);
    const [hereOnly, setHereOnly] = useState(multiLib);
    const [mode, setMode] = useState(false);
    const [selected, setSelected] = useState(() => new Map());
    const sel = { mode, setMode, selected, setSelected };

    useEffect(() => {
        extApi.performersAll().then(setAll, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="出演者一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!all) return <ExtListPage title="出演者一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const allTags = [...new Set(all.flatMap(p => p.tags))].sort(window.WLExt.nameCompare);
    const list = all.filter(p => (!tag || p.tags.includes(tag)) && (!dupOnly || p.dup) && (!hereOnly || p.videoCount > 0)).sort(compare(order));
    const reload = () => extApi.performersAll().then(setAll, () => { });
    return (
        <ExtListPage title="出演者一覧">
            <ExtPageTitle icon="users" text={'出演者一覧（' + all.length + '名）'} />
            <div className="wlext-plist-controls">
                <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
                <div className="wlext-plist-sortrow">
                    <span className="wlext-plist-ctl-label">絞り込み:</span>
                    <select className="wlext-plist-select" value={tag} onChange={(e) => setTag(e.target.value)}>
                        <option value="">タグ: すべて</option>
                        {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <label className="wlext-plist-ctl-label" style={{ cursor: 'pointer' }}>
                        <input type="checkbox" checked={dupOnly} onChange={(e) => setDupOnly(e.target.checked)} />{' 別名/氏名が重複する出演者のみ'}
                    </label>
                    {multiLib && (
                        <label className="wlext-plist-ctl-label" style={{ cursor: 'pointer' }}>
                            <input type="checkbox" checked={hereOnly} onChange={(e) => setHereOnly(e.target.checked)} />{' このライブラリに出演作がある出演者のみ'}
                        </label>
                    )}
                </div>
                <div className="wlext-plist-sortrow">
                    <button className="wlext-btn" onClick={() => cleanupUnused(multiLib, reload)}>🗑 関連動画のない出演者を一括削除</button>
                </div>
            </div>
            <div className="wlext-plist-count">{list.length + ' 名'}</div>
            <div className="wlext-plist-grid">
                {list.length
                    ? list.map(p => <PerformerCard key={p.id} p={p} sort={order.sort} sel={sel} />)
                    : <div style={muted}>該当する出演者がいません</div>}
            </div>
            <ExtListFabs sel={sel} items={list.map(p => [String(p.id), p.name || '(無名)'])} kind="performer" kindLabel="出演者" />
        </ExtListPage>
    );
}
