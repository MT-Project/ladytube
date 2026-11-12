/* =============================================================
   LadyTube 拡張 - 動画ページの拡張メタデータの読み込み・保存・編集
   (評価 / 出演者 / 型番・シリーズ・メーカー・レーベル・監督 / 公開日 / ジャンル)
   表示 (評価の★・ジャンルや出演者の表・右下の丸ボタン) は本体の動画ページ
   (client/src/components/ExtWatchMeta.jsx。v3.1.13 まではここで DOM に差し込んでいた)。
   本体が使うもの: WL.loadMeta / WL.saveRating / WL.openMetaSearch / WL.openTagEditor / WL.openMetaEdit、
   保存したら window に wlext-meta-updated ({ id, meta }) を投げる。
   private が使うもの: WL._meta (読み込んだ詳細情報)、WL.metaSearch / WL.showMetaPreview (差し込み口)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    WL._meta = WL._meta || {};

    // 動画ページを開くたびに読み直す (以前も動画が変わるたびにキャッシュを捨てていた)
    WL.loadMeta = (vid) => WL.api.getMeta(vid).then(m => { WL._meta[vid] = m; return m; });

    function metaToPayload(meta) {
        return {
            rating: meta.rating || 0,
            display_name: meta.display_name || '',
            model_no: meta.model_no || '',
            release_date: meta.release_date || '',
            series: meta.series || '',
            maker: meta.maker || '',
            label: meta.label || '',
            directors: meta.directors || [],
            genres: meta.genres || [],
            performers: (meta.performers || []).map(p => p.id),
        };
    }

    async function saveMeta(vid, payload) {
        await WL.api.saveMeta(vid, payload);
        // 出演者展開や file_name を含む最新版を取り直す
        const fresh = await WL.api.getMeta(vid);
        WL._meta[vid] = fresh;
        rerender(vid);
        return fresh;
    }

    // 本体の動画ページ (WatchPage.jsx) に知らせる。評価・表・タイトル・公開日を描き直す
    function rerender(vid) {
        window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id: vid, meta: WL._meta[vid] } }));
        WL.requestEnsure();
    }

    // 評価 (★) を押したとき
    WL.saveRating = async (vid, n) => {
        const meta = WL._meta[vid]; if (!meta) return;
        try { const p = metaToPayload(meta); p.rating = n; meta.rating = n; await saveMeta(vid, p); WL.toast('評価を保存しました', 'success'); }
        catch (e) { WL.toast('評価の保存に失敗: ' + e.message, 'error'); }
    };

    /* ---------- 編集ダイアログ ---------- */
    function openEditDialog(vid, meta) {
        const temp = JSON.parse(JSON.stringify(metaToPayload(meta)));

        const ratingHost = h('div');
        const ratingEl = WL.starsEl(temp.rating, (n) => { temp.rating = n; });
        ratingHost.appendChild(ratingEl);

        const inDisplay = h('input', { class: 'wlext-input', value: temp.display_name });
        const inModel = h('input', { class: 'wlext-input', value: temp.model_no });
        const inRelease = h('input', { class: 'wlext-input', type: 'date', value: normalizeDateInput(temp.release_date) });
        const inSeries = h('input', { class: 'wlext-input', value: temp.series });
        const inMaker = h('input', { class: 'wlext-input', value: temp.maker });
        const inLabel = h('input', { class: 'wlext-input', value: temp.label });
        const directorsInput = WL.chipInput(temp.directors, '監督名を入力してEnter');
        const performersInput = WL.performerInput(meta.performers || []);
        const genresInput = WL.chipInput(temp.genres, 'ジャンルを入力してEnter');

        const field = (label, node) => h('div', { class: 'wlext-field' }, [h('label', null, label), node]);

        const body = h('div', null, [
            field('評価', ratingHost),
            field('表示動画名 (タイトルを置き換えます)', inDisplay),
            field('出演者', performersInput.el),
            field('ジャンル', genresInput.el),
            h('div', { class: 'wlext-row2' }, [field('公開日', inRelease), field('品番', inModel)]),
            h('div', { class: 'wlext-row2' }, [field('シリーズ名', inSeries), field('作品監督', directorsInput.el)]),
            h('div', { class: 'wlext-row2' }, [field('メーカー', inMaker), field('レーベル', inLabel)]),
        ]);

        WL.dialog('詳細情報を編集', body, {
            onSave: async (close) => {
                const payload = {
                    rating: temp.rating,
                    display_name: inDisplay.value.trim(),
                    model_no: inModel.value.trim(),
                    release_date: inRelease.value.trim(),
                    series: inSeries.value.trim(),
                    maker: inMaker.value.trim(),
                    label: inLabel.value.trim(),
                    directors: directorsInput.getValues(),
                    genres: genresInput.getValues(),
                    performers: performersInput.getValues().map(p => p.id),
                };
                try { await saveMeta(vid, payload); WL.toast('保存しました', 'success'); close(); }
                catch (e) { WL.toast('保存に失敗: ' + e.message, 'error'); }
            }
        });
    }

    function normalizeDateInput(s) {
        if (!s) return '';
        const d = WL.parseDate(s); if (!d) return '';
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    /* ---------- 右下の丸ボタン (ExtWatchMeta.jsx の ExtWatchFabs) が呼ぶ ---------- */
    // 動画情報を検索。差し込み口: WL.metaSearch が登録されていれば、それに検索を任せる
    // (複数の情報ソースを並べる個人用モジュールなど)。無ければ FANZA を品番で検索する。
    WL.openMetaSearch = (vid) => (WL.metaSearch ? WL.metaSearch(vid) : runDmmSearch(vid));
    // タグ編集 (本体のタグ編集の代わり。グループ対応のダイアログ)
    WL.openTagEditor = (vid) => openTagEditor(vid);
    // 詳細情報を編集
    WL.openMetaEdit = (vid) => {
        const meta = WL._meta[vid];
        if (!meta) { WL.toast('詳細情報を読み込み中です'); return; }
        openEditDialog(vid, meta);
    };

    async function openTagEditor(vid) {
        let current = [];
        try { const r = await WL.api.getVideoTags(vid); current = r.tags || []; } catch (e) { }
        WL.presetTagDialog({
            title: 'タグを編集',
            current,
            loadPresets: () => WL.loadVideoTagPresets(),
            savePresets: (arr) => WL.saveVideoTagPresets(arr),
            onSave: async (selected) => {
                try {
                    await WL.api.setVideoTags(vid, selected);
                    WL.toast('タグを保存しました', 'success');
                    setTimeout(() => location.reload(), 350);
                } catch (e) { WL.toast('タグの保存に失敗: ' + e.message, 'error'); }
            }
        });
    }

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
