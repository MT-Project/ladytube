// LadyTube: 検索ワード (v3.14.0)。動画ページで選んだ文字やファイル名の語をためておき、検索欄の右の「貼り付け」で検索欄の末尾に足す。
// ブラウザの localStorage (wlext_search_words) に置くので、同じブラウザのタブどうしで共有する (ほかのタブの変更は storage イベントで読み直す)。
// 選ぶ・押す・貼り付けるの画面は components/ExtSearchWords.jsx
import { useEffect, useState } from 'react';
import { toast } from './toast';

const KEY = 'wlext_search_words';
const EV = 'wlext-search-words';   // 同じタブの中の変更 (storage イベントは、変えたタブには来ない)
const MAX_LEN = 100;                // ponytail: これより長い選択 (段落まるごと等) は語として扱わない
const MAX_WORDS = 50;

export const searchWords = () => {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(w => typeof w === 'string') : []; }
    catch { return []; }
};
const store = (list) => {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 覚えられないときは何もしない */ }
    window.dispatchEvent(new Event(EV));
};

// 語にできる形へ。キーワード検索 (server/ext/routes/fullsearch.js) は " を逃がせないので消し、
// 先頭の > < は再生時間・日付の指定と読まれる (引用符で囲んでも) ので外す。空白・改行は1つの空白に
export function cleanWord(s) {
    const w = String(s || '').replace(/"/g, '').replace(/\s+/g, ' ').trim().replace(/^[<>]+/, '').trim();
    return w.length > MAX_LEN ? '' : w;
}

// 検索欄に書く形。空白を含む語・記号 (- ! ~ @) で始まる語・OR は "…" で囲み、1つの語としてそのまま探す
export const quoteWord = (w) => (/\s|^[-!~@]|^or$/i.test(w) ? '"' + w + '"' : w);

export function addSearchWord(s) {
    const w = cleanWord(s);
    if (!w) return;
    const list = searchWords().filter(x => x !== w).concat([w]).slice(-MAX_WORDS);
    store(list);
    toast('「' + w + '」を検索ワードに足しました（全部で' + list.length + 'つ。検索欄の右のボタンで貼り付けます）', 'success');
}

export function removeSearchWord(w) {
    store(searchWords().filter(x => x !== w));
}

// 貼り付ける文字列を返し、ためた語を空にする
export function takeSearchWords() {
    const text = searchWords().map(quoteWord).join(' ');
    store([]);
    return text;
}

export function useSearchWords() {
    const [list, setList] = useState(searchWords);
    useEffect(() => {
        const load = () => setList(searchWords());
        const onStorage = (e) => { if (e.key === KEY || e.key === null) load(); };
        window.addEventListener(EV, load);
        window.addEventListener('storage', onStorage);
        return () => { window.removeEventListener(EV, load); window.removeEventListener('storage', onStorage); };
    }, []);
    return list;
}
