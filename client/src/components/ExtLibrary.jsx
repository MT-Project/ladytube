// LadyTube: 管理画面の「拡張機能：ライブラリ」(一覧・作成・取り込み・名前変更・切り替え・削除。ExtSettingsParts.jsx が置く)。
// v3.2.1 までは拡張の server/ext/public/library.js。仕組みは server/ext/library.js、切り替えと通信の印は utils/library.js、
// 書き込みの拒否は server/ext/routes/library.js、ヘッダーのライブラリ名は ExtLibraryPill.jsx。見た目は womanlive-ext.css の .wlext-lib-*。
import { useEffect, useRef, useState } from 'react';
import { ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import { FolderPicker } from './ExtSettingsSections';
import { extGet, extSend } from '../services/extApi';
import { currentLibrary, switchLibrary } from '../utils/library';
import { GOTO_KEY } from './ExtLibraryPill';
import { openExtDialog } from '../utils/extDialog';
import { toast } from '../utils/toast';

const LIB = currentLibrary;
const MODES = [
    ['empty', '空のライブラリ'],
    ['settings', '今のライブラリの設定を引き継ぐ（動画とメタデータは空）'],
    ['clone', '今のライブラリを丸ごと複製'],
];

function fmtSize(n) {
    if (n == null) return '-';
    if (n >= 1024 * 1024 * 1024) return (n / 1024 / 1024 / 1024).toFixed(1) + ' GB';
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
    return Math.max(1, Math.round(n / 1024)) + ' KB';
}
function fmtWhen(s) {
    if (!s) return '-';
    const d = new Date(s); if (isNaN(d)) return '-';
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

/* ---------- 管理画面: ライブラリ ---------- */
const Note = ({ children }) => <div className="wlext-lib-note">{children}</div>;

function RenameDialog({ l, onDone, onClose }) {
    const inp = useRef(null);
    useEffect(() => { const t = setTimeout(() => inp.current?.focus(), 50); return () => clearTimeout(t); }, []);
    const save = async () => {
        try {
            const r = await extSend('PUT', '/ext/api/libraries/' + encodeURIComponent(l.id), { name: inp.current.value.trim() });
            toast('名前を「' + r.name + '」に変更しました', 'success');
            onClose();
            // ヘッダーの表示は読み直しで変わる (使用中のものを変えたとき)
            if (l.active) setTimeout(() => location.reload(), 400); else onDone();
        } catch (e) { toast(e.message, 'error'); }
    };
    return (
        <ExtDialog title="ライブラリの名前を変更" onClose={onClose} onSave={save} saveLabel="変更">
            <div><input ref={inp} className="wlext-input" defaultValue={l.name} maxLength="40" /></div>
        </ExtDialog>
    );
}

function DeleteDialog({ l, onDone, onClose }) {
    const inp = useRef(null);
    const del = async () => {
        if (inp.current.value.trim() !== l.name) { toast('名前が一致しません', 'error'); return; }
        try {
            await extSend('DELETE', '/ext/api/libraries/' + encodeURIComponent(l.id));
            toast('「' + l.name + '」を削除しました', 'success');
            onClose();
            onDone();
        } catch (e) { toast(e.message, 'error'); }
    };
    return (
        <ExtDialog title="ライブラリを削除" onClose={onClose} onSave={del} saveLabel="削除する" danger>
            <div style={{ fontSize: '0.9rem', lineHeight: '1.7' }}>
                <div>{'ライブラリ「' + l.name + '」を削除します。動画ファイルそのものは消えません。'}</div>
                <div>データベースのファイルは libraries\_trash フォルダへ移します（元に戻すときはそこから戻せます）。</div>
                <div style={{ marginTop: '0.6rem' }}>確認のため、ライブラリの名前を入力してください。</div>
                <input ref={inp} className="wlext-input" placeholder={l.name} />
            </div>
        </ExtDialog>
    );
}

function LibraryRow({ l, data, reload }) {
    const info = [l.videos != null ? l.videos + '本' : '-', fmtSize(l.size), '最終利用 ' + (l.active ? '使用中' : fmtWhen(l.last_used_at))].join(' / ');
    return (
        <div className={'wlext-lib-row' + (l.active ? ' wlext-lib-row-active' : '')}>
            <div className="wlext-lib-main">
                <div className="wlext-lib-name">
                    <Icon name="database" size={16} /><span>{l.name}</span>
                    {l.active && <span className="wlext-lib-badge wlext-lib-badge-active">使用中</span>}
                    {l.isDefault && <span className="wlext-lib-badge">既定</span>}
                    {l.missing && <span className="wlext-lib-badge wlext-lib-badge-warn">ファイルなし</span>}
                </div>
                <div className="wlext-lib-info">{info}</div>
            </div>
            <div className="wlext-lib-btns">
                {!l.active && <button className="wlext-btn" disabled={!data.local || l.missing} title={data.local ? '' : 'この PC からのみ切り替えられます'} onClick={() => switchLibrary(l)}>切り替え</button>}
                <button className="wlext-btn" onClick={() => openExtDialog(RenameDialog, { l, onDone: reload })}>名前変更</button>
                {!l.isDefault && !l.active && <button className="wlext-btn wlext-btn-danger" disabled={!data.local} title={data.local ? '' : 'この PC からのみ削除できます'} onClick={() => openExtDialog(DeleteDialog, { l, onDone: reload })}>削除</button>}
            </div>
        </div>
    );
}

export function ExtLibrarySettings() {
    const [data, setData] = useState(null);   // null = 読み込み中 / { error } / 一覧
    const [busy, setBusy] = useState('');     // 'create' / 'import'
    const name = useRef(null), mode = useRef(null), path = useRef(null), impName = useRef(null), block = useRef(null);
    const reload = () => extGet('/ext/api/libraries').then(setData, e => setData({ error: e.message }));
    useEffect(() => {
        extGet('/ext/api/libraries').then(setData, e => setData({ error: e.message }));
        // ヘッダーのメニューの「ライブラリの管理」から来たときはこの項目へ
        let go = null;
        try { go = sessionStorage.getItem(GOTO_KEY); sessionStorage.removeItem(GOTO_KEY); } catch { /* 移らないだけ */ }
        if (go) { const t = setTimeout(() => block.current?.scrollIntoView(), 300); return () => clearTimeout(t); }
    }, []);
    const create = async () => {
        setBusy('create');
        try {
            const r = await extSend('POST', '/ext/api/libraries', { name: name.current.value.trim(), mode: mode.current.value });
            toast('ライブラリ「' + r.name + '」を作成しました', 'success');
            name.current.value = '';
            await reload();
        } catch (e) { toast(e.message, 'error'); }
        finally { setBusy(''); }
    };
    const doImport = async () => {
        setBusy('import');
        try {
            const r = await extSend('POST', '/ext/api/libraries/import', { path: path.current.value.trim(), name: impName.current.value.trim() });
            const p = r.performers || {};
            toast('「' + r.name + '」として取り込みました' + (p.merged ? '（出演者 ' + p.merged + '名を共通の出演者へまとめ、うち ' + p.added + '名を追加）' : ''), 'success');
            path.current.value = ''; impName.current.value = '';
            await reload();
        } catch (e) { toast(e.message, 'error'); }
        finally { setBusy(''); }
    };
    const msgs = [];
    if (data && !data.error) {
        if (data.warning) msgs.push(data.warning);
        if (!data.canRestart) msgs.push('この起動方法では自動で再起動できません。切り替えたあとはサーバーを起動し直してください。');
    }
    if (!LIB) return null;
    return (
        <div ref={block} className="wlext-settings-host wlext-settings-section wlext-lib-section">
            <h3 className="wlext-ext-h3"><Icon name="database" size={16} /><span>拡張機能：ライブラリ</span></h3>
            <Note>ライブラリごとに、スキャン対象フォルダ・動画・タグ・評価などのメタデータを別々に持ちます。出演者・公開設定・プリセットタグ・FANZA API・出演者タグは全ライブラリ共通です。切り替えと削除は、サーバーを動かしている PC（localhost）からのみ行えます。</Note>
            <div className="wlext-lib-warning" style={{ display: msgs.length ? '' : 'none' }}>{msgs.join('\n')}</div>
            <div className="wlext-lib-list">
                {data && (data.error ? '読み込みに失敗: ' + data.error : data.libraries.map(l => <LibraryRow key={l.id} l={l} data={data} reload={reload} />))}
            </div>
            <h4 className="wlext-lib-h4">新しく作る</h4>
            <div className="wlext-inline wlext-lib-form">
                <input ref={name} className="wlext-input" placeholder="新しいライブラリの名前" maxLength="40" />
                <select ref={mode} className="wlext-input wlext-lib-mode">{MODES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                <button className="wlext-btn wlext-btn-primary" disabled={busy === 'create'} onClick={create}>作成</button>
            </div>
            <h4 className="wlext-lib-h4">ほかの videos.db を取り込む</h4>
            <Note>指定した videos.db をコピーして新しいライブラリにします（元のファイルは変更しません）。フォルダを選ぶと、その中の videos.db を取り込みます。出演者は名前で突き合わせて共通の出演者へまとめます。</Note>
            <div className="wlext-inline wlext-lib-form">
                <input ref={path} className="wlext-input" placeholder="(例) D:\WomanLive\videos.db （フォルダでも可）" />
                <button className="wlext-btn" onClick={() => openExtDialog(FolderPicker, { onSelect: (p) => { path.current.value = p; } })}>参照...</button>
            </div>
            <div className="wlext-inline wlext-lib-form">
                <input ref={impName} className="wlext-input" placeholder="ライブラリの名前" maxLength="40" />
                <button className="wlext-btn wlext-btn-primary" disabled={busy === 'import'} onClick={doImport}>{busy === 'import' ? '取り込み中…' : '取り込む'}</button>
            </div>
        </div>
    );
}
