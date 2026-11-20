// =============================================================
// ファイル名から品番(model_no)を設定する (v3.11.0)
//  規則: AAA-BBB.ZZZ / AAA-BBB_CCC.ZZZ → 品番 AAA-BBB
//        AAA-BBBD.ZZZ / AAA-BBBD_CCC.ZZZ → 品番 AAA-BBBD
//        (AAA=英字列 / BBB,CCC=数字列 / D=英字1文字 / ZZZ=拡張子)
//  スキャン完了時に未設定分を自動で埋め (index.js の /api/scan のフック)、
//  一括操作とリスト表示の⋮の「品番をファイル名から設定」(ExtVideoMenu.jsx) からも選んだ動画に入れられる。
//  入っている品番は上書きしない。
// =============================================================
const path = require('path');
// db は遅延 require (このファイル単体で規則の自己チェックを走らせられるようにする)
const db = () => require('../db');

// 拡張子を除いた本体が「英字-数字」のときだけ品番とみなす。
// 数字のうしろの英字1文字(分割ディスクの A/B/C など)は品番の一部として残す
// (例: DANDY-681A.mp4 → DANDY-681A)。末尾の _数字 はファイル分割の連番なので落とす。
// 全体一致にしているので "AAA-BBB-CCC.mp4" は対象外。
const RE = /^([A-Za-z]+)-(\d+)([A-Za-z]?)(?:_\d+)?$/;

// 上の規則に合わないときに試す、配信サイトごとの品番/ID の形。
// ファイル名のどこかにこの形があれば拾う (上から順に試す)。どれも形を絞ってあるので、
// 普通の名前 (my-holiday-video など) は拾わない。
//   FC2         FC2-PPV-1234567 / FC2PPV_1234567 / FC2-1234567 → FC2-1234567
//   HEYZO       heyzo-1234 → HEYZO-1234
//   HeyDouga    heydouga-4037-123 → HEYDOUGA-4037-123
//   KIN8        kin8-1234 → KIN8-1234
//   MYWIFE      mywife-1234 → MYWIFE-1234
//   C0930等     h0930-ori1234 → H0930-ori1234
//   無修正(日付) 010120_001 (1Pondo・CaribbeancomPR・PACOPACOMAMA・MURAMURA) / 010120_01 (10musume)
//               010120-001 (Caribbeancom)。区切りはファイル名のまま残す (サイトごとに違うため)
//   Tokyo-Hot   n1234 / k1234 など。名前に tokyo-hot があるか、ファイル名がその ID だけのとき
//   MGS         300MIUM-123 / 259LUXU-1234 (数字で始まる素人系の品番)
//   通常の品番   ABC-123 タイトル.mp4 のように、品番のうしろに空白とタイトルが続くもの
const FORMATS = [
    (b) => { const m = /(?:^|[^a-z0-9])FC2[-_ ]?(?:PPV[-_ ]?)?(\d{5,8})(?![0-9])/i.exec(b); return m && 'FC2-' + m[1]; },
    (b) => { const m = /(?:^|[^a-z0-9])HEYZO[-_ ]?(\d{3,5})(?![0-9])/i.exec(b); return m && 'HEYZO-' + m[1]; },
    (b) => { const m = /(?:^|[^a-z0-9])HEYDOUGA[-_ ]?(\d{4})[-_]([a-z]*\d+)(?![0-9])/i.exec(b); return m && 'HEYDOUGA-' + m[1] + '-' + m[2]; },
    (b) => { const m = /(?:^|[^a-z0-9])KIN8(?:TENGOKU)?[-_ ]?(\d{3,5})(?![0-9])/i.exec(b); return m && 'KIN8-' + m[1]; },
    (b) => { const m = /(?:^|[^a-z0-9])MYWIFE[-_ ]?(?:NO\.?\s*)?(\d{3,5})(?![0-9])/i.exec(b); return m && 'MYWIFE-' + m[1]; },
    (b) => { const m = /(?:^|[^a-z0-9])(C0930|H0930|H4610)[-_ ]([a-z]+\d+)(?![0-9])/i.exec(b); return m && m[1].toUpperCase() + '-' + m[2].toLowerCase(); },
    (b) => {
        // MMDDYY + 区切り + 連番。先頭6桁が月日として成り立つものだけ (ただの数字の並びを拾わない)
        const m = /(?:^|[^0-9])((0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{2})([-_])(\d{2,3})(?![0-9])/.exec(b);
        return m && m[1] + m[4] + m[5];
    },
    (b) => {
        const m = /(?:^|[^a-z0-9])(n|k|kb|cz|gedo|se)(\d{3,4})(?![0-9])/i.exec(b);
        if (!m) return null;
        const id = (m[1] + m[2]).toLowerCase();
        return (/tokyo[-_ ]?hot/i.test(b) || b.trim().toLowerCase() === id) ? id : null;
    },
    (b) => { const m = /^(\d{3,4}[A-Za-z]{2,8})-(\d{3,5})(?:_\d+)?(?:\s.*)?$/.exec(b.trim()); return m && (m[1] + '-' + m[2]).toUpperCase(); },
    (b) => { const m = /^([A-Za-z]+)-(\d+)([A-Za-z]?)\s+\S/.exec(b.trim()); return m && m[1] + '-' + m[2] + m[3]; },
];

const SITE_FORMATS = 6;   // FORMATS の先頭から、サイト名で始まる形の数

function parseModelNo(filename) {
    const base = path.parse(String(filename || '')).name;
    // サイト名で始まる形 (FC2・HEYZO など先頭6つ) は、heyzo-1234 のように上の規則にも合ってしまうので先に見て表記をそろえる
    for (const f of FORMATS.slice(0, SITE_FORMATS)) { const no = f(base); if (no) return no; }
    const m = RE.exec(base.trim());
    if (m) return m[1] + '-' + m[2] + m[3];
    for (const f of FORMATS.slice(SITE_FORMATS)) { const no = f(base); if (no) return no; }
    return null;
}

// rows: [{ filename, hash, model_no }] を受けて未設定のものだけ埋める。
// 既に品番が入っている動画は触らない(手で直した値を上書きしないため)。
function fill(rows) {
    const stmt = db().prepare(`
        INSERT INTO ext_video_meta (hash, model_no, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(hash) DO UPDATE SET model_no = excluded.model_no, updated_at = CURRENT_TIMESTAMP
    `);
    // ext_video_meta は hash がキーなので、同じ内容の重複ファイルは1件として扱う。
    // 重複のうち1つでも規則に合うファイル名があれば、それを品番に使う。
    const byHash = new Map();
    rows.forEach(r => {
        if (!r.hash) return;
        if (!byHash.has(r.hash)) byHash.set(r.hash, []);
        byHash.get(r.hash).push(r);
    });

    let set = 0, kept = 0, nomatch = 0;
    db().transaction(() => {
        byHash.forEach((group, hash) => {
            if (group.some(r => r.model_no && String(r.model_no).trim())) { kept++; return; }
            const no = group.map(r => parseModelNo(r.filename)).find(Boolean);
            if (!no) { nomatch++; return; }
            stmt.run(hash, no);
            set++;
        });
    })();
    return { set, kept, nomatch };
}

// スキャン後の自動設定: 品番が未設定の動画すべてを対象にする。
function fillAllMissing() {
    const rows = db().prepare(`
        SELECT f.filename, f.hash, e.model_no
        FROM files f
        LEFT JOIN ext_video_meta e ON e.hash = f.hash
        WHERE e.model_no IS NULL OR TRIM(e.model_no) = ''
    `).all();
    return fill(rows);
}

// 一括操作のメニューから: 選んだ動画だけを対象にする。
function fillByIds(ids) {
    const list = (ids || []).map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    if (!list.length) return { set: 0, kept: 0, nomatch: 0 };
    const rows = db().prepare(`
        SELECT f.filename, f.hash, e.model_no
        FROM files f
        LEFT JOIN ext_video_meta e ON e.hash = f.hash
        WHERE f.id IN (${list.map(() => '?').join(',')})
    `).all(...list);
    return fill(rows);
}

module.exports = { parseModelNo, fillAllMissing, fillByIds };

// 規則の自己チェック: node server/ext/modelno.js で実行 (DBには触らない)
if (require.main === module) {
    const assert = require('assert');
    const eq = (name, want) => assert.strictEqual(parseModelNo(name), want, name);
    eq('ABC-123.mp4', 'ABC-123');
    eq('ABC-123_456.mp4', 'ABC-123');
    eq('abc-007_1.mkv', 'abc-007');
    eq('ABC-123', 'ABC-123');            // 拡張子なしでも本体が規則どおりなら拾う
    // 数字のうしろの英字1文字は品番の一部として残す (分割ディスクの A/B/C など)
    eq('DANDY-681A.mp4', 'DANDY-681A');
    eq('DANDYA-043B.mp4', 'DANDYA-043B'); // 英字列の末尾が英字でも、ハイフンで切れるので影響なし
    eq('abc-007a_2.mkv', 'abc-007a');     // 英字1文字 + 分割連番
    eq('ABC-123AB.mp4', null);            // 英字は1文字まで
    eq('ABC-123_456_789.mp4', null);     // 数字列は1つだけ
    eq('ABC-123-456.mp4', null);
    eq('ABC-123 (1).mp4', 'ABC-123');    // 品番のうしろに空白と何かが続く形は品番だけ拾う
    eq('ABC123.mp4', null);
    // 品番 + タイトル
    eq('ABC-080 タイトル 名前.mp4', 'ABC-080');
    eq('XYZ-664 タイトル 02 名前 編集版.mp4', 'XYZ-664');
    eq('ABC-080タイトル.mp4', null);     // 空白で区切られていなければ拾わない
    // FC2
    eq('FC2-PPV-1234567.mp4', 'FC2-1234567');
    eq('FC2PPV-1234567.mp4', 'FC2-1234567');
    eq('fc2-ppv_1234567_1.mp4', 'FC2-1234567');
    eq('FC2-1234567.mp4', 'FC2-1234567');
    eq('[FHD] FC2-PPV-1234567 タイトル.mp4', 'FC2-1234567');
    // 無修正系
    eq('HEYZO-1234.mp4', 'HEYZO-1234');
    eq('heyzo_hd_1234_full.mp4', null);   // 番号の位置が違う形は拾わない
    eq('heydouga-4037-123.mp4', 'HEYDOUGA-4037-123');
    eq('kin8-1234.mp4', 'KIN8-1234');
    eq('mywife-1234.mp4', 'MYWIFE-1234');
    eq('h0930-ori1234.mp4', 'H0930-ori1234');
    eq('C0930-KI123456.mp4', 'C0930-ki123456');
    eq('010120_001-1pon.mp4', '010120_001');
    eq('1pondo_010120_001.mp4', '010120_001');
    eq('carib-010120-001.mp4', '010120-001');
    eq('010120_01-10mu.mp4', '010120_01');
    eq('20230101_001.mp4', null);          // 8桁の日付は MMDDYY ではない
    eq('139999_001.mp4', null);            // 13月は無い
    eq('Tokyo-Hot n1234.mp4', 'n1234');
    eq('n1234.mp4', 'n1234');
    eq('k1234 something.mp4', null);       // tokyo-hot の手がかりが無い
    // MGS (数字で始まる品番)
    eq('300MIUM-123.mp4', '300MIUM-123');
    eq('259luxu-1234_2.mp4', '259LUXU-1234');
    eq('550ENE-001.mp4', '550ENE-001');
    // 拾わない
    eq('my-holiday-video.mp4', null);
    eq('SFJ5-025.mp4', null);
    eq('IMG_20230101_120000.mp4', null);
    eq('AB1C-123.mp4', null);            // AAA は英字のみ
    eq('123-456.mp4', null);
    eq('ABC-.mp4', null);
    eq('', null);
    console.log('modelno: OK');
}
