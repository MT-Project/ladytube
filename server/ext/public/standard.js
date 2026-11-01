/* =============================================================
   WomanLive 拡張 - 動画ページの標準モード
   本家の動画ページ (動画が横いっぱい = シアターモード) に、動画の右へ情報欄を置く「標準モード」を足す。
   ・切替はプレイヤーの「プレイヤー設定」と「フルスクリーン」の間のボタン。状態は端末に保存 (既定はシアター)
   ・標準モードは ヘッダー / 動画 / 右の情報欄 / タイトルの行 だけを1画面に収める
   ・右の情報欄は上の矢印か項目名で切り替え、欄の中だけスクロールする
       カバーとサムネイル = 本家のスクリーンショット欄 / 動画情報 = 本家の詳細欄
       イメージリスト = 本家のイメージリスト (開いている間だけ項目が出る)
       同じシリーズの動画・関連動画 = 拡張が描く一覧
   本家の要素は動かさず CSS で右欄の位置に重ねる (React の描画を壊さないため)。
   狭い画面 (幅1000px未満) とフルスクリーン中はシアターモードのまま。
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;
    const MODE_KEY = 'wlext_watch_layout', TAB_KEY = 'wlext_std_tab';
    const wide = window.matchMedia('(min-width: 1000px)');

    const load = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
    const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
    const isStandard = () => load(MODE_KEY, 'theater') === 'standard';

    const imageListOpen = () => !!document.querySelector('#root [class*="imageListContainer_"], #root [class*="imageListLoading_"]');
    const fullscreen = () => !!document.fullscreenElement || !!document.querySelector('#root [class*="container_"].fullscreen');
    const active = () => !!WL.matchWatch() && isStandard() && wide.matches && !fullscreen();

    const TABS = [
        { key: 'media', label: 'カバーとサムネイル' },
        { key: 'series', label: '同じシリーズの動画' },
        { key: 'related', label: '関連動画' },
        { key: 'info', label: '動画情報' },
        { key: 'images', label: 'イメージリスト', when: imageListOpen },
    ];
    const visibleTabs = () => TABS.filter(t => !t.when || t.when());

    let tab = load(TAB_KEY, 'media');
    let wasImages = false, tabBeforeImages = null;

    /* ---------- 右欄の見出し (矢印と項目名) ---------- */
    let head = null, chips = null;
    const panes = {};   // series / related: 拡張が描く一覧

    function buildHead() {
        chips = h('div', { class: 'wlext-std-chips' });
        const arrow = (dir, icon, title) => h('div', { class: 'wlext-std-arrow', title, onClick: () => step(dir) }, WL.icon(icon, 18));
        head = h('div', { class: 'wlext-std-head' }, [arrow(-1, 'chevron-left', '前の項目'), chips, arrow(1, 'chevron-right', '次の項目')]);
        document.body.appendChild(head);
        ['series', 'related'].forEach(k => { panes[k] = h('div', { class: 'wlext-std-pane', 'data-pane': k }); document.body.appendChild(panes[k]); });
    }
    function step(dir) {
        const list = visibleTabs();
        const i = Math.max(0, list.findIndex(t => t.key === tab));
        select(list[(i + dir + list.length) % list.length].key);
    }
    function select(key) {
        tab = key;
        if (key !== 'images') save(TAB_KEY, key);   // イメージリストは開いている間だけの項目なので覚えない
        apply();
    }
    function paintHead() {
        const list = visibleTabs();
        const sig = list.map(t => t.key).join(',') + '|' + tab;
        if (chips.dataset.sig === sig) return;
        chips.dataset.sig = sig;
        chips.innerHTML = '';
        list.forEach(t => {
            const c = h('div', { class: 'wlext-std-chip' + (t.key === tab ? ' active' : ''), onClick: () => select(t.key) }, t.label);
            chips.appendChild(c);
            if (t.key === tab) requestAnimationFrame(() => c.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
        });
    }

    /* ---------- 拡張が描く一覧 ---------- */
    const msg = (text) => h('div', { class: 'wlext-std-msg' }, text);
    const sameModel = (a, b) => !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();

    async function renderSeries(pane, vid) {
        pane.replaceChildren(msg('読み込み中...'));
        let r;
        try { r = await WL.api.videoSiblings(vid); } catch (e) { pane.replaceChildren(msg('読み込みに失敗しました: ' + e.message)); return; }
        if (pane.dataset.vid !== vid) return;
        const out = [];
        // 同じ品番 (分割されたパート) を先頭に
        if (r.parts.length > 1) {
            out.push(h('div', { class: 'wlext-std-sec' }, '同じ品番（' + r.parts.length + '本）'));
            const list = h('div', { class: 'wlext-vrow-list' });
            r.parts.forEach(v => list.appendChild(WL.videoRow(v, { current: String(v.id) === vid })));
            out.push(list);
        }
        if (r.series) {
            const token = '@series:"' + r.series + '"';
            out.push(h('div', { class: 'wlext-std-sec' }, [
                WL.navA(WL.searchHref(token), { class: 'wlext-link', title: '「' + r.series + '」で検索' }, r.series),
                h('span', { class: 'wlext-std-sec-n' }, '（' + r.works.length + '作品）'),
            ]));
            const list = h('div', { class: 'wlext-vrow-list' });
            r.works.forEach(v => list.appendChild(WL.videoRow(v, {
                count: v.group_count, stripPart: v.group_count > 1, date: true,
                current: String(v.id) === vid || sameModel(v.ext_model_no, r.modelNo),
            })));
            out.push(list);
        }
        if (!out.length) out.push(msg('シリーズが設定されていません'));
        pane.replaceChildren(...out);
    }

    async function renderRelated(pane, vid) {
        const w = WL._watch;
        if (!w || w.id !== vid) { pane.replaceChildren(msg('読み込み中...')); pane.dataset.vid = ''; return; }   // 動画の情報が届いたら描き直す
        if (!w.relatedIds.length) { pane.replaceChildren(msg('関連動画はありません')); return; }
        pane.replaceChildren(msg('読み込み中...'));
        let r;
        try { r = await WL.api.videosBrief(w.relatedIds); } catch (e) { pane.replaceChildren(msg('読み込みに失敗しました: ' + e.message)); return; }
        if (pane.dataset.vid !== vid) return;
        const list = h('div', { class: 'wlext-vrow-list' });
        r.videos.forEach(v => list.appendChild(WL.videoRow(v, { note: String(v.id) === String(w.nextVideoId) ? '次に再生' : '' })));
        pane.replaceChildren(list);
    }

    function ensurePane(vid) {
        const pane = panes[tab]; if (!pane || pane.dataset.vid === vid) return;
        pane.dataset.vid = vid;
        (tab === 'series' ? renderSeries : renderRelated)(pane, vid);
    }

    /* ---------- 切替ボタン (プレイヤーの「プレイヤー設定」の右) ---------- */
    function ensureSwitch() {
        const settings = document.querySelector('#root [class*="rightControls_"] button[title="プレイヤー設定"]');
        if (!settings) return;
        let btn = settings.parentElement.querySelector('.wlext-layout-btn');
        if (!btn) {
            btn = h('button', { class: settings.className + ' wlext-layout-btn', onClick: (e) => { e.stopPropagation(); save(MODE_KEY, isStandard() ? 'theater' : 'standard'); apply(); } });
        }
        if (settings.nextElementSibling !== btn) settings.insertAdjacentElement('afterend', btn);
        const std = isStandard();
        const sig = String(std);
        if (btn.dataset.sig !== sig) {
            btn.dataset.sig = sig;
            const size = (settings.querySelector('svg') && settings.querySelector('svg').getAttribute('width')) || 20;
            btn.innerHTML = WL.iconSvg(std ? 'rectangle-horizontal' : 'panel-right', size);
            btn.title = std ? 'シアターモードへ変更' : '標準モードへ変更';
        }
        btn.style.display = wide.matches ? '' : 'none';
    }

    /* ---------- 大きさ: 動画の高さを「画面 − タイトルの行」に収める ---------- */
    function layout() {
        const nav = document.querySelector('#root [class*="nav_"]');
        const top = (nav ? Math.round(nav.getBoundingClientRect().bottom) : 48) + 8;
        document.body.style.setProperty('--wlext-std-top', top + 'px');
        const player = document.querySelector('#root [class*="playerSection_"]');
        const title = document.querySelector('#root [data-wlext-std="title"]');
        if (!player || !title) return;
        // 動画の下端からタイトルの行の下端までは動画の高さに依らないので、その分を画面から引く
        const reserve = title.getBoundingClientRect().bottom - player.getBoundingClientRect().bottom + 16;
        const hgt = Math.max(200, Math.floor(window.innerHeight - player.getBoundingClientRect().top - reserve));
        document.body.style.setProperty('--wlext-std-player-h', hgt + 'px');
    }

    function mark() {
        const t = document.querySelector('#root h1[class*="videoInfoTitle_"]');
        if (t && t.parentElement && t.parentElement.dataset.wlextStd !== 'title') t.parentElement.dataset.wlextStd = 'title';
        const rel = [...document.querySelectorAll('#root h3')].find(x => x.textContent.trim() === '関連動画');
        if (rel && rel.parentElement && rel.parentElement.dataset.wlextStd !== 'related') rel.parentElement.dataset.wlextStd = 'related';
    }

    /* ---------- 反映 ---------- */
    let ro = null;
    function apply() {
        const vid = WL.matchWatch();
        if (vid) ensureSwitch();
        const on = active();
        document.body.classList.toggle('wlext-std', on);
        if (!on) return;
        if (!head) buildHead();
        mark();

        // イメージリストを開いたらその項目へ、閉じたら元の項目へ
        const imgs = imageListOpen();
        if (imgs && !wasImages) { tabBeforeImages = tab; tab = 'images'; }
        if (!imgs && wasImages && tab === 'images') tab = tabBeforeImages || 'media';
        if (!imgs && tab === 'images') tab = 'media';
        wasImages = imgs;
        if (!TABS.some(t => t.key === tab)) tab = 'media';

        document.body.dataset.wlextTab = tab;
        paintHead();
        ensurePane(vid);
        layout();
        const title = document.querySelector('#root [data-wlext-std="title"]');
        if (title && (!ro || ro.target !== title)) {
            if (ro) ro.disconnect();
            ro = new ResizeObserver(() => { if (active()) layout(); });
            ro.observe(title); ro.target = title;
        }
    }

    WL.onEnsure(apply);
    WL.onRoute(() => { Object.values(panes).forEach(p => { p.dataset.vid = ''; p.replaceChildren(); }); apply(); });
    window.addEventListener('resize', WL.debounce(apply, 100));
    document.addEventListener('fullscreenchange', () => setTimeout(apply, 50));
    wide.addEventListener('change', apply);
})();
