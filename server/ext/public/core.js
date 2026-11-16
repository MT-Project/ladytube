/* =============================================================
   WomanLive 拡張 - コア
   ・SPA ルート検知
   ・共通 UI (ライトボックス / トースト / チップ入力 など)
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt;

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

    // (v3.2.1 までは、ここに本家 API を包む fetch フックがあった: まとめたカードの手直し・タグの複製・関連動画の差し替え。
    //  今はサーバー (search.js・videoService.js) と本体の画面 (VideoList.jsx・SearchPage.jsx) が行う)


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
    WL.matchSettings = () => location.pathname === '/settings';

    // (v3.2.1 までは、ここに DOM 監視 WL.onEnsure / WL.requestEnsure があった。#root の変化のたびに、登録された関数を呼んで
    //  本体の画面へ差し込み直していた。差し込みはすべて本体の画面・差し込み口に移り、登録する所が無くなったので消した)

    // (v3.2.1 までは、ここにライトボックス WL.lightbox があった。今は本体の client/src/components/ExtImageDialogs.jsx)

    /* ---------- 画像クロッパ (任意アスペクト比) ---------- */
    // 本体の画面は client/src/components/ExtImageDialogs.jsx の ExtCropDialog を使う。ここは private のジャンル一覧のために残す (private が写すまで)
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

    // (v3.2.1 までは、ここにタグのプリセットのグループとタグ選択のダイアログ (WL.presetTagDialog) があった。
    //  今は本体の client/src/utils/tagPresets.js と components/ExtPresetTagDialog.jsx)

    console.log('[LadyTube] core 初期化完了');
})();
