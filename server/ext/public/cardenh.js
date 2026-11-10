/* =============================================================
   WomanLive 拡張 - 検索結果カードの表示拡張
   ・サムネ右上にメーカー名 (半透明の白字)
   ・フォルダ名をサムネ左下へ (動画の長さバッジと同じ形式)
   ・もともとフォルダ名があった位置に評価(★)を表示
   メーカー/評価は bulkMeta でまとめて取得・キャッシュ。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    WL._cardMeta = WL._cardMeta || {}; // id -> { rating, maker, ... } (取得済み)
    let pending = false;

    function ensure() {
        if (location.pathname !== '/search') return;       // 検索結果画面のみ
        const root = document.getElementById('root'); if (!root) return;
        const missing = [];
        root.querySelectorAll('a[href^="/watch/"]').forEach(card => {
            const m = (card.getAttribute('href') || '').match(/\/watch\/(\d+)/); if (!m) return;
            // サムネ枠はグリッド/リスト共通の1クラス(thumbnailWrapper_*)。表示切替はカード側でなく
            // 祖先コンテナの素クラス.listで行われる(applyTagsのisList判定を参照)。
            const thumb = card.querySelector('[class*="thumbnailWrapper_"]');
            const folderEl = WL.findFolderName(card);  // folderName (grid/list 共通)
            if (!thumb || !folderEl) return;
            // 折りたたみバッジ(フォルダ名/メーカー)が枠内に収まるよう、サムネ枠を相対配置に
            if (getComputedStyle(thumb).position === 'static') thumb.style.position = 'relative';
            const id = Number(m[1]);
            applyCard(id, thumb, folderEl, card);
            applyTags(card, id);
            if (WL._cardMeta[id] === undefined && !missing.includes(id)) missing.push(id);
        });
        if (missing.length && !pending) fetchMeta(missing);
    }

    /* ---------- リスト表示: タグを幅に合わせて表示 ('…' で省略・マウスオーバーで全表示) ---------- */
    function splitTags(s) { return String(s == null ? '' : s).split('\n').map(t => t.trim()).filter(Boolean); }

    // 本家のタグ枠(tagBadgeContainer_*)はグリッドと共有のため触らず、リスト時のみ隠して別枠(.wlext-tagrow)で表示する。
    // グリッド/リストはカードでなく祖先コンテナの素クラス.list(非ハッシュ)で判別する。
    function applyTags(card, id) {
        const isList = !!card.closest('.list');
        const native = card.querySelector('[class*="tagBadgeContainer_"]:not(.wlext-tagrow)');
        let mine = card.querySelector('.wlext-tagrow');
        if (!isList || !native) { if (mine) mine.remove(); if (native) native.style.display = ''; return; }
        const tags = splitTags(WL._videoTags && WL._videoTags[id]);
        const meta = WL._cardMeta[id];
        const genres = (meta && Array.isArray(meta.genres)) ? meta.genres : [];
        if (!tags.length && !genres.length) { if (mine) mine.remove(); native.style.display = ''; return; }
        native.style.display = 'none';
        if (!mine) { mine = h('div', { class: native.className + ' wlext-tagrow' }); native.insertAdjacentElement('afterend', mine); }
        const sig = mine.clientWidth + '|' + genres.join('\n') + '|' + tags.join('\n');
        if (mine.getAttribute('data-sig') === sig) return;   // 同じ幅・内容なら再フィットしない
        mine.setAttribute('data-sig', sig);
        fitTags(mine, genres, tags, native);
    }

    // ジャンル(動画ページと同じチップ・押すと検索)を先に並べ、タグとの間に「│」を置く。あふれたら末尾(タグ側)から削る
    function fitTags(cont, genres, tags, native) {
        // タグバッジ本体のクラスは native 内の既存バッジから拝借する(タグ0件時は本家プロパティ名で検索)
        const sample = native.querySelector('[class*="tagBadge_"]') || document.querySelector('[class*="tagBadge_"]:not([class*="tagBadgeContainer_"])');
        const badgeClass = sample ? sample.className : '';
        cont.innerHTML = '';
        const items = genres.map(g => searchLink('@genre:"' + g + '"', g, 'wlext-genre-chip wlext-list-genre'));
        if (genres.length && tags.length) items.push(h('span', { class: 'wlext-tagsep' }, '│'));
        tags.forEach(t => items.push(h('span', { class: badgeClass }, t)));
        items.forEach(el => cont.appendChild(el));
        const all = [genres.length ? 'ジャンル: ' + genres.join(' / ') : '', tags.length ? 'タグ: ' + tags.join(' / ') : ''].filter(Boolean).join('\n');
        const ell = h('span', { class: badgeClass + ' wlext-tag-ell', title: all }, '…');
        cont.appendChild(ell);
        ell.style.display = 'none';
        if (cont.scrollWidth <= cont.clientWidth) { ell.remove(); return; } // 全部入る
        ell.style.display = '';
        while (cont.scrollWidth > cont.clientWidth && items.length) items.pop().remove();
        // 区切りが末尾に残ったら一緒に消す
        if (items.length && items[items.length - 1].classList.contains('wlext-tagsep')) items.pop().remove();
    }

    // カード内のリンク(押すとその条件で検索)。左クリックはカード本体(動画へ遷移)へ伝播させない
    function searchLink(token, text, cls) {
        const url = WL.searchHref(token);
        return WL.navA(url, { class: cls, title: '「' + text + '」で検索', onClick: (e) => { e.stopPropagation(); WL.navigate(url); } }, text);
    }

    // 注入はすべて「カード内で1つ」に統一し、毎回 現在のビュー(グリッド/リスト)の
    // 正しい位置へ再配置する。これにより グリッド⇔リスト 切替で重複しない。
    function applyCard(id, thumb, folderEl, card) {
        const meta = WL._cardMeta[id];
        const isPoster = !!card.closest('.poster');

        // 1) フォルダ名 → サムネ左下 (長さバッジ durationBadge_* の形式を流用)。
        //    ポスター表示は長さバッジが無く位置合わせできず、評価行と重なるため表示しない。
        const txt = (folderEl.textContent || '').trim();
        let fo = card.querySelector('.wlext-folder-ov');
        if (isPoster) {
            if (fo) fo.remove();
        } else {
            if (!fo && txt) {
                const durSample = thumb.querySelector('[class*="durationBadge_"]');
                fo = h('div', { class: (durSample ? durSample.className + ' ' : '') + 'wlext-folder-ov', title: txt }, txt);
            }
            if (fo && fo.parentElement !== thumb) thumb.appendChild(fo);   // 現ビューのサムネへ寄せる
        }
        // 元のフォルダ名は隠す (テキストは残す: 既存のブックマーク/スクショ注入が参照するため)
        folderEl.style.display = 'none';

        // 2) 評価 (スクショ数・ブックマークと同じ行。位置は表示形式により WL.cardMetaRow が判定)
        const row = WL.cardMetaRow(card);
        if (row) {
            let rc = row.querySelector('.wlext-card-rating');
            if (!rc) { rc = h('div', { class: 'wlext-card-rating' }); row.appendChild(rc); }
            const rating = meta ? (meta.rating || 0) : 0;
            if (rc.getAttribute('data-r') !== String(rating)) {
                rc.setAttribute('data-r', String(rating));
                rc.innerHTML = '';
                if (rating > 0) rc.appendChild(WL.starsEl(rating)); // 読み取り専用
            }
            // シリーズ名 (リスト表示のみ。評価の左。行幅の半分までで「…」)
            const series = (card.closest('.list') && meta && meta.series) || '';
            let se = row.querySelector('.wlext-card-series');
            if (!series) { if (se) se.remove(); }
            else if (!se || se.textContent !== series) {
                const next = searchLink('@series:"' + series + '"', series, 'wlext-card-series');
                if (se) se.replaceWith(next); else row.prepend(next);
            }
        }

        // 3) メーカー → サムネ右上 (半透明の白字)
        if (meta && meta.maker) {
            let mk = card.querySelector('.wlext-maker-ov');
            if (!mk) mk = h('div', { class: 'wlext-maker-ov' });
            if (mk.parentElement !== thumb) thumb.appendChild(mk);
            if (mk.textContent !== meta.maker) { mk.textContent = meta.maker; mk.title = meta.maker; }
        }

        // 4) 出演者 (リスト表示のみ。評価行の下・タグ行の上に名前だけ表示)
        applyPerformers(card, meta);
    }

    // リスト表示で、登録済みの出演者名と監督を評価行の下(タグ行の上)に「出演者：A、B　監督：X」の形で表示する。画像は出さない。
    function applyPerformers(card, meta) {
        const isList = !!card.closest('.list');
        const performers = (meta && Array.isArray(meta.performers)) ? meta.performers : [];
        const directors = (meta && Array.isArray(meta.directors)) ? meta.directors : [];
        let row = card.querySelector('.wlext-card-performers');
        if (!isList || (!performers.length && !directors.length)) { if (row) row.remove(); return; }

        const metaRow = card.querySelector('.wlext-card-meta');
        const parent = metaRow && metaRow.parentElement;
        if (!parent) { if (row) row.remove(); return; }

        const sig = performers.map(p => p.id).join(',') + '|' + directors.join('\n');
        if (!row) { row = h('div', { class: 'wlext-card-performers' }); }
        if (row.getAttribute('data-sig') !== sig) {
            row.setAttribute('data-sig', sig);
            row.innerHTML = '';
            row.title = [performers.length ? '出演者：' + performers.map(p => p.name).join('、') : '',
                         directors.length ? '監督：' + directors.join('、') : ''].filter(Boolean).join('　');
            if (performers.length) row.appendChild(h('span', { class: 'wlext-card-label' }, '出演者：'));
            performers.forEach((p, i) => {
                if (i > 0) row.appendChild(document.createTextNode('、'));
                // <a href> にして中クリック(新規タブ)はブラウザ標準に任せる。
                // 左クリックはカード本体(動画へ遷移)へ伝播させない。
                const url = '/performer/' + p.id;
                row.appendChild(WL.navA(url, {
                    class: 'wlext-card-performer', title: p.name + 'のページを開く',
                    onClick: (e) => { e.stopPropagation(); WL.navigate(url); }
                }, p.name));
            });
            if (directors.length) {
                row.appendChild(h('span', { class: 'wlext-card-label' + (performers.length ? ' wlext-card-label-gap' : '') }, '監督：'));
                directors.forEach((d, i) => {
                    if (i > 0) row.appendChild(document.createTextNode('、'));
                    row.appendChild(searchLink('@director:"' + d + '"', d, 'wlext-card-performer'));
                });
            }
        }
        if (row.previousElementSibling !== metaRow || row.parentElement !== parent) {
            metaRow.insertAdjacentElement('afterend', row);
        }
    }

    function fetchMeta(ids) {
        pending = true;
        WL.api.bulkMeta(ids)
            .then(map => {
                ids.forEach(id => { WL._cardMeta[id] = map[id] || {}; });
                pending = false;
                ensure(); // 取得後に再描画
            })
            .catch(() => { pending = false; });
    }

    WL.onEnsure(ensure);
    // ウィンドウ幅が変わったらタグの表示数を再計算する
    window.addEventListener('resize', WL.debounce(ensure, 150));
})();
