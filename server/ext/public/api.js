/* =============================================================
   WomanLive 拡張 - API クライアント
   ============================================================= */
(function () {
    'use strict';
    window.WLExt = window.WLExt || {};
    const WL = window.WLExt;

    // ---- ライブラリ (サーバーが HTML に埋め込んだ「この画面のライブラリ」) ----
    // 同じオリジンへのリクエストすべてに印を付け、サーバーの使用中ライブラリと食い違ったら読み直す。
    // 動画の id はライブラリごとに振られるので、切り替え前の画面のまま操作させない。
    // (書き込みはサーバー側でも拒否する → routes/library.js)
    const LIB = window.WLExtLibrary || null;
    WL.library = LIB;
    if (LIB) {
        const nativeFetch = window.fetch.bind(window);
        let reloading = false;
        WL.onLibraryChanged = function () {
            if (reloading) return;
            reloading = true;
            const box = document.createElement('div');
            box.className = 'wlext-lib-overlay';
            box.textContent = 'ライブラリが切り替わりました。読み直しています…';
            (document.body || document.documentElement).appendChild(box);
            setTimeout(() => location.replace('/'), 600);   // 今の URL の id は前のライブラリのもの
        };
        const sameOrigin = (url) => { try { return new URL(url, location.href).origin === location.origin; } catch (e) { return false; } };
        window.fetch = function (input, init) {
            const url = typeof input === 'string' ? input : (input && input.url) || String(input);
            if (!sameOrigin(url)) return nativeFetch(input, init);
            const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
            headers.set('X-WLExt-Library', LIB.id);
            return nativeFetch(input, Object.assign({}, init, { headers })).then(r => {
                const now = r.headers.get('X-WLExt-Library');
                if (now && now !== LIB.id) WL.onLibraryChanged();
                return r;
            });
        };
        // 別の端末で切り替えられたとき: 画面に戻ったら確かめる
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') window.fetch('/ext/api/libraries/current').catch(() => { });
        });
        // 検索履歴だけはライブラリ別にする (既定ライブラリは今までのキーのまま)
        if (LIB.id !== 'default') {
            const KEYS = ['search_history'];
            const P = Storage.prototype, g = P.getItem, s = P.setItem, rm = P.removeItem;
            const k2 = (k) => (KEYS.includes(k) ? k + '@' + LIB.id : k);
            P.getItem = function (k) { return g.call(this, k2(k)); };
            P.setItem = function (k, v) { return s.call(this, k2(k), v); };
            P.removeItem = function (k) { return rm.call(this, k2(k)); };
        }
    }

    // 拡張のフックを通さない素の fetch を保持 (core.js が window.fetch を差し替えるため)
    // ライブラリの印付けは通す (上で差し替えたもの)。
    const rawFetch = window.fetch.bind(window);
    WL._rawFetch = rawFetch;

    async function req(url, opts) {
        const r = await rawFetch(url, opts);
        if (!r.ok) {
            let msg = r.status + '';
            try { const t = await r.text(); try { msg = JSON.parse(t).error || t; } catch (e) { msg = t || msg; } } catch (e) { }
            const err = new Error(msg); err.status = r.status; throw err;
        }
        const ct = r.headers.get('content-type') || '';
        return ct.includes('json') ? r.json() : r.text();
    }
    const jsonOpts = (method, body) => ({
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });

    WL.api = {
        // ライブラリ
        libraries: () => req('/ext/api/libraries'),
        createLibrary: (name, mode) => req('/ext/api/libraries', jsonOpts('POST', { name, mode })),
        importLibrary: (path, name) => req('/ext/api/libraries/import', jsonOpts('POST', { path, name })),
        renameLibrary: (id, name) => req('/ext/api/libraries/' + encodeURIComponent(id), jsonOpts('PUT', { name })),
        switchLibrary: (id) => req('/ext/api/libraries/' + encodeURIComponent(id) + '/switch', jsonOpts('POST', {})),
        deleteLibrary: (id) => req('/ext/api/libraries/' + encodeURIComponent(id), { method: 'DELETE' }),

        // DMM(FANZA) 商品検索
        dmmSearch: (id) => req('/ext/api/dmm/search?id=' + encodeURIComponent(id)),
        dmmApply: (id, item) => req('/ext/api/dmm/apply', jsonOpts('POST', { id, item })),
        dmmMakerSearch: (name) => req('/ext/api/dmm/makers?name=' + encodeURIComponent(name)),

        // 動画メタ
        getMeta: (id) => req('/ext/api/video/' + id + '/meta'),

        // 一覧ページからの一括削除 (targets は performer なら id、それ以外は名前)
        deleteMetadataValues: (kind, targets) => req('/ext/api/metadata/delete', jsonOpts('POST', { kind, targets })),

        // メーカー情報 (private のメーカー情報の取得も使う)
        saveMaker: (m) => req('/ext/api/maker', jsonOpts('PUT', m)),
        setMakerImage: (name, dataUrl, view) => req('/ext/api/maker/image', jsonOpts('POST', { name, image: dataUrl, view })),

        // 出演者 (private の出演者情報の取得も使う)
        getPerformer: (id) => req('/ext/api/performer/' + id),
        updatePerformer: (id, p) => req('/ext/api/performer/' + id, jsonOpts('PUT', p)),
        setPerformerImage: (id, dataUrl) => req('/ext/api/performer/' + id + '/image', jsonOpts('POST', { image: dataUrl })),

        // 動画タグ プリセット (本体の /api/tags を利用。実タグのみ。# 見出しは含めない)
        getVideoPresetTags: () => req('/api/tags').then(a => Array.isArray(a) ? a.map(t => (t && t.name) || t).filter(Boolean) : []),
        saveVideoPresetTags: (tags) => req('/api/tags/bulk', jsonOpts('PUT', { tags })),
        // 動画タグ プリセットのグループレイアウト (# 見出し入り。ext 側に保持)
        getVideoTagLayout: () => req('/ext/api/video-tag-layout'),
        saveVideoTagLayout: (layout) => req('/ext/api/video-tag-layout', jsonOpts('PUT', { layout })),
    };
})();
