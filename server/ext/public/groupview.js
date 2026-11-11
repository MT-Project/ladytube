/* =============================================================
   WomanLive 拡張 - 同じ品番の動画をまとめて表示 (検索画面)
   トグルと「N本」バッジは本体の画面 (client/src/pages/SearchPage.jsx・components/VideoList.jsx) が出す。
   まとめる処理はサーバー (search.js の groupedVideos)。ここに残すのは次の2つ:
   ・WL.openGroupMembers(id): 「N本」を押したときの、まとめた動画の一覧 (選んで再生できる)
   ・WL.videoRow(v, opts): 一覧の1行 (動画ページ右側の一覧 standard.js と共用)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

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

    WL.openGroupMembers = async (id) => {
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
    };
})();
