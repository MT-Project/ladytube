// LadyTube: タグ一覧 (/tags)。登録動画のタグをサムネイル付きで並べる (作りはシリーズ一覧と同じ)。押すとそのタグを検索。
// サムネイルは既定が無地 (タグ名から決まる色) にタグ名。右下の画像ボタンから、そのタグの動画のスクリーンショットか
// 手元の画像 (16:9 に切り取る) を登録できる。並び替え: タグ名 / 動画本数 / プリセット順 (# のグループごとに見出し)。
// v3.2.1 までは拡張の server/ext/public/taglist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス。
// API・切り取り・通知・プリセットの読み込みは拡張の WL.* (api.js・core.js。React より先に読まれる)
import { Fragment, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExtListCard, ExtListFabs, ExtListPage, ExtPageTitle, ExtSortRow } from '../components/ExtListParts';
import { Icon } from '../components/ExtIcon';
import { storedSort, colorFor } from '../utils/formatters';
import { toast } from '../utils/toast';
import { extApi } from '../services/extApi';
import { loadVideoTagPresets, parseTagGroups } from '../utils/tagPresets';

const SORTS = [['name', 'タグ名', 'asc'], ['count', '動画本数', 'desc'], ['preset', 'プリセット順', 'asc']];
const STORE = 'wlext_sort_tags';
const muted = { color: 'var(--text-secondary,#888)' };

// 並びの区切り [{ label, items }]。プリセット順は、タグのプリセットの並びで # のグループごとに分け
// (入れ子は「親 / 子」)、プリセットに無いタグは末尾へ (グループがあるときだけ「プリセット外」の見出し)
function sectionsFor(list, presets, order) {
    const WL = window.WLExt;
    if (order.sort !== 'preset') {
        const dir = order.dir === 'asc' ? 1 : -1;
        const items = list.slice().sort((a, b) => {
            const byName = WL.nameCompare(a.name, b.name);
            if (order.sort === 'name') return byName * dir;
            return ((a.count || 0) - (b.count || 0)) * dir || byName;
        });
        return [{ label: '', items }];
    }
    const byKey = new Map(list.map(t => [t.name.toLowerCase(), t]));
    const used = new Set();
    const sections = [];
    (function walk(node, label) {
        const items = [];
        node.tags.forEach(nm => {
            const t = byKey.get(String(nm).toLowerCase());
            if (t && !used.has(t)) { used.add(t); items.push(t); }
        });
        if (items.length) sections.push({ label, items });
        node.children.forEach(c => walk(c, label ? label + ' / ' + c.name : c.name));
    })(parseTagGroups(presets), '');
    const hasGroups = sections.some(s => s.label);
    const rest = list.filter(t => !used.has(t)).sort((a, b) => WL.nameCompare(a.name, b.name));
    if (rest.length) sections.push({ label: hasGroups ? 'プリセット外' : '', items: rest });
    if (order.dir === 'desc') { sections.reverse(); sections.forEach(s => s.items.reverse()); }
    return sections;
}

// 手元の画像を選び、16:9 に切り取って登録する
function pickAndCrop(name, onChanged) {
    const WL = window.WLExt;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files && input.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => WL.cropDialog(reader.result, async (dataUrl) => {
            try { await extApi.setTagThumb(name, dataUrl); onChanged(true); toast('サムネイルを登録しました', 'success'); }
            catch (e) { toast('登録に失敗: ' + e.message, 'error'); }
        }, { aspect: [16, 9], outW: 640, title: 'タグサムネイルを切り取り', hint: 'ドラッグで位置調整・スライダーで拡大。推奨比率 16:9（640×360）で切り取ります。' });
        reader.readAsDataURL(file);
    });
    document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 1000);
}

// サムネイルの編集: そのタグの動画のスクリーンショット (9枚) から選ぶ。下に 既定に戻す / 決定 / 他の画像へ更新 / ローカルから選択
function ThumbEditor({ tag, onClose, onChanged }) {
    const WL = window.WLExt;
    const [shots, setShots] = useState(null);   // null = 読み込み中 / { error } / 配列
    const [round, setRound] = useState(0);      // 「他の画像へ更新」で増やす
    const [picked, setPicked] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        extApi.tagScreenshots(tag.name, 9).then(s => { if (alive) setShots(s); }, e => { if (alive) setShots({ error: e.message }); });
        return () => { alive = false; };
    }, [WL, tag.name, round]);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const reload = () => { setShots(null); setPicked(null); setRound(n => n + 1); };
    const decide = async () => {
        if (picked == null) return;
        setBusy(true);
        try {
            await extApi.setTagThumbFromScreenshot(tag.name, picked);
            onChanged(true);
            toast('サムネイルを登録しました', 'success');
            onClose();
        } catch (e) { toast('登録に失敗: ' + e.message, 'error'); setBusy(false); }
    };
    const reset = async () => {
        onClose();
        try { await extApi.deleteTagThumb(tag.name); onChanged(false); toast('既定のサムネイルに戻しました', 'success'); }
        catch (e) { toast('リセットに失敗: ' + e.message, 'error'); }
    };
    const msg = (text) => <div className="wlext-ss-pick-msg">{text}</div>;
    const empty = Array.isArray(shots) && !shots.length;

    return createPortal(
        <div className="wlext-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="wlext-dialog">
                <div className="wlext-dialog-header"><span>{'サムネイルを編集 — ' + tag.name}</span><span className="wlext-close-x" onClick={onClose}>✕</span></div>
                <div className="wlext-dialog-body">
                    <div className="wlext-ss-grid wlext-ss-pick-grid">
                        {shots == null ? msg('読み込み中...')
                            : shots.error ? msg('読み込みに失敗しました: ' + shots.error)
                                : empty ? msg('このタグの動画にスクリーンショットがありません。「ローカルから選択」で画像を登録できます。')
                                    : shots.map(s => (
                                        <div key={s.id} className={'wlext-ss-card wlext-ss-pick-card' + (picked === s.id ? ' wlext-ss-sel' : '')} onClick={() => setPicked(s.id)}>
                                            <img src={'/api/screenshot/' + s.id + '/image'} loading="lazy" />
                                        </div>
                                    ))}
                    </div>
                </div>
                <div className="wlext-dialog-footer">
                    {tag.hasThumb && <button className="wlext-btn" style={{ marginRight: 'auto' }} onClick={reset}>既定に戻す</button>}
                    <div className="wlext-inline">
                        <button className="wlext-btn wlext-btn-primary" disabled={picked == null || busy} onClick={decide}>決定</button>
                        <button className="wlext-btn" disabled={empty} onClick={reload}>他の画像へ更新</button>
                        <button className="wlext-btn" onClick={() => { onClose(); pickAndCrop(tag.name, onChanged); }}>ローカルから選択</button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

function TagCard({ tag, sel, onEdit, onThumbError }) {
    const WL = window.WLExt;
    return (
        <ExtListCard to={'/search?q=' + encodeURIComponent('@tag:"' + tag.name + '"')} className="wlext-series-card wlext-tag-card"
            title={'「' + tag.name + '」で検索'} sel={sel} id={tag.name} name={tag.name}>
            <div className="wlext-video-thumb wlext-tag-thumb" style={tag.hasThumb ? undefined : { background: colorFor(tag.name) }}>
                {tag.hasThumb
                    ? <img loading="lazy" alt={tag.name} src={extApi.tagThumbUrl(tag.name, tag.v)} onError={onThumbError} />
                    : <div className="wlext-tag-thumb-label">{tag.name}</div>}
                <div className="wlext-series-count" title={tag.count + '本'}>{String(tag.count)}</div>
                {/* 選択モード中はカードと同じく選択を切り替える (押したことをカードへ伝える) */}
                <div className="wlext-tag-edit" title="サムネイルを編集"
                    onClick={(e) => { e.preventDefault(); if (sel.mode) return; e.stopPropagation(); onEdit(); }}>
                    <Icon name="image" size={15} />
                </div>
            </div>
            <div className="wlext-series-name">{tag.name}</div>
        </ExtListCard>
    );
}

export default function TagsPage() {
    const [list, setList] = useState(null);      // タグ (v はサムネイルの URL に付ける印。変えたら読み直す)
    const [presets, setPresets] = useState([]);
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(() => storedSort(STORE, SORTS, { sort: 'name', dir: 'asc' }));
    const [editing, setEditing] = useState(null);   // サムネイルを編集中のタグ名
    const [mode, setMode] = useState(false);
    const [selected, setSelected] = useState(() => new Map());
    const sel = { mode, setMode, selected, setSelected };

    useEffect(() => {
        Promise.all([
            extApi.tagsList(),
            loadVideoTagPresets().catch(() => []),   // プリセットが読めなくても一覧は出す
        ]).then(([tags, p]) => {
            const v = Date.now();
            setList(tags.map(t => ({ ...t, v })));
            setPresets(p);
        }, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="タグ一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="タグ一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const setThumb = (name, hasThumb) => setList(prev => prev.map(t => t.name === name ? { ...t, hasThumb, v: Date.now() } : t));
    const sections = sectionsFor(list, presets, order);
    const editTag = editing && list.find(t => t.name === editing);
    return (
        <ExtListPage title="タグ一覧">
            <ExtPageTitle icon="tag" text={'タグ一覧（' + list.length + '件）'} />
            <div className="wlext-plist-controls">
                <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
                <div className="wlext-plist-ctl-label">サムネイルの推奨比率は 16:9（例: 640×360）です。各タグ右下の画像ボタンから変更できます。</div>
            </div>
            <div className="wlext-series-grid">
                {sections.some(s => s.items.length)
                    ? sections.map((sec, i) => (
                        <Fragment key={i + ':' + sec.label}>
                            {sec.label && <div className="wlext-taglist-sep">{sec.label}</div>}
                            {sec.items.map(t => (
                                <TagCard key={t.name} tag={t} sel={sel} onEdit={() => setEditing(t.name)}
                                    onThumbError={() => setList(prev => prev.map(x => x.name === t.name ? { ...x, hasThumb: false } : x))} />
                            ))}
                        </Fragment>
                    ))
                    : <div style={muted}>タグが設定された動画がありません</div>}
            </div>
            {editTag && <ThumbEditor tag={editTag} onClose={() => setEditing(null)} onChanged={(has) => setThumb(editTag.name, has)} />}
            <ExtListFabs sel={sel} items={sections.flatMap(s => s.items).map(t => [t.name, t.name])} kind="tag" kindLabel="タグ" />
        </ExtListPage>
    );
}
