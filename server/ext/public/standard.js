/* =============================================================
   WomanLive 拡張 - 動画ページの標準モード: 右欄の一覧
   標準モードそのもの (切替・右欄の見出し・大きさ) は本体の画面 (client/src/components/ExtStandard.jsx) にある。
   ここは右欄の「同じシリーズ」「関連動画」の中身を描く。呼ぶ側は pane.dataset.vid に動画 id を入れてから呼ぶ
   (描いている間に別の動画へ移ったら、古い結果は捨てる)。
   ・WL.renderStdSeries(pane, vid): 同じ品番 (分割されたパート) と、同じシリーズの作品
   ・WL.renderStdRelated(pane, vid, { relatedIds, nextVideoId }): 関連動画
   ============================================================= */
(function () {
    'use strict';
    const WL = window.WLExt; const h = WL.h;

    const msg = (text) => h('div', { class: 'wlext-std-msg' }, text);
    const sameModel = (a, b) => !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();

    WL.renderStdSeries = async (pane, vid) => {
        pane.replaceChildren(msg('読み込み中...'));
        let r;
        try { r = await WL.api.videoSiblings(vid); } catch (e) { pane.replaceChildren(msg('読み込みに失敗しました: ' + e.message)); return; }
        if (pane.dataset.vid !== vid) return;
        const out = [];
        // 同じ品番 (分割されたパート) を先頭に。「同じ品番」を押すとその品番で検索する
        if (r.parts.length > 1) {
            out.push(h('div', { class: 'wlext-std-sec' }, [
                WL.navA(WL.searchHref('@model:"' + r.modelNo + '"'), { class: 'wlext-link', title: '品番「' + r.modelNo + '」で検索' }, '同じ品番'),
                h('span', { class: 'wlext-std-sec-n' }, '（' + r.parts.length + '本）'),
            ]));
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
    };

    WL.renderStdRelated = async (pane, vid, info) => {
        const ids = (info && info.relatedIds) || [];
        if (!ids.length) { pane.replaceChildren(msg('関連動画はありません')); return; }
        pane.replaceChildren(msg('読み込み中...'));
        let r;
        try { r = await WL.api.videosBrief(ids); } catch (e) { pane.replaceChildren(msg('読み込みに失敗しました: ' + e.message)); return; }
        if (pane.dataset.vid !== vid) return;
        const list = h('div', { class: 'wlext-vrow-list' });
        r.videos.forEach(v => list.appendChild(WL.videoRow(v, { note: String(v.id) === String(info.nextVideoId) ? '次に再生' : '' })));
        pane.replaceChildren(list);
    };
})();
