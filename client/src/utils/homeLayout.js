// LadyTube: ホームの並び (v3.8.0)。カルーセルとメニューを出すかと、行の並び・出すか・名前・枚数を、DB の設定 (ライブラリごと) に置く。
// API は server/ext/routes/saved.js の homeGet / homeSave。行を描くのは pages/HomePage.jsx、編集は管理画面の「ホーム画面」(ExtSettingsSections.jsx)。
// 行は「検索語・並び順・枚数」で、組み込みの行はここの HOME_ROWS、保存した検索から足した行は条件の写しを持つ (元の保存した検索を消しても残る)。
// 「もっと見る」の行き先は homeRowQuery の戻り値を savedSearchHref に渡す (ランダムは同じ seed で、ホームと同じ並びの続きを出す)
import { extGet, extSend } from '../services/extApi';

// seed はランダムの行どうしで並びが重ならないよう、5分ごとの数に足す値 (v3.7.0 までのホームと同じく、最新動画はカルーセルと同じ、PICKUP は +1)
export const HOME_ROWS = {
    new: { name: '最新動画（1ヶ月以内）', sort: 'random', seed: 0, about: '更新日が1ヶ月以内の動画をランダムに。無いときは PICKUP を出す' },
    continue: { name: '続きを見る', q: '@play:partial', sort: 'history_desc', about: '視聴途中の動画を、最近再生した順に' },
    recent: { name: '最近再生した動画', q: '', sort: 'history_desc', about: '再生した動画を、最近再生した順に' },
    next: { name: '次のパート', q: '@play:next', sort: 'ext_partplayed_desc', about: '前のパートを見終えた未再生のパートを、前のパートを最近再生した順に' },
    unwatched: { name: '未再生', q: '@play:unwatched', sort: 'random', seed: 2, about: '未再生の動画をランダムに' },
    rated: { name: '高評価', q: '@rating:>=4', sort: 'random', seed: 3, about: '評価4以上の動画をランダムに' },
    pickup: { name: 'PICKUP', q: '', sort: 'random', seed: 1, about: 'すべての動画からランダムに' },
};
export const HOME_COUNTS = [4, 8, 12];

// 保存が無いときは v3.7.0 までのホームと同じ並び。保存に無い組み込みの行は、隠した行として後ろに足す (編集の画面に出すため)
export function normalizeHomeLayout(saved) {
    const base = saved && Array.isArray(saved.rows) ? saved
        : { rows: ['new', 'continue', 'recent'].map(type => ({ type, show: true })) };
    const rows = base.rows.filter(r => r && (r.type === 'saved' || HOME_ROWS[r.type]))
        .map(r => ({ ...r, name: r.name || '', count: r.count || 8, show: r.show !== false }));
    Object.keys(HOME_ROWS).forEach(type => { if (!rows.some(r => r.type === type)) rows.push({ type, show: false, name: '', count: 8 }); });
    return { carousel: base.carousel !== false, menu: base.menu !== false, rows };
}

export const loadHomeLayout = () => extGet('/ext/api/home-layout').then(r => normalizeHomeLayout(r.layout));
export const saveHomeLayout = (layout) => extSend('PUT', '/ext/api/home-layout', { layout }).then(r => normalizeHomeLayout(r.layout));

export const homeRowName = (row) => row.name || (HOME_ROWS[row.type] || {}).name || '';

// 1ヶ月前の日付 (YYYY-MM-DD。本体の検索の >日付 は files.updated_at と比べる)。v3.7.0 までは HomePage.jsx の getOneMonthAgo
function oneMonthAgo() {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const p2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

// 行の検索の条件。n は5分ごとの数 (ランダムの並びは5分間変わらない)、i は表示する行の中の番号 (保存した検索のランダムの seed に使う)
export function homeRowQuery(row, n, i) {
    const b = HOME_ROWS[row.type] || {};
    const saved = row.type === 'saved';
    const sort = (saved ? row.sort : b.sort) || '';
    return {
        name: homeRowName(row),
        q: (row.type === 'new' ? '>' + oneMonthAgo() : saved ? row.q : b.q) || '',
        sort,
        seed: sort === 'random' ? String(n + (b.seed != null ? b.seed : 10 + i)) : '',
        path: (saved && row.path) || '',
        count: row.count || 8,
    };
}
