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
