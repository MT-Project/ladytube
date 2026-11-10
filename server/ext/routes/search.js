// =============================================================
// 検索 ルート
// 本体の一覧 /api/videos と件数 /api/videos/count は、ここの videos / count で返す
// (本体 server/services/videoService.js の getVideos / getVideoCount から呼ぶ)。
// 検索語は @ で始まる項目トークンと本家互換のキーワード (fullsearch.js の keywordWhere)、
// ほかに path (フォルダ絞り込み)・sort (拡張のソートを含む)・group=1 (品番でまとめる) を扱う。
// 戻り値の形は本体と同じで、一覧は { videos }、件数は { totalCount }。
// =============================================================
const { db, splitList, SORT_MAP } = require('../db');
const { keywordWhere, orderByFor, pathWhere, sortWhere } = require('./fullsearch');

const VIDEO_FIELDS = `
    f.id, f.path, f.filename, f.size,
    m.hash, m.duration,
    (m.thumbnail IS NOT NULL) AS has_thumbnail,
    LENGTH(m.thumbnail) AS thumbnail_size,
    m.tags, m.use_transcode, m.display_name, m.last_pos,
    e.display_name AS ext_display_name,
    e.rating AS ext_rating
`;

// 検索文字列を「項目トークン」と「キーワード」に分ける。
//   '@maker:"X" rating:>=4 温泉' -> tokens=[maker,rating] keyword='温泉'
// '@' で始まらないものは本家と同じキーワード検索なので、項目トークンとしては解釈しない
// (例: "http://x" の "http:" をフィールド名と読み違えないため)。
function splitQuery(q) {
    const s = String(q == null ? '' : q).trim();
    if (!s) return { tokens: [], keyword: '' };
    if (!s.startsWith('@')) return { tokens: [], keyword: s };

    const body = s.slice(1);
    const tokens = [];
    // field:"quoted value"  または field:value
    const re = /(\w+)\s*:\s*("([^"]*)"|[^\s]+)/g;
    let match, last = 0, rest = '';
    while ((match = re.exec(body)) !== null) {
        rest += body.slice(last, match.index);
        last = match.index + match[0].length;
        const field = match[1].toLowerCase();
        let value = match[3] !== undefined ? match[3] : match[2];
        tokens.push({ field, value });
    }
    rest += body.slice(last);
    return { tokens, keyword: rest.trim() };
}

// 検索文字列から WHERE 条件一式を作る (項目トークン AND キーワード AND フォルダ)
// query は req.query 相当 (path / sort も見る)。文字列を渡したときは検索語だけとして扱う。
function conditionsFor(query) {
    const opts = (query && typeof query === 'object') ? query : { q: query };
    const { tokens, keyword } = splitQuery(opts.q);
    const { where, params } = buildConditions(tokens);
    if (keyword) {
        const kw = keywordWhere(keyword);   // 書式が不正なら badRequest 付きで throw
        if (kw.sql) { where.push('(' + kw.sql + ')'); params.push(...kw.params); }
    }
    const pw = pathWhere(opts.path);
    if (pw.sql) { where.push(pw.sql); params.push(...pw.params); }
    const sw = sortWhere(opts.sort);
    if (sw) where.push(sw);
    return { where, params };
}

function buildConditions(tokens) {
    const where = [];
    const params = [];
    for (const { field, value } of tokens) {
        switch (field) {
            case 'maker': where.push('e.maker = ? COLLATE NOCASE'); params.push(value); break;
            case 'series': where.push('e.series = ? COLLATE NOCASE'); params.push(value); break;
            case 'label':
                // release:none と同じ書き方で「レーベルなし」を引けるようにする
                if (value === 'none') where.push("(e.label IS NULL OR e.label = '')");
                else { where.push('e.label = ? COLLATE NOCASE'); params.push(value); }
                break;
            case 'model': where.push('e.model_no = ? COLLATE NOCASE'); params.push(value); break;
            case 'director':
                where.push("('\n' || IFNULL(e.directors,'') || '\n') LIKE ? COLLATE NOCASE");
                params.push(`%\n${value}\n%`); break;
            case 'genre':
                where.push("('\n' || IFNULL(e.genres,'') || '\n') LIKE ? COLLATE NOCASE");
                params.push(`%\n${value}\n%`); break;
            case 'performer':
                where.push("('\n' || IFNULL(e.performers,'') || '\n') LIKE ?");
                params.push(`%\n${value}\n%`); break;
            case 'tag':
                where.push("IFNULL(m.tags,'') LIKE ?");
                params.push(`%\n${value}\n%`); break;
            case 'rating': {
                const mm = /^(>=|<=|>|<|=)?\s*(\d)/.exec(value);
                if (mm) {
                    const op = mm[1] || '=';
                    where.push(`IFNULL(e.rating,0) ${op} ?`);
                    params.push(parseInt(mm[2], 10));
                }
                break;
            }
            case 'releasemonth': // YYYY-MM
                where.push("substr(IFNULL(e.release_date,''),1,7) = ?");
                params.push(value);
                break;
            case 'releaseyear': // YYYY
                where.push("substr(IFNULL(e.release_date,''),1,4) = ?");
                params.push(value);
                break;
            case 'release':
                if (value === 'none') where.push("(e.release_date IS NULL OR e.release_date = '')");
                break;
            case 'bookmark': {
                // ブックマークフォルダ名で指定する(同名のフォルダがあれば両方が対象)。
                // 名前に一致しなければ旧形式のフォルダIDとしても解釈する(古いリンクを壊さないため)。
                const ids = db.prepare('SELECT id FROM ext_bookmark_folders WHERE name = ? COLLATE NOCASE').all(value).map(r => r.id);
                if (!ids.length) { const n = parseInt(value, 10); if (Number.isInteger(n)) ids.push(n); }
                if (!ids.length) { where.push('1 = 0'); break; }   // 該当なしは0件
                where.push(`f.hash IN (SELECT hash FROM ext_bookmarks WHERE folder_id IN (${ids.map(() => '?').join(',')}))`);
                ids.forEach(i => params.push(i));
                break;
            }
            // --- 除外 (含まない) 検索 ---
            case 'notmaker': where.push("IFNULL(e.maker,'') != ? COLLATE NOCASE"); params.push(value); break;
            case 'notseries': where.push("IFNULL(e.series,'') != ? COLLATE NOCASE"); params.push(value); break;
            case 'notlabel': where.push("IFNULL(e.label,'') != ? COLLATE NOCASE"); params.push(value); break;
            case 'notdirector':
                where.push("('\n' || IFNULL(e.directors,'') || '\n') NOT LIKE ? COLLATE NOCASE");
                params.push(`%\n${value}\n%`); break;
            case 'notgenre':
                where.push("('\n' || IFNULL(e.genres,'') || '\n') NOT LIKE ? COLLATE NOCASE");
                params.push(`%\n${value}\n%`); break;
            case 'notperformer':
                where.push("('\n' || IFNULL(e.performers,'') || '\n') NOT LIKE ?");
                params.push(`%\n${value}\n%`); break;
            default: break;
        }
    }
    return { where, params };
}

// 「品番でまとめる」のまとめ単位。品番が空の動画は1本ずつ (id で別々にする)。
const GROUP_KEY = "CASE WHEN IFNULL(e.model_no,'') = '' THEN 'i' || f.id ELSE 'm' || UPPER(e.model_no) END";

const BASE = `
    FROM files f
    JOIN metadata m ON f.hash = m.hash
    LEFT JOIN ext_video_meta e ON e.hash = f.hash
`;

// 同じ品番の動画を1件にまとめた一覧。検索に合った動画だけでまとめる。
//  並び: グループ内で今のソート順の一番前に来る動画の位置 (新しい順なら一番新しい動画)
//  代表: ファイル名の自然順で先頭 (_1 など)。ext_group_ids はメンバーの id をその順に並べたもの
function groupedVideos(whereSql, params, orderBy, extraParams, limit, offset) {
    // ORDER BY の乱数シード(extraParams)は hits の SELECT 句にあるので WHERE の値より前に渡す
    return db.prepare(`
        WITH hits AS (
            SELECT f.id AS id, ${GROUP_KEY} AS gk, ext_namekey(f.filename) AS nk,
                   ROW_NUMBER() OVER (ORDER BY ${orderBy}, f.id) AS ord
            ${BASE}${whereSql}
        ), g AS (
            SELECT id, gk, MIN(ord) OVER w AS gord, COUNT(*) OVER w AS gcount,
                   ROW_NUMBER() OVER (PARTITION BY gk ORDER BY nk, id) AS rn
            FROM hits WINDOW w AS (PARTITION BY gk)
        )
        SELECT ${VIDEO_FIELDS}, g.gcount AS ext_group_count,
               CASE WHEN g.gcount > 1 THEN (SELECT GROUP_CONCAT(g2.id ORDER BY g2.rn) FROM g g2 WHERE g2.gk = g.gk) END AS ext_group_ids
        FROM g
        JOIN files f ON f.id = g.id
        JOIN metadata m ON f.hash = m.hash
        LEFT JOIN ext_video_meta e ON e.hash = f.hash
        WHERE g.rn = 1
        ORDER BY g.gord
        LIMIT ? OFFSET ?
    `).all(...extraParams, ...params, limit, offset);
}

// 本体と同じく、一覧と件数は別々に返す (一覧を先に出し、件数は後から取る作り)
function respond(req, res, countOnly) {
    try {
        const query = req.query;
        const { where, params } = conditionsFor(query);
        const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
        const grouped = query.group === '1';

        if (countOnly) {
            const total = db.prepare(`SELECT ${grouped ? `COUNT(DISTINCT ${GROUP_KEY})` : 'COUNT(*)'} AS total ${BASE}${whereSql}`).get(...params).total;
            return res.json({ totalCount: total });
        }

        const limit = Math.max(1, parseInt(query.perPage, 10) || 20);
        const offset = (Math.max(1, parseInt(query.page, 10) || 1) - 1) * limit;
        const { orderBy, extraParams } = orderByFor(query.sort, query.seed);
        const videos = grouped
            ? groupedVideos(whereSql, params, orderBy, extraParams, limit, offset)
            : db.prepare(`
                SELECT ${VIDEO_FIELDS}
                ${BASE}${whereSql}
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `).all(...params, ...extraParams, limit, offset);
        res.json({ videos });
    } catch (e) {
        if (e.badRequest) return res.status(400).json({ error: e.message });
        console.error('[ext search]', e);
        res.status(500).json({ error: countOnly ? '動画数取得に失敗しました' : '検索に失敗しました' });
    }
}
exports.videos = (req, res) => respond(req, res, false);
exports.count = (req, res) => respond(req, res, true);

// シリーズ別に集計 (シリーズ一覧用)
//  name: シリーズ名 / count: 動画(ファイル)本数 / avgRating: 評価平均(0は除外) / thumbId: サムネ用動画id
exports.seriesList = (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT e.series AS name,
                   COUNT(f.id) AS count,
                   AVG(CASE WHEN e.rating > 0 THEN e.rating END) AS avg_rating,
                   MAX(CASE WHEN m.thumbnail IS NOT NULL THEN f.id END) AS thumb_id
            FROM ext_video_meta e
            JOIN files f ON f.hash = e.hash
            JOIN metadata m ON m.hash = f.hash
            WHERE e.series IS NOT NULL AND e.series != ''
            GROUP BY e.series
        `).all();

        const series = rows.map(r => ({
            name: r.name,
            count: r.count,
            avgRating: r.avg_rating != null ? Math.round(r.avg_rating * 10) / 10 : null,
            thumbId: r.thumb_id || null
        }));
        res.json(series);
    } catch (e) {
        console.error('[ext series]', e);
        res.status(500).json({ error: e.message });
    }
};

// 公開日(release_date)で年月別に集計 (公開カレンダー用)
exports.releaseCalendar = (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT substr(e.release_date, 1, 7) AS ym, COUNT(*) AS count
            FROM files f
            JOIN ext_video_meta e ON e.hash = f.hash
            WHERE e.release_date IS NOT NULL AND e.release_date != ''
            GROUP BY ym
            ORDER BY ym DESC
        `).all();

        const uncategorized = db.prepare(`
            SELECT COUNT(*) AS c
            FROM files f
            LEFT JOIN ext_video_meta e ON e.hash = f.hash
            WHERE e.release_date IS NULL OR e.release_date = ''
        `).get().c;

        const months = rows
            .filter(r => r.ym && /^\d{4}-\d{2}/.test(r.ym))
            .map(r => ({ year: r.ym.slice(0, 4), month: r.ym.slice(5, 7), count: r.count }));

        res.json({ months, uncategorized });
    } catch (e) {
        console.error('[ext release-calendar]', e);
        res.status(500).json({ error: e.message });
    }
};

// 検索結果の絞り込み候補 (サイドメニュー用)
//   GET /ext/api/search/facets?q=...
//   今の検索条件に合う動画すべてを対象に、ジャンル/タグ/メーカー/出演者/シリーズを数える。
//   件数の多い順に並べ、そのまま検索トークンに使える値(value)と表示名(label)を返す。
//   出演者だけは検索が id 指定なので value=id / label=氏名 と分かれる。
exports.facets = (req, res) => {
    try {
        // 一覧と同じ母集団を数えるため、検索語だけでなく path / sort も同じに扱う
        const { where, params } = conditionsFor(req.query);
        const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';

        const rows = db.prepare(`
            SELECT m.tags AS tags, e.genres AS genres, e.maker AS maker, e.series AS series, e.performers AS performers,
                   ${GROUP_KEY} AS gk
            ${BASE}${whereSql}
        `).all(...params);

        // 品番でまとめているときは、一覧のカードと同じく「まとめた件数」で数える
        const grouped = req.query.group === '1';
        const counts = { genre: new Map(), tag: new Map(), maker: new Map(), performer: new Map(), series: new Map() };
        const seen = new Set();
        const bump = (kind, v, gk) => {
            const s = String(v == null ? '' : v).trim(); if (!s) return;
            if (grouped) { const k = kind + '\n' + s + '\n' + gk; if (seen.has(k)) return; seen.add(k); }
            counts[kind].set(s, (counts[kind].get(s) || 0) + 1);
        };
        rows.forEach(r => {
            splitList(r.genres).forEach(v => bump('genre', v, r.gk));
            splitList(r.tags).forEach(v => bump('tag', v, r.gk));
            splitList(r.performers).forEach(v => bump('performer', v, r.gk));
            bump('maker', r.maker, r.gk);
            bump('series', r.series, r.gk);
        });

        // 出演者は id で数えているので氏名を引く
        const names = new Map();
        const pids = [...counts.performer.keys()].map(v => parseInt(v, 10)).filter(n => !isNaN(n));
        if (pids.length) {
            db.prepare(`SELECT id, name FROM ext_performers WHERE id IN (${pids.map(() => '?').join(',')})`)
                .all(...pids).forEach(p => names.set(String(p.id), p.name));
        }

        const list = (kind) => [...counts[kind]]
            .map(([value, count]) => ({ value, count, label: kind === 'performer' ? (names.get(value) || '') : value }))
            .filter(x => x.label)      // 出演者マスタから消えた id は出さない
            .sort((a, b) => (b.count - a.count) || String(a.label).localeCompare(String(b.label), 'ja'));

        res.json({
            total: grouped ? new Set(rows.map(r => r.gk)).size : rows.length,
            genre: list('genre'),
            tag: list('tag'),
            maker: list('maker'),
            performer: list('performer'),
            series: list('series'),
        });
    } catch (e) {
        if (e.badRequest) return res.status(400).json({ error: e.message });
        console.error('[ext search facets]', e);
        res.status(500).json({ error: e.message });
    }
};

// 一覧の小さな表示 (品番グループの中身・動画ページ右側の一覧) に使う項目
const BRIEF_FIELDS = `
    f.id, f.filename, m.duration, m.last_pos,
    (m.thumbnail IS NOT NULL) AS has_thumbnail, LENGTH(m.thumbnail) AS thumbnail_size,
    e.display_name AS ext_display_name, e.rating AS ext_rating,
    e.release_date AS ext_release_date, e.model_no AS ext_model_no
`;

// GET /ext/api/videos/brief?ids=3,1,2   指定した id の動画を、指定した順で返す
exports.brief = (req, res) => {
    try {
        const ids = String(req.query.ids || '').split(',').map(s => parseInt(s, 10)).filter(n => Number.isInteger(n)).slice(0, 500);
        if (!ids.length) return res.json({ videos: [] });
        const rows = db.prepare(`SELECT ${BRIEF_FIELDS} ${BASE} WHERE f.id IN (${ids.map(() => '?').join(',')})`).all(...ids);
        const byId = new Map(rows.map(r => [r.id, r]));
        res.json({ videos: ids.map(id => byId.get(id)).filter(Boolean) });
    } catch (e) {
        console.error('[ext videos brief]', e);
        res.status(500).json({ error: e.message });
    }
};

// GET /ext/api/video/:id/siblings   動画ページ右側の「同じシリーズの動画」
//  parts: 同じ品番の動画 (ファイル名の自然順)
//  works: 同じシリーズの動画を品番でまとめたもの (公開日の古い順・公開日なしは最後)。group_count はまとめた本数
exports.siblings = (req, res) => {
    try {
        const cur = db.prepare(`SELECT f.id, e.model_no, e.series ${BASE} WHERE f.id = ?`).get(req.params.id);
        if (!cur) return res.status(404).json({ error: '動画が見つかりません' });
        const modelNo = String(cur.model_no || '').trim(), series = String(cur.series || '').trim();

        const parts = modelNo ? db.prepare(`
            SELECT ${BRIEF_FIELDS} ${BASE}
            WHERE e.model_no = ? COLLATE NOCASE
            ORDER BY ext_namekey(f.filename), f.id
        `).all(modelNo) : [];

        const works = series ? db.prepare(`
            WITH s AS (
                SELECT f.id AS id, ${GROUP_KEY} AS gk, ext_namekey(f.filename) AS nk,
                       NULLIF(e.release_date, '') AS rd
                ${BASE}
                WHERE e.series = ? COLLATE NOCASE
            ), g AS (
                SELECT id, COUNT(*) OVER w AS gcount, MIN(rd) OVER w AS grd,
                       ROW_NUMBER() OVER (PARTITION BY gk ORDER BY nk, id) AS rn
                FROM s WINDOW w AS (PARTITION BY gk)
            )
            SELECT ${BRIEF_FIELDS}, g.gcount AS group_count
            FROM g JOIN files f ON f.id = g.id
            JOIN metadata m ON f.hash = m.hash
            LEFT JOIN ext_video_meta e ON e.hash = f.hash
            WHERE g.rn = 1
            ORDER BY g.grd IS NULL, g.grd, ext_namekey(f.filename)
        `).all(series) : [];

        res.json({ modelNo, series, parts, works });
    } catch (e) {
        console.error('[ext video siblings]', e);
        res.status(500).json({ error: e.message });
    }
};
