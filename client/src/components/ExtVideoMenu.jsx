// LadyTube: 検索画面の動画の操作メニュー (v3.2.1 までは拡張の server/ext/public/bulkselect.js)。openExtDialog で開く:
//  ・選択モードの一括操作の丸ボタン (ExtSelection.jsx): anchor なし。右下に出て、見出しは「N件を一括操作」
//  ・リスト表示の「⋮」(VideoList.jsx): anchor にボタンの要素を渡すと、その下に出る。まとめたカードなら見出し「まとめた N本を操作」
// 操作: タグ追加 / 詳細情報編集 / 動画情報を取得 / ブックマーク追加 / 品番をファイル名から設定 (v3.11.0) /
//   ファイル名を変更 (1本のとき) かファイル名をルールで変更 (2本以上。どちらも v3.12.0・PC だけ。ExtRename.jsx) / 削除。ids は対象の動画 (まとめたカードは中の動画すべて。呼ぶ側が広げる)。
// 差し込み口 WL.videoMenuExtras に足した「項目を作る関数 (ids, close) => 要素」は「動画の削除」の上に並ぶ。
// done は操作が終わったら呼ぶ (選択の解除)。見た目は womanlive-ext.css の .wlext-sel-menu-* / .wlext-bm-dlg-*。
// タグ追加は ExtPresetTagDialog.jsx、詳細情報編集は ExtMetaEdit.jsx の ExtBulkMetaDialog (開くときに読む。v3.13.0)、
// 動画情報を取得は ExtMetaSearch.jsx の BulkMetaFetchDialog (開くときに読む。v3.15.0)。
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import { extGet, extSend } from '../services/extApi';
import { setBookmarked } from '../utils/bookmarks';
import { openExtDialog } from '../utils/extDialog';
import { isLocalPC, PC_ONLY } from '../utils/library';
import { toast } from '../utils/toast';
import { openRenameDialog, openRuleRenameDialog } from '../utils/fileRule';
import ExtPresetTagDialog from './ExtPresetTagDialog';
import { loadVideoTagPresets, saveVideoTagPresets } from '../utils/tagPresets';

const muted = { fontSize: '0.8rem', color: 'var(--text-secondary,#888)' };

// 操作のあと: 選択を解いて (done)、一覧を取り直させる
function afterAction(done) {
    if (done) done();
    window.dispatchEvent(new Event('library-updated'));
}

// ファイル名から品番を入れる (server/ext/modelno.js)。入っている品番は変えない。選択は解かない
async function doModelNo(ids) {
    let r;
    try { r = await extSend('POST', '/ext/api/model-no/bulk', { ids }); }
    catch (e) { toast('品番の設定に失敗: ' + e.message, 'error'); return; }
    const parts = [r.set + '件に品番を設定しました'];
    if (r.kept) parts.push('設定済み ' + r.kept + '件はそのまま');
    if (r.nomatch) parts.push('規則に合わない ' + r.nomatch + '件は未設定');
    toast(parts.join(' / '), r.set ? 'success' : 'error');
    if (r.set) afterAction(null);
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
                <div className="wlext-sel-menu-item" onClick={run((ids, done) => import('./ExtMetaEdit').then(m => openExtDialog(m.ExtBulkMetaDialog, { ids, onDone: () => afterAction(done) })))}><Icon name="pencil" size={15} /><span>詳細情報編集</span></div>
                <div className="wlext-sel-menu-item" onClick={run((ids, done) => import('./ExtMetaSearch').then(m => openExtDialog(m.BulkMetaFetchDialog, { ids, onDone: () => afterAction(done) })))}><Icon name="search" size={15} /><span>動画情報を取得</span></div>
                <div className="wlext-sel-menu-item" onClick={run(doBookmark)}><Icon name="bookmark-add" size={15} /><span>ブックマーク追加</span></div>
                <div className="wlext-sel-menu-item" onClick={run(doModelNo)}><Icon name="hash" size={15} /><span>品番をファイル名から設定</span></div>
                <div className={'wlext-sel-menu-item' + (isLocalPC ? '' : ' disabled')} title={isLocalPC ? '' : 'ファイル名の変更は、' + PC_ONLY}
                    onClick={run((ids) => (!isLocalPC ? toast('ファイル名の変更は、' + PC_ONLY, 'error') : ids.length === 1 ? openRenameDialog(String(ids[0])) : openRuleRenameDialog(ids)))}>
                    <Icon name="pencil" size={15} /><span>{ids.length === 1 ? 'ファイル名を変更' : 'ファイル名をルールで変更'}</span></div>
                <div ref={del} className={'wlext-sel-menu-item danger' + (isLocalPC ? '' : ' disabled')} title={isLocalPC ? '' : '動画の削除は、' + PC_ONLY}
                    onClick={run((ids, done) => (isLocalPC ? openExtDialog(DeleteDialog, { ids, done }) : toast('動画の削除は、' + PC_ONLY, 'error')))}><Icon name="trash" size={15} /><span>動画の削除</span></div>
            </div>
        </>,
        document.body
    );
}

/* ---------- タグ追加 ---------- */
function doTags(ids, done) {
    openExtDialog(ExtPresetTagDialog, {
        title: 'タグを追加（' + ids.length + '件）',
        current: [],
        // グループ対応の動画タグプリセット (動画単体ページと共用)
        loadPresets: loadVideoTagPresets,
        savePresets: saveVideoTagPresets,
        onSave: async (tags) => {
            if (!tags.length) { toast('追加するタグを選んでください', 'error'); return; }
            try { const r = await extSend('POST', '/ext/api/bulk/tags', { ids, tags }); toast(r.count + '件にタグを追加しました', 'success'); afterAction(done); }
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

// 1本のときの ExtBookmarkDialog (ExtCardParts.jsx) と同じく、フォルダは選ぶだけで「OK」で追加する (外す操作は無い)。
// 「＋追加」のフォルダはその場で作り (キャンセルしても残る)、選んだ状態で並べる
function BulkBookmarkDialog({ ids, folders: initial, onClose }) {
    const [folders, setFolders] = useState(initial);
    const [on, setOn] = useState(() => new Set());
    const input = useRef(null);
    const toggle = (id, add) => setOn(prev => { const s = new Set(prev); if (add ?? !s.has(id)) s.add(id); else s.delete(id); return s; });
    const add = async () => {
        const name = input.current.value.trim(); if (!name) return;
        try {
            const nf = await extSend('POST', '/ext/api/bookmark/folders', { name });
            input.current.value = '';
            setFolders(prev => [...prev, { id: nf.id, name: nf.name, count: 0 }]);
            toggle(nf.id, true);
        } catch (e) { toast('フォルダ追加に失敗: ' + e.message, 'error'); }
    };
    // 途中で失敗したら、追加できたフォルダの選択を外して閉じない (もう一度 OK で残りを追加する)
    const save = async () => {
        const picked = folders.filter(f => on.has(f.id));
        const done = [];
        try {
            for (const f of picked) {
                const r = await extSend('POST', '/ext/api/bulk/bookmark', { ids, folderId: f.id });
                done.push({ f, count: r.count });
            }
        } catch (e) { toast('失敗: ' + e.message, 'error'); return; }
        finally {
            if (done.length) {
                ids.forEach(id => setBookmarked(id, true));
                setOn(prev => { const s = new Set(prev); done.forEach(d => s.delete(d.f.id)); return s; });
            }
        }
        if (done.length === 1) toast('「' + done[0].f.name + '」に ' + done[0].count + '件追加しました', 'success');
        else if (done.length) toast(done.map(d => '「' + d.f.name + '」').join('') + 'に追加しました', 'success');
        onClose();
    };
    return (
        <ExtDialog title="ブックマークに一括追加" onClose={onClose} onSave={save} saveLabel="OK">
            <div>
                <div style={{ ...muted, marginBottom: '0.5rem' }}>{'選択した ' + ids.length + '件を追加するフォルダを選んで「OK」を押してください。'}</div>
                <div className="wlext-bm-dlg-list">
                    {folders.length ? folders.map(f => (
                        <div key={f.id} className={'wlext-bm-dlg-item' + (on.has(f.id) ? ' on' : '')} onClick={() => toggle(f.id)}>
                            <span className="name">{f.name}</span><span className="chk">{on.has(f.id) ? '✓' : ''}</span>
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
// 動画ファイルはごみ箱へ送る (v3.4.0 までは即削除)。ごみ箱が使えない場所の本数 (noTrash) を先に聞いて、その分は完全に消えると書く
function DeleteDialog({ ids, done, onClose }) {
    const [noTrash, setNoTrash] = useState(0);
    useEffect(() => {
        let alive = true;
        extSend('POST', '/ext/api/bulk/delete/check', { ids }).then(r => { if (alive) setNoTrash(r.noTrash || 0); }, () => { });
        return () => { alive = false; };
    }, [ids]);
    const remove = async () => {
        try {
            const r = await extSend('POST', '/ext/api/bulk/delete', { ids });
            const failed = r.fileErrors ? '（' + r.fileErrors + '件はファイルを削除できなかったので残しました）' : '';
            toast(r.deleted + '件を削除しました' + failed, r.deleted || !r.fileErrors ? 'success' : 'error');
            onClose(); afterAction(done);
        } catch (e) { toast('削除に失敗: ' + e.message, 'error'); }
    };
    const red = { color: 'var(--status-error,#e51400)', fontWeight: 'bold' };
    return (
        <ExtDialog title="動画の削除" onClose={onClose} onSave={remove} saveLabel="削除する" danger>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div style={{ ...red, marginBottom: '0.4rem' }}>{'選択した ' + ids.length + '件の動画を削除します'}</div>
                <div>元の動画ファイルはごみ箱へ送ります。関連するスクリーンショット・カバー画像・追加情報・ブックマークは削除され、動画をごみ箱から戻しても元に戻りません。</div>
                {noTrash > 0 && <div style={{ ...red, marginTop: '0.4rem' }}>{(noTrash === ids.length ? '' : 'このうち ' + noTrash + '件は、') + 'ごみ箱が使えない場所（ネットワークや USB メモリなど）にあるので、動画ファイルも完全に削除されます。'}</div>}
                <div style={{ marginTop: '0.4rem', fontWeight: 'bold' }}>よろしいですか？</div>
            </div>
        </ExtDialog>
    );
}
