// LadyTube: 拡張から本体へ移した一覧のページ (シリーズ一覧など) の共通の部品。
// 中身の見た目は拡張のページと同じ womanlive-ext.css のクラス (.wlext-pp-container・.wlext-plist-*)。ヘッダーは本体の Navbar。
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from './Navbar';
import { Icon } from './ExtIcon';
import ExtSelectionFabs from './ExtSelection';
import { ExtDialog } from './ExtDialog';
import { extSend } from '../services/extApi';
import { closeExtDialog, extDialogSnapshot, openExtDialog } from '../utils/extDialog';
import { theme } from '../theme';
import { toast } from '../utils/toast';

const page = css`
    min-height: 100vh;
    padding-top: 3rem;
    background-color: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
`;

// ページの外枠。title は文書の題 (「<title> - LadyTube」。拡張の WL.setDocTitle と同じ形。空なら「LadyTube」)
export function ExtListPage({ title, children }) {
    useEffect(() => {
        document.title = title ? title + ' - LadyTube' : 'LadyTube';
        window.scrollTo(0, 0);
    }, [title]);
    return (
        <div className={page}>
            <Navbar />
            <div className="wlext-pp-container">{children}</div>
        </div>
    );
}

// ページの見出し (アイコン + 文字。拡張の WL.pageTitle と同じ形)
export function ExtPageTitle({ icon, text }) {
    return <h2 className="wlext-relcal-title"><Icon name={icon} size={20} /><span>{text}</span></h2>;
}

// 選択モード: ページが sel = { mode, setMode, selected, setSelected } を持ち (selected は Map: 削除対象の値 -> 表示名)、
// カードの ExtListCard と丸ボタンの ExtListFabs に渡す (拡張の一覧のページの WL.listSelect と同じ動き)。

// 一覧のカード。押すと to へ (中クリック・Ctrl+クリックは新しいタブ)。選択モード中は押すと選択を切り替え、左上に印を置く
export function ExtListCard({ to, className, title, sel, id, name, children }) {
    const on = sel.mode && sel.selected.has(id);
    const toggle = () => sel.setSelected(prev => {
        const next = new Map(prev);
        if (next.has(id)) next.delete(id); else next.set(id, name);
        return next;
    });
    return (
        <Link to={to} className={className + (on ? ' wlext-sel-on' : '')} title={title}
            style={sel.mode ? { position: 'relative' } : undefined}
            onClick={sel.mode ? (e) => { e.preventDefault(); toggle(); } : undefined}>
            {children}
            {sel.mode && <div className={'wlext-sel-badge' + (on ? ' on' : '')}>{on ? '✓' : ''}</div>}
        </Link>
    );
}

// 「名前のみ」の表示 (ExtViewToggle で切り替える)。items は [{ id, to, title, name, count, extra }] で、箇条書きに「名前（N本）」を並べる
// (広い画面は複数の列に流す。womanlive-ext.css の .wlext-name-list)。sel を渡すと選択モードで選べる (カードの ExtListCard と同じ)
export function ExtNameList({ items, sel }) {
    const body = (it) => <><span className="wlext-name-text">{it.name}</span><span className="wlext-name-count">{'（' + it.count + '本）'}</span></>;
    return (
        <ul className="wlext-name-list">
            {items.map(it => (
                <li key={it.id}>
                    {sel
                        ? <ExtListCard to={it.to} className="wlext-name-item" title={it.title} sel={sel} id={it.id} name={it.name}>{body(it)}</ExtListCard>
                        : <Link to={it.to} className="wlext-name-item" title={it.title}>{body(it)}</Link>}
                    {it.extra}
                </li>
            ))}
        </ul>
    );
}

// 選択モードの丸ボタン (検索画面と同じ ExtSelectionFabs)。items は表示中の [削除対象の値, 表示名] の並び。
// 「すべて選択」は表示中を選んだものに足す (絞り込みで隠れた選択は残す。拡張と同じ)。
// kind / kindLabel は削除の種類 (series / tag ...) と、メニュー・確認に出す名前。メニューと確認は下の ListMenu (v3.2.1 までは拡張の listselect.js)
export function ExtListFabs({ sel, items, kind, kindLabel }) {
    return (
        <ExtSelectionFabs selectionMode={sel.mode} selectedIds={sel.selected}
            onToggleMode={() => { closeListMenu(); sel.setMode(!sel.mode); sel.setSelected(new Map()); }}
            onSelectAll={() => sel.setSelected(prev => new Map([...prev, ...items]))}
            onDeselectAll={() => sel.setSelected(new Map())}
            onMenu={() => {
                if (extDialogSnapshot()?.Component === ListMenu) closeExtDialog();
                else if (sel.selected.size) openExtDialog(ListMenu, { kind, kindLabel, selected: new Map(sel.selected) });
            }} />
    );
}

const closeListMenu = () => { if (extDialogSnapshot()?.Component === ListMenu) closeExtDialog(); };

// 「N件を一括操作」のメニュー (右下)。selected は Map (削除対象の値 -> 表示名)
function ListMenu({ kind, kindLabel, selected, onClose }) {
    return createPortal(
        <>
            <div className="wlext-sel-menu-backdrop" onClick={onClose} />
            <div className="wlext-sel-menu">
                <div className="wlext-sel-menu-head">{selected.size + '件を一括操作'}</div>
                <div className="wlext-sel-menu-item danger" onClick={() => { onClose(); openExtDialog(ListDeleteDialog, { kind, kindLabel, selected }); }}>
                    <Icon name="trash" size={15} /><span>{kindLabel + 'の削除'}</span>
                </div>
            </div>
        </>,
        document.body
    );
}

// 選んだ値を全動画のメタデータから取り除く。終わったらページを読み直す
function ListDeleteDialog({ kind, kindLabel: label, selected, onClose }) {
    const names = [...selected.values()];
    const remove = async () => {
        try {
            const r = await extSend('POST', '/ext/api/metadata/delete', { kind, targets: [...selected.keys()] });
            toast(r.deleted + '件の' + label + 'を削除しました（動画 ' + r.videos + '件を更新）', 'success');
            onClose();
            // ponytail: 拡張と同じくページごと読み直す。各ページに読み直しの関数を渡すなら、それに替える
            setTimeout(() => location.reload(), 500);
        } catch (e) { toast('削除に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title={label + 'の削除'} onClose={onClose} onSave={remove} saveLabel="削除する" danger>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ color: 'var(--status-error,#e51400)', fontWeight: 'bold', marginBottom: '0.4rem' }}>{'選択した ' + names.length + '件の' + label + 'を削除します'}</div>
                <div className="wlext-sel-del-names">{names.join('、')}</div>
                <div style={{ marginTop: '0.5rem' }}>{'すべての動画のメタデータから' + label + 'を取り除きます。動画そのものは削除しません。'}</div>
                <div style={{ marginTop: '0.4rem', fontWeight: 'bold' }}>この操作は元に戻せません。よろしいですか？</div>
            </div>
        </ExtDialog>
    );
}

// 表示の切り替え (サムネイル / 名前のみ)。並び替えの行の右に置く (.wlext-plist-ctlrow で並べる)。view は 'thumb' | 'names'。
// storeKey があれば保存する (戻すのは utils/formatters.js の storedView)
const VIEWS = [['thumb', 'サムネイル', 'layout-grid'], ['names', '名前のみ', 'list']];
export function ExtViewToggle({ view, onChange, storeKey }) {
    return (
        <div className="wlext-plist-sortrow">
            <span className="wlext-plist-ctl-label">表示:</span>
            {VIEWS.map(([key, label, icon]) => (
                <div key={key} className={'wlext-plist-sortbtn wlext-plist-viewbtn' + (view === key ? ' active' : '')} onClick={() => {
                    if (storeKey) { try { localStorage.setItem(storeKey, key); } catch { /* 保存できなくても切り替える */ } }
                    onChange(key);
                }}>
                    <Icon name={icon} size={14} /><span>{label}</span>
                </div>
            ))}
        </div>
    );
}

// 並び替えの行 (拡張の WL.sortRow と同じ形)。defs は [キー, 表示名, 既定の向き] の並び、order は { sort, dir }。
// 押すと同じキーなら向きを変え、違うキーならそのキーの既定の向き。storeKey があれば保存する (戻すのは utils/formatters.js の storedSort)
export function ExtSortRow({ defs, order, onChange, storeKey }) {
    return (
        <div className="wlext-plist-sortrow">
            <span className="wlext-plist-ctl-label">並び替え:</span>
            {defs.map(([key, label, defDir]) => {
                const active = order.sort === key;
                const choose = () => {
                    const next = active ? { sort: key, dir: order.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: defDir || 'asc' };
                    if (storeKey) { try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* 保存できなくても並び替える */ } }
                    onChange(next);
                };
                return (
                    <div key={key} className={'wlext-plist-sortbtn' + (active ? ' active' : '')} onClick={choose}>
                        {label + (active ? (order.dir === 'asc' ? ' ↑' : ' ↓') : '')}
                    </div>
                );
            })}
        </div>
    );
}
