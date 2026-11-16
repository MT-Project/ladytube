/* =============================================================
   WomanLive 拡張 - ライブラリ名 (拡張の書き方のページの共通ヘッダー nav.js の WL.pageHeader が置く。今は private のジャンル一覧だけ)
   ・ロゴの右に使用中のライブラリ名。押すと一覧から切り替え (2つ以上あるときだけ出す)
   本体の画面のライブラリ名・管理画面の項目は本体 (client/src/components/ExtLibrary.jsx。v3.2.1 まではここ)。
   private が使う部品を写すときに一緒に片付ける。仕組みは server/ext/library.js。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;
    const LIB = WL.library;
    if (!LIB) return;

    /* ---------- 切り替え ---------- */
    function overlay(text) {
        let box = document.querySelector('.wlext-lib-overlay');
        if (!box) { box = h('div', { class: 'wlext-lib-overlay' }); document.body.appendChild(box); }
        box.textContent = text;
        return box;
    }

    // 再起動を待つ。新しいサーバーが応えた時点で本体の utils/library.js がライブラリの違いに気づき、ホームを開き直す。
    function waitRestart(name) {
        const box = overlay('「' + name + '」へ切り替えています…');
        const t0 = Date.now();
        (function tick() {
            if (Date.now() - t0 > 60000) {
                box.textContent = '切り替えに時間がかかっています。サーバーのコンソールを確認してから、ページを読み直してください。';
                return;
            }
            WL._rawFetch('/ext/api/libraries/current').catch(() => { }).finally(() => setTimeout(tick, 800));
        })();
    }

    WL.switchLibrary = function (lib) {
        const body = h('div', { style: { fontSize: '0.9rem', lineHeight: '1.7' } }, [
            h('div', null, '「' + lib.name + '」に切り替えます。'),
            h('div', null, 'サーバーを再起動するため、再生中の動画は止まります。ほかの端末で開いている画面も読み直しになります。'),
        ]);
        WL.dialog('ライブラリを切り替え', body, {
            saveLabel: '切り替える',
            onSave: async (close) => {
                let r;
                try { r = await WL.api.switchLibrary(lib.id); }
                catch (e) { WL.toast(e.message, 'error'); return; }
                close();
                if (r.restarting) waitRestart(lib.name);
                else WL.toast('次にサーバーを起動したときに「' + lib.name + '」が開きます（この起動方法では自動で再起動できません）', 'success');
            }
        });
    };

    /* ---------- ヘッダー: ライブラリ名 + 切り替えメニュー ---------- */
    let menuEl = null, backdrop = null;
    function closeMenu() {
        if (menuEl) { menuEl.remove(); menuEl = null; }
        if (backdrop) { backdrop.remove(); backdrop = null; }
    }
    async function openMenu(anchor) {
        closeMenu();
        backdrop = h('div', { class: 'wlext-navmenu-backdrop', onClick: closeMenu });
        menuEl = h('div', { class: 'wlext-navmenu wlext-lib-menu' }, h('div', { class: 'wlext-navmenu-item wlext-lib-menu-loading' }, '読み込み中…'));
        const rc = anchor.getBoundingClientRect();
        Object.assign(menuEl.style, { top: Math.round(rc.bottom + 6) + 'px', left: Math.round(Math.max(8, rc.left)) + 'px' });
        document.body.appendChild(backdrop);
        document.body.appendChild(menuEl);

        let data;
        try { data = await WL.api.libraries(); }
        catch (e) { closeMenu(); WL.toast('読み込みに失敗: ' + e.message, 'error'); return; }
        if (!menuEl) return;
        const menu = menuEl;
        menu.innerHTML = '';
        data.libraries.forEach(l => {
            const item = h('div', { class: 'wlext-navmenu-item' + (l.active ? ' wlext-lib-current' : '') }, [
                WL.icon(l.active ? 'check' : 'database', 18),
                h('span', { class: 'wlext-lib-menu-name' }, l.name),
                h('span', { class: 'wlext-lib-menu-count' }, l.videos != null ? l.videos + '本' : ''),
            ]);
            item.addEventListener('click', () => {
                if (l.active) { closeMenu(); return; }
                if (!data.local) { WL.toast('切り替えはサーバーを動かしている PC からのみ行えます', 'error'); return; }
                closeMenu();
                WL.switchLibrary(l);
            });
            menu.appendChild(item);
        });
        menu.appendChild(h('div', { class: 'wlext-navmenu-sep' }));
        const manage = h('div', { class: 'wlext-navmenu-item' }, [WL.icon('settings', 18), h('span', null, 'ライブラリの管理')]);
        manage.addEventListener('click', () => {
            closeMenu();
            try { sessionStorage.setItem('wlext_goto_library', '1'); } catch (e) { }
            WL.navigate('/settings');
        });
        menu.appendChild(manage);
        // 画面の右にはみ出したら寄せる
        const mr = menu.getBoundingClientRect();
        if (mr.right > window.innerWidth - 8) menu.style.left = Math.max(8, window.innerWidth - 8 - mr.width) + 'px';
    }

    // ロゴの右のライブラリ名。置き場所は本体のヘッダー (Navbar.jsx の ExtSlot from="libraryPill") と
    // 拡張のページの共通ヘッダー (nav.js の WL.pageHeader) が決める (v3.1.15 まではここが nav a[href="/"] を探して足していた)
    WL.libraryPill = function () {
        if (LIB.count < 2) return null;   // ライブラリが1つ(既定のみ)なら出さない
        const pill = h('button', { class: 'wlext-libpill', type: 'button', title: 'ライブラリ: ' + LIB.name + '（クリックで切り替え）' }, [
            WL.icon('database', 14), h('span', { class: 'wlext-libpill-name' }, LIB.name), WL.icon('chevron-down', 14)
        ]);
        pill.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); if (menuEl) closeMenu(); else openMenu(pill); });
        return pill;
    };

})();
