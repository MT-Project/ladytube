/* =============================================================
   WomanLive 拡張 - 同じ品番の動画をまとめて表示 (検索画面)
   ・表示形式ボタンの並びにトグルを置く (既定はまとめる)
   ・まとめたカードのサムネ左上に「N本」バッジ。押すと中の動画を一覧で出し、選んで再生できる
   まとめる処理はサーバー (search.js の groupedSearch)。カードを押したときは代表(先頭の動画)を再生する。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    // トグル: サムネイル切替(covermode.js)と同じく本家の表示形式ボタンのクラスを借りる
    function ensureToggle() {
        const group = document.querySelector('[class*="statusBar_"] [class*="controlGroup_"]:not(.wlext-thumbmode):not(.wlext-groupmode)');
        if (!group) return;
        const sample = group.querySelector('[class*="viewModeButton_"]');
        const btnCls = sample ? sample.className.split(/\s+/).filter(c => c && c !== 'active').join(' ') : '';
        let tg = group.parentElement.querySelector('.wlext-groupmode');
        if (!tg) {
            const btn = h('div', {
                class: btnCls, onClick: () => {
                    WL.setGroupByModel(!WL.groupByModel());
                    ensure();
                    window.dispatchEvent(new Event('library-updated'));   // 本家に一覧と件数を取り直させる
                }
            }, WL.icon('layers', 20));
            tg = h('div', { class: group.className + ' wlext-groupmode' }, btn);
        }
        // サムネイル切替の右 (無ければ表示形式ボタンの右)
        const after = group.parentElement.querySelector('.wlext-thumbmode') || group;
        if (after.nextElementSibling !== tg) after.insertAdjacentElement('afterend', tg);
        const on = WL.groupByModel();
        const btn = tg.firstElementChild;
        btn.classList.toggle('active', on);
        btn.title = on ? '同じ品番の動画をまとめて表示中（押すと1本ずつ表示）' : '同じ品番の動画をまとめて表示';
    }

    function ensureBadges() {
        const on = WL.groupByModel();
        document.querySelectorAll('#root a[href^="/watch/"]').forEach(card => {
            const m = (card.getAttribute('href') || '').match(/\/watch\/(\d+)/); if (!m) return;
            const thumb = card.querySelector('[class*="thumbnailWrapper_"]'); if (!thumb) return;
            const ids = on ? WL._groupIds[m[1]] : null;
            let badge = thumb.querySelector('.wlext-group-badge');
            if (!ids || ids.length < 2) { if (badge) badge.remove(); return; }
            if (!badge) {
                badge = h('div', { class: 'wlext-group-badge', title: 'まとめた動画を一覧で表示' });
                // カード(リンク)の遷移より先に止める
                badge.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); openMembers(Number(badge.dataset.id)); });
                thumb.appendChild(badge);
            }
            if (getComputedStyle(thumb).position === 'static') thumb.style.position = 'relative';
            if (badge.dataset.sig !== m[1] + ':' + ids.length) {
                badge.dataset.sig = m[1] + ':' + ids.length;
                badge.dataset.id = m[1];
                badge.innerHTML = '';
                badge.appendChild(WL.icon('layers', 12));
                badge.appendChild(h('span', null, ids.length + '本'));
            }
        });
    }

    // 一覧の1行 (動画ページ右側の一覧 standard.js と共用)
    WL.videoRow = (v, opts = {}) => {
        const useDisp = WL.useDisplayName() && v.ext_display_name;
        let name = useDisp ? v.ext_display_name : String(v.filename || '').replace(/\.[^.\\/]+$/, '');
        if (opts.stripPart) name = name.replace(/_\d+$/, '');
        const img = h('img', { loading: 'lazy', alt: '' });
        if (v.has_thumbnail) img.src = WL.api.thumbUrl(v);
        const thumb = h('div', { class: 'wlext-vrow-thumb' }, [img, h('span', { class: 'wlext-vrow-dur' }, WL.formatDuration(v.duration))]);
        if (v.last_pos > 0 && v.duration > 0) thumb.appendChild(h('div', { class: 'wlext-vrow-prog', style: { width: Math.min(100, v.last_pos / v.duration * 100) + '%' } }));
        if (opts.count > 1) thumb.appendChild(h('span', { class: 'wlext-vrow-count' }, [WL.icon('layers', 11), h('span', null, opts.count + '本')]));
        const sub = [];
        if (v.ext_rating > 0) sub.push(WL.starsEl(v.ext_rating));
        if (opts.date && v.ext_release_date) sub.push(h('span', null, WL.fmtDate(v.ext_release_date)));
        if (opts.note) sub.push(h('span', { class: 'wlext-vrow-note' }, opts.note));
        return WL.navA('/watch/' + v.id, { class: 'wlext-vrow' + (opts.current ? ' current' : ''), title: name }, [
            thumb,
            h('div', { class: 'wlext-vrow-info' }, [h('div', { class: 'wlext-vrow-name' }, name), h('div', { class: 'wlext-vrow-sub' }, sub)]),
        ]);
    };

    async function openMembers(id) {
        const ids = WL.groupMembers(id);
        const list = h('div', { class: 'wlext-vrow-list' }, h('div', { class: 'wlext-facets-msg' }, '読み込み中...'));
        const close = WL.dialog('まとめた動画（' + ids.length + '本）', list);
        try {
            const r = await WL.api.videosBrief(ids);
            list.innerHTML = '';
            r.videos.forEach(v => {
                const row = WL.videoRow(v);
                row.addEventListener('click', () => close());
                list.appendChild(row);
            });
        } catch (e) { list.textContent = '読み込みに失敗しました: ' + e.message; }
    }

    function ensure() {
        if (location.pathname !== '/search') return;
        ensureToggle();
        ensureBadges();
    }
    WL.onEnsure(ensure);
})();
