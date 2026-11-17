// LadyTube: 拡張の API (/ext/api/*) を本体の画面から呼ぶ。失敗したらサーバーの { error } の文を Error にする
// (拡張の api.js の req と同じ。ライブラリの印は api.js が window.fetch に付ける)
async function call(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) {
        let msg = r.status + '';
        try { const t = await r.text(); try { msg = JSON.parse(t).error || t; } catch { msg = t || msg; } } catch { /* 文が読めなければ状態の番号のまま */ }
        throw new Error(msg);
    }
    return r.json();
}
export const extGet = (url) => call(url);
// method は POST / PUT / DELETE。body は JSON にして送る
export const extSend = (method, url, body) => call(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// 本体へ移した拡張のページが使う呼び出し (v3.2.1 までは拡張の api.js の WL.api。名前もそのまま)
const q = encodeURIComponent;
export const extApi = {
    replaceMetadata: (kind, before, after) => extSend('POST', '/ext/api/metadata/replace', { kind, before, after }),
    // 出演者
    performersAll: () => extGet('/ext/api/performers/all'),
    cleanupUnusedPerformers: (dryRun) => extSend('POST', '/ext/api/performers/cleanup-unused', { dryRun }),
    getPerformer: (id) => extGet('/ext/api/performer/' + id),
    updatePerformer: (id, p) => extSend('PUT', '/ext/api/performer/' + id, p),
    performerImageUrl: (id, bust) => '/ext/api/performer/' + id + '/image' + (bust ? '?t=' + bust : ''),
    setPerformerImage: (id, dataUrl) => extSend('POST', '/ext/api/performer/' + id + '/image', { image: dataUrl }),
    performerVideos: (id) => extGet('/ext/api/performer/' + id + '/videos'),
    performerScreenshots: (id, sort, limit) => extGet('/ext/api/performer/' + id + '/screenshots?limit=' + (limit || 8) + (sort ? '&sort=' + sort : '')),
    getPerformerTags: () => extGet('/ext/api/performer-tags'),
    savePerformerTags: (tags) => extSend('PUT', '/ext/api/performer-tags', { tags }),
    // メーカー
    makersList: () => extGet('/ext/api/makers'),
    saveMaker: (m) => extSend('PUT', '/ext/api/maker', m),
    makerImageUrl: (name, bust) => '/ext/api/maker/image?name=' + q(name) + (bust ? '&t=' + bust : ''),
    setMakerImage: (name, dataUrl, view) => extSend('POST', '/ext/api/maker/image', { name, image: dataUrl, view }),
    dmmMakerSearch: (name) => extGet('/ext/api/dmm/makers?name=' + q(name)),
    // タグ
    tagsList: () => extGet('/ext/api/tags'),
    tagThumbUrl: (name, bust) => '/ext/api/tag/thumb?name=' + q(name) + (bust ? '&t=' + bust : ''),
    setTagThumb: (name, dataUrl) => extSend('POST', '/ext/api/tag/thumb', { name, image: dataUrl }),
    deleteTagThumb: (name) => extSend('DELETE', '/ext/api/tag/thumb?name=' + q(name)),
    tagScreenshots: (name, limit) => extGet('/ext/api/tag/screenshots?name=' + q(name) + (limit ? '&limit=' + limit : '')),
    setTagThumbFromScreenshot: (name, screenshotId) => extSend('POST', '/ext/api/tag/thumb/from-screenshot', { name, screenshotId }),
    // ブックマーク
    bmFolders: () => extGet('/ext/api/bookmark/folders'),
    bmCreateFolder: (name) => extSend('POST', '/ext/api/bookmark/folders', { name }),
    bmRenameFolder: (id, name) => extSend('PUT', '/ext/api/bookmark/folders/' + id, { name }),
    bmDeleteFolder: (id) => extSend('DELETE', '/ext/api/bookmark/folders/' + id),
    // スクリーンショット枚数
    ssCounts: (ids) => extGet('/ext/api/screenshots/counts?ids=' + ids.join(',')),
};
