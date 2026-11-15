// LadyTube: 検索画面の動画の操作メニュー (v3.2.1 までは拡張の server/ext/public/bulkselect.js)。openExtDialog で開く:
//  ・選択モードの一括操作の丸ボタン (ExtSelection.jsx): anchor なし。右下に出て、見出しは「N件を一括操作」
//  ・リスト表示の「⋮」(VideoList.jsx): anchor にボタンの要素を渡すと、その下に出る。まとめたカードなら見出し「まとめた N本を操作」
// 操作: タグ追加 / 詳細情報編集 / ブックマーク追加 / 削除。ids は対象の動画 (まとめたカードは中の動画すべて。呼ぶ側が広げる)。
// 差し込み口 WL.videoMenuExtras に足した「項目を作る関数 (ids, close) => 要素」は「動画の削除」の上に並ぶ。
// done は操作が終わったら呼ぶ (選択の解除)。見た目は womanlive-ext.css の .wlext-sel-menu-* / .wlext-bm-dlg-*。
// タグ追加と詳細情報編集のダイアログは、拡張の部品 (WL.presetTagDialog / chipInput / performerInput。private も使う) で組む。
import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import { extGet, extSend } from '../services/extApi';
import { setBookmarked } from '../utils/bookmarks';
import { openExtDialog } from '../utils/extDialog';

const toast = (msg, type) => window.WLExt?.toast?.(msg, type);
const muted = { fontSize: '0.8rem', color: 'var(--text-secondary,#888)' };

// 操作のあと: 選択を解いて (done)、一覧を取り直させる
function afterAction(done) {
    if (done) done();
    window.dispatchEvent(new Event('library-updated'));
}

export default function ExtVideoMenu({ ids, anchor, done, onClose }) {
    const menu = useRef(null);
    const del = useRef(null);
    useLayoutEffect(() => {
        const extras = Object.values(window.WLExt?.videoMenuExtras || {}).map(make => make(ids, onClose)).filter(Boolean);
        extras.forEach(x => del.current.parentNode.insertBefore(x, del.current));
        if (anchor) {
            // ボタンの直下、右端をそろえる。画面の下にはみ出すなら上側へ
            const el = menu.current, r = anchor.getBoundingClientRect();
            let left = r.right - el.offsetWidth; if (left < 8) left = 8;
            let top = r.bottom + 6;
            if (top + el.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - el.offsetHeight - 6);
            el.style.left = left + 'px';
            el.style.top = top + 'px';
        }
        return () => extras.forEach(x => x.remove());
    }, [ids, anchor, onClose]);
    const run = (fn) => () => { onClose(); fn(ids, done); };
    const head = anchor ? (ids.length > 1 ? 'まとめた ' + ids.length + '本を操作' : null) : ids.length + '件を一括操作';
    return createPortal(
        <>
            <div className="wlext-sel-menu-backdrop" onClick={onClose} />
            <div ref={menu} className={'wlext-sel-menu' + (anchor ? ' wlext-sel-menu-anchored' : '')}>
                {head && <div className="wlext-sel-menu-head">{head}</div>}
                <div className="wlext-sel-menu-item" onClick={run(doTags)}><Icon name="tag" size={15} /><span>タグ追加</span></div>
                <div className="wlext-sel-menu-item" onClick={run(doMeta)}>✎ 詳細情報編集</div>
                <div className="wlext-sel-menu-item" onClick={run(doBookmark)}><Icon name="bookmark-add" size={15} /><span>ブックマーク追加</span></div>
                <div ref={del} className="wlext-sel-menu-item danger" onClick={run((ids, done) => openExtDialog(DeleteDialog, { ids, done }))}>🗑 動画の削除</div>
            </div>
        </>,
        document.body
    );
}

/* ---------- タグ追加 ---------- */
function doTags(ids, done) {
    const WL = window.WLExt;
    WL.presetTagDialog({
        title: 'タグを追加（' + ids.length + '件）',
        current: [],
        // グループ対応の動画タグプリセット (動画単体ページと共用)
        loadPresets: () => WL.loadVideoTagPresets(),
        savePresets: (arr) => WL.saveVideoTagPresets(arr),
        onSave: async (tags) => {
            if (!tags.length) { toast('追加するタグを選んでください', 'error'); return; }
            try { const r = await extSend('POST', '/ext/api/bulk/tags', { ids, tags }); toast(r.count + '件にタグを追加しました', 'success'); afterAction(done); }
            catch (e) { toast('失敗: ' + e.message, 'error'); }
        }
    });
}

/* ---------- 詳細情報編集 (表示動画名なし) ---------- */
function doMeta(ids, done) {
    const WL = window.WLExt, h = WL.h;
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
        h('div', { style: { ...muted, marginBottom: '0.6rem' } },
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
            try { const r = await extSend('POST', '/ext/api/bulk/meta', { ids, meta }); toast(r.count + '件を更新しました', 'success'); close(); afterAction(done); }
            catch (e) { toast('失敗: ' + e.message, 'error'); }
        }
    });
}

/* ---------- ブックマーク一括追加 ---------- */
async function doBookmark(ids) {
    let folders;
    try { folders = await extGet('/ext/api/bookmark/folders'); } catch (e) { toast('読み込み失敗: ' + e.message, 'error'); return; }
    openExtDialog(BulkBookmarkDialog, { ids, folders });
}

function BulkBookmarkDialog({ ids, folders: initial, onClose }) {
    const [folders, setFolders] = useState(initial);
    const input = useRef(null);
    const addTo = async (folderId) => {
        const r = await extSend('POST', '/ext/api/bulk/bookmark', { ids, folderId });
        ids.forEach(id => setBookmarked(id, true));
        return r;
    };
    const pick = async (f) => {
        try { const r = await addTo(f.id); toast('「' + f.name + '」に ' + r.count + '件追加しました', 'success'); }
        catch (e) { toast('失敗: ' + e.message, 'error'); }
    };
    const add = async () => {
        const name = input.current.value.trim(); if (!name) return;
        try {
            const nf = await extSend('POST', '/ext/api/bookmark/folders', { name });
            const r = await addTo(nf.id);
            setFolders([...folders, { id: nf.id, name: nf.name, count: r.count }]);
            input.current.value = '';
            toast('「' + nf.name + '」に追加しました', 'success');
        } catch (e) { toast('失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title="ブックマークに一括追加" onClose={onClose}>
            <div>
                <div style={{ ...muted, marginBottom: '0.5rem' }}>{'選択した ' + ids.length + '件を追加するフォルダをタップしてください。'}</div>
                <div className="wlext-bm-dlg-list">
                    {folders.length ? folders.map(f => (
                        <div key={f.id} className="wlext-bm-dlg-item" onClick={() => pick(f)}>
                            <span className="name">{f.name}</span><span className="chk">＋</span>
                        </div>
                    )) : <div style={{ color: 'var(--text-secondary,#888)', fontSize: '0.85rem', padding: '0.5rem' }}>フォルダがありません。下で追加してください。</div>}
                </div>
                <div className="wlext-inline" style={{ marginTop: '0.8rem' }}>
                    <input ref={input} className="wlext-input" placeholder="新しいフォルダ名" />
                    <button className="wlext-btn" onClick={add}>＋追加</button>
                </div>
            </div>
        </ExtDialog>
    );
}

/* ---------- 削除 ---------- */
function DeleteDialog({ ids, done, onClose }) {
    const remove = async () => {
        try {
            const r = await extSend('POST', '/ext/api/bulk/delete', { ids });
            toast(r.deleted + '件を削除しました' + (r.fileErrors ? '（ファイル削除に失敗 ' + r.fileErrors + '件）' : ''), 'success');
            onClose(); afterAction(done);
        } catch (e) { toast('削除に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title="動画の削除" onClose={onClose} onSave={remove} saveLabel="削除する" danger>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ color: 'var(--status-error,#e51400)', fontWeight: 'bold', marginBottom: '0.4rem' }}>{'⚠ 選択した ' + ids.length + '件の動画を削除します'}</div>
                <div>元の動画ファイルが削除され、関連するスクリーンショット・カバー画像・追加情報・ブックマークも削除されます。</div>
                <div style={{ marginTop: '0.4rem', fontWeight: 'bold' }}>この操作は元に戻せません。よろしいですか？</div>
            </div>
        </ExtDialog>
    );
}
