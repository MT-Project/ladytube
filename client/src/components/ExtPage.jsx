// LadyTube: 拡張のページ (メーカー一覧・シリーズ一覧・タグ一覧・出演者一覧・出演者・ブックマーク・公開カレンダー
// と、個人用モジュールのページ)。本体のページが無い URL で App.jsx の最後のルートが置く。
// 拡張は WLExt.extPages に { 'URL の形': render(params, mount) } を足しておき、URL が合うと render を呼ぶ。
// ページの中身は拡張が作り、mount(要素) で渡された要素をここが body の末尾に置く (v3.1.15 までと同じ位置。
// 拡張のページは画面全体に重ねる position: fixed)。URL が変わるか、ほかのページへ移ると外す。
// 拡張は defer で読むので、まだなら読み終わってから (DOMContentLoaded) 探す。
import { useLayoutEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

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
