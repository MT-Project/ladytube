// LadyTube: ブックマーク済みの動画 (カードと動画ページのブックマークボタンが見る。v3.2.1 までは拡張の bookmark.js の WL._bmIds)。
// ボタンが初めて置かれたときに読む (読めなければ次に置かれたときに読み直す)。変えたら知らせて描き直させる。
import { extGet } from '../services/extApi';

let ids = null;   // Set<動画 id> | null (まだ読んでいない)
let loading = false;
const subs = new Set();
const emit = () => subs.forEach(f => f());

function load() {
    if (ids || loading) return;
    loading = true;
    extGet('/ext/api/bookmark/ids').then(a => { ids = new Set(a.map(Number)); loading = false; emit(); }, () => { loading = false; });
}
export const subscribeBookmarks = (f) => { subs.add(f); load(); return () => subs.delete(f); };
export const isBookmarked = (id) => !!(ids && ids.has(Number(id)));
export function setBookmarked(id, on) {
    if (!ids) ids = new Set();
    if (on) ids.add(Number(id)); else ids.delete(Number(id));
    emit();
}

// 拡張の一括操作 (bulkselect.js) が WL._bmIds に足して WL.repaintBookmarks を呼ぶので、同じものを渡す (bulkselect.js を移したら消す)
if (window.WLExt) {
    Object.defineProperty(window.WLExt, '_bmIds', { get: () => ids, configurable: true });
    window.WLExt.repaintBookmarks = emit;
}
