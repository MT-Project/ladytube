/* =============================================================
   WomanLive 拡張 - 動画ページの日付表示
   ・タイトル下の「N 回再生」の横: 本家はファイルの更新日時を出すが、公開日に置き換える
     「公開日 2024/03/15（2年7ヶ月前）」。公開日が無ければ回数だけ。
   ・更新日 (ファイルの更新日時) は詳細欄の「前回再生:」の下へ移す
   本家の行は隠して同じクラスの行を並べる (本家は改変しない)。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    // 本家と同じ書式 (UTC で保存された値を端末の時刻で「2026/10/25 23:17」)
    function fmtDateTime(s) {
        if (!s) return '';
        try {
            const v = String(s);
            return new Date(v.includes('Z') || v.includes('+') ? v : v + 'Z')
                .toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch (e) { return ''; }
    }

    function ensureMetaLine(vid) {
        const native = document.querySelector('#root [class*="videoInfoMeta_"]:not(.wlext-meta-line)');
        if (!native) return;
        const plays = (native.textContent.match(/^\s*([\d,]+)\s*回再生/) || [])[1] || '0';
        const meta = WL._meta && WL._meta[vid];
        const rel = meta && meta.release_date;
        const text = plays + ' 回再生' + (rel ? '   公開日 ' + WL.fmtDate(rel) + '（' + WL.ymAgo(rel) + '）' : '');
        let mine = native.parentElement.querySelector('.wlext-meta-line');
        if (!mine) mine = h('div', { class: native.className + ' wlext-meta-line' });
        if (native.nextElementSibling !== mine) native.insertAdjacentElement('afterend', mine);
        if (mine.textContent !== text) mine.textContent = text;
        native.style.display = 'none';
    }

    function ensureUpdatedRow(vid) {
        const w = WL._watch;
        if (!w || w.id !== vid) return;
        const grid = document.querySelector('#root [class*="detailGrid_"]'); if (!grid) return;
        const key = [...grid.children].find(d => d.textContent.trim() === '前回再生:');
        if (!key || !key.nextElementSibling) return;
        let k = grid.querySelector('.wlext-updated-k'), v = grid.querySelector('.wlext-updated-v');
        if (!k) { k = h('div', { class: 'wlext-updated-k' }, '更新日:'); v = h('div', { class: 'wlext-updated-v' }); }
        if (key.nextElementSibling.nextElementSibling !== k) key.nextElementSibling.insertAdjacentElement('afterend', k);
        if (k.nextElementSibling !== v) k.insertAdjacentElement('afterend', v);
        const text = fmtDateTime(w.updatedAt);
        if (v.textContent !== text) v.textContent = text;
    }

    function ensure() {
        const vid = WL.matchWatch(); if (!vid) return;
        ensureMetaLine(vid);
        ensureUpdatedRow(vid);
    }
    WL.onEnsure(ensure);
    // 動画が変わったら作り直す (前の動画の値を残さない)
    WL.onRoute(() => document.querySelectorAll('.wlext-meta-line, .wlext-updated-k, .wlext-updated-v').forEach(e => e.remove()));
})();
