// LadyTube: ファイル名のルールと名前の変更のあとの知らせ (v3.12.0)。
// ルールはサーバーと同じ server/ext/filerule.mjs を使う (FANZA の確認画面の「ファイル名: 今 → 新」。実際に変えるのはサーバーの rename.js)
import { loadMeta } from './videoMeta';
import { openExtDialog } from './extDialog';

export { ruleStem, DEFAULT_RULE, RULE_FIELDS } from '../../../server/ext/filerule.mjs';

// 名前を変えるダイアログ (components/ExtRename.jsx)。開くときに読む (最初に読む JS を増やさない)
export const openRenameDialog = (id) => import('../components/ExtRename').then(m => openExtDialog(m.ExtRenameDialog, { id }));
export const openRuleRenameDialog = (ids) => import('../components/ExtRename').then(m => openExtDialog(m.ExtRuleRenameDialog, { ids }));

// 名前を変えた動画を知らせる: 開いている動画ページは表 (動画ファイル名) とタイトルを描き直し、一覧は取り直す
export async function notifyRenamed(ids) {
    for (const id of ids || []) {
        try {
            const meta = await loadMeta(id);
            window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id, meta } }));
        } catch { /* 次に開いたときに直る */ }
    }
    window.dispatchEvent(new Event('library-updated'));
}
