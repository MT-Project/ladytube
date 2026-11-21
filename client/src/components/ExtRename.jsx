// LadyTube: 動画のファイル名の変更 (v3.12.0。サーバーは server/ext/rename.js。PC からだけ)
//  ・ExtRenameDialog: 1本の名前を入力して変える (動画ページの「動画ファイル名」の行と、リスト表示の「⋮」)。「ルールで作る」で入力欄にルールの名前を入れる
//  ・ExtRuleRenameDialog: 選んだ動画をファイル名のルールで変える (一括操作と、まとめたカードの「⋮」)。変える前と後の一覧を出してから変える
// 拡張子は変えない。同じ名前の字幕と、カバー画像のフォルダの同じ名前の画像も一緒に変わる。見た目は womanlive-ext.css の .wlext-rename-*
import { useEffect, useState } from 'react';
import { ExtDialog } from './ExtDialog';
import { extGet, extSend } from '../services/extApi';
import { loadMeta } from '../utils/videoMeta';
import { notifyRenamed } from '../utils/fileRule';
import { toast } from '../utils/toast';

const muted = { fontSize: '0.8rem', color: 'var(--text-secondary,#888)' };
const splitExt = (fn) => { const m = /^(.*?)(\.[^.]*)?$/.exec(fn || ''); return [m[1], m[2] || '']; };

// 変えたあとの通知 (一緒に変えたファイルと、変えられなかったファイル)
function tellResult(r) {
    toast('ファイル名を変更しました' + (r.moved?.length ? '（' + r.moved.join('、') + ' も）' : ''), 'success');
    (r.warnings || []).forEach(w => toast(w, 'error'));
}

export function ExtRenameDialog({ id, onClose }) {
    const [cur, setCur] = useState(null);   // 今のファイル名
    const [name, setName] = useState('');
    useEffect(() => {
        loadMeta(id).then(m => { setCur(m.file_name || ''); setName(splitExt(m.file_name)[0]); }, e => toast('読み込みに失敗: ' + e.message, 'error'));
    }, [id]);
    const [, ext] = splitExt(cur);
    const fromRule = async () => {
        try {
            const t = (await extSend('POST', '/ext/api/rename/rule', { ids: [id], dryRun: true })).items[0];
            if (t.stem) setName(t.stem); else toast(t.error || 'ルールで名前を作れません', 'error');
        } catch (e) { toast(e.message, 'error'); }
    };
    const save = async () => {
        try {
            const r = await extSend('POST', '/ext/api/video/' + id + '/rename', { name: name.trim() });
            if (r.same) toast('ファイル名は変わりません', 'success'); else { tellResult(r); notifyRenamed([id]); }
            onClose();
        } catch (e) { toast(e.message, 'error'); }
    };
    return (
        <ExtDialog title="ファイル名を変更" onClose={onClose} onSave={cur === null ? null : save} saveLabel="変更する">
            <div className="wlext-rename-cur">{cur === null ? '読み込み中...' : '今の名前: ' + cur}</div>
            <div className="wlext-inline">
                <input className="wlext-input wlext-rename-input" value={name} onChange={e => setName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && cur !== null) save(); }} autoFocus />
                <span className="wlext-rename-ext">{ext}</span>
            </div>
            <div className="wlext-inline" style={{ marginTop: '0.5rem' }}>
                <button className="wlext-btn" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={fromRule}>ルールで作る</button>
                <span style={muted}>管理画面の「ファイル名のルール」で名前を作り、入力欄に入れます。</span>
            </div>
            <div style={{ ...muted, marginTop: '0.6rem' }}>拡張子は変わりません。同じ名前の字幕ファイルと、カバー画像のフォルダの同じ名前の画像も一緒に変えます。</div>
        </ExtDialog>
    );
}

const STATUS = { ok: '変える', same: '同じ名前', error: '変えられない', done: '変えた' };

export function ExtRuleRenameDialog({ ids, onClose }) {
    const [rule, setRule] = useState('');
    const [items, setItems] = useState(null);   // ruleTargets / applyRule の戻り
    const [done, setDone] = useState(false);
    useEffect(() => {
        extGet('/ext/api/settings').then(s => setRule(s.rename_rule || ''), () => { });
        extSend('POST', '/ext/api/rename/rule', { ids, dryRun: true }).then(r => setItems(r.items), e => { toast(e.message, 'error'); setItems([]); });
    }, [ids]);
    const n = items ? items.filter(t => t.status === 'ok').length : 0;
    const apply = async () => {
        try {
            const r = await extSend('POST', '/ext/api/rename/rule', { ids, dryRun: false });
            setItems(r.items); setDone(true);
            const ok = r.items.filter(t => t.status === 'done');
            const ng = r.items.filter(t => t.status === 'error').length;
            toast(ok.length + '本の名前を変えました' + (ng ? ' / ' + ng + '本は変えられませんでした' : ''), ok.length ? 'success' : 'error');
            ok.forEach(t => (t.warnings || []).forEach(w => toast(w, 'error')));
            if (ok.length) notifyRenamed(ok.map(t => t.id));
        } catch (e) { toast(e.message, 'error'); }
    };
    return (
        <ExtDialog title={'ファイル名をルールで変更（' + ids.length + '本）'} onClose={onClose}
            onSave={!done && n ? apply : null} saveLabel={'変更する（' + n + '本）'} cancelLabel={done ? '閉じる' : null}>
            <div style={muted}>{'ルール: ' + rule + '　（管理画面の「ファイル名のルール」で変えられます）'}</div>
            {!items ? <div style={{ marginTop: '0.6rem' }}>確かめています...</div>
                : <div className="wlext-rename-list">
                    {items.map(t => (
                        <div key={t.id} className={'wlext-rename-row ' + t.status} title={t.to || ''}>
                            <span className="st">{STATUS[t.status]}</span>
                            <span className="from">{t.from}</span>
                            <span className="arrow">→</span>
                            <span className="to">{t.status === 'error' ? t.error : t.to}</span>
                        </div>
                    ))}
                </div>}
        </ExtDialog>
    );
}
