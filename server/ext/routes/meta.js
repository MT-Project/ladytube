// =============================================================
// 動画の拡張メタデータ ルート
// =============================================================
const { db, splitList, joinList, hashOfVideo } = require('../db');
const seriestags = require('./seriestags');
const { normalizeUrl } = require('../perfurl.mjs');
const { hasCover } = require('./cover');   // 本体の画面 (ExtMetaEdit.jsx) と同じもの

const EMPTY = {
    rating: 0, display_name: '', model_no: '', release_date: '',
    series: '', maker: '', label: '',
    directors: [], genres: [], performers: [], summary: '', url: '',
    tags: []   // 動画のタグ (v3.17.0。保存で自動付与のタグが増えることがあるので、動画ページが保存のあと読み直す)
};

function expandPerformers(idsCsvLines) {
    const ids = splitList(idsCsvLines);
    if (ids.length === 0) return [];
    const out = [];
    const stmt = db.prepare('SELECT id, name, furigana, birthday, (image IS NOT NULL) AS has_image FROM ext_performers WHERE id = ?');
    for (const idStr of ids) {
        const p = stmt.get(parseInt(idStr, 10));
        if (p) out.push({ id: p.id, name: p.name, furigana: p.furigana, birthday: p.birthday, has_image: !!p.has_image });
    }
    return out;
}

// GET /ext/api/video/:id/meta
exports.getMeta = (req, res) => {
    try {
        const file = db.prepare('SELECT hash, filename, path, updated_at FROM files WHERE id = ?').get(req.params.id);
        if (!file) return res.status(404).json({ error: 'video not found' });

        const row = db.prepare('SELECT * FROM ext_video_meta WHERE hash = ?').get(file.hash);
        const tagRow = db.prepare('SELECT tags FROM metadata WHERE hash = ?').get(file.hash);

        const meta = {
            ...EMPTY,
            file_name: file.filename,
            video_date: file.updated_at,   // 動画の作成日時(ファイル更新日時) 年齢計算の既定基準
            has_cover: hasCover(file),     // カバー画像があるか (v3.15.0。一括取得が、カバーだけを取りに行くかを決める)
            tags: splitList(tagRow && tagRow.tags),
        };

        if (row) {
            meta.rating = row.rating || 0;
            meta.display_name = row.display_name || '';
            meta.model_no = row.model_no || '';
            meta.release_date = row.release_date || '';
            meta.series = row.series || '';
            meta.maker = row.maker || '';
            meta.label = row.label || '';
            meta.directors = splitList(row.directors);
            meta.genres = splitList(row.genres);
            meta.performers = expandPerformers(row.performers);
            meta.summary = row.summary || '';
            meta.url = row.url || '';
        }
        res.json(meta);
    } catch (e) {
        console.error('[ext meta get]', e);
        res.status(500).json({ error: e.message });
    }
};

// PUT /ext/api/video/:id/meta
exports.putMeta = (req, res) => {
    try {
        const hash = hashOfVideo(req.params.id);
        if (!hash) return res.status(404).json({ error: 'video not found' });

        const b = req.body || {};
        // performers は id の配列で受け取る
        const performerIds = Array.isArray(b.performers)
            ? b.performers.map(p => (typeof p === 'object' ? p.id : p)).filter(x => x !== undefined && x !== null)
            : [];

        const rating = Math.max(0, Math.min(5, parseInt(b.rating, 10) || 0));
        // 作品のページの URL (v3.15.0)。http/https だけ (スキームが無ければ https を補う)
        const url = typeof b.url === 'string' ? normalizeUrl(b.url) : undefined;
        if (url === '' && b.url.trim()) return res.status(400).json({ error: 'URL は http か https で始まるものだけです' });

        const prev = db.prepare('SELECT series FROM ext_video_meta WHERE hash = ?').get(hash);
        const series = (b.series || '').trim() || null;
        db.prepare(`
            INSERT INTO ext_video_meta
                (hash, rating, display_name, model_no, release_date, series, maker, label, directors, genres, performers, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(hash) DO UPDATE SET
                rating=excluded.rating, display_name=excluded.display_name, model_no=excluded.model_no,
                release_date=excluded.release_date, series=excluded.series, maker=excluded.maker,
                label=excluded.label, directors=excluded.directors, genres=excluded.genres,
                performers=excluded.performers, updated_at=CURRENT_TIMESTAMP
        `).run(
            hash, rating,
            (b.display_name || '').trim() || null,
            (b.model_no || '').trim() || null,
            (b.release_date || '').trim() || null,
            series,
            (b.maker || '').trim() || null,
            (b.label || '').trim() || null,
            joinList(b.directors),
            joinList(b.genres),
            joinList(performerIds)
        );
        // 作品紹介 (v3.13.0) は送られてきたときだけ書く (評価の保存など、作品紹介を持たない呼び出しで消さない)
        if (typeof b.summary === 'string') {
            db.prepare('UPDATE ext_video_meta SET summary = ? WHERE hash = ?').run(b.summary.trim() || null, hash);
        }
        // URL も送られてきたときだけ書く (同じ理由)
        if (url !== undefined) db.prepare('UPDATE ext_video_meta SET url = ? WHERE hash = ?').run(url || null, hash);

        // シリーズが変わったときだけ、そのシリーズのルールのタグを足す (評価の保存などシリーズが同じなら何もしない。seriestags.js)
        const tagsAdded = seriestags.onSeries(hash, prev && prev.series, series);
        res.json({ success: true, tags_added: tagsAdded });
    } catch (e) {
        console.error('[ext meta put]', e);
        res.status(500).json({ error: e.message });
    }
};

