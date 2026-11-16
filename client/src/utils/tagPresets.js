// LadyTube: タグのプリセットのグループ (「# 名前」「## 名前」の見出し)。v3.2.1 までは拡張の core.js の
// WL.parseTagGroups / WL.reconcileTagLayout / WL.loadVideoTagPresets / WL.saveVideoTagPresets。
// 動画タグのプリセットは、本体のプリセット (/api/tags。見出しの無い実タグ) と拡張のレイアウト (# 入りの並び) の2つに分けて持つ。
import { extGet, extSend } from '../services/extApi';

const isHeader = (s) => /^[#＃]/.test(String(s == null ? '' : s).trim());

// "# 名前" でグループ、"## 名前" でその下位 (ネスト)。見出しの間のタグがそのグループに属する (半角# / 全角＃ どちらも見出し)
export function parseTagGroups(list) {
    const root = { name: null, level: 0, path: '', tags: [], children: [] };
    const stack = [root];
    (list || []).forEach(raw => {
        const line = String(raw == null ? '' : raw).trim();
        if (!line) return;
        const m = /^([#＃]+)\s*(.*)$/.exec(line);
        if (m && m[2]) {
            const level = m[1].length;
            while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
            const parent = stack[stack.length - 1];
            const node = { name: m[2].trim(), level, path: parent.path + m[2].trim(), tags: [], children: [] };
            parent.children.push(node);
            stack.push(node);
        } else {
            stack[stack.length - 1].tags.push(line);
        }
    });
    return root;
}

// 本体のプリセット (実タグ) とレイアウト (# 入り) を突き合わせる。
// 本体で増えたタグは既定のグループ (先頭の # より前) へ、消えたタグはレイアウトから外す。本体のプリセットに紛れた見出しは無視する
function reconcileTagLayout(layout, nativeTags) {
    layout = Array.isArray(layout) ? layout.slice() : [];
    nativeTags = Array.isArray(nativeTags) ? nativeTags.map(s => String(s).trim()).filter(Boolean).filter(t => !isHeader(t)) : [];
    const nativeSet = new Set(nativeTags);
    const realSet = new Set(layout.filter(l => !isHeader(l)).map(s => String(s).trim()));
    const kept = layout.filter(l => isHeader(l) || nativeSet.has(String(l).trim()));
    const missing = nativeTags.filter(t => !realSet.has(t));
    if (!missing.length) return kept;
    const firstHdr = kept.findIndex(isHeader);
    if (firstHdr === -1) return [...kept, ...missing];
    return [...kept.slice(0, firstHdr), ...missing, ...kept.slice(firstHdr)];
}

// 動画タグのプリセット (グループ入り)。動画ページのタグ編集・一括のタグ追加・タグ一覧のプリセット順で使う
export async function loadVideoTagPresets() {
    const [native, layout] = await Promise.all([
        extGet('/api/tags').then(a => (Array.isArray(a) ? a.map(t => (t && t.name) || t).filter(Boolean) : [])),
        extGet('/ext/api/video-tag-layout').catch(() => []),
    ]);
    return reconcileTagLayout(layout, native);
}
export async function saveVideoTagPresets(arr) {
    await extSend('PUT', '/ext/api/video-tag-layout', { layout: arr });
    await extSend('PUT', '/api/tags/bulk', { tags: arr.filter(t => !isHeader(t)) });
}
