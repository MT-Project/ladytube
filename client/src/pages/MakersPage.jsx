// LadyTube: メーカー一覧 (/makers)。メーカーごとに 画像 (1:1)・名前 (ふりがな)・キャッチコピー・TOP10 タグ・レーベル一覧・
// 平均評価・公式サイト / FANZA のリンクを横長の行で並べる。
// ・画像 / 名前 … そのメーカーで検索。画像の右下から画像を登録 (アニメーション画像は元のまま保存し、表示範囲を別に持つ)
// ・キャッチコピー … 押すとその場で編集 (Enter / 外す で保存、Esc で取り消し)
// ・TOP10 タグ … メーカー×タグの AND 検索。レーベル … そのレーベルで検索 (「レーベルなし」はそのメーカーのレーベル未設定)
// ・⋮ … メーカー情報の編集 / FANZA からの取得。差し込み口 WL.makerMenuExtras に「項目を作る関数 (maker, close) => 要素」を
//   足すと、その下に並ぶ (maker は一覧の1行のデータ { name, listUrl, siteUrl, catchCopy, ... }。押したら close() を呼ぶ)
// v3.2.1 までは拡張の server/ext/public/makerlist.js。見た目は拡張のときと同じ womanlive-ext.css のクラス。
// ダイアログは ExtDialog (openExtDialog で開く)。画像の切り取りは拡張の WL.cropDialog (core.js)
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { ExtListPage, ExtPageTitle, ExtSortRow } from '../components/ExtListParts';
import { ExtStars } from '../components/ExtCardParts';
import { Icon } from '../components/ExtIcon';
import { ExtDialog } from '../components/ExtDialog';
import { openExtDialog } from '../utils/extDialog';
import { storedSort, colorFor, searchToken } from '../utils/formatters';
import { toast } from '../utils/toast';
import { extApi } from '../services/extApi';
import { cropDialog } from '../utils/imageDialogs';
import { nameCompare } from '../utils/namekey';

const SORTS = [['name', 'メーカー名', 'asc'], ['count', '動画本数', 'desc'], ['rating', '評価', 'desc']];
const STORE = 'wlext_sort_makers';
const muted = { color: 'var(--text-secondary,#888)' };

const searchHref = (q) => '/search?q=' + encodeURIComponent(q);
const makerHref = (name) => searchHref('@' + searchToken('maker', name));
const makerTagHref = (name, tag) => searchHref('@' + searchToken('maker', name) + ' ' + searchToken('tag', tag));
const labelHref = (label) => searchHref('@' + searchToken('label', label));
const noLabelHref = (maker) => searchHref('@' + searchToken('maker', maker) + ' label:none');

function compare(order) {
    const dir = order.dir === 'asc' ? 1 : -1;
    return (a, b) => {
        const byName = nameCompare(a.furigana || a.name, b.furigana || b.name);
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

// アニメーション画像 (GIF / APNG / アニメーション WebP) か。切り取って描き直すと止まってしまうので、
// これらは元のまま保存し、表示範囲だけ別に持つ。先頭 256KB だけ見る。
// ponytail: GIF は1コマでもアニメーション扱い (元のまま保存しても表示は同じ)
function isAnimated(dataUrl) {
    const i = dataUrl.indexOf(',') + 1;
    const b64 = dataUrl.slice(i, i + 349524);
    const s = atob(b64.slice(0, b64.length - b64.length % 4));
    if (s.startsWith('GIF8')) return true;
    if (s.startsWith('\x89PNG')) { const a = s.indexOf('acTL'); return a > 0 && a < s.indexOf('IDAT'); }
    if (s.startsWith('RIFF') && s.slice(8, 16) === 'WEBPVP8X') return (s.charCodeAt(20) & 0x02) !== 0;
    return false;
}

// 手元の画像を選び、1:1 に切り取って (そのままなら全体を中央に) 登録する。onDone(変えた項目)
function pickImage(m, onDone) {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
    input.addEventListener('change', () => {
        const file = input.files && input.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = () => cropDialog(reader.result, async (dataUrl, view) => {
            const anim = isAnimated(reader.result);
            try {
                await extApi.setMakerImage(m.name, anim ? reader.result : dataUrl, anim ? view : null);
                onDone({ hasImage: true, imageView: anim ? view : null, v: Date.now() });
                toast('メーカー画像を登録しました', 'success');
            }
            catch (e) { toast('登録に失敗: ' + e.message, 'error'); }
        }, {
            aspect: [1, 1], outW: 600, fit: 'contain', title: 'メーカー画像を登録',
            hint: 'そのまま登録すると画像全体を中央に表示します。拡大すると正方形に切り取れます（ドラッグで位置調整）。',
        });
        reader.readAsDataURL(file);
    });
    document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 1000);
}

/* ---------- メーカー情報の編集 ---------- */
const Field = ({ label, children }) => <div className="wlext-field"><label>{label}</label>{children}</div>;
const hint = (mb) => ({ fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: mb });

function MakerEditDialog({ m, onDone, onClose }) {
    const furi = useRef(null), cc = useRef(null), url = useRef(null), site = useRef(null);
    const save = async () => {
        const v = { furigana: furi.current.value, catchCopy: cc.current.value, listUrl: url.current.value, siteUrl: site.current.value };
        try {
            await extApi.saveMaker({ name: m.name, furigana: v.furigana, catch_copy: v.catchCopy, list_url: v.listUrl, site_url: v.siteUrl });
            onDone({ furigana: v.furigana.trim(), catchCopy: v.catchCopy.trim(), listUrl: v.listUrl.trim(), siteUrl: v.siteUrl.trim() });
            toast('メーカー情報を保存しました', 'success');
            onClose();
        } catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title={'メーカー情報を編集 — ' + m.name} onClose={onClose} onSave={save}>
            <div>
                <div style={hint('0.6rem')}>メーカー名は動画のメタデータそのものです。名前を変えるときは設定画面の「メタデータの置換」を使ってください。</div>
                <Field label="メーカー名"><div className="wlext-maker-readonly">{m.name}</div></Field>
                <Field label="ふりがな"><input ref={furi} className="wlext-input" defaultValue={m.furigana || ''} placeholder="めーかーめい" /></Field>
                <Field label="キャッチコピー"><input ref={cc} className="wlext-input" defaultValue={m.catchCopy || ''} /></Field>
                <Field label="リストページURL (FANZA)"><input ref={url} className="wlext-input" defaultValue={m.listUrl || ''} placeholder="https://..." /></Field>
                <Field label="公式サイトURL"><input ref={site} className="wlext-input" defaultValue={m.siteUrl || ''} placeholder="https://..." /></Field>
            </div>
        </ExtDialog>
    );
}
const editDialog = (m, onDone) => openExtDialog(MakerEditDialog, { m, onDone });

/* ---------- FANZA からのメーカー情報取得 ---------- */
async function fetchInfo(m, onDone) {
    toast('FANZAでメーカーを検索中...');
    let data;
    try { data = await extApi.dmmMakerSearch(m.name); }
    catch (e) { toast(e.message || '検索に失敗しました', 'error'); return; }
    if (data.exact && data.exact.length === 1) openExtDialog(MakerPreviewDialog, { m, item: data.exact[0], onDone });
    else openExtDialog(MakerSelectDialog, { m, data, onDone });
}

const Msg = ({ children }) => <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#888)' }}>{children}</div>;

// 完全一致しなかったとき: 候補から選ばせる (名前を変えて再検索もできる)
function MakerSelectDialog({ m, data: initial, onDone, onClose }) {
    const [data, setData] = useState(initial);   // 検索の結果 / { msg }
    const input = useRef(null);
    const research = async () => {
        const q = input.current.value.trim(); if (!q) return;
        setData({ msg: '検索中...' });
        try { setData(await extApi.dmmMakerSearch(q)); }
        catch (e) { setData({ msg: '検索に失敗しました: ' + e.message }); }
    };
    const items = data.msg ? [] : ((data.exact && data.exact.length ? data.exact : data.candidates) || []);
    return (
        <ExtDialog title="メーカーを選択してください" onClose={onClose}>
            <div>
                <Field label="メーカー名で検索（Enterで再検索）">
                    <div className="wlext-inline">
                        <input ref={input} className="wlext-input" defaultValue={m.name} placeholder="メーカー名" onKeyDown={(e) => { if (e.key === 'Enter') research(); }} />
                        <button className="wlext-btn" onClick={research}>検索</button>
                    </div>
                </Field>
                <div className="wlext-dmm-select">
                    {data.msg ? <Msg>{data.msg}</Msg>
                        : !items.length ? <Msg>候補が見つかりませんでした。名前を変えて検索してください。</Msg>
                            : <>
                                {items.map((it, i) => (
                                    <div key={i} className="wlext-dmm-select-item" onClick={() => openExtDialog(MakerPreviewDialog, { m, item: it, onDone })}>
                                        <div className="wlext-dmm-select-info">
                                            <div className="wlext-dmm-select-title">{it.name}</div>
                                            <div className="wlext-dmm-select-sub">{it.ruby || '(読み仮名なし)'}</div>
                                        </div>
                                    </div>
                                ))}
                                {data.limited && <Msg>{'候補が多いため上位' + items.length + '件のみ表示しています。'}</Msg>}
                            </>}
                </div>
            </div>
        </ExtDialog>
    );
}

// 反映前の確認 (動画情報・出演者情報の取得と同じ流れ)
function MakerPreviewDialog({ m, item, onDone, onClose }) {
    const save = async () => {
        try {
            await extApi.saveMaker({ name: m.name, furigana: item.ruby || '', list_url: item.listUrl || '' });
            onDone({ furigana: item.ruby || '', listUrl: item.listUrl || '' });
            toast('メーカー情報を設定しました', 'success');
            onClose();
        } catch (e) { toast('設定に失敗: ' + e.message, 'error'); }
    };
    const rows = [['メーカー名 (FANZA)', item.name], ['読み仮名', item.ruby], ['リストページURL', item.listUrl]];
    return (
        <ExtDialog title="この内容で設定しますか？" onClose={onClose} onSave={save} saveLabel="設定する">
            <div>
                <div style={hint('0.7rem')}>{'「' + m.name + '」に、読み仮名(ふりがな)とリストページURLを設定します。メーカー名そのものは変更しません。'}</div>
                <div className="wlext-detail-grid" style={{ fontSize: '0.85rem' }}>
                    {rows.map(([k, v]) => <Fragment key={k}><div className="wlext-key">{k}</div><div className="wlext-val">{v || '(なし)'}</div></Fragment>)}
                </div>
            </div>
        </ExtDialog>
    );
}

/* ---------- ⋮ メニュー (リスト表示の動画メニューと同じ見た目・配置) ---------- */
function MakerMenu({ anchor, m, onClose, onDone }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const el = ref.current;
        // 差し込み口の項目は、位置を決める前に足す (高さに入れる)
        const extras = Object.values(window.WLExt.makerMenuExtras || {}).map(make => make(m, onClose)).filter(Boolean);
        extras.forEach(x => el.appendChild(x));
        // ⋮ の直下、右端をそろえる。画面の下にはみ出すなら上側へ
        const r = anchor.getBoundingClientRect();
        let left = r.right - el.offsetWidth; if (left < 8) left = 8;
        let top = r.bottom + 6;
        if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 6);
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        return () => extras.forEach(x => x.remove());
    }, [anchor, m, onClose]);
    const item = (icon, label, run) => (
        <div className="wlext-sel-menu-item" onClick={() => { onClose(); run(m, onDone); }}><Icon name={icon} size={15} /><span>{label}</span></div>
    );
    return createPortal(
        <>
            <div className="wlext-sel-menu-backdrop" onClick={onClose} />
            <div ref={ref} className="wlext-sel-menu wlext-sel-menu-anchored">
                {item('pencil', 'メーカー情報編集', editDialog)}
                {item('search', 'メーカー情報取得', fetchInfo)}
            </div>
        </>,
        document.body
    );
}

// キャッチコピー: 押すと入力欄に替え、Enter / 外す で保存、Esc で取り消し
function CatchCopy({ m, update }) {
    const [editing, setEditing] = useState(false);
    const done = useRef(false);   // Enter で閉じたあとの blur で二度保存しない
    const input = useRef(null);
    useLayoutEffect(() => { if (editing) { input.current.focus(); input.current.select(); } }, [editing]);
    if (!editing) {
        return (
            <div className={'wlext-maker-catch' + (m.catchCopy ? '' : ' empty')} title="クリックして編集"
                onClick={() => { done.current = false; setEditing(true); }}>{m.catchCopy || 'キャッチコピーを追加'}</div>
        );
    }
    const finish = async (save) => {
        if (done.current) return;
        done.current = true;
        const v = input.current.value.trim();
        setEditing(false);
        if (!save || v === (m.catchCopy || '')) return;
        try { await extApi.saveMaker({ name: m.name, catch_copy: v }); update({ catchCopy: v }); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <input ref={input} className="wlext-input wlext-maker-catch-input" defaultValue={m.catchCopy || ''} placeholder="キャッチコピー"
            onKeyDown={(e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); }}
            onBlur={() => finish(true)} />
    );
}

function MakerRow({ m, update, openMenu }) {
    const v = m.imageView;   // アニメーション画像は元のまま保存してあるので、登録時の表示範囲をここで当てる
    const title = '「' + m.name + '」で検索';
    const labels = m.labels || [];
    return (
        <div className="wlext-maker-row">
            <Link to={makerHref(m.name)} className="wlext-maker-img" title={title} style={m.hasImage ? undefined : { background: colorFor(m.name) }}>
                {m.hasImage
                    ? <img loading="lazy" alt={m.name} src={extApi.makerImageUrl(m.name, m.v)} onError={() => update({ hasImage: false })}
                        style={v ? {
                            position: 'absolute', objectFit: 'fill', maxWidth: 'none', width: (100 / v.w) + '%', height: (100 / v.h) + '%',
                            left: (-v.x / v.w * 100) + '%', top: (-v.y / v.h * 100) + '%',
                        } : undefined} />
                    : <div className="wlext-tag-thumb-label">{m.name}</div>}
                <div className="wlext-series-count" title={m.count + '本'}>{String(m.count)}</div>
                <div className="wlext-tag-edit" title="メーカー画像を設定"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); pickImage(m, update); }}>
                    <Icon name="image" size={15} />
                </div>
            </Link>
            <div className="wlext-maker-body">
                <Link to={makerHref(m.name)} className="wlext-maker-name" title={title}>
                    <span>{m.name}</span><span className="wlext-maker-furi">{m.furigana || ''}</span>
                </Link>
                <CatchCopy m={m} update={update} />
                <div className="wlext-maker-tags">
                    {(m.topTags || []).map(t => (
                        <Link key={t.name} to={makerTagHref(m.name, t.name)} className="wlext-maker-tag" title={'「' + m.name + '」×「' + t.name + '」で検索'}>
                            {t.name + '(' + t.count + ')'}
                        </Link>
                    ))}
                </div>
                {labels.length > 0 && (
                    <details className="wlext-maker-labels">
                        <summary>{'レーベル一覧（' + labels.length + '）'}</summary>
                        <div className="wlext-maker-label-list">
                            {labels.map((l, i) => (
                                <Link key={i} to={l.none ? noLabelHref(m.name) : labelHref(l.name)} className={'wlext-maker-label' + (l.none ? ' none' : '')}
                                    title={l.none ? '「' + m.name + '」のレーベル未設定の作品を検索' : '「' + l.name + '」で検索'}>
                                    {l.name + '(' + l.count + ')'}
                                </Link>
                            ))}
                        </div>
                    </details>
                )}
            </div>
            <div className="wlext-maker-side">
                <div className="wlext-maker-side-top">
                    <div className="wlext-series-rating">
                        {m.avgRating != null
                            ? <><ExtStars value={Math.round(m.avgRating)} /><span className="wlext-series-ratingnum">{m.avgRating.toFixed(1)}</span></>
                            : <span style={{ ...muted, fontSize: '0.75rem' }}>評価なし</span>}
                    </div>
                    <div className="wlext-maker-menu-btn" title="メーカーの操作" onClick={(e) => { e.stopPropagation(); openMenu(e.currentTarget, m); }}>⋮</div>
                </div>
                <div className="wlext-maker-links">
                    <a className="wlext-maker-site" target="_blank" rel="noopener noreferrer" title="メーカーの公式サイトを開く"
                        href={m.siteUrl || '#'} style={m.siteUrl ? undefined : { display: 'none' }}>公式サイト</a>
                    <a className="wlext-maker-fanza" href={m.listUrl || '#'} target="_blank" rel="noopener noreferrer" title="FANZAのリストページを開く"
                        style={m.listUrl ? undefined : { display: 'none' }}>FANZA</a>
                </div>
            </div>
        </div>
    );
}

export default function MakersPage() {
    const [list, setList] = useState(null);      // メーカー (v は画像の URL に付ける印。変えたら読み直す)
    const [error, setError] = useState(null);
    const [order, setOrder] = useState(() => storedSort(STORE, SORTS, { sort: 'count', dir: 'desc' }));
    const [menu, setMenu] = useState(null);      // ⋮ のメニュー { anchor, m }
    const closeMenu = useCallback(() => setMenu(null), []);

    useEffect(() => {
        extApi.makersList().then(l => {
            const v = Date.now();
            setList(l.map(m => ({ ...m, v })));
        }, e => setError(e.message));
    }, []);

    if (error) return <ExtListPage title="メーカー一覧"><div>{'読み込みに失敗しました: ' + error}</div></ExtListPage>;
    if (!list) return <ExtListPage title="メーカー一覧"><div style={muted}>読み込み中...</div></ExtListPage>;

    const updater = (name) => (patch) => setList(prev => prev.map(x => x.name === name ? { ...x, ...patch } : x));
    const sorted = list.slice().sort(compare(order));
    return (
        <ExtListPage title="メーカー一覧">
            <ExtPageTitle icon="factory" text={'メーカー一覧（' + list.length + '件）'} />
            <div className="wlext-plist-controls">
                <ExtSortRow defs={SORTS} order={order} onChange={setOrder} storeKey={STORE} />
            </div>
            <div className="wlext-maker-list">
                {sorted.length
                    ? sorted.map(m => <MakerRow key={m.name} m={m} update={updater(m.name)} openMenu={(anchor, mk) => setMenu({ anchor, m: mk })} />)
                    : <div style={muted}>メーカーが設定された動画がありません</div>}
            </div>
            {menu && <MakerMenu anchor={menu.anchor} m={menu.m} onClose={closeMenu} onDone={updater(menu.m.name)} />}
        </ExtListPage>
    );
}
