// =============================================================
// 動画のファイル名の変更 (v3.12.0)
//  ・renameVideo(id, stem): 同じフォルダの中で名前を変え、files の行は path と filename を書き換えるだけにする
//    (id が変わらないので、開いているページやブックマークはそのまま)。拡張子は変えない。
//    同じ名前の字幕 (.ass/.vtt/.srt) と、カバー画像のフォルダの同じ名前の画像も一緒に変える
//    (フォルダの画像はファイル名で探すため。cover.js の findFolderCover)。
//  ・ruleTargets(ids) / applyRule(ids): ファイル名のルール (filerule.mjs。設定 ext_rename_rule) で名前を作って変える
//  エクスプローラーで変えると、次のスキャンで別の id の行になり、フォルダのカバー画像も外れる。
// =============================================================
const fs = require('fs');
const path = require('path');
const { db, getSetting, splitList, IMG_EXTS } = require('./db');
const { ruleStem, DEFAULT_RULE } = require('./filerule.mjs');

const SUB_EXTS = ['.ass', '.vtt', '.srt'];   // 本体 videoService.js の getSubtitle と同じ
const PATH_MAX = 259;                         // Windows の古いアプリが開ける長さ

function bad(message) { const e = new Error(message); e.status = 400; return e; }

// 名前 (拡張子なし) として使えないときの理由
function stemError(stem) {
    if (!stem) return '名前が空です';
    if (/[\\/:*?"<>|\u0000-\u001f]/.test(stem)) return '使えない文字 (\\ / : * ? " < > |) が入っています';
    if (/^\s|[. ]$/.test(stem)) return '先頭の空白と、末尾の点や空白は使えません';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) return 'Windows で使えない名前です';
    return null;
}

// 変える前に確かめる (実際には変えない)。戻りは { f, to } か、使えない理由を投げる
function check(id, stem) {
    const f = db.prepare('SELECT id, path, filename, hash FROM files WHERE id = ?').get(id);
    if (!f) throw bad('動画が見つかりません');
    const ext = path.extname(f.path);
    const err = stemError(stem);
    if (err) throw bad(err);
    const to = path.join(path.dirname(f.path), stem + ext);
    if (to === f.path) return { f, to, same: true };
    if (to.length > PATH_MAX) throw bad('パスが長すぎます（' + PATH_MAX + '文字まで。今は ' + to.length + '文字）');
    const caseOnly = to.toLowerCase() === f.path.toLowerCase();   // 大文字小文字だけの違いは同じファイル
    if (!fs.existsSync(f.path)) throw bad('動画ファイルが見つかりません（移動か削除されています）');
    if (!caseOnly && fs.existsSync(to)) throw bad('同じ名前のファイルがあります');
    if (!caseOnly && db.prepare('SELECT 1 FROM files WHERE path = ? AND id <> ?').get(to, id)) throw bad('同じパスの動画が登録されています（スキャンすると直ります）');
    return { f, to, caseOnly };
}

// 字幕やカバー画像のように、同じ名前で並ぶファイルを一緒に変える (失敗しても動画の名前は戻さない。warnings に書く)
function moveAlong(from, to, caseOnly, moved, warnings) {
    if (!fs.existsSync(from)) return;
    if (!caseOnly && fs.existsSync(to)) { warnings.push(path.basename(to) + ' が既にあるので、' + path.basename(from) + ' は変えませんでした'); return; }
    try { fs.renameSync(from, to); moved.push(path.basename(to)); }
    catch (e) { warnings.push(path.basename(from) + ' を変えられませんでした: ' + e.code); }
}

function renameVideo(id, stem) {
    stem = String(stem == null ? '' : stem);
    const { f, to, same, caseOnly } = check(id, stem);
    if (same) return { id: f.id, from: f.filename, to: f.filename, same: true };
    const ext = path.extname(f.path), oldStem = path.basename(f.path, ext), dir = path.dirname(f.path);
    try { fs.renameSync(f.path, to); }
    catch (e) {
        if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) throw bad('ファイルが使用中か、書き込みできません（変換して再生している最中などは変えられません）');
        throw bad('名前を変えられませんでした: ' + e.message);
    }
    try { db.prepare('UPDATE files SET path = ?, filename = ? WHERE id = ?').run(to, stem + ext, f.id); }
    catch (e) { try { fs.renameSync(to, f.path); } catch (e2) { } throw e; }   // DB を書き換えられなければファイル名も戻す
    const moved = [], warnings = [];
    SUB_EXTS.forEach(x => moveAlong(path.join(dir, oldStem + x), path.join(dir, stem + x), caseOnly, moved, warnings));
    const coverDir = getSetting('ext_cover_folder', '');
    if (coverDir) IMG_EXTS.forEach(x => moveAlong(path.join(coverDir, oldStem + x), path.join(coverDir, stem + x), caseOnly, moved, warnings));
    console.log('[LadyTube] ファイル名を変更: ' + f.filename + ' → ' + stem + ext + (moved.length ? '（' + moved.join('・') + ' も）' : ''));
    return { id: f.id, from: f.filename, to: stem + ext, moved, warnings };
}

// ルールに入れる値 (詳細情報から)
function valuesOf(hash) {
    const r = db.prepare('SELECT * FROM ext_video_meta WHERE hash = ?').get(hash) || {};
    const name = db.prepare('SELECT name FROM ext_performers WHERE id = ?');
    return {
        model_no: r.model_no || '', title: r.display_name || '', maker: r.maker || '', label: r.label || '',
        series: r.series || '', release_date: r.release_date || '',
        performers: splitList(r.performers).map(pid => (name.get(pid) || {}).name).filter(Boolean),
    };
}

const currentRule = () => getSetting('ext_rename_rule', '') || DEFAULT_RULE;

// ルールで作る名前の一覧 (変える前の確認用)。[{ id, from, to, status: 'ok'|'same'|'error', error }]
function ruleTargets(ids) {
    const rule = currentRule();
    return (ids || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n)).map(id => {
        const f = db.prepare('SELECT id, path, filename, hash FROM files WHERE id = ?').get(id);
        if (!f) return { id, from: '', to: '', status: 'error', error: '動画が見つかりません' };
        const ext = path.extname(f.path);
        const stem = ruleStem(rule, valuesOf(f.hash), path.basename(f.path, ext));
        if (!stem) return { id, from: f.filename, to: '', status: 'error', error: 'ルールの項目が空なので名前を作れません' };
        try {
            const c = check(id, stem);
            return { id, from: f.filename, to: stem + ext, stem, status: c.same ? 'same' : 'ok' };
        } catch (e) { return { id, from: f.filename, to: stem + ext, status: 'error', error: e.message }; }
    });
}

// ルールで変える。確認のあとに名前が変わっていても、その時点の値で作り直す
function applyRule(ids) {
    return ruleTargets(ids).map(t => {
        if (t.status !== 'ok') return t;
        try { return { ...t, ...renameVideo(t.id, t.stem), status: 'done' }; }
        catch (e) { return { ...t, status: 'error', error: e.message }; }
    });
}

module.exports = { renameVideo, ruleTargets, applyRule, stemError };
