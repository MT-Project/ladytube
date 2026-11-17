// =============================================================
// HTML 注入ミドルウェア
// 既存の client/dist/index.html を「ディスク上は変更せず」、配信時に
// 使用中のライブラリ (window.WLExtLibrary) を <head> へ差し込みます。
// (v3.2.1 までは拡張の画面の <script>/<link> も差し込んでいた。今は本体の client/src にある)
// /watch/:id や /performer/:id など、SPA のページ遷移すべてに適用されます。
// =============================================================
const fs = require('fs');
const path = require('path');
const library = require('./library');

const DIST_INDEX = path.join(__dirname, '..', '..', 'client', 'dist', 'index.html');

module.exports = function createInject() {
    return function injectMiddleware(req, res, next) {
        if (req.method !== 'GET') return next();

        const p = req.path;
        // API・拡張アセットは対象外
        if (p.startsWith('/api') || p.startsWith('/ext/')) return next();
        // 拡張子を持つパス(=静的ファイル)は対象外
        const lastSeg = p.substring(p.lastIndexOf('/') + 1);
        if (lastSeg.includes('.')) return next();
        // HTML を要求していなければ対象外
        const accept = req.headers.accept || '';
        if (!accept.includes('text/html')) return next();

        try {
            let html = fs.readFileSync(DIST_INDEX, 'utf8');
            if (html.includes('</head>')) {
                // 使用中のライブラリ (名前変更などで変わるので配信のたびに作る)。
                // 本体の client/src/utils/library.jsx がこれを見て、全リクエストに「どのライブラリの画面か」を付ける。
                const lib = JSON.stringify(library.clientInfo()).replace(/</g, '\\u003c');
                html = html.replace('</head>', `
  <script>window.WLExtLibrary = ${lib};</script>
</head>`);
            }
            res.set('Content-Type', 'text/html; charset=utf-8');
            res.set('Cache-Control', 'no-cache');
            return res.send(html);
        } catch (e) {
            // dist が無い等の場合は元の処理に委ねる
            return next();
        }
    };
};
