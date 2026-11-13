/* =============================================================
   WomanLive 拡張 - ブックマーク (追加ボタン + フォルダ選択ダイアログ)
   ボタンは本体の画面 (client/src/components/ExtCardParts.jsx の ExtBookmarkButton) が置く
   (一覧のカードと動画ページの右下の丸ボタン)。押すと WL.openBookmarkDialog。ブックマーク済みかどうかは
   WL._bmIds を見て、変わると wlext-bookmarks-changed で知らせる
   (v3.1.15 まではここがカードを探してボタンを足し、動画ページのボタンを body に足していた)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    WL._bmIds = WL._bmIds || null; // Set<videoId> | null(未読込)
    let loading = false;

    function ensureIds() {
        if (WL._bmIds || loading) return;
        loading = true;
        WL.api.bmIds().then(ids => { WL._bmIds = new Set(ids.map(Number)); loading = false; repaintAll(); })
            .catch(() => { loading = false; });
    }

    // ブックマークのボタンは本体の画面 (ExtCardParts.jsx の ExtBookmarkButton) が描くので、変わったことを知らせる
    function repaintAll() { window.dispatchEvent(new Event('wlext-bookmarks-changed')); }
    WL.repaintBookmarks = repaintAll;

    function setBookmarkedFromFolders(vid, folders) {
        if (!WL._bmIds) WL._bmIds = new Set();
        if (folders.some(f => f.in)) WL._bmIds.add(Number(vid));
        else WL._bmIds.delete(Number(vid));
        repaintAll();
    }

    /* ---------- フォルダ選択ダイアログ ---------- */
    WL.openBookmarkDialog = openDialog;
    async function openDialog(vid) {
        let data;
        try { data = await WL.api.bmVideoFolders(vid); }
        catch (e) { WL.toast('読み込みに失敗: ' + e.message, 'error'); return; }
        const folders = data.folders || [];

        const listHost = h('div', { class: 'wlext-bm-dlg-list' });
        function renderList() {
            listHost.innerHTML = '';
            if (!folders.length) {
                listHost.appendChild(h('div', { style: { color: 'var(--text-secondary,#888)', fontSize: '0.85rem', padding: '0.5rem' } }, 'フォルダがありません。下の欄から追加してください。'));
                return;
            }
            folders.forEach(f => {
                const item = h('div', {
                    class: 'wlext-bm-dlg-item' + (f.in ? ' on' : ''),
                    onClick: async () => {
                        try {
                            if (f.in) { await WL.api.bmRemove(vid, f.id); f.in = false; }
                            else { await WL.api.bmAdd(vid, f.id); f.in = true; }
                            item.classList.toggle('on', f.in);
                            item.querySelector('.chk').textContent = f.in ? '✓' : '';
                            setBookmarkedFromFolders(vid, folders);
                        } catch (e) { WL.toast('更新に失敗: ' + e.message, 'error'); }
                    }
                }, [h('span', { class: 'name' }, f.name), h('span', { class: 'chk' }, f.in ? '✓' : '')]);
                listHost.appendChild(item);
            });
        }
        renderList();

        const input = h('input', { class: 'wlext-input', placeholder: '新しいフォルダ名' });
        const addBtn = h('button', {
            class: 'wlext-btn', onClick: async () => {
                const name = input.value.trim(); if (!name) return;
                try {
                    const nf = await WL.api.bmCreateFolder(name);
                    await WL.api.bmAdd(vid, nf.id);
                    folders.push({ id: nf.id, name: nf.name, in: true });
                    input.value = '';
                    renderList();
                    setBookmarkedFromFolders(vid, folders);
                } catch (e) { WL.toast('フォルダ追加に失敗: ' + e.message, 'error'); }
            }
        }, '＋追加');
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addBtn.click(); } });

        const body = h('div', null, [
            h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.5rem' } }, 'フォルダをタップで追加/解除します。'),
            listHost,
            h('div', { class: 'wlext-inline', style: { marginTop: '0.8rem' } }, [input, addBtn])
        ]);
        WL.dialog('ブックマーク', body, {});  // 変更は即時反映のため保存ボタンなし
    }

    // ブックマーク済みの動画を読む (どのページでも。本体の画面のボタンが WL._bmIds を見る)
    WL.onEnsure(ensureIds);
})();
