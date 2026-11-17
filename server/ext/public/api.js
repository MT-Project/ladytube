/* =============================================================
   WomanLive 拡張 - API クライアント (拡張と private が使う WL.api / WL._rawFetch)
   ============================================================= */
(function () {
    'use strict';
    window.WLExt = window.WLExt || {};
    const WL = window.WLExt;

    // 使用中のライブラリ (サーバーが HTML に埋め込んだもの)。通信への印付けと、切り替わったときの読み直しは
    // 本体の client/src/utils/library.js が window.fetch を包んで行う (v3.2.1 まではここ)。
    WL.library = window.WLExtLibrary || null;

    // 拡張と private の通信。呼んだ時点の window.fetch (本体がライブラリの印を付けるもの) を使う
    const rawFetch = (...a) => window.fetch(...a);
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
        // DMM(FANZA) メーカー検索 (private のメーカー情報の取得)
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
    };
})();
