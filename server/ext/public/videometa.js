/* =============================================================
   LadyTube 拡張 - 動画ページの「動画情報を検索」(FANZA を品番で検索し、確認画面で選んだ項目を反映する)
   詳細情報の読み書き・評価・編集ダイアログ・タグ編集は本体 (client/src/utils/videoMeta.js・components/ExtMetaEdit.jsx。
   v3.2.1 までここ)。表示は本体の client/src/components/ExtWatchMeta.jsx。
   本体が使うもの: WL.openMetaSearch。反映したら window に wlext-meta-updated ({ id, meta }) を投げる。
   private が使うもの: WL._meta (読み込んだ詳細情報)、WL.metaSearch / WL.showMetaPreview (差し込み口)、
   WL.metaSearchTitle (「動画情報を検索」の丸ボタンの説明。本体の ExtWatchMeta.jsx が読む。無ければ本体の既定の文)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    WL._meta = WL._meta || {};

    // 本体の動画ページ (WatchPage.jsx) に知らせる。評価・表・タイトル・公開日を描き直す
    function rerender(vid) {
        window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id: vid, meta: WL._meta[vid] } }));
    }

    /* ---------- 右下の丸ボタン (ExtWatchMeta.jsx の ExtWatchFabs) が呼ぶ ---------- */
    // 動画情報を検索。差し込み口: WL.metaSearch が登録されていれば、それに検索を任せる
    // (複数の情報ソースを並べる個人用モジュールなど)。無ければ FANZA を品番で検索する。
    WL.openMetaSearch = (vid) => (WL.metaSearch ? WL.metaSearch(vid) : runDmmSearch(vid));

    async function runDmmSearch(vid) {
        const meta = WL._meta[vid];
        if (meta && !meta.model_no) { WL.toast('品番が設定されていません。先に品番を登録してください。', 'error'); return; }
        WL.toast('FANZAで検索中...');
        let data;
        try { data = await WL.api.dmmSearch(vid); }
        catch (e) { WL.toast(e.message || '検索に失敗しました', 'error'); return; }
        if (!data.items || !data.items.length) { WL.toast('商品情報が見つかりませんでした（品番: ' + (data.keyword || '') + '）', 'error'); return; }
        if (data.items.length === 1) showDmmPreview(vid, data.items[0]);
        else showDmmSelect(vid, data.items);
    }

    function itemThumb(item) {
        // thumb はブラウザから見える画像 URL (情報ソースによってはサーバー側でしか取れない imageLarge と分けて渡す)
        const src = item.thumb || item.imageLarge;
        return src
            ? h('img', { src, class: 'wlext-dmm-thumb', loading: 'lazy', referrerpolicy: 'no-referrer' })
            : h('div', { class: 'wlext-dmm-thumb', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.7rem' } }, 'no image');
    }

    function showDmmSelect(vid, items) {
        const list = h('div', { class: 'wlext-dmm-select' });
        items.forEach(item => {
            list.appendChild(h('div', { class: 'wlext-dmm-select-item', onClick: () => { close(); showDmmPreview(vid, item); } }, [
                itemThumb(item),
                h('div', { class: 'wlext-dmm-select-info' }, [
                    h('div', { class: 'wlext-dmm-select-title' }, item.title || '(無題)'),
                    h('div', { class: 'wlext-dmm-select-sub' }, [item.date, item.maker, (item.actresses || []).join(', ')].filter(Boolean).join(' / '))
                ])
            ]));
        });
        const close = WL.dialog('検索結果が複数あります（選択してください）', list, {});
    }

    // 取り込む項目 (キーは dmm.js mapItem の戻りに合わせる)。
    // list:true は改行区切りの複数値、merge:true は既存を消さずに足す項目。
    const DMM_FIELDS = [
        { key: 'title', label: '表示動画名', cur: (m) => m.display_name || '' },
        { key: 'date', label: '公開日', cur: (m) => (m.release_date ? WL.fmtDate(m.release_date) : ''), show: (v) => WL.fmtDate(v) },
        { key: 'actresses', label: '出演者', list: true, cur: (m) => (m.performers || []).map(p => p.name) },
        { key: 'genres', label: 'ジャンル', list: true, merge: true, cur: (m) => m.genres || [] },
        { key: 'series', label: 'シリーズ名', cur: (m) => m.series || '' },
        { key: 'maker', label: 'メーカー', cur: (m) => m.maker || '' },
        { key: 'label', label: 'レーベル', cur: (m) => m.label || '' },
        { key: 'directors', label: '作品監督', list: true, cur: (m) => m.directors || [] },
    ];
    const mergeList = (cur, add) => {
        const out = (cur || []).slice();
        (add || []).forEach(v => { if (!out.includes(v)) out.push(v); });
        return out;
    };

    // チェックの付いていない項目を空にして返す。サーバー(dmm.js apply)は空の項目を
    // 既存の値のまま残すので、「送らない = 適用しない」になる。
    function pickChecked(item, checks, imgChk) {
        const out = Object.assign({}, item);
        DMM_FIELDS.forEach(f => {
            if (!(checks[f.key] && checks[f.key].checked)) out[f.key] = f.list ? [] : '';
        });
        if (!(imgChk && imgChk.checked)) { out.imageLarge = ''; out.imageAlt = ''; }
        return out;
    }

    function showDmmPreview(vid, item) {
        const meta = WL._meta[vid] || {};
        const checks = {};
        const grid = h('div', { class: 'wlext-prev-grid' });

        DMM_FIELDS.forEach(f => {
            const raw = item[f.key];
            const nv = f.list ? (raw || []) : (raw || '');
            if (f.list ? !nv.length : !nv) return;      // 取得できなかった項目は出さない
            const curVal = f.cur(meta);
            const curText = f.list ? (curVal || []).join('、') : curVal;
            const newText = f.list
                ? (f.merge ? mergeList(curVal, nv).join('、') : nv.join('、'))
                : (f.show ? f.show(nv) : nv);

            const chk = h('input', { type: 'checkbox' });
            chk.checked = true;
            checks[f.key] = chk;
            grid.appendChild(h('label', { class: 'wlext-prev-row' }, [
                chk,
                h('span', { class: 'wlext-prev-label' }, f.label),
                h('span', { class: 'wlext-prev-cur' }, curText || '(空)'),
                h('span', { class: 'wlext-prev-arrow' }, '→'),
                h('span', { class: 'wlext-prev-new' }, newText + (f.merge ? '（追加）' : ''))
            ]));
        });

        // カバー画像は「未設定のときだけ取得」なので、既に設定済みなら押しても変化しない
        let imgChk = null;
        if (item.imageLarge) {
            imgChk = h('input', { type: 'checkbox' });
            imgChk.checked = true;
            grid.appendChild(h('label', { class: 'wlext-prev-row' }, [
                imgChk,
                h('span', { class: 'wlext-prev-label' }, 'カバー画像'),
                h('span', { class: 'wlext-prev-cur' }, ''),
                h('span', { class: 'wlext-prev-arrow' }, '→'),
                h('span', { class: 'wlext-prev-new' }, 'カバー画像が未設定なら取得して設定')
            ]));
        }

        const body = h('div', null, [
            h('div', { style: { display: 'flex', gap: '1rem', marginBottom: '0.8rem' } }, [
                itemThumb(item),
                h('div', { style: { fontSize: '0.78rem', color: 'var(--text-secondary,#888)' } },
                    'チェックを付けた項目だけをメタデータに設定します。チェックを外した項目は今の値のままです。')
            ]),
            grid.childElementCount ? grid
                : h('div', { style: { color: 'var(--text-secondary,#888)' } }, '設定できる情報が取得できませんでした。')
        ]);

        WL.dialog('設定する情報を選択', body, {
            saveLabel: '設定する',
            onSave: async (close) => {
                const picked = pickChecked(item, checks, imgChk);
                const any = DMM_FIELDS.some(f => (f.list ? picked[f.key].length : picked[f.key])) || picked.imageLarge;
                if (!any) { WL.toast('設定する項目が選択されていません', 'error'); return; }
                await applyDmm(vid, picked);
                close();
            }
        });
    }

    // 差し込み口: 選んだ情報を確認画面に出して反映する (反映は /ext/api/dmm/apply。item は dmm.js mapItem と同じ形)
    WL.showMetaPreview = (vid, item) => showDmmPreview(vid, item);

    async function applyDmm(vid, item) {
        try {
            const r = await WL.api.dmmApply(vid, item);
            delete WL._meta[vid];
            try { WL._meta[vid] = await WL.api.getMeta(vid); } catch (e) { }
            rerender(vid);
            window.dispatchEvent(new CustomEvent('wlext-cover-refresh', { detail: { id: vid } }));   // 本体の動画ページのカバーを取り直す
            WL.toast('メタデータを設定しました' + (r.coverSet ? '（カバー画像も取得）' : ''), 'success');
        } catch (e) { WL.toast('設定に失敗: ' + e.message, 'error'); }
    }

})();
