// =============================================================
// DB の自動バックアップ
//  起動時に、使用中のライブラリの DB を backups/<ライブラリの id>/videos-YYYYMMDD-HHmmss.db へ写す。
//  前のバックアップから1日たっていなければ作らない。ライブラリごとに新しい KEEP 個を残す。
//  追加ライブラリで起動したときは、出演者とメーカーを持つ既定のライブラリも写す。
//  戻すとき: LadyTube を終了し、バックアップを videos.db (追加ライブラリは libraries/<id>/videos.db) へ
//  上書きコピーする (同じ場所の videos.db-wal・videos.db-shm があれば消す)。
// =============================================================
const fs = require('fs');
const path = require('path');
const library = require('./library');

const DIR = path.join(__dirname, '..', '..', 'backups');
const KEEP = 5;
const INTERVAL = 24 * 60 * 60 * 1000;
const NAME = /^videos-\d{8}-\d{6}\.db$/;

const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => '' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());

// attached: 写す DB の名前 (省くと main)。作ったらそのパス、まだ新しければ null
async function backupOne(db, id, attached) {
    const dir = path.join(DIR, id);
    fs.mkdirSync(dir, { recursive: true });
    const all = fs.readdirSync(dir);
    // 写している途中で終わった残り (ライブラリの切り替えなど)
    all.filter(f => f.endsWith('.tmp')).forEach(f => fs.rmSync(path.join(dir, f), { force: true }));
    const done = all.filter(f => NAME.test(f)).sort();
    const last = done[done.length - 1];
    if (last && Date.now() - fs.statSync(path.join(dir, last)).mtimeMs < INTERVAL) return null;
    const dest = path.join(dir, 'videos-' + stamp(new Date()) + '.db');
    await db.backup(dest + '.tmp', attached ? { attached } : undefined);
    fs.renameSync(dest + '.tmp', dest);
    done.concat(path.basename(dest)).slice(0, -KEEP).forEach(f => fs.rmSync(path.join(dir, f), { force: true }));
    return dest;
}

// 起動を待たせないよう、呼ぶ側は await しない。失敗しても起動は続ける
exports.run = async (db) => {
    try {
        const made = [await backupOne(db, library.runtime.id)];
        if (library.runtime.shared) made.push(await backupOne(db, library.DEFAULT_ID, 'shared'));
        made.filter(Boolean).forEach(f => console.log('[LadyTube] DB をバックアップしました: ' + path.relative(path.join(DIR, '..'), f)));
    } catch (e) { console.error('[LadyTube] DB の自動バックアップに失敗しました', e); }
};
