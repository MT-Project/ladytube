// =============================================================
// LadyTube - ライブラリ (DB ファイル単位の切り替え)
//
// ライブラリ1つ = DB ファイル1つ。
//   既定ライブラリ : インストール先の videos.db
//   追加ライブラリ : libraries/<id>/videos.db  (一覧と使用中は libraries/libraries.json)
//
// 本体 server/db.js が起動時に bootPath() で開くファイルを決め、開いた直後に opened(db) を呼ぶ。
// 切り替えはサーバーの再起動で行う: 使用中を書き換えて RESTART_CODE で終わり、起動用の
// ladytube.bat がそれを見て起動し直す (bat は LADYTUBE_RESTART=1 を渡す。bat 以外から起動したときは手動)。
//
// 全ライブラリ共通のもの:
//   ・出演者 (ext_performers) … 既定ライブラリの表を使う。追加ライブラリの接続には既定の
//     videos.db を "shared" として ATTACH し、追加ライブラリ側には ext_performers を置かない。
//     修飾なしの "ext_performers" は SQLite の名前解決で shared 側に届くので、既存の SQL はそのまま動く。
//   ・メーカー情報 (ext_makers) … 出演者と同じ置き方 (v2.0.1 から)。一覧に出すメーカーは各ライブラリの動画から集める。
//   ・SHARED_KEYS の設定 … 既定ライブラリの settings を正とし、起動時に写し、書き込みのたびに書き戻す。
//
// このファイルは本体の server/db.js から、DB を開く前に読まれる。先頭で ../db や ./db を require しないこと
// (循環して本体の DB がまだ無い)。本体の DB が要る処理は関数の中で遅延 require する。
// =============================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_DB = path.join(ROOT, 'videos.db');
const LIB_DIR = path.join(ROOT, 'libraries');
const REG_FILE = path.join(LIB_DIR, 'libraries.json');
const TRASH_DIR = path.join(LIB_DIR, '_trash');
const DEFAULT_ID = 'default';
const DEFAULT_NAME = 'メイン';
const RESTART_CODE = 75;   // このコードで終わったら、ladytube.bat が起動し直す
const canRestart = () => process.env.LADYTUBE_RESTART === '1';   // ladytube.bat から起動したか

// 全ライブラリ共通の設定 (公開設定・プリセットタグ・FANZA API・出演者タグ)
const SHARED_KEYS = [
    'allow_public', 'preset_tags', 'ext_video_tag_layout',
    'ext_dmm_api_id', 'ext_dmm_affiliate_id',
    'ext_performer_preset_tags', 'ext_performer_tag_rules',
];
// 「設定を引き継いで作成」でも写さない設定 (動画や画像の置き場所はライブラリごとに違う)
const NOT_INHERITED = ['scan_folders', 'ext_cover_folder'];

// 起動中のライブラリ
const runtime = { id: DEFAULT_ID, path: DEFAULT_DB, shared: false, warning: '' };

/* ---------- 一覧 (libraries.json) ---------- */
function readRegistry() {
    let reg = null;
    try { reg = JSON.parse(fs.readFileSync(REG_FILE, 'utf8')); } catch (e) { /* 未作成 = 既定のみ */ }
    if (!reg || !Array.isArray(reg.libraries)) reg = { active: DEFAULT_ID, libraries: [] };
    if (!reg.libraries.some(l => l.id === DEFAULT_ID)) reg.libraries.unshift({ id: DEFAULT_ID, name: DEFAULT_NAME });
    if (!reg.active) reg.active = DEFAULT_ID;
    return reg;
}
function writeRegistry(reg) {
    fs.mkdirSync(LIB_DIR, { recursive: true });
    const tmp = REG_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(reg, null, 2), 'utf8');
    fs.renameSync(tmp, REG_FILE);
}
function dbPathOf(id) { return id === DEFAULT_ID ? DEFAULT_DB : path.join(LIB_DIR, id, 'videos.db'); }
function findLib(reg, id) { return reg.libraries.find(l => l.id === id) || null; }
function samePath(a, b) { return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase(); }

// 起動時に開くライブラリ (一覧に無い・ファイルが無いときは既定)
function bootLibraryId() {
    const reg = readRegistry();
    const id = reg.active;
    if (id !== DEFAULT_ID && (!findLib(reg, id) || !fs.existsSync(dbPathOf(id)))) {
        console.error('[LadyTube] ライブラリ "' + id + '" が見つからないため、既定のライブラリで起動します');
        return DEFAULT_ID;
    }
    return id;
}

const raw = () => require('better-sqlite3');   // 拡張が自分で別の DB ファイルを開くとき用

function hasTable(conn, schema, name) {
    return !!conn.prepare(`SELECT 1 FROM ${schema}.sqlite_master WHERE type = 'table' AND name = ?`).get(name);
}

/* ---------- 本体 server/db.js から: 開くファイルを決め、開いた直後に繋ぐ ---------- */
function bootPath() {
    runtime.id = bootLibraryId();
    runtime.path = dbPathOf(runtime.id);
    return runtime.path;
}
function opened(conn) {
    if (runtime.id !== DEFAULT_ID) attachShared(conn);
}

// 追加ライブラリの接続に既定ライブラリを shared として繋ぎ、共通設定を写す。
// 本体が allow_public を読むより前 (本体の DB 生成の直後) に呼ばれる。
function attachShared(conn) {
    try {
        conn.prepare('ATTACH DATABASE ? AS shared').run(DEFAULT_DB);
        runtime.shared = true;
        copySharedIn(conn);
    } catch (e) {
        runtime.warning = '既定のライブラリに接続できませんでした（' + e.message + '）。出演者と共通設定が使えません。';
        console.error('[LadyTube] ' + runtime.warning);
    }
}

const keysPh = () => SHARED_KEYS.map(() => '?').join(',');

// 既定 → 使用中ライブラリ (起動時)
function copySharedIn(conn) {
    if (!hasTable(conn, 'main', 'settings') || !hasTable(conn, 'shared', 'settings')) return;
    conn.transaction(() => {
        conn.prepare(`DELETE FROM main.settings WHERE key IN (${keysPh()})`).run(...SHARED_KEYS);
        conn.prepare(`INSERT INTO main.settings (key, value) SELECT key, value FROM shared.settings WHERE key IN (${keysPh()})`).run(...SHARED_KEYS);
    })();
}

// 使用中ライブラリ → 既定 (書き込み系リクエストの後)。本体の API も拡張の API も
// 使用中ライブラリの settings に書くので、ここで既定側へ揃える。
function syncSharedOut(db) {
    if (!runtime.shared) return 0;
    const read = (schema) => new Map(db.prepare(`SELECT key, value FROM ${schema}.settings WHERE key IN (${keysPh()})`)
        .all(...SHARED_KEYS).map(r => [r.key, r.value]));
    const mine = read('main'), theirs = read('shared');
    const diff = SHARED_KEYS.filter(k => mine.get(k) !== theirs.get(k));
    if (!diff.length) return 0;
    const up = db.prepare('INSERT OR REPLACE INTO shared.settings (key, value) VALUES (?, ?)');
    const del = db.prepare('DELETE FROM shared.settings WHERE key = ?');
    db.transaction(() => diff.forEach(k => (mine.has(k) ? up.run(k, mine.get(k)) : del.run(k))))();
    return diff.length;
}

/* ---------- 出演者を既定ライブラリへ寄せる ---------- */
// conn には既定ライブラリが shared として繋がっていること。conn の main にある ext_performers を
// 名前で突き合わせて shared 側へまとめ、動画の紐付け(ext_video_meta.performers の id)を付け替えてから
// main の ext_performers を消す。取り込み・複製のときと、起動時の保険として呼ぶ。
function mergePerformersIntoShared(conn) {
    if (!hasTable(conn, 'main', 'ext_performers')) return { merged: 0, added: 0 };
    if (!hasTable(conn, 'shared', 'ext_performers')) {
        const ddl = conn.prepare("SELECT sql FROM main.sqlite_master WHERE type = 'table' AND name = 'ext_performers'").get().sql;
        conn.exec(ddl.replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?"?ext_performers"?/i, 'CREATE TABLE IF NOT EXISTS shared.ext_performers'));
    }
    const colsOf = (schema) => conn.prepare(`PRAGMA ${schema}.table_info(ext_performers)`).all().map(c => c.name);
    const sharedCols = new Set(colsOf('shared'));
    const cols = colsOf('main').filter(c => c !== 'id' && sharedCols.has(c));

    const rows = conn.prepare('SELECT * FROM main.ext_performers').all();
    const byIdName = conn.prepare('SELECT id FROM shared.ext_performers WHERE id = ? AND name = ?');
    const byName = conn.prepare('SELECT * FROM shared.ext_performers WHERE name = ?');
    const ins = conn.prepare(`INSERT INTO shared.ext_performers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    const empty = (v) => v == null || v === '' || v === 0;
    const map = new Map();
    let added = 0;

    conn.transaction(() => {
        rows.forEach(r => {
            if (!r.name) return;
            // 同じ id・同じ名前 (既定ライブラリの複製) はそのまま。次に名前で突き合わせる。
            let hit = byIdName.get(r.id, r.name);
            if (!hit) {
                const s = byName.get(r.name);
                if (s) {
                    // 共有側で空の項目だけ埋める (画像やプロフィールを取り込み元から補う)
                    const fill = cols.filter(c => c !== 'name' && empty(s[c]) && !empty(r[c]));
                    if (fill.length) {
                        conn.prepare(`UPDATE shared.ext_performers SET ${fill.map(c => c + ' = ?').join(', ')} WHERE id = ?`)
                            .run(...fill.map(c => r[c]), s.id);
                    }
                    hit = s;
                }
            }
            if (!hit) { hit = { id: ins.run(...cols.map(c => r[c])).lastInsertRowid }; added++; }
            map.set(r.id, Number(hit.id));
        });

        if (hasTable(conn, 'main', 'ext_video_meta')) {
            const upd = conn.prepare('UPDATE main.ext_video_meta SET performers = ? WHERE hash = ?');
            conn.prepare("SELECT hash, performers FROM main.ext_video_meta WHERE performers IS NOT NULL AND performers != ''").all().forEach(v => {
                const ids = String(v.performers).split('\n').map(s => s.trim()).filter(Boolean);
                // 出演者表に無い id (元から切れていた紐付け) は落とす
                const next = [...new Set(ids.map(s => map.get(parseInt(s, 10))).filter(n => n != null))].map(String);
                if (next.join('\n') !== ids.join('\n')) upd.run(next.length ? next.join('\n') : null, v.hash);
            });
        }
        conn.exec('DROP TABLE main.ext_performers');
    })();
    return { merged: rows.length, added };
}

/* ---------- メーカー情報を既定ライブラリへ寄せる (v2.0.1 で共通にした) ---------- */
// conn には既定ライブラリが shared として繋がっていること。conn の main にある ext_makers を
// 名前で突き合わせて shared 側へまとめ、main の表を消す。同じメーカーが両方にあるときは共有側を正とし、
// 空の項目だけ埋める (画像と表示範囲 image_view は組で扱う)。
function mergeMakersIntoShared(conn) {
    if (!hasTable(conn, 'main', 'ext_makers')) return { merged: 0, added: 0 };
    const ddl = conn.prepare("SELECT sql FROM main.sqlite_master WHERE type = 'table' AND name = 'ext_makers'").get().sql;
    conn.exec(ddl.replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?"?ext_makers"?/i, 'CREATE TABLE IF NOT EXISTS shared.ext_makers'));
    const colsOf = (schema) => conn.prepare(`PRAGMA ${schema}.table_info(ext_makers)`).all();
    // 寄せる側にしか無い列 (拡張の版の違い) は共有側に足してから写す
    const sharedCols = new Set(colsOf('shared').map(c => c.name));
    colsOf('main').filter(c => !sharedCols.has(c.name)).forEach(c => conn.exec(`ALTER TABLE shared.ext_makers ADD COLUMN ${c.name} ${c.type}`));
    const cols = colsOf('main').map(c => c.name);

    const rows = conn.prepare('SELECT * FROM main.ext_makers').all();
    const byName = conn.prepare('SELECT * FROM shared.ext_makers WHERE name = ?');
    const ins = conn.prepare(`INSERT INTO shared.ext_makers (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`);
    const empty = (v) => v == null || v === '';
    let added = 0;
    conn.transaction(() => {
        rows.forEach(r => {
            if (!r.name) return;
            const s = byName.get(r.name);
            if (!s) { ins.run(...cols.map(c => r[c])); added++; return; }
            const fill = cols.filter(c => !['name', 'updated_at', 'image_view'].includes(c) && empty(s[c]) && !empty(r[c]));
            if (fill.includes('image') && cols.includes('image_view')) fill.push('image_view');
            if (fill.length) {
                conn.prepare(`UPDATE shared.ext_makers SET ${fill.map(c => c + ' = ?').join(', ')} WHERE name = ?`)
                    .run(...fill.map(c => r[c]), s.name);
            }
        });
        conn.exec('DROP TABLE main.ext_makers');
    })();
    return { merged: rows.length, added };
}

// 拡張のスキーマ作成の前に呼ぶ (ext/db.js)。追加ライブラリの main に出演者表・メーカー表が残っていたら寄せる。
function beforeSchema(db) {
    if (runtime.shared && hasTable(db, 'main', 'ext_performers')) {
        const r = mergePerformersIntoShared(db);
        console.log(`[LadyTube] 出演者 ${r.merged}件を共通の出演者へまとめました (新規 ${r.added}件)`);
    }
    const logMakers = (r, name) => console.log(`[LadyTube] ${name} のメーカー情報 ${r.merged}件を共通のメーカー情報へまとめました (新規 ${r.added}件)`);
    const reg = readRegistry();
    if (runtime.shared && hasTable(db, 'main', 'ext_makers')) logMakers(mergeMakersIntoShared(db), (findLib(reg, runtime.id) || {}).name);
    // 使用中でないライブラリに残っているメーカー情報も今寄せる (切り替えを待つと、その間の編集と食い違う)
    reg.libraries.forEach(l => {
        const file = dbPathOf(l.id);
        if (l.id === DEFAULT_ID || l.id === runtime.id || !fs.existsSync(file)) return;
        try {
            const conn = new (raw())(file, { fileMustExist: true, timeout: 5000 });
            try {
                if (!hasTable(conn, 'main', 'ext_makers')) return;
                conn.prepare('ATTACH DATABASE ? AS shared').run(DEFAULT_DB);
                logMakers(mergeMakersIntoShared(conn), l.name);
            } finally { conn.close(); }
        } catch (e) { console.error('[LadyTube] ' + l.name + ' のメーカー情報をまとめられませんでした: ' + e.message); }
    });
}
// 共通の表 (出演者・メーカー) を作る先。追加ライブラリでは既定ライブラリ側 (shared)
function sharedSchema() { return runtime.shared ? 'shared.' : ''; }

/* ---------- ほかのライブラリへの波及 (出演者は共通なので) ---------- */
// 使用中以外の各ライブラリで fn(conn, schema) を呼ぶ。既定ライブラリは本体の接続に shared として
// 繋がっているので、別の接続を開かずにそれを使う (同じファイルへの二重書き込みでロック待ちにしない)。
function forEachOtherLibrary(db, fn, readonly) {
    readRegistry().libraries.forEach(l => {
        if (l.id === runtime.id) return;
        if (l.id === DEFAULT_ID && runtime.shared) return fn(db, 'shared', l);
        const file = dbPathOf(l.id);
        if (!fs.existsSync(file)) return;
        const conn = new (raw())(file, { readonly: !!readonly, fileMustExist: true, timeout: 5000 });
        try { fn(conn, 'main', l); } finally { conn.close(); }
    });
}

function performerIdsIn(conn, schema, out) {
    if (!hasTable(conn, schema, 'ext_video_meta')) return out;
    conn.prepare(`SELECT performers FROM ${schema}.ext_video_meta WHERE performers IS NOT NULL AND performers != ''`).all()
        .forEach(r => String(r.performers).split('\n').forEach(s => { const n = parseInt(s, 10); if (!isNaN(n)) out.add(n); }));
    return out;
}
// ほかのライブラリの動画に登録されている出演者 id
function performerIdsUsedElsewhere(db) {
    const used = new Set();
    forEachOtherLibrary(db, (conn, schema) => performerIdsIn(conn, schema, used), true);
    return used;
}
// ほかのライブラリの動画から、出演者 id の紐付けを外す (出演者を消したとき)
function removePerformersElsewhere(db, ids) {
    const drop = new Set(ids.map(String));
    let n = 0;
    forEachOtherLibrary(db, (conn, schema) => {
        if (!hasTable(conn, schema, 'ext_video_meta')) return;
        const upd = conn.prepare(`UPDATE ${schema}.ext_video_meta SET performers = ?, updated_at = CURRENT_TIMESTAMP WHERE hash = ?`);
        conn.prepare(`SELECT hash, performers FROM ${schema}.ext_video_meta WHERE performers IS NOT NULL AND performers != ''`).all().forEach(v => {
            const ids0 = String(v.performers).split('\n').map(s => s.trim()).filter(Boolean);
            const next = ids0.filter(s => !drop.has(s));
            if (next.length !== ids0.length) { upd.run(next.length ? next.join('\n') : null, v.hash); n++; }
        });
    });
    return n;
}

/* ---------- 一覧の情報 ---------- */
function fileSize(file) {
    let n = 0;
    ['', '-wal'].forEach(s => { try { n += fs.statSync(file + s).size; } catch (e) { } });
    return n;
}
function videoCount(db, l) {
    try {
        if (l.id === runtime.id) return db.prepare('SELECT COUNT(*) AS c FROM main.files').get().c;
        if (l.id === DEFAULT_ID && runtime.shared) return db.prepare('SELECT COUNT(*) AS c FROM shared.files').get().c;
        const conn = new (raw())(dbPathOf(l.id), { readonly: true, fileMustExist: true });
        try { return hasTable(conn, 'main', 'files') ? conn.prepare('SELECT COUNT(*) AS c FROM files').get().c : 0; }
        finally { conn.close(); }
    } catch (e) { return null; }
}
function list(db) {
    const reg = readRegistry();
    return reg.libraries.map(l => ({
        id: l.id, name: l.name, isDefault: l.id === DEFAULT_ID, active: l.id === runtime.id,
        size: fileSize(dbPathOf(l.id)), videos: videoCount(db, l),
        created_at: l.created_at || null, last_used_at: l.id === runtime.id ? new Date().toISOString() : (l.last_used_at || null),
        missing: !fs.existsSync(dbPathOf(l.id)),
    }));
}
// HTML に埋め込む情報 (クライアントが本家バンドルより先に読む)
function clientInfo() {
    const reg = readRegistry();
    const cur = findLib(reg, runtime.id);
    return { id: runtime.id, name: cur ? cur.name : DEFAULT_NAME, count: reg.libraries.length };
}

/* ---------- 作成・取り込み・名前変更・削除・切り替え ---------- */
function cleanName(reg, name, selfId) {
    const n = String(name == null ? '' : name).trim();
    if (!n) throw badRequest('名前を入力してください');
    if (n.length > 40) throw badRequest('名前は40文字以内にしてください');
    if (reg.libraries.some(l => l.id !== selfId && l.name === n)) throw badRequest('「' + n + '」は既にあります');
    return n;
}
function badRequest(msg) { const e = new Error(msg); e.status = 400; return e; }
function newId() { return 'lib' + Date.now().toString(36); }

// 本体と同じ初期化 (テーブルと既定の設定)
function initEmpty(file) {
    const conn = new (raw())(file);
    try {
        conn.pragma('journal_mode = WAL');
        require('../db').initDb(conn);
    } finally { conn.close(); }
}

// 既定ライブラリを shared として繋いで出演者を寄せる
function normalizeFile(file) {
    const conn = new (raw())(file, { fileMustExist: true, timeout: 5000 });
    try {
        conn.prepare('ATTACH DATABASE ? AS shared').run(DEFAULT_DB);
        const r = mergePerformersIntoShared(conn);
        mergeMakersIntoShared(conn);
        return r;
    } finally { conn.close(); }
}

// mode: 'empty' | 'settings' (使用中ライブラリの設定を引き継ぐ) | 'clone' (使用中ライブラリを丸ごと複製)
async function create(db, name, mode) {
    const reg = readRegistry();
    const n = cleanName(reg, name);
    const id = newId();
    const file = dbPathOf(id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
        if (mode === 'clone') {
            await db.backup(file);
            normalizeFile(file);
        } else {
            initEmpty(file);
            if (mode === 'settings') {
                const rows = db.prepare('SELECT key, value FROM main.settings').all().filter(r => !NOT_INHERITED.includes(r.key));
                const conn = new (raw())(file);
                try {
                    const st = conn.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
                    conn.transaction(() => rows.forEach(r => st.run(r.key, r.value)))();
                } finally { conn.close(); }
            }
        }
    } catch (e) {
        try { fs.rmSync(path.dirname(file), { recursive: true, force: true }); } catch (e2) { }
        throw e;
    }
    reg.libraries.push({ id, name: n, created_at: new Date().toISOString() });
    writeRegistry(reg);
    return { id, name: n };
}

// 取り込む DB が本体の今の版と同じ形か (本体の initDb で作った表と列を比べる)
function checkCompatible(src) {
    const fresh = new (raw())(':memory:');
    try {
        require('../db').initDb(fresh);
        ['files', 'metadata', 'settings', 'screenshots'].forEach(t => {
            const have = new Set(src.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name));
            if (!have.size) throw badRequest('LadyTube（WomanLive）のデータベースではありません（' + t + ' がありません）');
            const missing = fresh.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name).filter(c => !have.has(c));
            if (missing.length) throw badRequest('今の LadyTube とデータベースの形式が違います（' + t + ' に ' + missing.join(', ') + ' がありません）');
        });
    } finally { fresh.close(); }
}

// 別の場所の videos.db をコピーしてライブラリにする (元のファイルは変更しない)
async function importDb(srcPath, name) {
    let src = String(srcPath || '').trim().replace(/^"(.*)"$/, '$1');
    if (!src) throw badRequest('取り込む videos.db の場所を入力してください');
    try { if (fs.statSync(src).isDirectory()) src = path.join(src, 'videos.db'); } catch (e) { }
    if (!fs.existsSync(src)) throw badRequest('ファイルが見つかりません: ' + src);
    const reg = readRegistry();
    if (reg.libraries.some(l => samePath(dbPathOf(l.id), src))) throw badRequest('このファイルは既にライブラリとして登録されています');
    const n = cleanName(reg, name);

    const conn = new (raw())(src, { readonly: true, fileMustExist: true, timeout: 5000 });
    const id = newId();
    const file = dbPathOf(id);
    let r;
    try {
        checkCompatible(conn);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        await conn.backup(file);   // 読み取り専用のまま WAL の中身も含めて写す
    } catch (e) {
        try { fs.rmSync(path.dirname(file), { recursive: true, force: true }); } catch (e2) { }
        throw e;
    } finally { conn.close(); }
    try { r = normalizeFile(file); }
    catch (e) { try { fs.rmSync(path.dirname(file), { recursive: true, force: true }); } catch (e2) { } throw e; }

    reg.libraries.push({ id, name: n, created_at: new Date().toISOString(), imported_from: src });
    writeRegistry(reg);
    return { id, name: n, performers: r };
}

function rename(id, name) {
    const reg = readRegistry();
    const l = findLib(reg, id);
    if (!l) throw badRequest('ライブラリが見つかりません');
    l.name = cleanName(reg, name, id);
    writeRegistry(reg);
    return { id, name: l.name };
}

// 削除: ファイルはすぐ消さず libraries/_trash へ移す。動画ファイルには触れない。
function remove(id) {
    const reg = readRegistry();
    const l = findLib(reg, id);
    if (!l) throw badRequest('ライブラリが見つかりません');
    if (id === DEFAULT_ID) throw badRequest('既定のライブラリは削除できません');
    if (id === runtime.id) throw badRequest('使用中のライブラリは削除できません。先に別のライブラリへ切り替えてください');
    const dir = path.dirname(dbPathOf(id));
    let moved = null;
    if (fs.existsSync(dir)) {
        fs.mkdirSync(TRASH_DIR, { recursive: true });
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
        moved = path.join(TRASH_DIR, id + '_' + stamp);
        fs.renameSync(dir, moved);
    }
    reg.libraries = reg.libraries.filter(x => x.id !== id);
    if (reg.active === id) reg.active = DEFAULT_ID;
    writeRegistry(reg);
    return { id, movedTo: moved };
}

// 切り替え: 一覧の使用中を書き換えて再起動する。ladytube.bat 以外から起動したときは再起動は手動。
function switchTo(db, id) {
    const reg = readRegistry();
    const l = findLib(reg, id);
    if (!l) throw badRequest('ライブラリが見つかりません');
    if (id === runtime.id) throw badRequest('既に使用中のライブラリです');
    if (!fs.existsSync(dbPathOf(id))) throw badRequest('ライブラリのファイルが見つかりません');
    const scanner = require('../services/scanner');
    if (scanner.isScanning) throw badRequest('スキャン中は切り替えられません。スキャンの完了か中止を待ってください');

    const now = new Date().toISOString();
    const cur = findLib(reg, runtime.id);
    if (cur) cur.last_used_at = now;
    l.last_used_at = now;
    reg.active = id;
    writeRegistry(reg);

    const restarting = canRestart();
    if (restarting) {
        setTimeout(() => {
            try { db.close(); } catch (e) { }
            process.exit(RESTART_CODE);
        }, 400);
    }
    return { id, name: l.name, restarting };
}

function isLocal(req) {
    const a = (req.socket && req.socket.remoteAddress) || '';
    return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';
}

module.exports = {
    DEFAULT_ID, RESTART_CODE, SHARED_KEYS, runtime, canRestart,
    bootPath, opened, beforeSchema, sharedSchema, syncSharedOut,
    performerIdsUsedElsewhere, removePerformersElsewhere,
    list, clientInfo, create, importDb, rename, remove, switchTo, isLocal, readRegistry,
    // 検証用
    _internal: { mergePerformersIntoShared, mergeMakersIntoShared, copySharedIn, dbPathOf, LIB_DIR, DEFAULT_DB },
};
