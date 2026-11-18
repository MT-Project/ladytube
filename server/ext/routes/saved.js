// =============================================================
// 保存した検索 (検索語・並び順・カテゴリーのフォルダ)。v3.7.0
//  DB の設定 ext_saved_searches に配列で置く。ライブラリごとに分かれ (SHARED_KEYS に入れない)、
//  ext_ で始まるのでバックアップにも入る。画面は client/src/utils/savedSearches.js。
//  後ろにホームの並び (v3.8.0。保存した検索を行として持てる) も置く。
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

// =============================================================
// ホームの並び (v3.8.0)。DB の設定 ext_home_layout に置く (保存した検索と同じくライブラリごと・バックアップに入る)。
//  { carousel, menu, rows: [{ type, show, name, count, (saved のときだけ q, sort, path) }] }
//  組み込みの行の中身と既定の並びは画面の client/src/utils/homeLayout.js が持つ。保存が無いとき GET は null
// =============================================================
const HOME_KEY = 'ext_home_layout';
const HOME_TYPES = ['new', 'pickup', 'continue', 'recent', 'unwatched', 'rated', 'next', 'saved'];
const HOME_MAX = 30;
const HOME_COUNTS = [4, 8, 12];

// GET /ext/api/home-layout -> { layout }
exports.homeGet = (req, res) => res.json({ layout: getSetting(HOME_KEY, null) });

// PUT /ext/api/home-layout { layout } — 丸ごとの置き換え。組み込みの行は1つずつ、保存した検索の行は名前のあるものだけ残す
exports.homeSave = (req, res) => {
    const b = req.body && req.body.layout;
    if (!b || !Array.isArray(b.rows) || b.rows.length > HOME_MAX) return res.status(400).json({ error: 'rows は ' + HOME_MAX + '件までの配列にしてください' });
    const seen = new Set();
    const rows = b.rows.map(r => {
        const type = r && HOME_TYPES.includes(r.type) ? r.type : null;
        if (!type || seen.has(type)) return null;
        if (type !== 'saved') seen.add(type);
        const row = { type, show: r.show !== false, name: str(r.name, 100), count: HOME_COUNTS.includes(Number(r.count)) ? Number(r.count) : 8 };
        if (type === 'saved') Object.assign(row, { q: str(r.q, 2000), sort: str(r.sort, 40), path: str(r.path, 1000) });
        return type === 'saved' && !row.name ? null : row;
    }).filter(Boolean);
    const layout = { carousel: b.carousel !== false, menu: b.menu !== false, rows };
    setSetting(HOME_KEY, layout);
    res.json({ layout });
};
