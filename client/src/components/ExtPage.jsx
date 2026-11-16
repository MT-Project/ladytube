// LadyTube: 拡張の差し込み口 WLExt.extPages で足すページ (今は個人用モジュールのページだけ。拡張のページ (公開カレンダー・シリーズ一覧・
// タグ一覧・出演者一覧・メーカー一覧・ブックマーク・出演者) は v3.2.1 の後から本体の CalendarPage.jsx・SeriesPage.jsx・TagsPage.jsx・
// PerformersPage.jsx・MakersPage.jsx・BookmarksPage.jsx・PerformerPage.jsx)。本体のページが無い URL で App.jsx の最後のルートが置く。
// 拡張は WLExt.extPages に { 'URL の形': render(params, mount) } を足しておき、URL が合うと render を呼ぶ。
// ページの中身は拡張が作り、mount(要素) で渡された要素をここが body の末尾に置く (v3.1.15 までと同じ位置。
// 拡張のページは画面全体に重ねる position: fixed)。URL が変わるか、ほかのページへ移ると外す。
// 拡張は defer で読むので、まだなら読み終わってから (DOMContentLoaded) 探す。
import { useLayoutEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';
// LadyTube: 拡張の書き方のページが使う名前の並べ替えを window.WLExt に渡す
import '../utils/namekey';

export default function ExtPage() {
    const { pathname } = useLocation();
    useLayoutEffect(() => {
        let node = null, done = false;
        const mount = (el) => { node = el; document.body.appendChild(el); };
        const find = () => {
            const pages = window.WLExt && window.WLExt.extPages;
            if (!pages || done) return;
            for (const [pattern, render] of Object.entries(pages)) {
                const m = matchPath(pattern, pathname);
                if (!m) continue;
                done = true;
                render(m.params, mount);
                return;
            }
        };
        find();
        window.addEventListener('DOMContentLoaded', find, { once: true });
        return () => { done = true; window.removeEventListener('DOMContentLoaded', find); if (node) node.remove(); };
    }, [pathname]);
    return null;
}
