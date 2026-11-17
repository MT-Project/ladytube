// LadyTube: 使用中のライブラリ (サーバーが HTML に埋め込んだ window.WLExtLibrary = { id, name, count })。v3.2.1 までは拡張の api.js。
// main.jsx が最初に読み込み、React が通信を始める前に次のことをしておく:
//  ・同じオリジンへのリクエストすべてに印 X-WLExt-Library を付ける。返事の印が違えば (ほかの端末で切り替えられた)、
//    ホームを開き直す (動画の id はライブラリごとに振られるので、前の画面のまま操作させない。書き込みはサーバーも 409 で拒む)
//  ・画面に戻ったときに、ライブラリが変わっていないか確かめる
//  ・検索履歴 (localStorage の search_history) だけはライブラリごとに分ける (既定のライブラリは今までのキーのまま)
// 拡張と private の通信 (WL.api / WL._rawFetch) も、呼んだ時点の window.fetch を使うので、ここを通る。
import { ExtConfirm } from '../components/ExtDialog';
import { extSend } from '../services/extApi';
import { openExtDialog } from './extDialog';
import { toast } from './toast';

export const currentLibrary = window.WLExtLibrary || null;

// private の画面とやり取りする入れ物 (差し込み口と、本体が渡す関数を置く)。React より先にここで作っておく
window.WLExt = window.WLExt || {};

// 画面全体を覆うお知らせ (切り替え中・切り替わった)
export function libraryOverlay(text) {
    let box = document.querySelector('.wlext-lib-overlay');
    if (!box) {
        box = document.createElement('div');
        box.className = 'wlext-lib-overlay';
        (document.body || document.documentElement).appendChild(box);
    }
    box.textContent = text;
    return box;
}

if (currentLibrary) {
    const LIB = currentLibrary;
    const nativeFetch = window.fetch.bind(window);
    let reloading = false;
    const onChanged = () => {
        if (reloading) return;
        reloading = true;
        libraryOverlay('ライブラリが切り替わりました。読み直しています…');
        setTimeout(() => location.replace('/'), 600);   // 今の URL の id は前のライブラリのもの
    };
    const sameOrigin = (url) => { try { return new URL(url, location.href).origin === location.origin; } catch { return false; } };
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : (input && input.url) || String(input);
        if (!sameOrigin(url)) return nativeFetch(input, init);
        const headers = new Headers((init && init.headers) || (input instanceof Request ? input.headers : undefined));
        headers.set('X-WLExt-Library', LIB.id);
        return nativeFetch(input, Object.assign({}, init, { headers })).then(r => {
            const now = r.headers.get('X-WLExt-Library');
            if (now && now !== LIB.id) onChanged();
            return r;
        });
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') window.fetch('/ext/api/libraries/current').catch(() => { });
    });
    if (LIB.id !== 'default') {
        const KEYS = ['search_history'];
        const P = Storage.prototype, g = P.getItem, s = P.setItem, rm = P.removeItem;
        const k2 = (k) => (KEYS.includes(k) ? k + '@' + LIB.id : k);
        P.getItem = function (k) { return g.call(this, k2(k)); };
        P.setItem = function (k, v) { return s.call(this, k2(k), v); };
        P.removeItem = function (k) { return rm.call(this, k2(k)); };
    }
}

/* ---------- 切り替え ---------- */
// 再起動を待つ。新しいサーバーが応えた時点で utils/library.js がライブラリの違いに気づき、ホームを開き直す
function waitRestart(name) {
    const box = libraryOverlay('「' + name + '」へ切り替えています…');
    const t0 = Date.now();
    (function tick() {
        if (Date.now() - t0 > 60000) {
            box.textContent = '切り替えに時間がかかっています。サーバーのコンソールを確認してから、ページを読み直してください。';
            return;
        }
        fetch('/ext/api/libraries/current').catch(() => { }).finally(() => setTimeout(tick, 800));
    })();
}
// ライブラリを切り替える (確かめてから。ヘッダーのメニューと管理画面の一覧から)
export function switchLibrary(lib) {
    openExtDialog(ExtConfirm, {
        title: 'ライブラリを切り替え', saveLabel: '切り替える',
        body: <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
            <div>{'「' + lib.name + '」に切り替えます。'}</div>
            <div>サーバーを再起動するため、再生中の動画は止まります。ほかの端末で開いている画面も読み直しになります。</div>
        </div>,
        onSave: async (close) => {
            let r;
            try { r = await extSend('POST', '/ext/api/libraries/' + encodeURIComponent(lib.id) + '/switch', {}); }
            catch (e) { toast(e.message, 'error'); return; }
            close();
            if (r.restarting) waitRestart(lib.name);
            else toast('次にサーバーを起動したときに「' + lib.name + '」が開きます（この起動方法では自動で再起動できません）', 'success');
        },
    });
}
