// LadyTube: ヘッダーのロゴの右のライブラリ名 (Navbar.jsx。ライブラリが2つ以上あるときだけ)。押すと一覧から切り替え。
// v3.2.1 までは拡張の server/ext/public/library.js。管理画面の項目は ExtLibrary.jsx、切り替えは utils/library.js。
// 見た目は womanlive-ext.css の .wlext-libpill / .wlext-lib-menu / .wlext-navmenu-*。
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ExtIcon';
import { extGet } from '../services/extApi';
import { currentLibrary as LIB, switchLibrary } from '../utils/library';
import { toast } from '../utils/toast';

export const GOTO_KEY = 'wlext_goto_library';   // 「ライブラリの管理」から来たとき (sessionStorage。ExtLibrary.jsx が読む)

function LibraryMenu({ anchor, onClose }) {
    const navigate = useNavigate();
    const menu = useRef(null);
    const [data, setData] = useState(null);
    useEffect(() => {
        let alive = true;
        extGet('/ext/api/libraries').then(d => { if (alive) setData(d); }, e => { if (alive) { onClose(); toast('読み込みに失敗: ' + e.message, 'error'); } });
        return () => { alive = false; };
    }, [onClose]);
    useLayoutEffect(() => {
        const el = menu.current, rc = anchor.getBoundingClientRect();
        el.style.top = Math.round(rc.bottom + 6) + 'px';
        el.style.left = Math.round(Math.max(8, rc.left)) + 'px';
        // 画面の右にはみ出したら寄せる
        const mr = el.getBoundingClientRect();
        if (mr.right > window.innerWidth - 8) el.style.left = Math.max(8, window.innerWidth - 8 - mr.width) + 'px';
    }, [anchor, data]);
    const pick = (l) => {
        if (l.active) { onClose(); return; }
        if (!data.local) { toast('切り替えはサーバーを動かしている PC からのみ行えます', 'error'); return; }
        onClose();
        switchLibrary(l);
    };
    const manage = () => {
        onClose();
        try { sessionStorage.setItem(GOTO_KEY, '1'); } catch { /* 移るだけ */ }
        navigate('/settings');
    };
    return createPortal(
        <>
            <div className="wlext-navmenu-backdrop" onClick={onClose} />
            <div ref={menu} className="wlext-navmenu wlext-lib-menu">
                {!data ? <div className="wlext-navmenu-item wlext-lib-menu-loading">読み込み中…</div> : <>
                    {data.libraries.map(l => (
                        <div key={l.id} className={'wlext-navmenu-item' + (l.active ? ' wlext-lib-current' : '')} onClick={() => pick(l)}>
                            <Icon name={l.active ? 'check' : 'database'} size={18} />
                            <span className="wlext-lib-menu-name">{l.name}</span>
                            <span className="wlext-lib-menu-count">{l.videos != null ? l.videos + '本' : ''}</span>
                        </div>
                    ))}
                    <div className="wlext-navmenu-sep" />
                    <div className="wlext-navmenu-item" onClick={manage}><Icon name="settings" size={18} /><span>ライブラリの管理</span></div>
                </>}
            </div>
        </>,
        document.body
    );
}

export function ExtLibraryPill() {
    const [anchor, setAnchor] = useState(null);
    const close = useCallback(() => setAnchor(null), []);
    if (!LIB || LIB.count < 2) return null;   // ライブラリが1つ (既定のみ) なら出さない
    return (
        <>
            <button className="wlext-libpill" type="button" title={'ライブラリ: ' + LIB.name + '（クリックで切り替え）'}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAnchor(anchor ? null : e.currentTarget); }}>
                <Icon name="database" size={14} /><span className="wlext-libpill-name">{LIB.name}</span><Icon name="chevron-down" size={14} />
            </button>
            {anchor && <LibraryMenu anchor={anchor} onClose={close} />}
        </>
    );
}

