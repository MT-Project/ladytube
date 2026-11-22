// LadyTube: 本体のヘッダー (Navbar.jsx) に置く拡張のボタン (v3.2.1 までは中身を拡張の server/ext/public/nav.js が出していた)。
//  ・ExtHelpButton: 検索ボタンの右の「？」。PC はホバー、タッチはタップで検索のヘルプを出す (押すと出したままにする)。
//    content を渡すと別のヘルプ (タグ選択のダイアログのプリセット編集のヘルプ。ExtPresetTagDialog.jsx)
//  ・ExtMenuButton: 右上のメニュー (ハンバーガー)。管理画面以外で、本体の歯車 (管理) の代わりに置く。
//    差し込み口 WL.navMenuExtras に足した「項目を作る関数 (close) => 要素」は「QRコード」の上に並ぶ (押したら close() を呼ぶ)。
//    保存した検索 (utils/savedSearches.js) は「QRコード」と「管理」の間に並ぶ (v3.7.0)
//    「LadyTube を終了」は「管理」の下。サーバーを動かしている PC からだけ出す (v3.11.0。/ext/api/shutdown)
// 見た目は womanlive-ext.css の .wlext-help-* / .wlext-navmenu-*。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ExtIcon';
import { savedSearchHref, useSavedSearches } from '../utils/savedSearches';
import { isLocalPC } from '../utils/library';
import { openExtDialog } from '../utils/extDialog';
import { ExtConfirm } from './ExtDialog';
import { extSend } from '../services/extApi';
import { toast } from '../utils/toast';

const HelpRow = ({ code, desc }) => <div className="wlext-help-row"><code className="wlext-help-code">{code}</code><span className="wlext-help-desc">{desc}</span></div>;
const HELP = <>
    <div className="wlext-help-title">検索のヘルプ</div>
    <h4>基本</h4>
    <HelpRow code="犬 猫" desc="AND 検索（すべて含む）" />
    <HelpRow code="犬 OR 猫" desc="OR 検索（どちらかを含む）" />
    <HelpRow code={'"Lady Tube"'} desc="空白を含む語句をそのまま検索" />
    <HelpRow code="-犬" desc="除外（その語を含まない）" />
    <HelpRow code="!犬" desc="指定したタグを含む動画" />
    <HelpRow code="~ (先頭)" desc="正規化検索（全角/半角・ひらがな/カタカナを区別しない）" />
    <div className="wlext-help-note">照合対象: ファイルパス・タグ・表示動画名</div>
    <h4>日付・再生時間</h4>
    <HelpRow code=">2024/01/01" desc="指定した日以降に登録した動画" />
    <HelpRow code="<2024/12/31" desc="指定した日以前に登録した動画" />
    <HelpRow code=">30" desc="再生時間が 30 分より長い" />
    <HelpRow code="<10" desc="再生時間が 10 分より短い" />
    <h4>項目を指定した検索</h4>
    <div className="wlext-help-note">動画ページや各一覧のリンク・ボタンから自動入力されます（手入力も可）。</div>
    <HelpRow code={'@maker:"名前"'} desc="メーカー名で検索（series / label / genre / director も同様）" />
    <HelpRow code={'@model:"品番"'} desc="品番で検索" />
    <HelpRow code={'@tag:"名前"'} desc="タグで検索" />
    <HelpRow code="@performer:ID" desc="出演者で検索" />
    <HelpRow code="@rating:4" desc="評価で検索（@rating:>=4 など演算子も可）" />
    <HelpRow code="@duration:>=30" desc="再生時間（分）で検索（@duration:<=60 も可。絞り込みのスライダーが使う形）" />
    <HelpRow code={'@releaseyear:"2024"'} desc={'公開年（@releasemonth:"2024-01" / @release:none も可）'} />
    <HelpRow code="@maker:none" desc="未設定の動画（@maker:any で設定ありの動画。model / series / label / genre なども同様）" />
    <HelpRow code={'@bookmark:"名前"'} desc="ブックマークフォルダで検索" />
    <HelpRow code={'@notmaker:"名前"'} desc="除外（notseries / notlabel / notgenre / notdirector / notperformer）" />
</>;

// content: ポップオーバーの中身 (既定は検索のヘルプ)。tooltip: ボタンの説明
export function ExtHelpButton({ content = HELP, tooltip = '検索のヘルプ' }) {
    const btn = useRef(null), pop = useRef(null), timer = useRef(0);
    const [open, setOpen] = useState(false);
    const [pinned, setPinned] = useState(false);
    const hide = () => { setOpen(false); setPinned(false); };
    const leave = () => { if (!pinned) { clearTimeout(timer.current); timer.current = setTimeout(hide, 200); } };
    // ボタンの右端にそろえて下に出す。画面からはみ出すなら左へずらす
    const place = () => {
        const el = pop.current; if (!el) return;
        const r = btn.current.getBoundingClientRect();
        el.style.top = (r.bottom + 8) + 'px';
        const w = el.offsetWidth || 360;
        let left = Math.min(r.right - w, window.innerWidth - 8 - w);
        if (left < 8) left = 8;
        el.style.left = left + 'px';
    };
    useLayoutEffect(() => { if (open) place(); }, [open]);
    useEffect(() => {
        if (!open) return;
        const onDoc = (e) => { if (!pop.current.contains(e.target) && !(e.target.closest && e.target.closest('.wlext-help-btn'))) hide(); };
        document.addEventListener('click', onDoc);
        window.addEventListener('resize', place);
        return () => { document.removeEventListener('click', onDoc); window.removeEventListener('resize', place); };
    }, [open]);
    useEffect(() => () => clearTimeout(timer.current), []);
    return (
        <>
            <button ref={btn} className="wlext-action wlext-help-btn" type="button" title={tooltip}
                onMouseEnter={() => { clearTimeout(timer.current); setOpen(true); }}
                onMouseLeave={leave}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (pinned && open) hide(); else { setPinned(true); setOpen(true); } }}>
                <Icon name="help" size={20} sw={2} />
            </button>
            {open && createPortal(
                <div ref={pop} className="wlext-help-pop" style={{ display: 'block' }}
                    onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={leave}>{content}</div>,
                document.body
            )}
        </>
    );
}

// メニューの項目 (ホームのメニューと同じ並び)。表記は本体のホームのメニューと、管理画面の見出しに合わせる
const NAV_ITEMS = [
    ['/screenshots', 'image', 'スクリーンショット'],
    ['/calendar', 'calendar', 'カレンダー'],
    // 本家 ver.260914 で /folder-tree は廃止され、検索画面のフォルダ絞り込み (カテゴリー) になった
    ['/search?path=root', 'folder', 'カテゴリー'],
    ['/bookmarks', 'bookmark', 'ブックマーク'],
    ['/makers', 'factory', 'メーカー一覧'],
    ['/series', 'library', 'シリーズ一覧'],
    ['/performers', 'users', '出演者一覧'],
    ['/tags', 'tag', 'タグ一覧'],
];

function NavMenu({ anchor, onClose }) {
    const navigate = useNavigate();
    const menu = useRef(null), qr = useRef(null);
    const saved = useSavedSearches();
    useLayoutEffect(() => {
        const extras = Object.values(window.WLExt?.navMenuExtras || {}).map(make => make(onClose)).filter(Boolean);
        extras.forEach(x => qr.current.parentNode.insertBefore(x, qr.current));
        // ボタンの右下にそろえる
        const el = menu.current, r = anchor.getBoundingClientRect();
        let left = r.right - el.offsetWidth; if (left < 8) left = 8;
        el.style.position = 'fixed';
        el.style.top = (r.bottom + 6) + 'px';
        el.style.left = left + 'px';
        el.style.maxHeight = (window.innerHeight - r.bottom - 14) + 'px';   // 保存した検索が多くても画面に収める
        el.style.overflowY = 'auto';
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        window.addEventListener('resize', onClose);
        return () => { extras.forEach(x => x.remove()); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onClose); };
    }, [anchor, onClose, saved]);
    const go = (href) => () => { onClose(); navigate(href); };
    // QR コードは本体のホームのダイアログ (HomePage.jsx が受ける)。ほかのページからは /?qr=1 で開く
    const openQR = () => { onClose(); if (location.pathname === '/') window.dispatchEvent(new Event('wlext-open-qr')); else navigate('/?qr=1'); };
    // LadyTube を終了 (確かめてから。終わったあとは通信できないので、通知だけ出す)
    const quit = () => {
        onClose();
        openExtDialog(ExtConfirm, {
            title: 'LadyTube を終了', saveLabel: '終了する',
            body: 'LadyTube のサーバーを止めて、起動したときのターミナルを閉じます。もう一度使うときは ladytube.bat で起動してください。',
            onSave: async (close) => {
                try { await extSend('POST', '/ext/api/shutdown', {}); close(); toast('LadyTube を終了しました。このタブは閉じてかまいません', 'success'); }
                catch (e) { toast('終了できません: ' + e.message, 'error'); }
            },
        });
    };
    const item = (icon, label, onClick, ref) => <div key={label} ref={ref} className="wlext-navmenu-item" onClick={onClick}><Icon name={icon} size={18} /><span>{label}</span></div>;
    return createPortal(
        <>
            <div className="wlext-navmenu-backdrop" onClick={onClose} />
            <div ref={menu} className="wlext-navmenu">
                {NAV_ITEMS.map(([href, icon, label]) => item(icon, label, go(href)))}
                {item('qr-code', 'QRコード', openQR, qr)}
                {saved.length > 0 && <div className="wlext-navmenu-sep" />}
                {saved.map((s, i) => <div key={'saved-' + i} className="wlext-navmenu-item" onClick={go(savedSearchHref(s))}><Icon name="filter" size={18} /><span>{s.name}</span></div>)}
                <div className="wlext-navmenu-sep" />
                {item('settings', '管理', go('/settings'))}
                {isLocalPC && item('power', 'LadyTube を終了', quit)}
            </div>
        </>,
        document.body
    );
}

export function ExtMenuButton() {
    const [anchor, setAnchor] = useState(null);
    const close = useCallback(() => setAnchor(null), []);
    return (
        <>
            <button className="wlext-action wlext-menu-btn" type="button" title="メニュー"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnchor(anchor ? null : e.currentTarget); }}>
                <Icon name="menu" size={20} sw={1.5} />
            </button>
            {anchor && <NavMenu anchor={anchor} onClose={close} />}
        </>
    );
}
