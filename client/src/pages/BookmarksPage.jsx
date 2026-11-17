// LadyTube: ブックマーク (/bookmarks)。ブックマークのフォルダをサムネイル・本数・平均評価で並べる。
// 並び替え: フォルダ名 / 動画本数 / 評価 (保存しない)。フォルダの追加・名称変更・削除。サムネイルか名前を押すとそのフォルダを検索。
// 表示はサムネイルと名前のみ (箇条書き。名称変更・削除は行の右) を切り替えられる (保存する)。
// v3.2.1 までは拡張の server/ext/public/bookmarklist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス。
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExtListPage, ExtNameList, ExtPageTitle, ExtSortRow, ExtViewToggle } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import { Icon } from '../components/ExtIcon';
import { toast } from '../utils/toast';
import { extApi } from '../services/extApi';
import { ExtConfirm, ExtDialog } from '../components/ExtDialog';
import { openExtDialog } from '../utils/extDialog';
import { nameCompare } from '../utils/namekey';
import { searchToken, storedView } from '../utils/formatters';

const SORTS = [['name', 'フォルダ名', 'asc'], ['count', '動画本数', 'desc'], ['rating', '評価', 'desc']];
const VIEW_STORE = 'wlext_view_bookmarks';
const muted = { color: 'var(--text-secondary,#888)' };

function compare(order) {
    const dir = order.dir === 'asc' ? 1 : -1;
    return (a, b) => {
        const byName = nameCompare(a.name || '', b.name || '');
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

// フォルダ名を1つ入れるダイアログ (追加・名称変更)。save(name) が済んだら閉じて onDone
function NameDialog({ title, saveLabel, value, save, onDone, emptyToast, onClose }) {
    const input = useRef(null);
    useEffect(() => { const t = setTimeout(() => input.current?.focus(), 50); return () => clearTimeout(t); }, []);
    const ok = async () => {
        const name = input.current.value.trim();
        if (!name) { if (emptyToast) toast('フォルダ名を入力してください', 'error'); return; }
        try { await save(name); onClose(); onDone(); } catch (e) { toast(saveLabel + 'に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title={title} onClose={onClose} onSave={ok} saveLabel={saveLabel}>
            <div className="wlext-field"><label>フォルダ名</label>
                {value == null ? <input ref={input} className="wlext-input" placeholder="フォルダ名" /> : <input ref={input} className="wlext-input" defaultValue={value} />}
            </div>
        </ExtDialog>
    );
}
const nameDialog = (title, saveLabel, value, save, onDone, emptyToast) => openExtDialog(NameDialog, { title, saveLabel, value, save, onDone, emptyToast });

function deleteDialog(s, onDone) {
    openExtDialog(ExtConfirm, {
        title: 'フォルダを削除', saveLabel: '削除する',
        body: <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>{'「' + s.name + '」を削除します（中のブックマークも削除されます。動画自体は削除されません）。よろしいですか？'}</div>,
        onSave: async (close) => { try { await extApi.bmDeleteFolder(s.id); close(); onDone(); } catch (e) { toast('削除に失敗: ' + e.message, 'error'); } },
    });
}

// フォルダ名で検索する (名前の " と \ は searchToken がエスケープする)
const folderUrl = (s) => '/search?q=' + encodeURIComponent('@' + searchToken('bookmark', s.name || ''));

function FolderActions({ s, reload }) {
    return (
        <div className="wlext-bm-actions">
            <span className="wlext-link" onClick={() => nameDialog('フォルダ名を変更', '変更', s.name || '', (name) => extApi.bmRenameFolder(s.id, name), reload, false)}><Icon name="pencil" size={12} />名称変更</span>
            <span className="wlext-link" style={{ color: 'var(--status-error,#e51400)' }} onClick={() => deleteDialog(s, reload)}><Icon name="trash" size={12} />削除</span>
        </div>
    );
}

function FolderCard({ s, reload }) {
    const url = folderUrl(s);
    return (
        <div className="wlext-series-card">
            <Link to={url} className="wlext-video-thumb" title="開く">
                {s.thumbId
                    ? <img src={'/api/video/' + s.thumbId + '/thumbnail'} loading="lazy" alt={s.name} />
                    : <div className="noimg">NO IMAGE</div>}
                <div className="wlext-series-count" title={s.count + '本'}>{String(s.count)}</div>
            </Link>
            <Link to={url} className="wlext-series-name" style={{ cursor: 'pointer' }} title="開く">{s.name || '(無題)'}</Link>
            <div className="wlext-series-rating">
                {s.avgRating != null
                    ? <><ExtStars value={Math.round(s.avgRating)} /><span className="wlext-series-ratingnum">{s.avgRating.toFixed(1)}</span></>
                    : <span style={{ ...muted, fontSize: '0.75rem' }}>評価なし</span>}
            </div>
            <FolderActions s={s} reload={reload} />
        </div>
    );
}

export default function BookmarksPage() {
    const [list, setList] = useState(null);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState({ sort: 'name', dir: 'asc' });
    const [view, setView] = useState(() => storedView(VIEW_STORE));

    useEffect(() => {
        extApi.bmFolders().then(setList, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="ブックマーク"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="ブックマーク"><div style={muted}>読み込み中...</div></ExtListPage>;

    const reload = () => extApi.bmFolders().then(setList, () => { });
    const sorted = list.slice().sort(compare(order));
    return (
        <ExtListPage title="ブックマーク">
            <ExtPageTitle icon="bookmark" text={'ブックマーク（' + list.length + 'フォルダ）'} />
            <div className="wlext-plist-controls">
                <div className="wlext-plist-ctlrow">
                    <ExtSortRow defs={SORTS} order={order} onChange={setOrder} />
                    <ExtViewToggle view={view} onChange={setView} storeKey={VIEW_STORE} />
                </div>
                <div className="wlext-plist-sortrow">
                    <button className="wlext-btn" onClick={() => nameDialog('フォルダを追加', '追加', null, (name) => extApi.bmCreateFolder(name), reload, true)}>＋ フォルダを追加</button>
                </div>
            </div>
            {!sorted.length ? <div style={muted}>ブックマークフォルダがありません。「＋ フォルダを追加」または各動画のブックマークのボタンから作成できます。</div>
                : view === 'names'
                    ? <ExtNameList items={sorted.map(s => ({
                        id: s.id, name: s.name || '(無題)', count: s.count, title: '開く', to: folderUrl(s),
                        extra: <FolderActions s={s} reload={reload} />,
                    }))} />
                    : <div className="wlext-series-grid">{sorted.map(s => <FolderCard key={s.id} s={s} reload={reload} />)}</div>}
        </ExtListPage>
    );
}
