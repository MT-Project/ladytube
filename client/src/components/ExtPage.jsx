// LadyTube: 差し込み口 WLExt.extPages で足すページ (個人用モジュールが足すページ。拡張のページは v3.2.1 の後から
// 本体の CalendarPage.jsx・SeriesPage.jsx・TagsPage.jsx・PerformersPage.jsx・MakersPage.jsx・BookmarksPage.jsx・PerformerPage.jsx)。
// 本体のページが無い URL で App.jsx の最後のルートが置く。
// 足す側は WLExt.extPages に { 'URL の形': render(params, mount, { setTitle }) } を置いておき、URL が合うと render が呼ばれる。
// 枠 (本体のヘッダー Navbar と中身の外枠 .wlext-pp-container) はここが出し、足す側は mount(要素) で中身だけを渡す
// (v3.2.1 までは足す側が拡張の共通ヘッダー WL.pageHeader 付きのページを作り、body の末尾に画面全体に重ねていた)。
// setTitle(文) は文書の題 (「文 - LadyTube」)。URL が変わるか、ほかのページへ移ると中身を外す。
// 足す側 (private) は defer で読むので、まだなら読み終わってから (DOMContentLoaded) 探す。
import { useLayoutEffect, useRef, useState } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
import { ExtListPage } from './ExtListParts';
// LadyTube: 拡張の書き方のページが使う名前の並べ替えを window.WLExt に渡す
import '../utils/namekey';

export default function ExtPage() {
    const { pathname } = useLocation();
    const box = useRef(null);
    const [title, setTitle] = useState('');
    useLayoutEffect(() => {
        let node = null, done = false;
        const mount = (el) => { node = el; box.current.appendChild(el); };
        const find = () => {
            const pages = window.WLExt && window.WLExt.extPages;
            if (!pages || done) return;
            for (const [pattern, render] of Object.entries(pages)) {
                const m = matchPath(pattern, pathname);
                if (!m) continue;
                done = true;
                render(m.params, mount, { setTitle });
                return;
            }
        };
        find();
        window.addEventListener('DOMContentLoaded', find, { once: true });
        return () => { done = true; window.removeEventListener('DOMContentLoaded', find); if (node) node.remove(); };
    }, [pathname]);
    return <ExtListPage title={title}><div ref={box} /></ExtListPage>;
}
