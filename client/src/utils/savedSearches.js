// LadyTube: 保存した検索 (v3.7.0)。検索語・並び順・フォルダを名前付きで、DB の設定 (ライブラリごと) に置く。
// API は server/ext/routes/saved.js。保存は検索画面の「この条件を保存」(components/ExtSavedSearch.jsx)、
// 名前の変更・並べ替え・削除は管理画面の「保存した検索」(ExtSettingsSections.jsx)。並べるのはホームと右上のメニュー。
// 変えたら wlext-saved-searches を投げ、並べている画面が読み直す
import { useEffect, useState } from 'react';
import { extGet, extSend } from '../services/extApi';

export const loadSavedSearches = () => extGet('/ext/api/saved-searches').then(r => r.list || []);

export async function saveSavedSearches(list) {
    const r = await extSend('PUT', '/ext/api/saved-searches', { list });
    window.dispatchEvent(new Event('wlext-saved-searches'));
    return r.list;
}

export function savedSearchHref(s) {
    const p = new URLSearchParams();
    if (s.q) p.set('q', s.q);
    if (s.sort) p.set('sort', s.sort);
    if (s.seed) p.set('seed', s.seed);   // ホームの行 (utils/homeLayout.js) のランダムの並び
    if (s.path) p.set('path', s.path);
    const t = p.toString();
    return '/search' + (t ? '?' + t : '');
}

// 保存した検索の一覧 (読めなかったときは空)
export function useSavedSearches() {
    const [list, setList] = useState([]);
    useEffect(() => {
        let alive = true;
        const load = () => loadSavedSearches().then(l => { if (alive) setList(l); }, () => { });
        load();
        window.addEventListener('wlext-saved-searches', load);
        return () => { alive = false; window.removeEventListener('wlext-saved-searches', load); };
    }, []);
    return list;
}
