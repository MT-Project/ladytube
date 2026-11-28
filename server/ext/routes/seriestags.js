// =============================================================
// シリーズ → タグの自動付与 (v3.17.0)
//  設定 ext_series_tags = [{ name: シリーズ名, tags: [タグ...] }] (ライブラリごと。ext_ なのでバックアップに入る)。
//  ・タグは足すだけで外さない。動くのは次の2つ
//      1. ルールを保存したとき (PUT。そのシリーズの今の全動画に足す)
//      2. 動画のシリーズが別の値に変わったとき (onSeries。詳細情報の編集・一括編集・FANZA の反映から呼ぶ)
//    シリーズが変わらない保存 (評価の変更など。画面は毎回シリーズも送る) では付けない = 手で外したタグを戻さない
//  ・シリーズ名は検索と同じく大文字小文字を区別しない (ASCII だけ。SQLite の NOCASE と同じ)
//  ・シリーズやタグの置換・削除で名前が変わったら、ルールも追う (replace.js が rename*/drop* を呼ぶ)
//  ・名前の置換 (シリーズ名の置換) では、動かした動画に移った先のルールは当てない
// 画面は client/src/pages/SeriesPage.jsx (選択モードのメニュー)
// =============================================================
const { db, addTags, getSetting, setSetting } = require('../db');

const KEY = 'ext_series_tags';
const MAX_NAMES = 500, MAX_TAGS = 50;
const fold = (s) => String(s == null ? '' : s).trim().replace(/[A-Z]/g, c => c.toLowerCase());
const rulesArr = () => { const r = getSetting(KEY, []); return Array.isArray(r) ? r : []; };
const cleanTags = (a) => [...new Set((Array.isArray(a) ? a : []).map(t => String(t == null ? '' : t).trim().slice(0, 100)).filter(Boolean))].slice(0, MAX_TAGS);
const save = (rules) => setSetting(KEY, rules.filter(r => r.name && r.tags.length));
const edit = (fn) => { const rules = rulesArr(); if (rules.length) save(fn(rules)); };
const findRule = (rules, name) => rules.findIndex(r => fold(r.name) === fold(name));

// シリーズ name の今の全動画 (hash ごと) にタグを足す -> { members: 動画の数, changed: タグが増えた動画の数 }
function applyTo(name, tags) {
    const hashes = db.prepare('SELECT DISTINCT e.hash FROM ext_video_meta e JOIN files f ON f.hash = e.hash WHERE e.series = ? COLLATE NOCASE').all(name).map(r => r.hash);
    return { members: hashes.length, changed: hashes.filter(h => addTags(h, tags).length).length };
}

// 動画 (hash) のシリーズが before から after に変わったとき、after のルールのタグを足す (足したタグの配列を返す)。
// タグを足せなかっただけで詳細情報の保存を失敗させないよう、エラーは飲む
exports.onSeries = (hash, before, after) => {
    try {
        if (!fold(after) || fold(before) === fold(after)) return [];
        const rules = rulesArr(), i = findRule(rules, after);
        return i < 0 ? [] : addTags(hash, rules[i].tags);
    } catch (e) {
        console.error('[ext series-tags]', e);
        return [];
    }
};

// GET /ext/api/series-tags -> { rules: [{ name, tags }] }
exports.list = (req, res) => res.json({ rules: rulesArr() });

// PUT /ext/api/series-tags { names, tags, mode } -> { rules, members, changed }
//  mode 'set' (既定): 各シリーズのルールを tags に置き換える (空ならルールを外す。動画のタグはそのまま)。保存したルールを今の全動画に足す
//  mode 'add': 各シリーズのルールに tags を足す。足した tags を今の全動画に足す
exports.save = (req, res) => {
    try {
        const b = req.body || {};
        const names = [...new Set((Array.isArray(b.names) ? b.names : []).map(n => String(n == null ? '' : n).trim().slice(0, 300)).filter(Boolean))];
        if (!names.length || names.length > MAX_NAMES) return res.status(400).json({ error: 'names は 1〜' + MAX_NAMES + '件の配列にしてください' });
        const tags = cleanTags(b.tags);
        const add = b.mode === 'add';
        if (add && !tags.length) return res.status(400).json({ error: 'タグを選んでください' });
        let members = 0, changed = 0;
        db.transaction(() => {
            const rules = rulesArr();
            names.forEach(name => {
                const i = findRule(rules, name);
                const next = add ? cleanTags([...(i >= 0 ? rules[i].tags : []), ...tags]) : tags;
                if (i >= 0) rules[i] = { name: rules[i].name, tags: next }; else rules.push({ name, tags: next });
                const r = next.length ? applyTo(name, add ? tags : next) : null;
                if (r) { members += r.members; changed += r.changed; }
            });
            save(rules);
        })();
        res.json({ success: true, rules: rulesArr(), members, changed });
    } catch (e) {
        console.error('[ext series-tags save]', e);
        res.status(500).json({ error: e.message });
    }
};

// 置換・削除に合わせてルールを直す (replace.js の中の、動画を直す処理と同じ transaction から呼ぶ)
exports.renameSeries = (before, after) => edit(rules => {
    const i = findRule(rules, before);
    if (i < 0) return rules;
    const j = rules.findIndex((r, k) => k !== i && fold(r.name) === fold(after));
    if (j >= 0) { rules[j].tags = cleanTags([...rules[j].tags, ...rules[i].tags]); rules.splice(i, 1); } else rules[i].name = String(after).trim();
    return rules;
});
exports.dropSeries = (name) => edit(rules => rules.filter(r => fold(r.name) !== fold(name)));
exports.renameTag = (before, after) => edit(rules => rules.map(r => ({ name: r.name, tags: cleanTags(r.tags.map(t => (t === before ? after : t))) })));
exports.dropTag = (name) => edit(rules => rules.map(r => ({ name: r.name, tags: r.tags.filter(t => t !== name) })));
