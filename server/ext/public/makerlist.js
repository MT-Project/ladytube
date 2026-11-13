/* =============================================================
   WomanLive 拡張 - メーカー一覧 (/makers)
   メーカーごとに 画像(1:1)・名前(ふりがな)・キャッチコピー・TOP10タグ・
   レーベル一覧・平均評価・FANZAリンクを、横長のリストで表示する。
   ・画像/名前クリック  … そのメーカーで検索
   ・TOP10タグクリック  … メーカー×タグの AND 検索
   ・レーベルクリック   … そのレーベルで検索
   ・⋮メニュー          … メーカー情報の編集 / FANZAからの取得
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    const makerHref = (name) => WL.searchHref('@maker:"' + name + '"');
    const makerTagHref = (name, tag) => WL.searchHref('@maker:"' + name + '" tag:"' + tag + '"');
    const labelHref = (label) => WL.searchHref('@label:"' + label + '"');
    // 「レーベルなし」だけは、そのメーカーのレーベル未設定作品を引く
    const noLabelHref = (maker) => WL.searchHref('@maker:"' + maker + '" label:none');

    /* ---------- ⋮ メニュー (リスト表示の動画メニューと同じ見た目・配置) ---------- */
    let menuEl = null, backdrop = null;
    function closeMenu() { if (menuEl) menuEl.remove(); if (backdrop) backdrop.remove(); menuEl = backdrop = null; }
    function openMenu(anchor, items) {
        closeMenu();
        backdrop = h('div', { class: 'wlext-sel-menu-backdrop', onClick: closeMenu });
        menuEl = h('div', { class: 'wlext-sel-menu wlext-sel-menu-anchored' }, items.map(it =>
            h('div', { class: 'wlext-sel-menu-item', onClick: () => { closeMenu(); it.onClick(); } },
                [WL.icon(it.icon, 15), h('span', null, it.label)])));
        document.body.appendChild(backdrop);
        document.body.appendChild(menuEl);
        // アンカー(⋮ボタン)直下に配置。画面外なら上側へ反転。
        const r = anchor.getBoundingClientRect();
        let left = r.right - menuEl.offsetWidth; if (left < 8) left = 8;
        let top = r.bottom + 6;
        if (top + menuEl.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - menuEl.offsetHeight - 6);
        menuEl.style.left = left + 'px';
        menuEl.style.top = top + 'px';
    }

    // アニメーション画像 (GIF / APNG / アニメーション WebP) か。切り取って描き直すと止まってしまうので、
    // これらは元のまま保存し、表示範囲だけ別に持つ。先頭 256KB だけ見る。
    // ponytail: GIF は1コマでもアニメーション扱い (元のまま保存しても表示は同じ)
    function isAnimated(dataUrl) {
        const i = dataUrl.indexOf(',') + 1;
        const b64 = dataUrl.slice(i, i + 349524);
        const s = atob(b64.slice(0, b64.length - b64.length % 4));
        if (s.startsWith('GIF8')) return true;
        if (s.startsWith('\x89PNG')) { const a = s.indexOf('acTL'); return a > 0 && a < s.indexOf('IDAT'); }
        if (s.startsWith('RIFF') && s.slice(8, 16) === 'WEBPVP8X') return (s.charCodeAt(20) & 0x02) !== 0;
        return false;
    }

    async function render(params, mount) {
        const page = h('div', { class: 'wlext-maker-page wlext-ext-page' });
        page.appendChild(WL.pageHeader());
        const container = h('div', { class: 'wlext-pp-container' }, h('div', { style: { color: 'var(--text-secondary,#888)' } }, '読み込み中...'));
        page.appendChild(container);
        mount(page);
        window.scrollTo(0, 0);
        WL.setDocTitle('メーカー一覧');

        let list;
        try { list = await WL.api.makersList(); }
        catch (e) { container.innerHTML = ''; container.appendChild(h('div', null, '読み込みに失敗しました: ' + e.message)); return; }

        const state = { sort: 'count', dir: 'desc' };

        container.innerHTML = '';
        container.appendChild(WL.pageTitle('factory', 'メーカー一覧（' + list.length + '件）'));

        const controls = h('div', { class: 'wlext-plist-controls' });
        const sorter = WL.sortRow(
            [['name', 'メーカー名', 'asc'], ['count', '動画本数', 'desc'], ['rating', '評価', 'desc']],
            state, renderList, 'wlext_sort_makers');
        controls.appendChild(sorter.el);
        container.appendChild(controls);

        const listEl = h('div', { class: 'wlext-maker-list' });
        container.appendChild(listEl);

        function cmp(a, b) {
            const dir = state.dir === 'asc' ? 1 : -1;
            const byName = WL.nameCompare(a.furigana || a.name, b.furigana || b.name);
            if (state.sort === 'name') return byName * dir;
            if (state.sort === 'count') return ((a.count || 0) - (b.count || 0)) * dir || byName;
            // rating: 未評価(null)は常に末尾
            const ra = a.avgRating, rb = b.avgRating;
            if (ra == null && rb == null) return byName;
            if (ra == null) return 1; if (rb == null) return -1;
            return (ra - rb) * dir || byName;
        }

        function renderList() {
            const sorted = list.slice().sort(cmp);
            listEl.innerHTML = '';
            if (!sorted.length) { listEl.appendChild(h('div', { style: { color: 'var(--text-secondary,#888)' } }, 'メーカーが設定された動画がありません')); return; }
            sorted.forEach(m => listEl.appendChild(row(m)));
        }

        /* ---------- 1行 ---------- */
        function row(m) {
            /* -- 画像 (1:1・既定は色背景+メーカー名。クリックで検索、右下から画像設定) -- */
            const img = WL.navA(makerHref(m.name), { class: 'wlext-maker-img', title: '「' + m.name + '」で検索' });
            function paintImg() {
                img.innerHTML = '';
                if (m.hasImage) {
                    img.style.background = '';
                    const im = h('img', { loading: 'lazy', alt: m.name });
                    im.onerror = () => { m.hasImage = false; paintImg(); };
                    im.src = WL.api.makerImageUrl(m.name, Date.now());
                    // アニメーション画像は元のまま保存してあるので、登録時の表示範囲をここで当てる
                    const v = m.imageView;
                    if (v) Object.assign(im.style, {
                        position: 'absolute', objectFit: 'fill', maxWidth: 'none',
                        width: (100 / v.w) + '%', height: (100 / v.h) + '%',
                        left: (-v.x / v.w * 100) + '%', top: (-v.y / v.h * 100) + '%'
                    });
                    img.appendChild(im);
                } else {
                    img.style.background = WL.colorFor(m.name);
                    img.appendChild(h('div', { class: 'wlext-tag-thumb-label' }, m.name));
                }
                img.appendChild(h('div', { class: 'wlext-series-count', title: m.count + '本' }, String(m.count)));
                const edit = h('div', { class: 'wlext-tag-edit', title: 'メーカー画像を設定' }, WL.icon('image', 15));
                edit.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); pickImage(); });
                img.appendChild(edit);
            }
            function pickImage() {
                const input = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
                input.addEventListener('change', () => {
                    const file = input.files && input.files[0]; if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => WL.cropDialog(reader.result, async (dataUrl, view) => {
                        const anim = isAnimated(reader.result);
                        try {
                            await WL.api.setMakerImage(m.name, anim ? reader.result : dataUrl, anim ? view : null);
                            m.hasImage = true; m.imageView = anim ? view : null; paintImg();
                            WL.toast('メーカー画像を登録しました', 'success');
                        }
                        catch (e) { WL.toast('登録に失敗: ' + e.message, 'error'); }
                    }, {
                        aspect: [1, 1], outW: 600, fit: 'contain', title: 'メーカー画像を登録',
                        hint: 'そのまま登録すると画像全体を中央に表示します。拡大すると正方形に切り取れます（ドラッグで位置調整）。'
                    });
                    reader.readAsDataURL(file);
                });
                document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 1000);
            }
            paintImg();

            /* -- 名前 + ふりがな -- */
            const furiEl = h('span', { class: 'wlext-maker-furi' });
            const nameEl = WL.navA(makerHref(m.name), { class: 'wlext-maker-name', title: '「' + m.name + '」で検索' },
                [h('span', null, m.name), furiEl]);
            const paintName = () => { furiEl.textContent = m.furigana || ''; };
            paintName();

            /* -- キャッチコピー (クリックで編集) -- */
            const catchEl = h('div', { class: 'wlext-maker-catch', title: 'クリックして編集' });
            function paintCatch() {
                catchEl.textContent = m.catchCopy || 'キャッチコピーを追加';
                catchEl.classList.toggle('empty', !m.catchCopy);
            }
            catchEl.addEventListener('click', () => {
                const input = h('input', { class: 'wlext-input wlext-maker-catch-input', value: m.catchCopy || '', placeholder: 'キャッチコピー' });
                catchEl.replaceWith(input);
                input.focus(); input.select();
                let done = false;
                const finish = async (save) => {
                    if (done) return; done = true;
                    const v = input.value.trim();
                    input.replaceWith(catchEl);
                    if (!save || v === (m.catchCopy || '')) return;
                    try { await WL.api.saveMaker({ name: m.name, catch_copy: v }); m.catchCopy = v; paintCatch(); }
                    catch (e) { WL.toast('保存に失敗: ' + e.message, 'error'); }
                };
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') finish(true);
                    else if (e.key === 'Escape') finish(false);
                });
                input.addEventListener('blur', () => finish(true));
            });
            paintCatch();

            /* -- TOP10タグ (メーカー×タグの AND 検索) -- */
            const tagsEl = h('div', { class: 'wlext-maker-tags' },
                (m.topTags || []).map(t => WL.navA(makerTagHref(m.name, t.name),
                    { class: 'wlext-maker-tag', title: '「' + m.name + '」×「' + t.name + '」で検索' },
                    t.name + '(' + t.count + ')')));

            /* -- レーベル一覧 (開閉。本数の多い順) -- */
            const labels = m.labels || [];
            const labelsEl = labels.length
                ? h('details', { class: 'wlext-maker-labels' }, [
                    h('summary', null, 'レーベル一覧（' + labels.length + '）'),
                    h('div', { class: 'wlext-maker-label-list' },
                        labels.map(l => WL.navA(l.none ? noLabelHref(m.name) : labelHref(l.name),
                            {
                                class: 'wlext-maker-label' + (l.none ? ' none' : ''),
                                title: l.none ? '「' + m.name + '」のレーベル未設定の作品を検索' : '「' + l.name + '」で検索'
                            },
                            l.name + '(' + l.count + ')')))
                ])
                : null;

            /* -- 右側: 評価 / ⋮ / FANZA -- */
            const ratingEl = h('div', { class: 'wlext-series-rating' });
            if (m.avgRating != null) {
                ratingEl.appendChild(WL.starsEl(Math.round(m.avgRating)));
                ratingEl.appendChild(h('span', { class: 'wlext-series-ratingnum' }, m.avgRating.toFixed(1)));
            } else {
                ratingEl.appendChild(h('span', { style: { color: 'var(--text-secondary,#888)', fontSize: '0.75rem' } }, '評価なし'));
            }

            const menuBtn = h('div', { class: 'wlext-maker-menu-btn', title: 'メーカーの操作' }, '⋮');
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openMenu(menuBtn, [
                    { icon: 'pencil', label: 'メーカー情報編集', onClick: () => editDialog(m, repaint) },
                    { icon: 'search', label: 'メーカー情報取得', onClick: () => fetchInfo(m, repaint) }
                ]);
            });

            const fanzaEl = h('a', {
                class: 'wlext-maker-fanza', href: m.listUrl || '#', target: '_blank', rel: 'noopener noreferrer',
                title: 'FANZAのリストページを開く'
            }, 'FANZA');
            const siteEl = h('a', {
                class: 'wlext-maker-site', target: '_blank', rel: 'noopener noreferrer', title: 'メーカーの公式サイトを開く'
            }, '公式サイト');
            const paintLinks = () => {
                fanzaEl.href = m.listUrl || '#';
                fanzaEl.style.display = m.listUrl ? '' : 'none';
                siteEl.href = m.siteUrl || '#';
                siteEl.style.display = m.siteUrl ? '' : 'none';
            };
            paintLinks();

            function repaint() { paintName(); paintCatch(); paintLinks(); }

            return h('div', { class: 'wlext-maker-row' }, [
                img,
                h('div', { class: 'wlext-maker-body' }, [nameEl, catchEl, tagsEl, labelsEl]),
                h('div', { class: 'wlext-maker-side' }, [
                    h('div', { class: 'wlext-maker-side-top' }, [ratingEl, menuBtn]),
                    h('div', { class: 'wlext-maker-links' }, [siteEl, fanzaEl])
                ])
            ]);
        }

        sorter.paint();
        renderList();
    }

    /* ---------- メーカー情報の編集 ---------- */
    function editDialog(m, onDone) {
        const inFuri = h('input', { class: 'wlext-input', value: m.furigana || '', placeholder: 'めーかーめい' });
        const inCatch = h('input', { class: 'wlext-input', value: m.catchCopy || '' });
        const inUrl = h('input', { class: 'wlext-input', value: m.listUrl || '', placeholder: 'https://...' });
        const inSite = h('input', { class: 'wlext-input', value: m.siteUrl || '', placeholder: 'https://...' });
        const field = (label, node) => h('div', { class: 'wlext-field' }, [h('label', null, label), node]);

        const body = h('div', null, [
            h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.6rem' } },
                'メーカー名は動画のメタデータそのものです。名前を変えるときは設定画面の「メタデータの置換」を使ってください。'),
            field('メーカー名', h('div', { class: 'wlext-maker-readonly' }, m.name)),
            field('ふりがな', inFuri),
            field('キャッチコピー', inCatch),
            field('リストページURL (FANZA)', inUrl),
            field('公式サイトURL', inSite)
        ]);

        WL.dialog('メーカー情報を編集 — ' + m.name, body, {
            onSave: async (close) => {
                try {
                    await WL.api.saveMaker({
                        name: m.name, furigana: inFuri.value, catch_copy: inCatch.value, list_url: inUrl.value, site_url: inSite.value
                    });
                    m.furigana = inFuri.value.trim();
                    m.catchCopy = inCatch.value.trim();
                    m.listUrl = inUrl.value.trim();
                    m.siteUrl = inSite.value.trim();
                    onDone();
                    WL.toast('メーカー情報を保存しました', 'success');
                    close();
                } catch (e) { WL.toast('保存に失敗: ' + e.message, 'error'); }
            }
        });
    }

    /* ---------- FANZA からのメーカー情報取得 ---------- */
    async function fetchInfo(m, onDone) {
        WL.toast('FANZAでメーカーを検索中...');
        let data;
        try { data = await WL.api.dmmMakerSearch(m.name); }
        catch (e) { WL.toast(e.message || '検索に失敗しました', 'error'); return; }
        if (data.exact && data.exact.length === 1) showFetchPreview(m, data.exact[0], onDone);
        else showFetchSelect(m, data, onDone);
    }

    // 完全一致しなかったとき: 候補から選ばせる (名前を変えて再検索もできる)
    function showFetchSelect(m, data, onDone) {
        const input = h('input', { class: 'wlext-input', value: m.name, placeholder: 'メーカー名' });
        const listEl = h('div', { class: 'wlext-dmm-select' });
        const msg = (t) => h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)' } }, t);

        function paint(d) {
            listEl.innerHTML = '';
            const items = (d.exact && d.exact.length ? d.exact : d.candidates) || [];
            if (!items.length) { listEl.appendChild(msg('候補が見つかりませんでした。名前を変えて検索してください。')); return; }
            items.forEach(it => listEl.appendChild(
                h('div', { class: 'wlext-dmm-select-item', onClick: () => { close(); showFetchPreview(m, it, onDone); } },
                    h('div', { class: 'wlext-dmm-select-info' }, [
                        h('div', { class: 'wlext-dmm-select-title' }, it.name),
                        h('div', { class: 'wlext-dmm-select-sub' }, it.ruby || '(読み仮名なし)')
                    ]))));
            if (d.limited) listEl.appendChild(msg('候補が多いため上位' + items.length + '件のみ表示しています。'));
        }

        async function research() {
            const q = input.value.trim(); if (!q) return;
            listEl.innerHTML = ''; listEl.appendChild(msg('検索中...'));
            try { paint(await WL.api.dmmMakerSearch(q)); }
            catch (e) { listEl.innerHTML = ''; listEl.appendChild(msg('検索に失敗しました: ' + e.message)); }
        }
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') research(); });

        const body = h('div', null, [
            h('div', { class: 'wlext-field' }, [
                h('label', null, 'メーカー名で検索（Enterで再検索）'),
                h('div', { class: 'wlext-inline' }, [input, h('button', { class: 'wlext-btn', onClick: research }, '検索')])
            ]),
            listEl
        ]);
        const close = WL.dialog('メーカーを選択してください', body, {});
        paint(data);
    }

    // 反映前の確認 (動画情報・出演者情報の取得と同じ流れ)
    function showFetchPreview(m, item, onDone) {
        const grid = h('div', { class: 'wlext-detail-grid', style: { fontSize: '0.85rem' } });
        const addRow = (k, v) => { grid.appendChild(h('div', { class: 'wlext-key' }, k)); grid.appendChild(h('div', { class: 'wlext-val' }, v || '(なし)')); };
        addRow('メーカー名 (FANZA)', item.name);
        addRow('読み仮名', item.ruby);
        addRow('リストページURL', item.listUrl);

        const body = h('div', null, [
            h('div', { style: { fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.7rem' } },
                '「' + m.name + '」に、読み仮名(ふりがな)とリストページURLを設定します。メーカー名そのものは変更しません。'),
            grid
        ]);

        WL.dialog('この内容で設定しますか？', body, {
            saveLabel: '設定する',
            onSave: async (close) => {
                try {
                    await WL.api.saveMaker({ name: m.name, furigana: item.ruby || '', list_url: item.listUrl || '' });
                    m.furigana = item.ruby || '';
                    m.listUrl = item.listUrl || '';
                    onDone();
                    WL.toast('メーカー情報を設定しました', 'success');
                    close();
                } catch (e) { WL.toast('設定に失敗: ' + e.message, 'error'); }
            }
        });
    }

    // 置き場所は本体 (client/src/components/ExtPage.jsx。App.jsx の最後のルート) が決め、URL が合うと render(params, mount) を呼ぶ
    // (v3.1.15 までは onEnsure で URL を見て、ここが body に足していた)
    WL.extPages = Object.assign(WL.extPages || {}, { '/makers': render });
})();
