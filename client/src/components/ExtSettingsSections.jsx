// LadyTube: 管理画面の拡張機能の項目 (v3.2.1 までは拡張の server/ext/public/settings.js)。
// カバー画像 / DMM 商品検索API / 出演者タグ 自動付与ルール / 関連動画の重み付け / メンテナンス / バックアップ。
// 置き場所と並びは SettingsPage.jsx が ExtSettingsSection name="..." で決める (ExtSettingsParts.jsx がここの部品を選ぶ)。
// 見た目は womanlive-ext.css の .wlext-settings-section・.wlext-rule-*・.wlext-related-*。入力欄は押したときに欄の値を読む。
import { useEffect, useRef, useState } from 'react';
import { ExtConfirm, ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import FolderPicker from './FolderPicker';
import { extGet, extSend } from '../services/extApi';
import { openExtDialog } from '../utils/extDialog';
import { currentLibrary } from '../utils/library';
import { toast } from '../utils/toast';

const desc = (mb) => ({ fontSize: '0.8rem', color: 'var(--text-secondary,#777)', marginBottom: mb });
const resultStyle = { fontSize: '0.82rem', marginTop: '0.6rem', whiteSpace: 'pre-wrap' };

function Section({ title, children }) {
    return (
        <div className="wlext-settings-host wlext-settings-section">
            <h3 className="wlext-ext-h3"><Icon name="puzzle" size={16} /><span>{'拡張機能：' + title}</span></h3>
            {children}
        </div>
    );
}

// カバー画像フォルダと DMM の設定は同じ API で読むので、同時に読むときは1回にまとめる
let extSettingsP = null;
const extSettings = () => extSettingsP || (extSettingsP = extGet('/ext/api/settings').finally(() => { extSettingsP = null; }));

export function ExtCoverSettings() {
    const input = useRef(null);
    useEffect(() => { extSettings().then(s => { input.current.value = s.cover_folder || ''; }, () => { }); }, []);
    const save = async () => {
        try { await extSend('POST', '/ext/api/settings', { cover_folder: input.current.value.trim() }); toast('カバー画像フォルダを保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <Section title="カバー画像">
            <div style={desc('0.5rem')}>動画ファイル名と同じ名前の画像（例: AAA.mp4 → AAA.jpg）をこのフォルダから探し、動画ページのカバー画像として表示します。</div>
            <div className="wlext-inline">
                <input ref={input} className="wlext-input" placeholder={'(例) C:\\covers'} defaultValue="" />
                <button className="wlext-btn" onClick={() => openFolderPicker((p) => { input.current.value = p; })}>参照...</button>
                <button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button>
            </div>
        </Section>
    );
}

export function ExtDmmSettings() {
    const api = useRef(null), aff = useRef(null);
    useEffect(() => { extSettings().then(s => { api.current.value = s.dmm_api_id || ''; aff.current.value = s.dmm_affiliate_id || ''; }, () => { }); }, []);
    const save = async () => {
        try { await extSend('POST', '/ext/api/settings', { dmm_api_id: api.current.value.trim(), dmm_affiliate_id: aff.current.value.trim() }); toast('DMM API設定を保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <Section title="DMM(FANZA) 商品検索API">
            <div style={desc('0.6rem')}>各動画ページの🔍ボタンで品番からFANZA商品情報を検索し、メタデータへ自動設定します。利用にはご自身のDMMアカウントで取得したAPI IDとアフィリエイトIDが必要です。</div>
            <div className="wlext-field"><label>API ID</label><input ref={api} className="wlext-input" placeholder="API ID" defaultValue="" /></div>
            <div className="wlext-field"><label>アフィリエイトID</label><input ref={aff} className="wlext-input" placeholder="アフィリエイトID (例: xxxxx-999)" defaultValue="" /></div>
            <div className="wlext-inline"><button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button></div>
        </Section>
    );
}

// 参照されていない拡張データ。本家の「クリーンアップ」でも同じ掃除が走るが、件数を確かめてから単独でも消せる
export function ExtMaintenanceSettings() {
    const [state, setState] = useState({ text: '確認中...', can: false });
    const paint = (d) => setState(d.total
        ? { text: d.items.filter(i => i.count).map(i => i.label + ': ' + i.count + '件').join('\n'), can: true }
        : { text: '参照されていないデータはありません。', can: false });
    const refresh = async () => {
        setState({ text: '確認中...', can: false });
        try { paint(await extGet('/ext/api/maintenance/orphans')); }
        catch (e) { setState({ text: 'エラー: ' + e.message, can: false }); }
    };
    useEffect(() => {
        extGet('/ext/api/maintenance/orphans').then(paint, e => setState({ text: 'エラー: ' + e.message, can: false }));
    }, []);
    const clean = async () => {
        let d;
        try { d = await extGet('/ext/api/maintenance/orphans'); }
        catch (e) { toast('確認に失敗: ' + e.message, 'error'); return; }
        if (!d.total) { toast('削除するデータはありません', 'error'); paint(d); return; }
        openExtDialog(ExtConfirm, {
            title: '参照されていないデータの削除', saveLabel: '削除', danger: true,
            body: <div>
                <div style={{ marginBottom: '0.5rem' }}>次のデータを削除します。元に戻せません。</div>
                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{d.items.filter(i => i.count).map(i => '・' + i.label + ' ' + i.count + '件').join('\n')}</div>
            </div>,
            onSave: async (close) => {
                try { const r = await extSend('POST', '/ext/api/maintenance/cleanup', {}); toast(r.total + '件を削除しました', 'success'); close(); refresh(); }
                catch (e) { toast('削除に失敗: ' + e.message, 'error'); }
            }
        });
    };
    return (
        <Section title="メンテナンス（参照されていないデータ）">
            <div style={desc('0.6rem')}>動画ファイルが無くなったあとも残っている拡張機能のデータ（評価などのメタデータ・カバー画像・ブックマーク・関連動画キャッシュ）を削除します。本家の「メンテナンス」のクリーンアップを実行したときも同じ掃除が一緒に走ります。</div>
            <div className="wlext-inline">
                <button className="wlext-btn" onClick={refresh}>件数を確認</button>
                <button className="wlext-btn" disabled={!state.can} onClick={clean}>削除する</button>
            </div>
            <div style={resultStyle}>{state.text}</div>
        </Section>
    );
}

const RELATED_FIELDS = [
    ['series', 'シリーズ一致'], ['performer', '出演者一致(1名ごと)'],
    ['maker', 'メーカー一致'], ['label', 'レーベル一致'], ['director', '監督一致'],
    ['genre', 'ジャンル一致(1つ)'], ['genreCap', 'ジャンル加点の上限(個数)'],
    ['tag', 'タグ一致(1つ)'], ['tagCap', 'タグ加点の上限(個数)'],
    ['releaseYear', '公開年が同じ'], ['releaseMonth', '公開月も同じ(加算)'],
    ['rating', '評価の近さ(最大)'],
];

export function ExtRelatedSettings() {
    const grid = useRef(null);
    const [result, setResult] = useState('');
    const inputs = () => grid.current.querySelectorAll('input');
    useEffect(() => {
        extGet('/ext/api/related/weights').then(d => {
            const w = (d && d.weights) || {};
            inputs().forEach((inp, i) => { const k = RELATED_FIELDS[i][0]; inp.value = w[k] != null ? w[k] : ''; });
        }, () => { });
    }, []);
    const collect = () => {
        const w = {};
        inputs().forEach((inp, i) => { const v = parseFloat(inp.value); w[RELATED_FIELDS[i][0]] = isNaN(v) ? 0 : v; });
        return w;
    };
    const save = async () => {
        try { await extSend('PUT', '/ext/api/related/weights', { weights: collect() }); toast('重み付けを保存しました（関連動画は順次再計算されます）', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const rebuild = async () => {
        setResult('全再計算中... しばらくお待ちください');
        try {
            await extSend('PUT', '/ext/api/related/weights', { weights: collect() });
            const r = await extSend('POST', '/ext/api/related/rebuild', {});
            setResult('全再計算が完了しました（対象 ' + r.count + ' 件）');
            toast('関連動画を再計算しました', 'success');
        } catch (e) { setResult('エラー: ' + e.message); toast('再計算に失敗: ' + e.message, 'error'); }
    };
    return (
        <Section title="関連動画（重み付け）">
            <div style={desc('0.6rem')}>動画ページの「関連動画」を、拡張メタデータ（シリーズ・出演者・メーカー等）の一致度で選びます。各項目の点数（重み）を調整できます（0 でその項目は無視）。シリーズ最重視が既定です。保存すると以後の表示に反映され（必要時に再計算）、「全再計算」で全動画を今すぐ計算し直します（横断的な変更も反映）。</div>
            <div ref={grid} className="wlext-related-grid">
                {RELATED_FIELDS.map(([key, label]) => <label key={key} className="wlext-related-field"><span>{label}</span><input className="wlext-input" type="number" step="1" /></label>)}
            </div>
            <div className="wlext-inline" style={{ marginTop: '0.6rem' }}>
                <button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button>
                <button className="wlext-btn" onClick={rebuild}>全再計算</button>
            </div>
            <div style={resultStyle}>{result}</div>
        </Section>
    );
}

export function ExtBackupSettings() {
    const [result, setResult] = useState('');
    const [status, setStatus] = useState('※ 復元するJSONを選択');
    const data = useRef(null);
    const lib = currentLibrary;   // 使用中のライブラリ (サーバーが HTML に埋め込んだもの)
    const multiLib = !!lib && lib.count > 1;
    const doExport = async () => {
        setResult('エクスポート中...');
        try {
            const d = await extGet('/ext/api/backup/export');
            const url = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }));
            const now = new Date(), p2 = (n) => ('0' + n).slice(-2);
            const stamp = now.getFullYear() + p2(now.getMonth() + 1) + p2(now.getDate()) + '-' + p2(now.getHours()) + p2(now.getMinutes());
            // ライブラリが複数あるときは、どのライブラリのバックアップか分かるよう名前を入れる
            const name = multiLib ? lib.name.replace(/[\\/:*?"<>|\s]+/g, '_') + '-' : '';
            const a = document.createElement('a');
            a.href = url; a.download = 'womanlive-ext-backup-' + name + stamp + '.json';
            document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setResult('エクスポートしました。');
            toast('バックアップを書き出しました', 'success');
        } catch (e) { setResult('エクスポート失敗: ' + e.message); toast('エクスポート失敗', 'error'); }
    };
    const onFile = (e) => {
        const f = e.target.files && e.target.files[0]; if (!f) return;
        setStatus('読み込み中...');
        const rd = new FileReader();
        rd.onload = () => {
            try { data.current = JSON.parse(rd.result); setStatus(f.name + ' を読み込みました'); }
            catch (err) { data.current = null; setStatus('JSON解析エラー: ' + err.message); }
        };
        rd.readAsText(f);
    };
    const doImport = () => {
        if (!data.current) { toast('先にJSONファイルを選択してください', 'error'); return; }
        openExtDialog(ExtConfirm, {
            title: 'バックアップを復元', saveLabel: '復元する',
            body: <div style={{ fontSize: '0.9rem', lineHeight: '1.6' }}>
                {multiLib && <div>{'復元先: ライブラリ「' + lib.name + '」'}</div>}
                <div>現在の拡張機能データ（追加メタ・出演者・ブックマーク等）は、バックアップの内容で置き換えられます。よろしいですか？</div>
                {multiLib && <div style={{ color: 'var(--status-error,#e51400)' }}>出演者は全ライブラリ共通のため、出演者の復元はすべてのライブラリに反映されます。</div>}
            </div>,
            onSave: async (close) => {
                setResult('インポート中...');
                try {
                    const r = await extSend('POST', '/ext/api/backup/import', { data: data.current });
                    setResult('【復元完了】\n動画メタ: ' + (r.video_meta || 0) + ' / 出演者: ' + (r.performers || 0) +
                        ' / カバー: ' + (r.video_cover || 0) + ' / ブックマーク: ' + (r.bookmarks || 0) + '件 / フォルダ: ' + (r.bookmark_folders || 0));
                    toast('復元しました', 'success');
                    close();
                } catch (e) { setResult('インポート失敗: ' + e.message); toast('インポート失敗: ' + e.message, 'error'); }
            }
        });
    };
    return (
        <Section title="バックアップ（追加機能データ）">
            <div style={desc('0.6rem')}>拡張機能のデータ（動画の追加メタデータ・出演者情報と画像・出演者タグのプリセット・タグ付与ルール・ブックマーク・各種設定）を JSON で書き出し／復元します。動画ファイル自体と、標準機能のデータ（タグ・再生回数など）は含みません。</div>
            <div className="wlext-inline" style={{ marginBottom: '0.6rem' }}><button className="wlext-btn wlext-btn-primary" onClick={doExport}>エクスポート</button></div>
            <input type="file" accept=".json,application/json" onChange={onFile} />
            <div style={{ fontSize: '0.82rem', margin: '0.5rem 0', color: 'var(--text-secondary,#777)' }}>{status}</div>
            <div className="wlext-inline"><button className="wlext-btn" onClick={doImport}>インポート（復元）</button></div>
            <div style={resultStyle}>{result}</div>
        </Section>
    );
}

const RULE_FIELDS = [['height', '身長'], ['weight', '体重'], ['bust', 'バスト'], ['waist', 'ウェスト'], ['hip', 'ヒップ'], ['cup', 'カップ数'], ['rating', '評価'], ['age', '年齢'], ['blood_type', '血液型']];
const RULE_OPS = [['>=', '≧'], ['<=', '≦'], ['>', '>'], ['<', '<'], ['=', '='], ['≠', '≠'], ['含む', '含む']];
let ruleKey = 0;

export function ExtTagRuleSettings() {
    const [rows, setRows] = useState([]);   // [{ key, rule }]
    const [result, setResult] = useState('');
    const host = useRef(null), sync = useRef(null);
    const add = (rule) => setRows(rs => [...rs, { key: ++ruleKey, rule: rule || {} }]);
    useEffect(() => {
        extGet('/ext/api/performer-tag-rules').then(rules => {
            const list = Array.isArray(rules) && rules.length ? rules : [{ field: 'height', op: '>=', value: '170', tag: '高身長' }];
            setRows(list.map(rule => ({ key: ++ruleKey, rule })));
        }, () => setRows([{ key: ++ruleKey, rule: {} }]));
    }, []);
    const collect = () => [...host.current.querySelectorAll('.wlext-rule-row')].map(row => {
        const sels = row.querySelectorAll('select'), ins = row.querySelectorAll('input');
        return { field: sels[0].value, op: sels[1].value, value: ins[0].value.trim(), tag: ins[1].value.trim() };
    }).filter(r => r.field && r.op && r.tag && r.value !== '');
    const save = async () => {
        try { await extSend('PUT', '/ext/api/performer-tag-rules', { rules: collect() }); toast('ルールを保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const apply = async () => {
        try {
            await extSend('PUT', '/ext/api/performer-tag-rules', { rules: collect() });   // 念のため保存してから適用
            const r = await extSend('POST', '/ext/api/performer-tag-rules/apply', { sync: sync.current.checked });
            setResult(`ルール適用完了\n付与: ${r.tagsAdded} 件 / 解除: ${r.tagsRemoved} 件 / 変更出演者: ${r.performersChanged} 名（ルール ${r.rules} 件）`);
            toast('タグを付与しました', 'success');
        } catch (e) { setResult('エラー: ' + e.message); toast('適用に失敗: ' + e.message, 'error'); }
    };
    const select = (options, value) => (
        <select className="wlext-rule-select" defaultValue={value}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
    );
    return (
        <Section title="出演者タグ 自動付与ルール">
            <div style={desc('0.6rem')}>条件に合う出演者へ自動でタグを付けます（例: 身長 ≧ 170 → 高身長）。「適用」で全出演者に一括付与します（出演者情報の取込時にも自動で付与されます）。</div>
            <div ref={host} className="wlext-rules">
                {rows.map(({ key, rule }) => (
                    <div key={key} className="wlext-rule-row">
                        {select(RULE_FIELDS, rule.field || 'height')}
                        {select(RULE_OPS, rule.op || '>=')}
                        <input className="wlext-input wlext-rule-val" defaultValue={rule.value != null ? rule.value : ''} />
                        <span style={{ color: 'var(--text-secondary,#888)' }}>→</span>
                        <input className="wlext-input wlext-rule-tag" defaultValue={rule.tag || ''} placeholder="付与するタグ" />
                        <button className="wlext-btn" title="削除" onClick={() => setRows(rs => rs.filter(r => r.key !== key))}>×</button>
                    </div>
                ))}
            </div>
            <div style={{ margin: '0.5rem 0' }}><button className="wlext-btn" onClick={() => add({})}>＋ ルールを追加</button></div>
            <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'block', margin: '0.3rem 0' }}><input ref={sync} type="checkbox" />{' 条件に合わない出演者から、ルールのタグを外す（同期）'}</label>
            <div className="wlext-inline">
                <button className="wlext-btn" onClick={save}>ルールを保存</button>
                <button className="wlext-btn wlext-btn-primary" onClick={apply}>適用</button>
            </div>
            <div style={resultStyle}>{result}</div>
        </Section>
    );
}

// フォルダの選択は本体の FolderPicker.jsx (ライブラリの取り込み ExtLibrary.jsx も)。openExtDialog で開くので isOpen は常に true
const openFolderPicker =(onSelect) => openExtDialog(FolderPicker, { isOpen: true, onSelect });

