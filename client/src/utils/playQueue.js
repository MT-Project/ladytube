// LadyTube: 連続再生 (v3.17.0)。検索結果から動画を開いたときの再生順 (id の列) を、そのタブの間だけ控える。
//  ・列は開いた時点の写し。見るとタグや再生状況が変わって検索の対象が縮んでも、位置は動かない
//  ・列が有効なのは、検索から開いたとき (と、列の中を移ったとき) だけ。履歴の state の wlextQueue が目印で、
//    ホームや関連動画から開いた動画は、前の検索の列に入っていても連続再生にならない
//  ・列は1件 = 1枚のカード (品番でまとめていれば、同じ品番のパートを順に並べたもの)。API は server/ext/routes/search.js の queue
//  ・スイッチ (連続再生のオン・オフ) は localStorage の wlext_queue_on ('1' でオン。既定オフ)。操作バーとプレイヤー設定のどちらからも
//    切り替えるので、持ち主はここ 1 か所 (useQueue の on / useQueueOn)
import { useMemo, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router-dom';
import { currentLibrary } from './library';

const KEY = 'wlext_queue', ON_KEY = 'wlext_queue_on', EVENT = 'wlext-queue';
export const QUEUE_STATE = { wlextQueue: 1 };

const get = (store, key) => { try { return store.getItem(key); } catch { return null; } };
const changed = () => window.dispatchEvent(new Event(EVENT));

// 検索から動画を開くときに呼ぶ。params は一覧の検索と同じ (q・sort・seed・path・group)。待たずに移ってよい
let seq = 0;
export function captureQueue(params) {
    const mine = ++seq;   // 続けて押したとき、古い応答で新しい列を上書きしない
    try { sessionStorage.removeItem(KEY); } catch { /* 保存できない環境 */ }
    changed();
    fetch('/ext/api/search/queue?' + new URLSearchParams(params)).then(r => (r.ok ? r.json() : null)).then(j => {
        if (mine !== seq || !j || !Array.isArray(j.entries)) return;
        try { sessionStorage.setItem(KEY, JSON.stringify({ lib: currentLibrary && currentLibrary.id, entries: j.entries })); } catch { /* 同上 */ }
        changed();
    }, () => { });
}

export function setQueueOn(on) {
    try { localStorage.setItem(ON_KEY, on ? '1' : '0'); } catch { /* 同上 */ }
    changed();
}

// 列の移動 (自動で進む・前へ・次へ)。印を付けて移るので、移った先でも列が続く
export const queueGo = (navigate, id) => navigate('/watch/' + id, { state: QUEUE_STATE });

const subscribe = (cb) => {
    window.addEventListener(EVENT, cb);
    window.addEventListener('storage', cb);
    return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
};
const snapshot = () => (get(sessionStorage, KEY) || '') + '\n' + (get(localStorage, ON_KEY) === '1' ? '1' : '0');

export function useQueueOn() {
    return useSyncExternalStore(subscribe, () => get(localStorage, ON_KEY) === '1');
}

let parsed = { snap: null, entries: null, where: null };
function entriesOf(snap) {
    if (parsed.snap !== snap) {
        let entries = null;
        try {
            const j = JSON.parse(snap.slice(0, snap.lastIndexOf('\n')) || 'null');
            // 別のライブラリの列は使わない (id はライブラリごとに振られる)
            if (j && Array.isArray(j.entries) && (j.lib || null) === ((currentLibrary && currentLibrary.id) || null)) entries = j.entries;
        } catch { /* 壊れた保存は無いものとして扱う */ }
        const where = new Map();
        (entries || []).forEach((e, ei) => e.forEach((id, mi) => { if (!where.has(id)) where.set(id, [ei, mi]); }));
        parsed = { snap, entries, where };
    }
    return parsed;
}

// 今の動画の列での位置。列が無い・今の動画が列に無い・検索から開いていないときは null
//  index/total: 何枚目か / 全部で何枚  on: 連続再生がオンか
//  nextMember/prevMember: 同じカードの次・前のパート  nextEntry/prevEntry: 次・前のカードの先頭の id
export function useQueue(id) {
    const snap = useSyncExternalStore(subscribe, snapshot);
    const { state } = useLocation();
    const marked = !!(state && state.wlextQueue);
    return useMemo(() => {
        if (!marked) return null;
        const { entries, where } = entriesOf(snap);
        const at = entries && where.get(Number(id));
        if (!at) return null;
        const [ei, mi] = at, entry = entries[ei];
        return {
            index: ei + 1, total: entries.length, on: snap.endsWith('\n1'),
            nextMember: entry[mi + 1] || null, prevMember: entry[mi - 1] || null,
            nextEntry: (entries[ei + 1] && entries[ei + 1][0]) || null, prevEntry: (entries[ei - 1] && entries[ei - 1][0]) || null,
        };
    }, [snap, marked, id]);
}
