// LadyTube: 管理画面の LadyTube の項目 (v3.2.1 までは拡張の server/ext/public/settings.js)。
// カバー画像 / 起動時に開くブラウザ / DMM 商品検索API / 出演者タグ 自動付与ルール / 関連動画の重み付け / ホーム画面 / 保存した検索 / 参照されていないデータの削除 / バックアップ。
// 見出しは本体の項目と同じく名前だけ (v3.3.1 までは「拡張機能：」とパズルのアイコン)。
// 置き場所と並びは SettingsPage.jsx が ExtSettingsSection name="..." で決める (ExtSettingsParts.jsx がここの部品を選ぶ)。
// 見た目は womanlive-ext.css の .wlext-settings-section・.wlext-rule-*・.wlext-related-*。入力欄は押したときに欄の値を読む。
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExtConfirm, ExtDialog } from './ExtDialog';
import { Icon } from './ExtIcon';
import FolderPicker from './FolderPicker';
import { extGet, extSend } from '../services/extApi';
import { openExtDialog } from '../utils/extDialog';
import { currentLibrary, isLocalPC, PC_ONLY } from '../utils/library';
import { loadSavedSearches, saveSavedSearches } from '../utils/savedSearches';
import { HOME_COUNTS, HOME_ROWS, homeRowName, loadHomeLayout, normalizeHomeLayout, saveHomeLayout } from '../utils/homeLayout';
import { toast } from '../utils/toast';
import { DEFAULT_RULE, RULE_FIELDS as NAME_FIELDS, ruleStem } from '../utils/fileRule';

const desc = (mb) => ({ fontSize: '0.8rem', color: 'var(--text-secondary,#777)', marginBottom: mb });
const resultStyle = { fontSize: '0.82rem', marginTop: '0.6rem', whiteSpace: 'pre-wrap' };

function Section({ title, icon, children, id }) {
    return (
        <div id={id} className="wlext-settings-host wlext-settings-section">
            <h3 className="wlext-ext-h3"><Icon name={icon} size={16} /><span>{title}</span></h3>
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
        <Section title="カバー画像" icon="image">
            <div style={desc('0.5rem')}>動画ファイル名と同じ名前の画像（例: AAA.mp4 → AAA.jpg）をこのフォルダから探し、動画ページのカバー画像として表示します。</div>
            <div className="wlext-inline">
                <input ref={input} className="wlext-input" placeholder={'(例) C:\\covers'} defaultValue="" />
                <button className="wlext-btn" onClick={() => openFolderPicker((p) => { input.current.value = p; })}>参照...</button>
                <button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button>
            </div>
        </Section>
    );
}

// 動画情報が取れていない動画 = 品番があってメーカーが空 (v3.11.0。検索の model:any と maker:none。@ は先頭にだけ付ける)
const UNFETCHED_Q = '@model:any maker:none';

export function ExtDmmSettings() {
    const navigate = useNavigate();
    const api = useRef(null), aff = useRef(null), auto = useRef(null);
    useEffect(() => { extSettings().then(s => { api.current.value = s.dmm_api_id || ''; aff.current.value = s.dmm_affiliate_id || ''; auto.current.checked = s.dmm_auto_fetch !== false; }, () => { }); }, []);
    // スキャンのあとの自動取得 (v3.11.0)。押したらすぐ保存する
    const saveAuto = async (e) => {
        const on = e.target.checked;
        try { await extSend('POST', '/ext/api/settings', { dmm_auto_fetch: on }); toast(on ? 'スキャンのあとに動画情報を自動で取得します' : 'スキャンのあとの自動取得をやめました', 'success'); }
        catch (err) { e.target.checked = !on; toast('保存に失敗: ' + err.message, 'error'); }
    };
    const save = async () => {
        try { await extSend('POST', '/ext/api/settings', { dmm_api_id: api.current.value.trim(), dmm_affiliate_id: aff.current.value.trim() }); toast('DMM API設定を保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <Section title="DMM(FANZA) 商品検索API" icon="search">
            <div style={desc('0.6rem')}>各動画ページの「動画情報を検索」ボタンで品番からFANZA商品情報を検索し、メタデータへ自動設定します。利用にはご自身のDMMアカウントで取得したAPI IDとアフィリエイトIDが必要です。</div>
            {!isLocalPC && <div style={desc('0.6rem')}>{'API ID とアフィリエイトID の表示と変更は、' + PC_ONLY + '。'}</div>}
            <div className="wlext-field"><label>API ID</label><input ref={api} className="wlext-input" placeholder={isLocalPC ? 'API ID' : ''} defaultValue="" disabled={!isLocalPC} /></div>
            <div className="wlext-field"><label>アフィリエイトID</label><input ref={aff} className="wlext-input" placeholder={isLocalPC ? 'アフィリエイトID (例: xxxxx-999)' : ''} defaultValue="" disabled={!isLocalPC} /></div>
            <div className="wlext-inline"><button className="wlext-btn wlext-btn-primary" onClick={save} disabled={!isLocalPC}>保存</button></div>
            <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'block', margin: '0.8rem 0 0.2rem' }}><input ref={auto} type="checkbox" defaultChecked onChange={saveAuto} />{' スキャンのあと、増えた動画の動画情報を自動で取得する'}</label>
            <div style={desc('0.5rem')}>スキャンで増えた動画のうち、品番があってメーカーが空のものを、一括取得と同じやり方（空の項目だけ埋める）で取得します。品番はスキャンのときにファイル名から入ります。</div>
            <div className="wlext-inline"><button className="wlext-btn" onClick={() => navigate('/search?q=' + encodeURIComponent(UNFETCHED_Q))}><Icon name="search" size={14} />動画情報が未取得の動画を検索</button></div>
        </Section>
    );
}

// 起動時に開くブラウザ (v3.14.0。server/ext/browser.js)。読むのも変えるのも PC からだけ。
// 選ぶ値: 'default' / 'none' / 'exe:<この PC に登録されたブラウザの場所>' / 'custom' (場所を入力)
export function ExtBrowserSettings() {
    const [data, setData] = useState(null);   // null = 読み込み中 / { browsers } / { error }
    const [pick, setPick] = useState('default');
    const [custom, setCustom] = useState('');
    const [args, setArgs] = useState('');
    useEffect(() => {
        if (!isLocalPC) return;
        extGet('/ext/api/browser').then(d => {
            const s = d.setting || {};
            const hit = s.mode === 'exe' && (d.browsers || []).find(b => b.path.toLowerCase() === String(s.path).toLowerCase());
            setPick(s.mode === 'exe' ? (hit ? 'exe:' + hit.path : 'custom') : (s.mode || 'default'));
            setCustom(s.mode === 'exe' && !hit ? s.path : '');
            setArgs(s.args || '');
            setData(d);
        }, e => setData({ error: e.message }));
    }, []);
    const isExe = pick === 'custom' || pick.startsWith('exe:');
    const body = () => (isExe ? { mode: 'exe', path: pick === 'custom' ? custom : pick.slice(4), args } : { mode: pick });
    const save = async () => {
        try { await extSend('PUT', '/ext/api/browser', body()); toast('起動時に開くブラウザを保存しました（次に ladytube.bat で起動したときから）', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const test = async () => {
        try { const r = await extSend('POST', '/ext/api/browser/test', body()); toast(r.opened ? 'ブラウザで LadyTube を開きました' : '「開かない」なので、ブラウザは開きません', 'success'); }
        catch (e) { toast('開けません: ' + e.message, 'error'); }
    };
    return (
        <Section title="起動時に開くブラウザ" icon="globe">
            <div style={desc('0.6rem')}>ladytube.bat で起動したときに LadyTube を開くブラウザです。ライブラリを切り替えたときの再起動では開きません。</div>
            {!isLocalPC ? <div style={desc('0.6rem')}>{'表示と変更は、' + PC_ONLY + '。'}</div>
                : !data ? <div style={desc('0.6rem')}>ブラウザを調べています...</div>
                    : <>
                        {data.error && <div style={desc('0.6rem')}>{'この PC のブラウザを読めませんでした（' + data.error + '）。場所を指定してください。'}</div>}
                        <div className="wlext-field">
                            <label>開くブラウザ</label>
                            <select className="wlext-input" value={pick} onChange={e => setPick(e.target.value)}>
                                <option value="default">既定のブラウザ</option>
                                {(data.browsers || []).map(b => <option key={b.path} value={'exe:' + b.path}>{b.name}</option>)}
                                <option value="custom">場所を指定（.exe）</option>
                                <option value="none">開かない</option>
                            </select>
                        </div>
                        {pick === 'custom' && <div className="wlext-field"><label>ブラウザの場所</label>
                            <input className="wlext-input" value={custom} onChange={e => setCustom(e.target.value)} placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe" /></div>}
                        {pick.startsWith('exe:') && <div style={desc('0.6rem')}>{pick.slice(4)}</div>}
                        {isExe && <div className="wlext-field"><label>起動のオプション（任意）</label>
                            <input className="wlext-input" value={args} onChange={e => setArgs(e.target.value)} placeholder={'例: --profile-directory="Profile 2"'} />
                            <div style={{ ...desc('0'), marginTop: '0.3rem' }}>
                                URL の前に渡します。空白を含むときは "…" で囲みます。プライベートウィンドウは Chrome・Brave・Vivaldi が --incognito、Edge が --inprivate、Firefox 系が -private-window です（プライベートウィンドウでは、テーマや表示形式などの画面の設定がブラウザに残りません）。
                            </div>
                        </div>}
                        <div className="wlext-inline">
                            <button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button>
                            <button className="wlext-btn" onClick={test}>今の入力内容で開いて試す</button>
                        </div>
                    </>}
        </Section>
    );
}

// 参照されていない拡張データ。本家の「クリーンアップ」でも同じ掃除が走るが、件数を確かめてから単独でも消せる
// ファイル名のルール (v3.12.0。server/ext/filerule.mjs)。名前を変えるのは PC からだけ (rename.js)
const RULE_SAMPLE = { model_no: 'ABC-123', title: 'タイトル', performers: ['出演者A', '出演者B'], maker: 'メーカー', label: 'レーベル', series: 'シリーズ', release_date: '2024-01-31' };

export function ExtFileRuleSettings() {
    const [rule, setRule] = useState(null);   // null = 読み込み中
    const onFetch = useRef(null);
    useEffect(() => { extSettings().then(s => { setRule(s.rename_rule || DEFAULT_RULE); onFetch.current.checked = !!s.rename_on_fetch; }, () => setRule(DEFAULT_RULE)); }, []);
    const save = async () => {
        try { await extSend('POST', '/ext/api/settings', { rename_rule: rule }); toast('ファイル名のルールを保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const saveOnFetch = async (e) => {
        const on = e.target.checked;
        try { await extSend('POST', '/ext/api/settings', { rename_on_fetch: on }); toast(on ? '動画情報を取得したら、ファイル名もルールで変えます' : '動画情報を取得しても、ファイル名は変えません', 'success'); }
        catch (err) { e.target.checked = !on; toast('保存に失敗: ' + err.message, 'error'); }
    };
    const sample = rule === null ? '' : ruleStem(rule, RULE_SAMPLE, 'ABC-123_2');
    return (
        <Section title="ファイル名のルール" icon="pencil">
            <div style={desc('0.6rem')}>動画のファイル名を変えるときの名前の作り方です。動画ページの「動画ファイル名」の変更ボタンの「ルールで作る」、一括操作の「ファイル名をルールで変更」、FANZA の確認画面の「ファイル名」の行で使います。名前を変えられるのは、サーバーを動かしている PC からだけです。</div>
            <div className="wlext-inline">
                <input className="wlext-input" value={rule ?? ''} onChange={e => setRule(e.target.value)} placeholder={DEFAULT_RULE} disabled={rule === null} />
                <button className="wlext-btn wlext-btn-primary" onClick={save} disabled={rule === null}>保存</button>
            </div>
            <div style={desc('0.3rem')}>{'使える項目: ' + NAME_FIELDS.map(f => '{' + f + '}').join(' ')}</div>
            <div style={desc('0.3rem')}>{'例: ' + (sample ? sample + '.mp4' : '（項目が空なので名前を作れません）') + '　（ABC-123_2.mp4 の場合）'}</div>
            <div style={desc('0.6rem')}>今の名前の末尾のパート番号（_2 など）は自動で付けます。タイトルは60文字、出演者は3人までで、ファイル名に使えない文字は全角に置き換えます。拡張子は変わりません。</div>
            <label style={{ fontSize: '0.85rem', cursor: 'pointer', display: 'block', margin: '0.2rem 0' }}><input ref={onFetch} type="checkbox" onChange={saveOnFetch} />{' 動画情報を取得したら、ファイル名もルールで変える'}</label>
            <div style={desc('0.5rem')}>一括取得とスキャン後の自動取得で、項目を埋めた動画の名前を変えます。1本ずつの確認画面では、「ファイル名」の行の最初のチェックになります。</div>
        </Section>
    );
}

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
        <Section title="参照されていないデータの削除" icon="trash">
            <div style={desc('0.6rem')}>動画ファイルが無くなったあとも残っている、LadyTube が追加したデータ（評価などの詳細情報・カバー画像・ブックマーク・関連動画キャッシュ）を削除します。上の「メンテナンス」のクリーンアップを実行したときも、同じ掃除が一緒に走ります。</div>
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
        <Section title="関連動画（重み付け）" icon="layers">
            <div style={desc('0.6rem')}>動画ページの「関連動画」を、詳細情報（シリーズ・出演者・メーカー等）の一致度で選びます。各項目の点数（重み）を調整できます（0 でその項目は無視）。シリーズ最重視が既定です。保存すると以後の表示に反映され（必要時に再計算）、「全再計算」で全動画を今すぐ計算し直します（横断的な変更も反映）。</div>
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
                <div>今の LadyTube が追加したデータ（詳細情報・出演者・ブックマーク等）は、バックアップの内容で置き換えられます。よろしいですか？</div>
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
        <Section title="バックアップ（詳細情報・出演者・ブックマークなど）" icon="archive">
            <div style={desc('0.6rem')}>LadyTube が追加したデータ（動画の詳細情報・出演者情報と画像・出演者タグのプリセット・タグ付与ルール・ブックマーク・各種設定）を JSON で書き出し／復元します。動画ファイル自体と、タグ・再生回数などのデータは含みません。</div>
            {!isLocalPC && <div style={desc('0.6rem')}>{'バックアップの書き出しと復元は、' + PC_ONLY + '。'}</div>}
            <div className="wlext-inline" style={{ marginBottom: '0.6rem' }}><button className="wlext-btn wlext-btn-primary" onClick={doExport} disabled={!isLocalPC}>エクスポート</button></div>
            <input type="file" accept=".json,application/json" onChange={onFile} disabled={!isLocalPC} />
            <div style={{ fontSize: '0.82rem', margin: '0.5rem 0', color: 'var(--text-secondary,#777)' }}>{status}</div>
            <div className="wlext-inline"><button className="wlext-btn" onClick={doImport} disabled={!isLocalPC}>インポート（復元）</button></div>
            <div style={resultStyle}>{result}</div>
        </Section>
    );
}

// ホーム画面 (v3.8.0。utils/homeLayout.js)。カルーセルとメニューを出すかと、行の並び・出すか・名前・枚数を変えて「保存」で書く。
// 保存した検索は、条件を写した行として足す。ホームの下の「ホームを編集」(/settings#home-layout) から来たときは、読み終えたらこの項目へ移る
let homeKey = 0;
const withKeys = (l) => ({ ...l, rows: l.rows.map(r => ({ key: ++homeKey, r })) });
export function ExtHomeSettings() {
    const [lay, setLay] = useState(null);   // { carousel, menu, rows: [{ key, r }] }。null は読み込み中
    const [saved, setSaved] = useState([]);
    const pick = useRef(null);
    useEffect(() => {
        const done = (l) => {
            setLay(withKeys(l));
            if (window.location.hash === '#home-layout') setTimeout(() => { const el = document.getElementById('home-layout'); if (el) el.scrollIntoView(); }, 0);
        };
        loadHomeLayout().then(done, () => done(normalizeHomeLayout(null)));
        loadSavedSearches().then(setSaved, () => { });
    }, []);
    const setRow = (i, patch) => setLay(l => ({ ...l, rows: l.rows.map((x, j) => (j === i ? { ...x, r: { ...x.r, ...patch } } : x)) }));
    const move = (i, d) => setLay(l => { const a = l.rows.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; return { ...l, rows: a }; });
    const addSaved = () => {
        const s = saved[pick.current.value];
        if (s) setLay(l => ({ ...l, rows: [...l.rows, { key: ++homeKey, r: { type: 'saved', show: true, name: s.name, count: 8, q: s.q, sort: s.sort, path: s.path } }] }));
    };
    const save = async () => {
        if (lay.rows.some(x => x.r.type === 'saved' && !x.r.name.trim())) { toast('名前が空の行があります', 'error'); return; }
        try { await saveHomeLayout({ carousel: lay.carousel, menu: lay.menu, rows: lay.rows.map(x => x.r) }); toast('ホーム画面を保存しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const about = (r) => (r.type === 'saved' ? '保存した検索: ' + savedSummary(r) : HOME_ROWS[r.type].about);
    const check = (key, label) => (
        <label className="wlext-home-check"><input type="checkbox" checked={lay[key]} onChange={(e) => setLay(l => ({ ...l, [key]: e.target.checked }))} />{label}</label>
    );
    return (
        <Section title="ホーム画面" icon="layout-grid" id="home-layout">
            <div style={desc('0.6rem')}>ホームに出すものと、行の並びを決めます。チェックを外した行と、動画が1本も無い行は出しません。名前を空にすると、もとの名前になります。変えたあとは「保存」を押してください。</div>
            {lay && <>
                {check('carousel', 'カルーセル（ランダムに15本）')}
                {check('menu', 'メニュー（すべての動画・カレンダー・一覧のページなど）')}
                <div style={{ marginTop: '0.6rem' }}>
                    {lay.rows.map((x, i) => (
                        <div key={x.key} className="wlext-saved-row wlext-home-row" style={{ opacity: x.r.show ? 1 : 0.6 }}>
                            <input type="checkbox" checked={x.r.show} onChange={(e) => setRow(i, { show: e.target.checked })} title="ホームに出す" />
                            <input className="wlext-input" value={x.r.name} placeholder={x.r.type === 'saved' ? '' : homeRowName({ type: x.r.type })} onChange={(e) => setRow(i, { name: e.target.value })} />
                            <select className="wlext-rule-select" value={x.r.count} onChange={(e) => setRow(i, { count: Number(e.target.value) })} title="出す本数">
                                {HOME_COUNTS.map(n => <option key={n} value={n}>{n + '本'}</option>)}
                            </select>
                            <span className="wlext-saved-sum" title={about(x.r)}>{about(x.r)}</span>
                            <button className="wlext-btn" disabled={i === 0} onClick={() => move(i, -1)} title="上へ">↑</button>
                            <button className="wlext-btn" disabled={i === lay.rows.length - 1} onClick={() => move(i, 1)} title="下へ">↓</button>
                            <button className="wlext-btn" style={x.r.type === 'saved' ? undefined : { visibility: 'hidden' }} onClick={() => setLay(l => ({ ...l, rows: l.rows.filter((_, j) => j !== i) }))} title="削除"><Icon name="trash" size={14} /></button>
                        </div>
                    ))}
                </div>
                <div className="wlext-inline" style={{ marginTop: '0.6rem' }}>
                    {saved.length ? <>
                        <select ref={pick} className="wlext-rule-select">{saved.map((s, i) => <option key={i} value={i}>{s.name}</option>)}</select>
                        <button className="wlext-btn" onClick={addSaved}>保存した検索を行に足す</button>
                    </> : <span style={desc(0)}>検索画面の「この条件を保存」で保存した検索も、行として足せます。</span>}
                </div>
                <div className="wlext-inline" style={{ marginTop: '0.6rem' }}>
                    <button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button>
                    <button className="wlext-btn" onClick={() => setLay(withKeys(normalizeHomeLayout(null)))} title="最新動画・続きを見る・最近再生した動画の3つの行に戻します（保存を押すまでは変わりません）">既定に戻す</button>
                </div>
            </>}
        </Section>
    );
}

// 保存した検索の条件を1行で (管理画面の「保存した検索」と「ホーム画面」)
const savedSummary = (s) => [s.q || '（検索語なし）', s.path ? 'フォルダ: ' + (s.path === 'root' ? 'すべて' : s.path) : ''].filter(Boolean).join(' / ');

// 保存した検索 (v3.7.0。保存は検索画面の「この条件を保存」)。名前の変更・並べ替え・削除をして「保存」で書く
let savedKey = 0;
export function ExtSavedSearchSettings() {
    const [rows, setRows] = useState(null);   // [{ key, s }]。null は読み込み中
    useEffect(() => {
        loadSavedSearches().then(list => setRows(list.map(s => ({ key: ++savedKey, s }))), () => setRows([]));
    }, []);
    const move = (i, d) => setRows(rs => { const a = rs.slice(); [a[i], a[i + d]] = [a[i + d], a[i]]; return a; });
    const rename = (i, name) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, s: { ...r.s, name } } : r)));
    const save = async () => {
        if (rows.some(r => !r.s.name.trim())) { toast('名前が空の行があります', 'error'); return; }
        try { await saveSavedSearches(rows.map(r => r.s)); toast('保存した検索を更新しました', 'success'); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <Section title="保存した検索" icon="filter">
            <div style={desc('0.6rem')}>検索画面の「この条件を保存」で保存した検索です。ホームのメニューと右上のメニューに、この順で並びます。名前の変更・並べ替え・削除のあとは「保存」を押してください。</div>
            {rows && !rows.length && <div style={desc('0.6rem')}>保存した検索はありません。</div>}
            {rows && rows.map((r, i) => (
                <div key={r.key} className="wlext-saved-row">
                    <input className="wlext-input" value={r.s.name} onChange={(e) => rename(i, e.target.value)} />
                    <span className="wlext-saved-sum" title={savedSummary(r.s)}>{savedSummary(r.s)}</span>
                    <button className="wlext-btn" disabled={i === 0} onClick={() => move(i, -1)} title="上へ">↑</button>
                    <button className="wlext-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title="下へ">↓</button>
                    <button className="wlext-btn" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} title="削除"><Icon name="trash" size={14} /></button>
                </div>
            ))}
            {rows && <div className="wlext-inline" style={{ marginTop: '0.6rem' }}><button className="wlext-btn wlext-btn-primary" onClick={save}>保存</button></div>}
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
        <Section title="出演者タグ 自動付与ルール" icon="tag">
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

