// ファイル名のルール (v3.12.0)。`{品番} {タイトル}` のような書き方から、拡張子を除いたファイル名を作る。
// サーバー (server/ext/rename.js) と画面 (client/src/utils/fileRule.js。FANZA の確認画面の「今 → 新」) で同じものを使う。
//  ・今のファイル名の末尾のパート番号 (_N) は、いつも最後に付ける (書き忘れてもパートどうしが同じ名前にならない)
//  ・タイトルは末尾の _N を外し、60文字で切る。出演者は3人まで、空白区切り。公開日は YYYY-MM-DD
//  ・使えない文字 (\ / : * ? " < > |) は全角に置き換え、全体は150文字で切る (パスが長いとほかのアプリで開けないことがある)
//  ・知らない {…} はそのまま残す (書き間違いが確認画面で見える)
export const DEFAULT_RULE = '{品番} {タイトル}';
export const RULE_FIELDS = ['品番', 'タイトル', '出演者', 'メーカー', 'レーベル', 'シリーズ', '公開日'];

const TITLE_MAX = 60, STEM_MAX = 150, PERFORMERS_MAX = 3;
const FULL = { '\\': '＼', '/': '／', ':': '：', '*': '＊', '?': '？', '"': '＂', '<': '＜', '>': '＞', '|': '｜' };
const cut = (s, n) => Array.from(s).slice(0, n).join('');   // サロゲートペアを割らない

// ファイル名に使えない文字を全角に、制御文字を空白にし、空白をまとめ、先頭と末尾の空白と末尾の点を落とす
export function cleanStem(s) {
    return String(s == null ? '' : s)
        .replace(/[\\/:*?"<>|]/g, c => FULL[c])
        .replace(/[\u0000-\u001f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[. ]+$/, '');
}

// 末尾のパート番号 (_N)。品番そのものが _N で終わる形 (無修正の日付形 010120_001 など) は品番の一部なので外さない
export function partSuffix(stem, modelNo) {
    const m = /_\d+$/.exec(String(stem || ''));
    if (!m) return '';
    const mn = String(modelNo || '').toLowerCase();
    return mn && mn.endsWith(m[0].toLowerCase()) ? '' : m[0];
}

// rule: ルールの文字列 / v: { model_no, title, performers: [名前], maker, label, series, release_date } / stem: 今の名前 (拡張子なし)
// 戻りは新しい名前 (拡張子なし)。品番もタイトルも空などで何も残らなければ ''
export function ruleStem(rule, v, stem) {
    const val = (k) => {
        switch (k) {
            case '品番': return v.model_no;
            case 'タイトル': return cut(String(v.title || '').replace(/_\d+$/, '').trim(), TITLE_MAX);
            case '出演者': return (v.performers || []).slice(0, PERFORMERS_MAX).join(' ');
            case 'メーカー': return v.maker;
            case 'レーベル': return v.label;
            case 'シリーズ': return v.series;
            case '公開日': return String(v.release_date || '').slice(0, 10);
            default: return null;
        }
    };
    const body = cleanStem(cut(cleanStem(String(rule || DEFAULT_RULE).replace(/\{([^{}]+)\}/g, (m, k) => {
        const x = val(k.trim());
        return x == null ? m : String(x);
    })), STEM_MAX));
    return body ? body + partSuffix(stem, v.model_no) : '';
}
