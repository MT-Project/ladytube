// LadyTube: 本体のヘッダー (Navbar.jsx) に置く拡張のボタン (v3.1.15 までの server/ext/public/nav.js の patchReactHeader / patchSearchHelp)。
//  ・ExtHelpButton: 検索ボタンの右の「？」。PC はホバー、タッチはタップで検索のヘルプを出す
//  ・ExtMenuButton: 右上のメニュー (ハンバーガー)。管理画面以外で、本体の歯車 (管理) の代わりに置く
// ポップオーバーとメニューの中身は拡張 (nav.js の WL.help* / WL.toggleNavMenu。拡張のページの共通ヘッダーと同じもの)。
// 拡張は defer で読むので、関数は押されたとき (またはマウスが乗ったとき) にだけ呼ぶ。
import { Icon } from './ExtIcon';

const WL = () => window.WLExt;

export function ExtHelpButton() {
    return (
        <button className="wlext-action wlext-help-btn" type="button" title="検索のヘルプ"
            onMouseEnter={(e) => { if (WL()) WL().helpEnter(e.currentTarget); }}
            onMouseLeave={() => { if (WL()) WL().helpLeave(); }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (WL()) WL().helpClick(e.currentTarget); }}>
            <Icon name="help" size={20} sw={2} />
        </button>
    );
}

export function ExtMenuButton() {
    return (
        <button className="wlext-action wlext-menu-btn" type="button" title="メニュー"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (WL()) WL().toggleNavMenu(e.currentTarget); }}>
            <Icon name="menu" size={20} sw={1.5} />
        </button>
    );
}
