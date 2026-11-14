// LadyTube: 拡張から本体へ移した一覧のページ (シリーズ一覧など) の共通の部品。
// 中身の見た目は拡張のページと同じ womanlive-ext.css のクラス (.wlext-pp-container・.wlext-plist-*)。ヘッダーは本体の Navbar。
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from './Navbar';
import { Icon } from './ExtIcon';
import ExtSelectionFabs from './ExtSelection';
import { theme } from '../theme';

const page = css`
    min-height: 100vh;
    padding-top: 3rem;
    background-color: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
`;

// ページの外枠。title は文書の題 (「<title> - LadyTube」。拡張の WL.setDocTitle と同じ形)
export function ExtListPage({ title, children }) {
    useEffect(() => {
        document.title = title + ' - LadyTube';
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

// 選択モードの丸ボタン (検索画面と同じ ExtSelectionFabs)。items は表示中の [削除対象の値, 表示名] の並び。
// kind / kindLabel は削除の種類 (series / tag ...) と、メニュー・確認に出す名前。メニューと確認は拡張の listselect.js
export function ExtListFabs({ sel, items, kind, kindLabel }) {
    return (
        <ExtSelectionFabs selectionMode={sel.mode} selectedIds={sel.selected}
            onToggleMode={() => { window.WLExt?.closeListMenu?.(); sel.setMode(!sel.mode); sel.setSelected(new Map()); }}
            onSelectAll={() => sel.setSelected(new Map(items))}
            onDeselectAll={() => sel.setSelected(new Map())}
            onMenu={() => window.WLExt?.toggleListMenu?.({ kind, kindLabel }, sel.selected)} />
    );
}

// 並び替えの行 (拡張の WL.sortRow と同じ形)。defs は [キー, 表示名, 既定の向き] の並び、order は { sort, dir }。
// 押すと同じキーなら向きを変え、違うキーならそのキーの既定の向き。storeKey に保存する (戻すのは utils/formatters.js の storedSort)
export function ExtSortRow({ defs, order, onChange, storeKey }) {
    return (
        <div className="wlext-plist-sortrow">
            <span className="wlext-plist-ctl-label">並び替え:</span>
            {defs.map(([key, label, defDir]) => {
                const active = order.sort === key;
                const choose = () => {
                    const next = active ? { sort: key, dir: order.dir === 'asc' ? 'desc' : 'asc' } : { sort: key, dir: defDir || 'asc' };
                    try { localStorage.setItem(storeKey, JSON.stringify(next)); } catch { /* 保存できなくても並び替える */ }
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
