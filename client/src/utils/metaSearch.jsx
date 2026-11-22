// LadyTube: 動画ページの「動画情報を検索」(品番で FANZA を検索し、確認画面で選んだ項目を反映する)。v3.2.1 までは拡張の videometa.js。
// 画面は components/ExtMetaSearch.jsx。private のために次のものを window.WLExt に置く (このファイルは動画ページと一緒に、
// private の画面 (defer) より先に読まれる):
//  ・WLExt.showMetaPreview(vid, item): 確認画面を開く。private の横断検索が使い、パート番号の付与が包む
//  ・WLExt.dmmSearch(vid): FANZA を品番で検索する。パート番号の付与が包む (v3.2.1 までは WLExt.api.dmmSearch)
//  ・WLExt.metaSearch (private が置く差し込み口): あれば検索をそれに任せる (複数の情報源を並べる横断検索)
// 画面 (ExtMetaSearch.jsx) は開くときに読む (v3.15.0。最初に読む JS を 500KB 未満に保つため)
import { extGet } from '../services/extApi';
import { openExtDialog } from './extDialog';
import { toast } from './toast';
import { cachedMeta } from './videoMeta';

const dialogs = () => import('../components/ExtMetaSearch');
const WL = window.WLExt || (window.WLExt = {});
WL.showMetaPreview = (vid, item) => dialogs().then(m => openExtDialog(m.MetaPreviewDialog, { vid, item }));
WL.dmmSearch = (vid) => extGet('/ext/api/dmm/search?id=' + encodeURIComponent(vid));

async function runDmmSearch(vid) {
    const meta = cachedMeta(vid);
    if (meta && !meta.model_no) { toast('品番が設定されていません。先に品番を登録してください。', 'error'); return; }
    toast('FANZAで検索中...');
    let data;
    try { data = await WL.dmmSearch(vid); }
    catch (e) { toast(e.message || '検索に失敗しました', 'error'); return; }
    if (!data.items || !data.items.length) { toast('商品情報が見つかりませんでした（品番: ' + (data.keyword || '') + '）', 'error'); return; }
    if (data.items.length === 1) WL.showMetaPreview(vid, data.items[0]);
    else dialogs().then(m => openExtDialog(m.MetaSelectDialog, { vid, items: data.items }));
}

// 動画ページの右下の「動画情報を検索」の丸ボタン (ExtWatchMeta.jsx)
export const openMetaSearch = (vid) => (WL.metaSearch ? WL.metaSearch(vid) : runDmmSearch(vid));
