// =============================================================
// 保存した検索 (検索語・並び順・カテゴリーのフォルダ)。v3.7.0
//  DB の設定 ext_saved_searches に配列で置く。ライブラリごとに分かれ (SHARED_KEYS に入れない)、
//  ext_ で始まるのでバックアップにも入る。画面は client/src/utils/savedSearches.js。
// =============================================================
const { getSetting, setSetting } = require('../db');

const KEY = 'ext_saved_searches';
const MAX = 100;
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

// GET /ext/api/saved-searches -> { list: [{ name, q, sort, path }] }
exports.list = (req, res) => {
    const list = getSetting(KEY, []);
    res.json({ list: Array.isArray(list) ? list : [] });
};

// PUT /ext/api/saved-searches { list } — 並べ替え・名前の変更・削除も、この丸ごとの置き換えで行う
exports.save = (req, res) => {
    const src = req.body && req.body.list;
    if (!Array.isArray(src) || src.length > MAX) return res.status(400).json({ error: 'list は ' + MAX + '件までの配列にしてください' });
    const list = src
        .map(s => ({ name: str(s && s.name, 100), q: str(s && s.q, 2000), sort: str(s && s.sort, 40), path: str(s && s.path, 1000) }))
        .filter(s => s.name);
    setSetting(KEY, list);
    res.json({ list });
};
