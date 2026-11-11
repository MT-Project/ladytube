/* =============================================================
   WomanLive 拡張 - 検索結果の一括操作 (メニューとダイアログ)
   選択モードの丸ボタン・カードのチェック・リスト表示の「⋮」は本体の画面
   (client/src/components/ExtSelection.jsx・components/VideoList.jsx) が出し、ここを呼ぶ:
   ・WL.toggleBulkMenu(ids, done): 一括操作メニュー (右下)。開いていれば閉じる。done は操作が終わったら呼ぶ (選択の解除)
   ・WL.openVideoMenu(id, anchor): 動画単体の操作メニュー (「⋮」の近く)
   ・WL.closeBulkMenu(): メニューを閉じる
   操作: タグ追加 / 詳細情報編集 / ブックマーク追加 / 削除。品番でまとめたカードは中の動画すべてが対象。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    /* ---------- メニュー ---------- */
    let menuEl = null, menuBackdrop = null;
    function closeMenu() { if (menuEl) menuEl.remove(); if (menuBackdrop) menuBackdrop.remove(); menuEl = menuBackdrop = null; }
    WL.closeBulkMenu = closeMenu;
    // 一括操作/動画単体で共通のメニュー項目 (対象 ids だけが異なる)
    function menuItems(ids, done) {
        return [
            h('div', { class: 'wlext-sel-menu-item', onClick: () => { closeMenu(); doTags(ids, done); } }, [WL.icon('tag', 15), h('span', null, 'タグ追加')]),
            h('div', { class: 'wlext-sel-menu-item', onClick: () => { closeMenu(); doMeta(ids, done); } }, '✎ 詳細情報編集'),
            h('div', { class: 'wlext-sel-menu-item', onClick: () => { closeMenu(); doBookmark(ids); } }, [WL.icon('bookmark-add', 15), h('span', null, 'ブックマーク追加')]),
            h('div', { class: 'wlext-sel-menu-item danger', onClick: () => { closeMenu(); doDelete(ids, done); } }, '🗑 動画の削除'),
        ];
    }
    // 品番でまとめたカードは、中の動画すべてを対象にする
    function expand(ids) {
        if (!WL.groupByModel()) return ids;
        return [...new Set(ids.flatMap(id => WL.groupMembers(id)))];
    }
    WL.toggleBulkMenu = (selectedIds, done) => {
        if (menuEl) { closeMenu(); return; }
        const ids = expand(selectedIds);
        if (!ids.length) return;
        menuBackdrop = h('div', { class: 'wlext-sel-menu-backdrop', onClick: closeMenu });
        menuEl = h('div', { class: 'wlext-sel-menu' }, [
            h('div', { class: 'wlext-sel-menu-head' }, ids.length + '件を一括操作'),
            ...menuItems(ids, done),
        ]);
        document.body.appendChild(menuBackdrop);
        document.body.appendChild(menuEl);
    };

    // 動画単体の操作メニュー (リスト表示の「⋮」から開く・ボタン近くにアンカー)
    WL.openVideoMenu = (id, anchor) => {
        closeMenu();
        menuBackdrop = h('div', { class: 'wlext-sel-menu-backdrop', onClick: closeMenu });
        const ids = expand([id]);
        menuEl = h('div', { class: 'wlext-sel-menu wlext-sel-menu-anchored' }, [
            ids.length > 1 ? h('div', { class: 'wlext-sel-menu-head' }, 'まとめた ' + ids.length + '本を操作') : null,
            ...menuItems(ids, null),
        ]);
        document.body.appendChild(menuBackdrop);
        document.body.appendChild(menuEl);
        // アンカー(ボタン)直下に配置。画面外なら上側へ反転。
        const r = anchor.getBoundingClientRect();
        const mw = menuEl.offsetWidth, mh = menuEl.offsetHeight;
        let left = r.right - mw; if (left < 8) left = 8;
        let top = r.bottom + 6;
        if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
        menuEl.style.left = left + 'px';
        menuEl.style.top = top + 'px';
    };

    // 操作のあと: 選択を解いて (done)、一覧を取り直させる
    function afterAction(done) {
        if (done) done();
        window.dispatchEvent(new Event('library-updated'));
    }

    /* ---------- タグ追加 ---------- */
    function doTags(ids, done) {
        WL.presetTagDialog({
            title: 'タグを追加（' + ids.length + '件）',
            current: [],
            // グループ対応の動画タグプリセット (動画単体ページと共用)
            loadPresets: () => WL.loadVideoTagPresets(),
            savePresets: (arr) => WL.saveVideoTagPresets(arr),
            onSave: async (tags) => {
                if (!tags.length) { WL.toast('追加するタグを選んでください', 'error'); return; }
                try { const r = await WL.api.bulkTags(ids, tags); WL.toast(r.count + '件にタグを追加しました', 'success'); afterAction(done); }
                catch (e) { WL.toast('失敗: ' + e.message, 'error'); }
            }
        });
    }

    /* ---------- 詳細情報編集 (表示動画名なし) ---------- */
    function doMeta(ids, done) {
        const temp = { rating: 0 };
        const ratingHost = h('div');
        ratingHost.appendChild(WL.starsEl(0, (n) => { temp.rating = n; }));
        const inModel = h('input', { class: 'wlext-input' });
        const inRelease = h('input', { class: 'wlext-input', type: 'date' });
        const inSeries = h('input', { class: 'wlext-input' });
        const inMaker = h('input', { class: 'wlext-input' });
        const inLabel = h('input', { class: 'wlext-input' });
        const directorsInput = WL.chipInput([], '監督名を入力してEnter');
        const performersInput = WL.performerInput([]);
        const genresInput = WL.chipInput([], 'ジャンルを入力してEnter');
        const field = (label, node) => h('div', { class: 'wlext-field' }, [h('label', null, label), node]);

        const body = h('div', null, [
            h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.6rem' } },
                '入力した項目のみ上書きします（空欄は変更しません）。ジャンルは既存に追加します。表示動画名は一括では変更できません。'),
            field('評価（★を選ぶと一括設定）', ratingHost),
            field('出演者（上書き）', performersInput.el),
            field('ジャンル（追加）', genresInput.el),
            h('div', { class: 'wlext-row2' }, [field('公開日', inRelease), field('品番', inModel)]),
            h('div', { class: 'wlext-row2' }, [field('シリーズ名', inSeries), field('作品監督', directorsInput.el)]),
            h('div', { class: 'wlext-row2' }, [field('メーカー', inMaker), field('レーベル', inLabel)]),
        ]);

        WL.dialog('詳細情報を一括編集（' + ids.length + '件）', body, {
            saveLabel: '適用',
            onSave: async (close) => {
                const meta = {
                    rating: temp.rating,
                    model_no: inModel.value.trim(),
                    release_date: inRelease.value.trim(),
                    series: inSeries.value.trim(),
                    maker: inMaker.value.trim(),
                    label: inLabel.value.trim(),
                    directors: directorsInput.getValues(),
                    genres: genresInput.getValues(),
                    performers: performersInput.getValues().map(p => p.id),
                };
                try { const r = await WL.api.bulkEditMeta(ids, meta); WL.toast(r.count + '件を更新しました', 'success'); close(); afterAction(done); }
                catch (e) { WL.toast('失敗: ' + e.message, 'error'); }
            }
        });
    }

    /* ---------- ブックマーク一括追加 ---------- */
    async function doBookmark(ids) {
        let folders;
        try { folders = await WL.api.bmFolders(); } catch (e) { WL.toast('読み込み失敗: ' + e.message, 'error'); return; }

        const listHost = h('div', { class: 'wlext-bm-dlg-list' });
        function render() {
            listHost.innerHTML = '';
            if (!folders.length) listHost.appendChild(h('div', { style: { color: 'var(--text-secondary,#888)', fontSize: '0.85rem', padding: '0.5rem' } }, 'フォルダがありません。下で追加してください。'));
            folders.forEach(f => {
                listHost.appendChild(h('div', {
                    class: 'wlext-bm-dlg-item',
                    onClick: async () => {
                        try {
                            const r = await WL.api.bulkBookmark(ids, f.id);
                            ids.forEach(id => { if (WL._bmIds) WL._bmIds.add(Number(id)); });
                            if (WL.repaintBookmarks) WL.repaintBookmarks();
                            WL.toast('「' + f.name + '」に ' + r.count + '件追加しました', 'success');
                        } catch (e) { WL.toast('失敗: ' + e.message, 'error'); }
                    }
                }, [h('span', { class: 'name' }, f.name), h('span', { class: 'chk' }, '＋')]));
            });
        }
        render();
        const input = h('input', { class: 'wlext-input', placeholder: '新しいフォルダ名' });
        const addBtn = h('button', {
            class: 'wlext-btn', onClick: async () => {
                const name = input.value.trim(); if (!name) return;
                try {
                    const nf = await WL.api.bmCreateFolder(name);
                    const r = await WL.api.bulkBookmark(ids, nf.id);
                    ids.forEach(id => { if (WL._bmIds) WL._bmIds.add(Number(id)); });
                    if (WL.repaintBookmarks) WL.repaintBookmarks();
                    folders.push({ id: nf.id, name: nf.name, count: r.count });
                    input.value = ''; render();
                    WL.toast('「' + nf.name + '」に追加しました', 'success');
                } catch (e) { WL.toast('失敗: ' + e.message, 'error'); }
            }
        }, '＋追加');

        const body = h('div', null, [
            h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.5rem' } }, '選択した ' + ids.length + '件を追加するフォルダをタップしてください。'),
            listHost,
            h('div', { class: 'wlext-inline', style: { marginTop: '0.8rem' } }, [input, addBtn])
        ]);
        WL.dialog('ブックマークに一括追加', body, {});
    }

    /* ---------- 削除 ---------- */
    function doDelete(ids, done) {
        const body = h('div', { style: { fontSize: '0.9rem', lineHeight: '1.7' } }, [
            h('div', { style: { color: 'var(--status-error,#e51400)', fontWeight: 'bold', marginBottom: '0.4rem' } }, '⚠ 選択した ' + ids.length + '件の動画を削除します'),
            h('div', null, '元の動画ファイルが削除され、関連するスクリーンショット・カバー画像・追加情報・ブックマークも削除されます。'),
            h('div', { style: { marginTop: '0.4rem', fontWeight: 'bold' } }, 'この操作は元に戻せません。よろしいですか？')
        ]);
        WL.dialog('動画の削除', body, {
            saveLabel: '削除する', danger: true,
            onSave: async (close) => {
                try {
                    const r = await WL.api.bulkDelete(ids);
                    WL.toast(r.deleted + '件を削除しました' + (r.fileErrors ? '（ファイル削除に失敗 ' + r.fileErrors + '件）' : ''), 'success');
                    close(); afterAction(done);
                } catch (e) { WL.toast('削除に失敗: ' + e.message, 'error'); }
            }
        });
    }
})();
