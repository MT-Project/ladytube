/* =============================================================
   WomanLive 拡張 - コア
   ・fetch フック (品番でまとめたカードの手直し / 関連動画の差し替え)
   ・SPA ルート検知
   ・DOM 監視 (React 再描画後の再注入)
   ・共通 UI (ライトボックス / トースト / チップ入力 など)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt;
    const origFetch = WL._rawFetch || window.fetch.bind(window);

    /* ---------- 小道具 ---------- */
    function h(tag, props, children) {
        const e = document.createElement(tag);
        if (props) {
            for (const k in props) {
                if (k === 'class') e.className = props[k];
                else if (k === 'style' && typeof props[k] === 'object') Object.assign(e.style, props[k]);
                else if (k === 'html') e.innerHTML = props[k];
                else if (k.startsWith('on') && typeof props[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), props[k]);
                else if (k === 'attrs') { for (const a in props.attrs) e.setAttribute(a, props.attrs[a]); }
                else if (props[k] !== null && props[k] !== undefined) e.setAttribute(k, props[k]);
            }
        }
        appendChildren(e, children);
        return e;
    }
    function appendChildren(e, children) {
        if (children === null || children === undefined) return;
        if (Array.isArray(children)) children.forEach(c => appendChildren(e, c));
        else if (children instanceof Node) e.appendChild(children);
        else e.appendChild(document.createTextNode(String(children)));
    }
    function debounce(fn, ms) { let t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
    function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    WL.h = h;
    WL.debounce = debounce;
    WL.escapeHtml = escapeHtml;

    /* ---------- 名前ソート (サーバーの ext_namekey と同一ロジック) ---------- */
    // namekey.js (UMD) を core より前に読み込み、ここで WL に公開する。
    const NK = window.WLNameKey || { nameKey: (s) => String(s == null ? '' : s), nameCompare: (a, b) => String(a).localeCompare(String(b), 'ja') };
    WL.nameKey = NK.nameKey;
    WL.nameCompare = NK.nameCompare;

    /* ---------- 一覧 共通部品 ---------- */
    // 画像が無いカード(タグ/ジャンル/メーカー)の既定背景。名前から色を決めるので毎回同じ色になる。
    WL.colorFor = function (s) {
        let n = 0;
        s = String(s || '');
        for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
        return 'hsl(' + (n % 360) + ', 42%, 40%)';
    };

    // カードの評価/スクショ数/ブックマークをまとめる行。表示形式(グリッド/リスト/ポスター)に
    // 応じて適切な位置(通常はタイトル直下、ポスターはサムネ上のオーバーレイ)へ配置する。
    // bookmark/screenshots から呼ばれ、何度呼んでも同じ行を返す(冪等)。検索画面では本体の画面
    // (client/src/components/ExtCardParts.jsx) が評価入りの行を先に置くので、それを見つけて返す。
    WL.cardMetaRow = function (card) {
        const isPoster = !!card.closest('.poster');
        const parent = isPoster
            ? card.querySelector('[class*="thumbnailWrapper_"]')
            : (card.querySelector('[class*="filename_"]') || {}).parentElement;
        if (!parent) return card.querySelector('.wlext-card-meta');
        let row = card.querySelector('.wlext-card-meta');
        if (!row) row = h('div', { class: 'wlext-card-meta' });
        row.classList.toggle('wlext-card-meta-poster', isPoster);
        if (row.parentElement !== parent) parent.appendChild(row);
        return row;
    };

    // クリック可能カードを <a href> 化するヘルパー。中クリック/Ctrl+クリック等は
    // ブラウザ標準の新規タブ動作に任せ、通常の左クリックだけ SPA 風のフルリロード遷移にする。
    WL.navA = function (url, props, children) {
        props = Object.assign({ href: url }, props);
        const userClick = props.onClick;
        props.onClick = (e) => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            if (userClick) userClick(e); else WL.navigate(url);
        };
        return h('a', props, children);
    };

    // 並び替えボタン列。defs=[[key,label,defaultDir],...] / state={sort,dir}。
    // 同じキー再クリックで asc/desc トグル、別キーは defaultDir(既定 asc)で開始。
    // onChange は選択変更時に呼ばれる(グリッド再描画用)。返り値 {el, paint}。
    // storeKey を渡すと選択を localStorage に保存し、次回表示時に復元する。
    WL.sortRow = function (defs, state, onChange, storeKey) {
        if (storeKey) {
            try {
                const saved = JSON.parse(localStorage.getItem(storeKey) || 'null');
                if (saved && defs.some(d => d[0] === saved.sort)) {
                    state.sort = saved.sort;
                    state.dir = saved.dir === 'desc' ? 'desc' : 'asc';
                }
            } catch (e) { /* 復元できなければ既定のまま */ }
        }
        const row = h('div', { class: 'wlext-plist-sortrow' });
        row.appendChild(h('span', { class: 'wlext-plist-ctl-label' }, '並び替え:'));
        const btns = {};
        function paint() {
            defs.forEach(([key, label]) => {
                const b = btns[key], a = state.sort === key;
                b.classList.toggle('active', a);
                b.textContent = label + (a ? (state.dir === 'asc' ? ' ↑' : ' ↓') : '');
            });
        }
        defs.forEach(([key, label, defDir]) => {
            const b = h('div', {
                class: 'wlext-plist-sortbtn', onClick: () => {
                    if (state.sort === key) state.dir = state.dir === 'asc' ? 'desc' : 'asc';
                    else { state.sort = key; state.dir = defDir || 'asc'; }
                    if (storeKey) { try { localStorage.setItem(storeKey, JSON.stringify({ sort: state.sort, dir: state.dir })); } catch (e) { } }
                    paint(); onChange();
                }
            }, label);
            btns[key] = b; row.appendChild(b);
        });
        return { el: row, paint };
    };

    /* ---------- 日付 / 時間 ---------- */
    function parseDate(s) {
        if (!s) return null;
        const str = String(s).trim().replace(/[./]/g, '-');
        const m = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (!m) return null;
        const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
        return isNaN(d.getTime()) ? null : d;
    }
    function ageYM(birthday, ref) {
        const b = parseDate(birthday); if (!b) return '';
        let r = (ref instanceof Date) ? ref : parseDate(ref);
        if (!r) r = new Date();
        let years = r.getFullYear() - b.getFullYear();
        let months = r.getMonth() - b.getMonth();
        if (r.getDate() < b.getDate()) months--;
        if (months < 0) { years--; months += 12; }
        if (years < 0) return '';
        return years + '歳' + months + 'ヶ月';
    }
    function ymAgo(s) {
        const d = parseDate(s); if (!d) return '';
        const now = new Date();
        let y = now.getFullYear() - d.getFullYear();
        let m = now.getMonth() - d.getMonth();
        if (now.getDate() < d.getDate()) m--;
        if (m < 0) { y--; m += 12; }
        if (y < 0) return '発売前';
        if (y === 0) return (m <= 0 ? '今月' : m + 'ヶ月前');
        return y + '年' + (m > 0 ? m + 'ヶ月' : '') + '前';
    }
    function fmtDate(s) { const d = parseDate(s); if (!d) return s || ''; return d.getFullYear() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + String(d.getDate()).padStart(2, '0'); }
    function formatDuration(sec) {
        if (!sec) return '---';
        const hh = Math.floor(sec / 3600), mm = Math.floor((sec % 3600) / 60), ss = Math.floor(sec % 60);
        return hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${mm}:${String(ss).padStart(2, '0')}`;
    }
    WL.parseDate = parseDate; WL.ageYM = ageYM; WL.ymAgo = ymAgo; WL.fmtDate = fmtDate; WL.formatDuration = formatDuration;

    /* ---------- ナビゲーション ---------- */
    // 拡張からの遷移はフルリロードで行い、確実に React 側 (検索) や拡張側 (出演者) に届ける
    WL.navigate = (url) => { window.location.assign(url); };
    // ページタイトル。本家の各ページと同じ "<名前> - WomanLive" 形式にする
    // (本家は自分のルートでしか title を設定しないため、拡張ページは自前で名乗る)
    WL.setDocTitle = (name) => { document.title = name ? name + ' - LadyTube' : 'LadyTube'; };
    WL.searchHref = (token) => '/search?q=' + encodeURIComponent(token);
    WL.searchBy = (token) => { WL.navigate(WL.searchHref(token)); };
    WL.openPerformer = (id) => { WL.navigate('/performer/' + id); };

    /* ---------- 中クリック(新規タブ)対応 ---------- */
    // <a href> にできない要素(タグの中にボタンを含むチップ等)へ data-wlext-href を付けると、
    // 中クリックで新規タブを開けるようにする。委譲なので後から生成した要素にも効く。
    const midTarget = (e) => e.target.closest && e.target.closest('[data-wlext-href]');
    document.addEventListener('mousedown', (e) => { if (e.button === 1 && midTarget(e)) e.preventDefault(); });
    document.addEventListener('auxclick', (e) => {
        if (e.button !== 1) return;
        const el = midTarget(e);
        if (!el) return;
        e.preventDefault(); e.stopPropagation();
        window.open(el.getAttribute('data-wlext-href'), '_blank');
    });

    // 拡張ページ共通ヘッダー (本家ヘッダーと統一: ロゴ/検索/操作) は nav.js が定義。

    /* ---------- fetch フック ---------- */
    function jsonResponse(data) {
        return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // 表示動画名を使うかどうか (表示設定の「動画表示名で表示する」。既定はON)。
    // 一覧と動画ページの名前は本体の画面 (client/src/utils/formatters.js の videoName) が出す。
    // ここは拡張の UI (品番でまとめたパートの一覧など) が同じ設定を読むためのもの。
    WL.useDisplayName = () => {
        try { return localStorage.getItem('wlext_use_display_name') !== '0'; } catch (e) { return true; }
    };

    // 検索画面で同じ品番の動画を1枚のカードにまとめるか (既定はON)。トグルは本体の検索画面
    // (client/src/pages/SearchPage.jsx) にあり、同じキーに書く。ここは拡張の UI (一括操作・絞り込み) が読むためのもの
    WL.groupByModel = () => {
        try { return localStorage.getItem('wlext_group_model') !== '0'; } catch (e) { return true; }
    };
    const grouping = () => location.pathname === '/search' && WL.groupByModel();

    // まとめたカードの中身: 代表 id -> メンバーの id (ファイル名順)。一括操作・「N本」の一覧で使う
    WL._groupIds = WL._groupIds || {};
    WL.groupMembers = (id) => WL._groupIds[id] || [Number(id)];
    function applyGroups(list) {
        if (!Array.isArray(list)) return;
        list.forEach(v => {
            if (!v || !(v.ext_group_count > 1)) return;
            WL._groupIds[v.id] = String(v.ext_group_ids || '').split(',').map(Number).filter(n => n > 0);
            // カードの名前はパート番号を外す (「…vol.5_1.mp4」→「…vol.5.mp4」、表示動画名「…_1」→「…」)
            v.filename = String(v.filename).replace(/_\d+(\.[^.\\/]+)?$/, '$1');
            if (v.ext_display_name) v.ext_display_name = String(v.ext_display_name).replace(/_\d+$/, '');
        });
    }

    // 検索そのもの (項目検索・品番でまとめる・件数) はサーバーの /api/videos と /api/videos/count が
    // 拡張の search.js で行う。ここでは一覧の結果に、まとめたカードの手直しだけをする。
    async function handleVideosFetch(input, init) {
        const r = await origFetch(input, init);
        if (!r.ok) return r;
        try {
            const data = await r.clone().json();
            applyGroups(data.videos);
            return jsonResponse(data);
        } catch (e) { return r; }
    }

    async function handleSingleVideoFetch(id, input, init) {
        const r = await origFetch(input, init);
        const clone = r.clone();
        try {
            const data = await r.json();
            // 拡張: 関連動画をメタデータ類似度で差し替え (空なら本体のパス近傍を維持)
            // (表示動画名 ext_display_name は、本体の /api/video/:id も関連動画 API も返す)
            try {
                const rel = await WL.api.relatedVideos(id);
                if (rel && Array.isArray(rel.videos) && rel.videos.length) data.relatedVideos = rel.videos;
            } catch (e) { }
            // 動画ページの拡張 (更新日の表示・標準モードの関連動画) が使う
            if (data && data.video) {
                WL._watch = {
                    id: String(id), updatedAt: data.video.updated_at, nextVideoId: data.nextVideoId,
                    relatedIds: (data.relatedVideos || []).map(v => v.id),
                };
                WL.requestEnsure();
            }
            return jsonResponse(data);
        } catch (e) { return clone; }
    }

    // グリッド表示の⋮(本家のタグメニュー)は代表の動画1本にタグを付け外しする。
    // 品番でまとめたカードでは、同じ変更を中の動画すべてへ送る。
    async function handleGroupTagFetch(id, url, input, init) {
        const r = await origFetch(input, init);
        if (r.ok) {
            const others = WL.groupMembers(id).filter(x => x !== Number(id));
            await Promise.all(others.map(o => origFetch(url.replace('/api/video/' + id + '/', '/api/video/' + o + '/'), init).catch(() => { })));
        }
        return r;
    }

    window.fetch = function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input && input.url) || '';
            if (typeof input === 'string') {
                const mt = url.match(/\/api\/video\/(\d+)\/tags(\?|$)/);
                if (mt && init && /^(POST|DELETE)$/i.test(init.method || '') && grouping()) return handleGroupTagFetch(mt[1], url, input, init);
                if (/\/api\/videos(\?|$)/.test(url)) return handleVideosFetch(input, init);
                const mv = url.match(/\/api\/video\/(\d+)(\?|$)/);
                if (mv) return handleSingleVideoFetch(mv[1], input, init);
            }
        } catch (e) { /* fall through */ }
        return origFetch(input, init);
    };

    /* ---------- ルート検知 ---------- */
    WL._routeCbs = [];
    WL.onRoute = (cb) => WL._routeCbs.push(cb);
    function emitRoute() { const p = location.pathname; WL._routeCbs.forEach(cb => { try { cb(p); } catch (e) { console.error(e); } }); }
    ['pushState', 'replaceState'].forEach(m => {
        const o = history[m];
        history[m] = function () { const ret = o.apply(this, arguments); setTimeout(emitRoute, 0); return ret; };
    });
    window.addEventListener('popstate', () => setTimeout(emitRoute, 0));

    WL.matchWatch = () => { const m = location.pathname.match(/^\/watch\/(\d+)/); return m ? m[1] : null; };
    WL.matchPerformer = () => { const m = location.pathname.match(/^\/performer\/(\d+)/); return m ? m[1] : null; };
    WL.matchSettings = () => location.pathname === '/settings';

    /* ---------- DOM 監視 (再注入) ---------- */
    WL._ensureCbs = [];
    WL.onEnsure = (cb) => WL._ensureCbs.push(cb);
    function runEnsure() { WL._ensureCbs.forEach(cb => { try { cb(); } catch (e) { console.error('[wlext ensure]', e); } }); }
    const debouncedEnsure = debounce(runEnsure, 80);
    WL.requestEnsure = () => { setTimeout(runEnsure, 0); setTimeout(runEnsure, 200); setTimeout(runEnsure, 500); };

    function startObserver() {
        const root = document.getElementById('root') || document.body;
        new MutationObserver(debouncedEnsure).observe(root, { childList: true, subtree: true });
        WL.onRoute(() => WL.requestEnsure());
        WL.requestEnsure();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver);
    else startObserver();

    /* ---------- ライトボックス ---------- */
    WL.lightbox = function (src, opts) {
        opts = opts || {};
        const img = h('img', { src });
        const actions = h('div', { class: 'wlext-lightbox-actions' });
        if (opts.onEdit) {
            actions.appendChild(h('button', { class: 'wlext-btn wlext-btn-primary', onClick: (e) => { e.stopPropagation(); close(); opts.onEdit(); } }, '画像を変更'));
        }
        if (opts.onReset) {
            actions.appendChild(h('button', { class: 'wlext-btn', onClick: (e) => { e.stopPropagation(); close(); opts.onReset(); } }, 'デフォルトに戻す'));
        }
        actions.appendChild(h('button', { class: 'wlext-btn', onClick: (e) => { e.stopPropagation(); close(); } }, '閉じる'));
        const box = h('div', { class: 'wlext-lightbox', onClick: () => close() }, [img, actions]);
        function close() { box.remove(); document.removeEventListener('keydown', onKey); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);
        document.body.appendChild(box);
        return close;
    };

    /* ---------- 画像クロッパ (任意アスペクト比) ---------- */
    // WL.cropDialog(dataUrl, onDone, { aspect:[w,h], outW, hint, fit })
    // 出演者画像(正方形)と同じ操作感で、指定比率に切り取って onDone(dataURL(PNG), view) を返す。
    // fit:'contain' は最初に画像全体を枠の中央に収める (余白は透明)。拡大すると切り取りになる。
    // view は枠に写っている範囲を元画像の幅・高さに対する割合で表したもの {x,y,w,h} (余白があると x,y<0・w,h>1)。
    WL.cropDialog = function (dataUrl, onDone, opts) {
        opts = opts || {};
        const aspect = opts.aspect || [1, 1];
        const STAGE_W = 320;
        const STAGE_H = Math.max(80, Math.round(STAGE_W * aspect[1] / aspect[0]));
        const OUT_W = opts.outW || 600;
        const OUT_H = Math.round(OUT_W * aspect[1] / aspect[0]);

        const stage = h('div', { class: 'wlext-cropper-stage', style: { width: STAGE_W + 'px', height: STAGE_H + 'px' } });
        const img = new Image();
        let scale = 1, minScale = 1, coverScale = 1, ox = 0, oy = 0, nw = 0, nh = 0;

        // 枠より大きい向きは枠を埋める範囲、小さい向きは枠の中だけ動かせる
        function clamp() {
            if (scale < minScale) scale = minScale;
            const w = nw * scale, hh = nh * scale;
            ox = Math.min(Math.max(ox, Math.min(0, STAGE_W - w)), Math.max(0, STAGE_W - w));
            oy = Math.min(Math.max(oy, Math.min(0, STAGE_H - hh)), Math.max(0, STAGE_H - hh));
        }
        function paint() {
            clamp();
            img.style.width = (nw * scale) + 'px';
            img.style.height = (nh * scale) + 'px';
            img.style.left = ox + 'px';
            img.style.top = oy + 'px';
        }
        // 指定の倍率で中央に置き直す
        function center(s) {
            scale = s;
            ox = (STAGE_W - nw * scale) / 2; oy = (STAGE_H - nh * scale) / 2;
            zoom.value = String(scale / minScale);
            paint();
        }
        img.onload = () => {
            nw = img.naturalWidth; nh = img.naturalHeight;
            coverScale = Math.max(STAGE_W / nw, STAGE_H / nh);
            minScale = opts.fit === 'contain' ? Math.min(STAGE_W / nw, STAGE_H / nh) : coverScale;
            zoom.max = String(4 * coverScale / minScale);
            img.style.position = 'absolute';
            stage.appendChild(img);
            center(minScale);
        };
        img.src = dataUrl;

        let dragging = false, sx = 0, sy = 0;
        function down(e) { dragging = true; const p = pt(e); sx = p.x - ox; sy = p.y - oy; stage.style.cursor = 'grabbing'; e.preventDefault(); }
        function move(e) { if (!dragging) return; const p = pt(e); ox = p.x - sx; oy = p.y - sy; paint(); }
        function up() { dragging = false; stage.style.cursor = 'grab'; }
        function pt(e) { const t = e.touches ? e.touches[0] : e; return { x: t.clientX, y: t.clientY }; }
        stage.addEventListener('mousedown', down); window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
        stage.addEventListener('touchstart', down, { passive: false }); stage.addEventListener('touchmove', (e) => { move(e); e.preventDefault(); }, { passive: false }); stage.addEventListener('touchend', up);

        const zoom = h('input', { type: 'range', min: '1', max: '4', step: '0.01', value: '1', style: { flex: '1' } });
        zoom.addEventListener('input', () => { scale = minScale * parseFloat(zoom.value); paint(); });

        const fitButtons = opts.fit === 'contain' ? h('div', { class: 'wlext-cropper-fit' }, [
            h('button', { type: 'button', class: 'wlext-btn', onClick: () => center(minScale) }, '全体を表示'),
            h('button', { type: 'button', class: 'wlext-btn', onClick: () => center(coverScale) }, '枠いっぱいに切り取る')
        ]) : null;

        const body = h('div', null, [
            stage,
            h('div', { class: 'wlext-cropper-controls' }, [h('span', null, '拡大'), zoom]),
            fitButtons,
            h('div', { style: { fontSize: '0.78rem', color: 'var(--text-secondary,#888)', marginTop: '0.4rem' } },
                opts.hint || 'ドラッグで位置調整・スライダーで拡大して切り取ります。')
        ]);

        function cleanup() { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); }

        WL.dialog(opts.title || '画像を切り取り', body, {
            saveLabel: '登録',
            onSave: async (close) => {
                const canvas = document.createElement('canvas'); canvas.width = OUT_W; canvas.height = OUT_H;
                const ctx = canvas.getContext('2d');
                const k = OUT_W / STAGE_W;
                ctx.drawImage(img, ox * k, oy * k, nw * scale * k, nh * scale * k);
                const out = canvas.toDataURL('image/png');
                const view = { x: -ox / scale / nw, y: -oy / scale / nh, w: STAGE_W / scale / nw, h: STAGE_H / scale / nh };
                cleanup();
                await onDone(out, view);
                close();
            }
        });
    };

    /* ---------- トースト ---------- */
    function toastWrap() {
        let w = document.querySelector('.wlext-toast-wrap');
        if (!w) { w = h('div', { class: 'wlext-toast-wrap' }); document.body.appendChild(w); }
        return w;
    }
    WL.toast = function (msg, type) {
        const t = h('div', { class: 'wlext-toast ' + (type || '') }, msg);
        toastWrap().appendChild(t);
        setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2600);
    };

    /* ---------- 評価(★) 部品 ---------- */
    // onChange(value) を渡すと編集可能。省略で読み取り専用。
    WL.starsEl = function (value, onChange) {
        const wrap = h('div', { class: 'wlext-rating' + (onChange ? '' : ' readonly') });
        let cur = value || 0;
        const stars = [];
        function paint(n) { stars.forEach((s, i) => s.classList.toggle('on', i < n)); }
        for (let i = 1; i <= 5; i++) {
            const star = h('span', { class: 'wlext-star' }, '★');
            if (onChange) {
                star.addEventListener('mouseenter', () => paint(i));
                star.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); cur = i; onChange(i); });
            }
            stars.push(star); wrap.appendChild(star);
        }
        if (onChange) {
            wrap.addEventListener('mouseleave', () => paint(cur));
            const clr = h('span', { class: 'wlext-rating-clear', onClick: (e) => { e.stopPropagation(); e.preventDefault(); cur = 0; onChange(0); } }, 'クリア');
            wrap.appendChild(clr);
        }
        paint(cur);
        wrap.setValue = (n) => { cur = n; paint(n); };
        return wrap;
    };

    /* ---------- 単純チップ入力 (文字列の複数値) ---------- */
    WL.chipInput = function (initial, placeholder) {
        let values = (initial || []).slice();
        const box = h('div', { class: 'wlext-chips' });
        const input = h('input', { class: 'wlext-chip-input', placeholder: placeholder || '入力してEnter' });
        function render() {
            box.querySelectorAll('.wlext-chip').forEach(c => c.remove());
            values.forEach((v, idx) => {
                const chip = h('span', { class: 'wlext-chip' }, [v, h('span', { class: 'x', onClick: () => { values.splice(idx, 1); render(); } }, '×')]);
                box.insertBefore(chip, input);
            });
        }
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); const t = input.value.trim(); if (t && !values.includes(t)) { values.push(t); render(); } input.value = ''; }
            else if (e.key === 'Backspace' && !input.value && values.length) { values.pop(); render(); }
        });
        box.appendChild(input); render();
        box.addEventListener('click', () => input.focus());
        return { el: box, getValues: () => { const t = input.value.trim(); if (t && !values.includes(t)) values.push(t); return values.slice(); } };
    };

    /* ---------- 出演者入力 (サジェスト + 新規作成) ---------- */
    WL.performerInput = function (initial) {
        let values = (initial || []).map(p => ({ id: p.id, name: p.name })); // {id,name}
        const box = h('div', { class: 'wlext-chips', style: { position: 'relative' } });
        const input = h('input', { class: 'wlext-chip-input', placeholder: '出演者名を入力' });
        let suggestEl = null;
        function render() {
            box.querySelectorAll('.wlext-chip').forEach(c => c.remove());
            values.forEach((v, idx) => {
                const chip = h('span', { class: 'wlext-chip' }, [v.name, h('span', { class: 'x', onClick: () => { values.splice(idx, 1); render(); } }, '×')]);
                box.insertBefore(chip, input);
            });
        }
        function closeSuggest() { if (suggestEl) { suggestEl.remove(); suggestEl = null; } }
        async function add(name) {
            name = name.trim(); if (!name) return;
            if (values.some(v => v.name === name)) { input.value = ''; closeSuggest(); return; }
            try { const p = await WL.api.createPerformer(name); values.push({ id: p.id, name: p.name }); render(); }
            catch (e) { WL.toast('出演者の追加に失敗: ' + e.message, 'error'); }
            input.value = ''; closeSuggest();
        }
        const doSuggest = debounce(async () => {
            const q = input.value.trim();
            closeSuggest();
            if (!q) return;
            let list = [];
            try { list = await WL.api.searchPerformers(q); } catch (e) { }
            suggestEl = h('div', { class: 'wlext-suggest' });
            list.filter(p => !values.some(v => v.id === p.id)).forEach(p => {
                suggestEl.appendChild(h('div', { onMousedown: (e) => { e.preventDefault(); values.push({ id: p.id, name: p.name }); render(); input.value = ''; closeSuggest(); } }, p.name + (p.furigana ? '（' + p.furigana + '）' : '')));
            });
            suggestEl.appendChild(h('div', { style: { borderTop: '1px solid var(--border-primary,#ccc)', color: 'var(--accent,#007acc)' }, onMousedown: (e) => { e.preventDefault(); add(q); } }, '＋「' + q + '」を新規追加'));
            const r = input.getBoundingClientRect();
            suggestEl.style.position = 'fixed';
            suggestEl.style.left = r.left + 'px';
            suggestEl.style.top = (r.bottom + 2) + 'px';
            document.body.appendChild(suggestEl);
        }, 200);
        input.addEventListener('input', doSuggest);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });
        input.addEventListener('blur', () => setTimeout(closeSuggest, 200));
        box.appendChild(input); render();
        box.addEventListener('click', () => input.focus());
        return { el: box, getValues: () => values.slice() };
    };

    /* ---------- 汎用ダイアログ ---------- */
    WL.dialog = function (title, bodyEl, { onSave, saveLabel, danger } = {}) {
        const overlay = h('div', { class: 'wlext-overlay', onClick: (e) => { if (e.target === overlay) close(); } });
        const footer = h('div', { class: 'wlext-dialog-footer' });
        footer.appendChild(h('button', { class: 'wlext-btn', onClick: () => close() }, 'キャンセル'));
        if (onSave) footer.appendChild(h('button', { class: 'wlext-btn ' + (danger ? 'wlext-btn-danger' : 'wlext-btn-primary'), onClick: async (e) => { e.target.disabled = true; try { await onSave(close); } finally { if (e.target) e.target.disabled = false; } } }, saveLabel || '保存'));
        const dlg = h('div', { class: 'wlext-dialog' }, [
            h('div', { class: 'wlext-dialog-header' }, [h('span', { class: 'wlext-dialog-title' }, title), h('span', { class: 'wlext-close-x', onClick: () => close() }, '✕')]),
            h('div', { class: 'wlext-dialog-body' }, bodyEl),
            footer
        ]);
        overlay.appendChild(dlg);
        function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
        function onKey(e) { if (e.key === 'Escape') close(); }
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        return close;
    };

    /* ---------- タグのグループ化 (プリセット一覧の # 見出し) ---------- */
    // "# 名前" でグループ、"## 名前" でその下位(ネスト)。見出しの間のタグがそのグループに属する。
    function parseTagGroups(list) {
        const root = { name: null, level: 0, path: '', tags: [], children: [] };
        const stack = [root];
        (list || []).forEach(raw => {
            const line = String(raw == null ? '' : raw).trim();
            if (!line) return;
            const m = /^([#＃]+)\s*(.*)$/.exec(line);   // 半角# / 全角＃ どちらも見出しとして扱う
            if (m && m[2]) {
                const level = m[1].length;
                while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
                const parent = stack[stack.length - 1];
                const node = { name: m[2].trim(), level, path: parent.path + '' + m[2].trim(), tags: [], children: [] };
                parent.children.push(node);
                stack.push(node);
            } else {
                stack[stack.length - 1].tags.push(line);
            }
        });
        return root;
    }
    WL.parseTagGroups = parseTagGroups;

    // 本家プリセット(実タグ)と ext のグループレイアウト(# 入り)を突き合わせる。
    // 本家で増えたタグはデフォルトグループ(先頭の # より前)へ、消えたタグはレイアウトから除外。
    WL.reconcileTagLayout = function (layout, nativeTags) {
        const isHdr = s => /^[#＃]/.test(String(s == null ? '' : s).trim());
        layout = Array.isArray(layout) ? layout.slice() : [];
        // 本家プリセットに紛れ込んだ見出し(#)は無視する(グループは ext レイアウト側で定義)
        nativeTags = Array.isArray(nativeTags) ? nativeTags.map(s => String(s).trim()).filter(Boolean).filter(t => !isHdr(t)) : [];
        const nativeSet = new Set(nativeTags);
        const realSet = new Set(layout.filter(l => !isHdr(l)).map(s => String(s).trim()));
        const kept = layout.filter(l => isHdr(l) || nativeSet.has(String(l).trim()));
        const missing = nativeTags.filter(t => !realSet.has(t));
        if (!missing.length) return kept;
        const firstHdr = kept.findIndex(isHdr);
        if (firstHdr === -1) return [...kept, ...missing];
        return [...kept.slice(0, firstHdr), ...missing, ...kept.slice(firstHdr)];
    };

    // 動画タグ プリセット(グループ対応) の読み書き。動画単体ページ・一括追加で共用。
    // グループ定義(# 入り)は ext に保持し、本家プリセットには実タグのみを同期する。
    WL.loadVideoTagPresets = async function () {
        const [native, layout] = await Promise.all([
            WL.api.getVideoPresetTags(),
            WL.api.getVideoTagLayout().catch(() => [])
        ]);
        return WL.reconcileTagLayout(layout, native);
    };
    WL.saveVideoTagPresets = async function (arr) {
        await WL.api.saveVideoTagLayout(arr);
        await WL.api.saveVideoPresetTags(arr.filter(t => !/^[#＃]/.test(String(t).trim())));
    };

    /* ---------- プリセットタグ選択ダイアログ (動画タグと同じ操作感) ---------- */
    // opts: { title, current[], loadPresets()->Promise<string[]>, savePresets(arr)->Promise, onSave(selected[])->Promise }
    WL.presetTagDialog = function (opts) {
        let selected = (opts.current || []).slice();
        let presets = [];
        let editMode = false;
        const collapsed = {}; // path -> true(折りたたみ中)

        const chipsHost = h('div', { class: 'wlext-tagselect' });
        const textarea = h('textarea', {
            class: 'wlext-textarea', style: { minHeight: '220px', display: 'none' },
            placeholder: 'タグを1行に1つずつ入力...\n「# 名前」でグループ、「## 名前」で下位グループ(ネスト)。\n例:\n# 干支\n犬\n猿\n# 魚\nマグロ'
        });

        function tagChip(name) {
            const el = h('div', { class: 'wlext-tagselect-item' + (selected.includes(name) ? ' on' : '') }, name);
            el.addEventListener('click', () => {
                if (selected.includes(name)) { selected = selected.filter(t => t !== name); el.classList.remove('on'); }
                else { selected.push(name); el.classList.add('on'); }
            });
            return el;
        }
        function chipRow(tags) {
            const row = h('div', { class: 'wlext-tagselect-row' });
            tags.forEach(t => row.appendChild(tagChip(t)));
            return row;
        }
        function renderGroup(node) {
            const isCol = !!collapsed[node.path];
            const header = h('div', { class: 'wlext-taggroup-header' }, [
                h('span', { class: 'wlext-taggroup-name' }, node.name),
                h('span', { class: 'wlext-taggroup-tri' }, isCol ? '▶' : '▼')
            ]);
            header.addEventListener('click', () => { collapsed[node.path] = !isCol; renderChips(); });
            const wrap = h('div', { class: 'wlext-taggroup' }, header);
            if (!isCol) {
                const inner = h('div', { class: 'wlext-taggroup-body' });
                if (node.tags.length) inner.appendChild(chipRow(node.tags));
                node.children.forEach(c => inner.appendChild(renderGroup(c)));
                wrap.appendChild(inner);
            }
            return wrap;
        }
        function renderChips() {
            chipsHost.innerHTML = '';
            const tree = parseTagGroups(presets);
            // プリセットに無い選択中タグはデフォルトグループへ
            const presetSet = new Set();
            (function walk(n) { n.tags.forEach(t => presetSet.add(t)); n.children.forEach(walk); })(tree);
            selected.forEach(t => { if (!presetSet.has(t)) { tree.tags.push(t); presetSet.add(t); } });
            tree.tags = [...new Set(tree.tags)];
            if (!presetSet.size) {
                chipsHost.appendChild(h('div', { style: { color: 'var(--text-secondary,#888)', fontSize: '0.85rem' } }, 'プリセットタグがありません。「プリセット編集...」で追加してください。'));
                return;
            }
            if (tree.tags.length) chipsHost.appendChild(chipRow(tree.tags));
            tree.children.forEach(g => chipsHost.appendChild(renderGroup(g)));
        }

        Promise.resolve(opts.loadPresets()).then(p => { presets = Array.isArray(p) ? p : []; renderChips(); }).catch(() => renderChips());

        // プリセット編集中はダイアログのタイトルを「プリセット編集...」に差し替え、右に ? ヘルプを出す。
        let titleEl = null;
        function paintTitle() {
            if (!titleEl) return;
            titleEl.textContent = editMode ? 'プリセット編集...' : (opts.title || 'タグを設定');
            if (editMode && WL.presetHelpBtn) titleEl.appendChild(WL.presetHelpBtn());
        }

        const editBtn = h('button', { class: 'wlext-btn' }, 'プリセット編集...');
        editBtn.addEventListener('click', async () => {
            if (!editMode) {
                editMode = true;
                textarea.value = presets.join('\n');
                textarea.style.display = 'block';
                chipsHost.style.display = 'none';
                editBtn.textContent = 'プリセットを保存';
                paintTitle();
            } else {
                const arr = textarea.value.split('\n').map(s => s.trim()).filter(Boolean);
                try { await opts.savePresets(arr); presets = [...new Set(arr)]; }
                catch (e) { WL.toast('プリセットの保存に失敗: ' + e.message, 'error'); return; }
                editMode = false;
                textarea.style.display = 'none';
                chipsHost.style.display = 'flex';
                editBtn.textContent = 'プリセット編集...';
                paintTitle();
                renderChips();
                WL.toast('プリセットタグを保存しました', 'success');
            }
        });

        const body = h('div', null, [
            h('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' } }, editBtn),
            chipsHost,
            textarea
        ]);

        WL.dialog(opts.title || 'タグを設定', body, {
            saveLabel: 'OK',
            onSave: async (close) => {
                if (editMode) { WL.toast('先に「プリセットを保存」を押してください', 'error'); return; }
                await opts.onSave(selected);
                close();
            }
        });
        titleEl = body.closest('.wlext-dialog').querySelector('.wlext-dialog-title');
    };

    console.log('[LadyTube] core 初期化完了');
})();
