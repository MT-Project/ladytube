// LadyTube: 出演者の関連URL (v3.13.0)。サーバー (routes/performers.js) と本体の画面 (pages/PerformerPage.jsx) で同じものを使う。
//  ・normalizeUrl: 入力を http/https の URL にそろえる (スキームが無ければ https://)。使えないものは ''
//  ・urlKind: URL の種類 (アイコンの名前と説明)。ドメインで決める。アイコンの名前は本体の画面の ExtIcon.jsx の ICONS 表
// 自己チェック: node server/ext/perfurl.mjs

export function normalizeUrl(input) {
    let s = String(input == null ? '' : input).trim();
    if (!s) return '';
    // スキームが無い (x.com/abc や //x.com/abc) ときは https を補う。javascript: などは下で弾く
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^(javascript|data|vbscript|file|about|blob):/i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
    let u;
    try { u = new URL(s); } catch { return ''; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return '';
    return u.href;
}

// [ドメインの末尾, 種類, 説明]。上から見て最初に合ったもの
const KINDS = [
    [['x.com', 'twitter.com'], 'brand-x', 'X'],
    [['instagram.com'], 'instagram', 'Instagram'],
    [['tiktok.com'], 'tiktok', 'TikTok'],
    [['youtube.com', 'youtu.be'], 'youtube', 'YouTube'],
    [['wikipedia.org'], 'book-open', 'Wikipedia'],
    [['ameblo.jp', 'note.com', 'lineblog.me', 'livedoor.jp', 'blog.jp', 'blog.fc2.com', 'hatenablog.com', 'hatenablog.jp', 'seesaa.net', 'exblog.jp', 'jugem.jp'], 'pen-line', 'ブログ'],
];
export function urlKind(href) {
    let host = '';
    try { host = new URL(href).hostname.toLowerCase(); } catch { /* 下の既定 */ }
    for (const [domains, icon, label] of KINDS) {
        if (domains.some(d => host === d || host.endsWith('.' + d))) return { icon, label };
    }
    return { icon: 'globe', label: 'Webサイト' };
}

// 自己チェック (node で直接動かしたときだけ)
if (typeof process !== 'undefined' && process.argv[1] && /perfurl\.mjs$/.test(process.argv[1])) {
    const eq = (a, b) => { if (a !== b) throw new Error(JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
    eq(normalizeUrl('x.com/abc'), 'https://x.com/abc');
    eq(normalizeUrl(' https://twitter.com/abc '), 'https://twitter.com/abc');
    eq(normalizeUrl('http://example.jp'), 'http://example.jp/');
    eq(normalizeUrl('//www.instagram.com/abc/'), 'https://www.instagram.com/abc/');
    eq(normalizeUrl('javascript:alert(1)'), '');
    eq(normalizeUrl('JavaScript:alert(1)'), '');
    eq(normalizeUrl('data:text/html,x'), '');
    eq(normalizeUrl('ftp://example.com/'), '');
    eq(normalizeUrl('abc'), '');
    eq(normalizeUrl(''), '');
    eq(urlKind('https://x.com/abc').icon, 'brand-x');
    eq(urlKind('https://mobile.twitter.com/abc').icon, 'brand-x');
    eq(urlKind('https://www.instagram.com/abc').icon, 'instagram');
    eq(urlKind('https://ja.wikipedia.org/wiki/abc').icon, 'book-open');
    eq(urlKind('https://ameblo.jp/abc').icon, 'pen-line');
    eq(urlKind('https://notx.com/').icon, 'globe');
    eq(urlKind('https://diaz-g.com/model/abc').icon, 'globe');
    console.log('perfurl: ok');
}
