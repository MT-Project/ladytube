// LadyTube: 動画ページの拡張メタデータ (評価・出演者・品番・シリーズ・メーカー・レーベル・監督・公開日・ジャンル) の読み書き。
// v3.2.1 までは拡張の server/ext/public/videometa.js。読んだものは window.WLExt._meta[id] にも置く
// (拡張に残した FANZA の検索と確認画面 (videometa.js) と private の検索が今の値として読む)。
// 保存したら window に wlext-meta-updated ({ id, meta }) を投げ、動画ページ (WatchPage.jsx) が描き直す
// (拡張の確認画面で反映したときも同じイベントが来る)。
import { extGet, extSend } from '../services/extApi';
import { parseYmd } from './formatters';
import { toast } from './toast';

const cache = () => (window.WLExt._meta = window.WLExt._meta || {});

export const cachedMeta = (vid) => cache()[vid];

// 動画ページを開くたびに読み直す
export async function loadMeta(vid) {
    const m = await extGet('/ext/api/video/' + vid + '/meta');
    cache()[vid] = m;
    return m;
}

// 保存して、出演者の展開や file_name を含む最新版を取り直して知らせる
export async function saveMeta(vid, payload) {
    await extSend('PUT', '/ext/api/video/' + vid + '/meta', payload);
    const fresh = await loadMeta(vid);
    window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id: vid, meta: fresh } }));
    return fresh;
}

// 保存する形 (出演者は id の並び)
export function metaToPayload(meta) {
    return {
        rating: meta.rating || 0,
        display_name: meta.display_name || '',
        model_no: meta.model_no || '',
        release_date: meta.release_date || '',
        series: meta.series || '',
        maker: meta.maker || '',
        label: meta.label || '',
        directors: meta.directors || [],
        genres: meta.genres || [],
        performers: (meta.performers || []).map(p => p.id),
    };
}

// 評価 (★) を押したとき
export async function saveRating(vid, n) {
    const meta = cachedMeta(vid); if (!meta) return;
    try { const p = metaToPayload(meta); p.rating = n; meta.rating = n; await saveMeta(vid, p); toast('評価を保存しました', 'success'); }
    catch (e) { toast('評価の保存に失敗: ' + e.message, 'error'); }
}

// <input type="date"> に入れる形 (YYYY-MM-DD)。読めなければ空
export function toDateInput(s) {
    const d = parseYmd(s); if (!d) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// タグ編集 (本体のタグ編集の代わり。グループ対応のダイアログは拡張の WL.presetTagDialog)。保存したらページを読み直す
export async function openTagEditor(vid) {
    const WL = window.WLExt;
    let current = [];
    try { const r = await extGet('/ext/api/video/' + vid + '/tags'); current = r.tags || []; } catch { /* 読めなければ空から */ }
    WL.presetTagDialog({
        title: 'タグを編集',
        current,
        loadPresets: () => WL.loadVideoTagPresets(),
        savePresets: (arr) => WL.saveVideoTagPresets(arr),
        onSave: async (selected) => {
            try {
                await extSend('PUT', '/ext/api/video/' + vid + '/tags', { tags: selected });
                toast('タグを保存しました', 'success');
                setTimeout(() => location.reload(), 350);
            } catch (e) { toast('タグの保存に失敗: ' + e.message, 'error'); }
        }
    });
}
