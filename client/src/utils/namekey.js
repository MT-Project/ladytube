// LadyTube: 名前の並べ替え (かな種別を無視・数字は桁順・頭の記号は無視)。サーバーの ext_namekey と同じ並びにするため、
// 定義はサーバーと同じ server/ext/namekey.mjs を使う (ビルドで取り込む。v3.2.1 までは拡張の WL.nameCompare)
import { nameKey, nameCompare } from '../../../server/ext/namekey.mjs';

export { nameKey, nameCompare };

// 拡張の書き方のページ (private のジャンル一覧) が WL.nameCompare を使うので渡す (private が写すまで。ExtPage.jsx が読み込む)
if (window.WLExt) Object.assign(window.WLExt, { nameKey, nameCompare });
