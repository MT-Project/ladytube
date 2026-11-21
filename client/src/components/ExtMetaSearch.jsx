// LadyTube: 動画ページの「動画情報を検索」の画面 (v3.2.1 までは拡張の server/ext/public/videometa.js)。開くのは utils/metaSearch.jsx。
//  ・MetaSelectDialog: 検索結果が複数のとき、選ばせる
//  ・MetaPreviewDialog: 取り込む項目の確認。チェックを付けた項目だけを /ext/api/dmm/apply で反映する
//    (サーバーは空の項目を今の値のまま残すので、チェックを外した項目は空にして送る)。
//    PC では、ファイル名のルールで作る名前が今と違えば「ファイル名」の行も出す (v3.12.0。既定のチェックは設定「動画情報を取得したらルールで変える」)
//  ・BulkMetaFetchDialog: 一括操作と「⋮」の「動画情報を取得」(ExtVideoMenu.jsx が開く)。今の値がある項目を空にして送り、空の項目だけを埋める
// 見た目は womanlive-ext.css の .wlext-dmm-* / .wlext-prev-* / .wlext-bulkfetch-*。
import { useEffect, useRef, useState } from 'react';
import { ExtDialog } from './ExtDialog';
import { extGet, extSend } from '../services/extApi';
import { formatYmd } from '../utils/formatters';
import { cachedMeta, loadMeta } from '../utils/videoMeta';
import { toast } from '../utils/toast';
import { isLocalPC } from '../utils/library';
import { ruleStem } from '../utils/fileRule';

// 取り込む項目 (キーはサーバーの dmm.js mapItem の戻りに合わせる)。list は複数値、merge は今の値を消さずに足す
const FIELDS = [
    { key: 'title', label: '表示動画名', cur: (m) => m.display_name || '' },
    { key: 'date', label: '公開日', cur: (m) => (m.release_date ? formatYmd(m.release_date) : ''), show: (v) => formatYmd(v) },
    { key: 'actresses', label: '出演者', list: true, cur: (m) => (m.performers || []).map(p => p.name) },
    { key: 'genres', label: 'ジャンル', list: true, merge: true, cur: (m) => m.genres || [] },
    { key: 'series', label: 'シリーズ名', cur: (m) => m.series || '' },
    { key: 'maker', label: 'メーカー', cur: (m) => m.maker || '' },
    { key: 'label', label: 'レーベル', cur: (m) => m.label || '' },
    { key: 'directors', label: '作品監督', list: true, cur: (m) => m.directors || [] },
];
const splitExt = (fn) => { const m = /^(.*?)(\.[^.]*)?$/.exec(fn || ''); return [m[1], m[2] || '']; };
const mergeList = (cur, add) => { const out = (cur || []).slice(); (add || []).forEach(v => { if (!out.includes(v)) out.push(v); }); return out; };

// 商品の画像 (thumb はブラウザから見える URL。情報源によってはサーバーでしか取れない imageLarge と分けて渡す)
function ItemThumb({ item }) {
    const src = item.thumb || item.imageLarge;
    return src
        ? <img src={src} className="wlext-dmm-thumb" loading="lazy" referrerPolicy="no-referrer" />
        : <div className="wlext-dmm-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '0.7rem' }}>no image</div>;
}

// 確認画面は window.WLExt.showMetaPreview を通して開く (private が包んで、表示動画名にパート番号を足すため)
export function MetaSelectDialog({ vid, items, onClose }) {
    return (
        <ExtDialog title="検索結果が複数あります（選択してください）" onClose={onClose}>
            <div className="wlext-dmm-select">
                {items.map((item, i) => (
                    <div key={i} className="wlext-dmm-select-item" onClick={() => { onClose(); window.WLExt.showMetaPreview(vid, item); }}>
                        <ItemThumb item={item} />
                        <div className="wlext-dmm-select-info">
                            <div className="wlext-dmm-select-title">{item.title || '(無題)'}</div>
                            <div className="wlext-dmm-select-sub">{[item.date, item.maker, (item.actresses || []).join(', ')].filter(Boolean).join(' / ')}</div>
                        </div>
                    </div>
                ))}
            </div>
        </ExtDialog>
    );
}

export function MetaPreviewDialog({ vid, item, onClose }) {
    const meta = cachedMeta(vid) || {};
    const [off, setOff] = useState({});   // チェックを外した項目 (キー → true。image はカバー画像)
    const toggle = (key) => (e) => setOff(o => ({ ...o, [key]: !e.target.checked }));
    // ファイル名のルール (v3.12.0)。名前を変えられるのは PC だけなので、ほかの端末では読まない
    const [cfg, setCfg] = useState(null);
    const [renameOn, setRenameOn] = useState(null);   // null = 設定 (rename_on_fetch) に従う
    useEffect(() => { if (isLocalPC) extGet('/ext/api/settings').then(setCfg, () => { }); }, []);
    const rows = FIELDS.map(f => {
        const raw = item[f.key];
        const nv = f.list ? (raw || []) : (raw || '');
        if (f.list ? !nv.length : !nv) return null;   // 取れなかった項目は出さない
        const curVal = f.cur(meta);
        const curText = f.list ? (curVal || []).join('、') : curVal;
        const newText = f.list ? (f.merge ? mergeList(curVal, nv).join('、') : nv.join('、')) : (f.show ? f.show(nv) : nv);
        return (
            <label key={f.key} className="wlext-prev-row">
                <input type="checkbox" checked={!off[f.key]} onChange={toggle(f.key)} />
                <span className="wlext-prev-label">{f.label}</span>
                <span className="wlext-prev-cur">{curText || '(空)'}</span>
                <span className="wlext-prev-arrow">→</span>
                <span className="wlext-prev-new">{newText + (f.merge ? '（追加）' : '')}</span>
            </label>
        );
    }).filter(Boolean);
    // ルールで作る名前。チェックした項目を反映したあとの値で作る (実際に変えるのはサーバーの rename.js で、同じ filerule.mjs を使う)
    let newName = '';
    if (cfg && meta.file_name) {
        const take = (key, cur) => { const nv = item[key]; return !off[key] && (Array.isArray(nv) ? nv.length : nv) ? nv : cur; };
        const [stem, ext] = splitExt(meta.file_name);
        const st = ruleStem(cfg.rename_rule, {
            model_no: meta.model_no, title: take('title', meta.display_name), release_date: take('date', meta.release_date),
            performers: take('actresses', (meta.performers || []).map(p => p.name)), maker: take('maker', meta.maker),
            label: take('label', meta.label), series: take('series', meta.series),
        }, stem);
        if (st && st !== stem) newName = st + ext;
    }
    const renameChecked = renameOn ?? !!cfg?.rename_on_fetch;
    const save = async () => {
        const picked = { ...item };
        FIELDS.forEach(f => { if (off[f.key]) picked[f.key] = f.list ? [] : ''; });
        if (off.image) { picked.imageLarge = ''; picked.imageAlt = ''; }
        const any = FIELDS.some(f => (f.list ? picked[f.key].length : picked[f.key])) || picked.imageLarge;
        if (!any) { toast('設定する項目が選択されていません', 'error'); return; }
        try {
            const r = await extSend('POST', '/ext/api/dmm/apply', { id: vid, item: picked, rename: !!newName && renameChecked });
            let fresh = null;
            try { fresh = await loadMeta(vid); } catch { /* 表は次に開いたときに直る */ }
            window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id: vid, meta: fresh } }));
            window.dispatchEvent(new CustomEvent('wlext-cover-refresh', { detail: { id: vid } }));   // 動画ページのカバーを取り直す
            toast('メタデータを設定しました' + (r.coverSet ? '（カバー画像も取得）' : '') + (r.renamed?.status === 'done' ? '（ファイル名も変更）' : ''), 'success');
            if (r.renamed?.status === 'error') toast('ファイル名は変えられませんでした: ' + r.renamed.error, 'error');
            if (r.renamed?.status === 'done') window.dispatchEvent(new Event('library-updated'));
        } catch (e) { toast('設定に失敗: ' + e.message, 'error'); }
        onClose();
    };
    return (
        <ExtDialog title="設定する情報を選択" onClose={onClose} onSave={save} saveLabel="設定する">
            <div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.8rem' }}>
                    <ItemThumb item={item} />
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary,#888)' }}>チェックを付けた項目だけをメタデータに設定します。チェックを外した項目は今の値のままです。</div>
                </div>
                {rows.length || item.imageLarge
                    ? <div className="wlext-prev-grid">
                        {rows}
                        {/* カバー画像は「未設定のときだけ取得」なので、設定済みなら押しても変わらない */}
                        {item.imageLarge && <label className="wlext-prev-row">
                            <input type="checkbox" checked={!off.image} onChange={toggle('image')} />
                            <span className="wlext-prev-label">カバー画像</span>
                            <span className="wlext-prev-cur"></span>
                            <span className="wlext-prev-arrow">→</span>
                            <span className="wlext-prev-new">カバー画像が未設定なら取得して設定</span>
                        </label>}
                        {newName && <label className="wlext-prev-row">
                            <input type="checkbox" checked={renameChecked} onChange={e => setRenameOn(e.target.checked)} />
                            <span className="wlext-prev-label">ファイル名</span>
                            <span className="wlext-prev-cur">{meta.file_name}</span>
                            <span className="wlext-prev-arrow">→</span>
                            <span className="wlext-prev-new">{newName}</span>
                        </label>}
                    </div>
                    : <div style={{ color: 'var(--text-secondary,#888)' }}>設定できる情報が取得できませんでした。</div>}
            </div>
        </ExtDialog>
    );
}

// 一括取得。選んだ動画を1本ずつ品番で FANZA から検索し (window.WLExt.dmmSearch。1本ずつの検索と同じ関数なので、包んで足した処理もそのまま効く)、
// 品番の一致する商品が1つだけなら、空の項目だけを埋める。見つからない・候補が複数・品番なし・失敗は飛ばし、最後に一覧で出す。
// 同じ品番のパートは、サーバー (dmm.js の findItemsCached) が控えた結果を返すので、問い合わせは1回で済む。
// 動いている間の「中止」(✕・Esc も) は今の1本を終えてから止まる。ほかのダイアログに替わったときも止まる
const WHY = { none: '品番なし', notfound: '見つからない', multi: '候補が複数', error: '失敗', rename: 'ファイル名' };
const isSet = (f, v) => (f.list ? (v || []).length > 0 : !!v);
// 1本分。戻りは [結果, 名前の変更の結果]。結果は 'filled' (埋めた) / 'same' (埋める項目なし) / 'none' / 'notfound' / 'multi'。検索や反映の失敗は投げる。
// rename: 埋めたらファイル名もルールで変える (v3.12.0。設定「動画情報を取得したらルールで変える」)
async function fetchOne(vid, meta, rename) {
    if (!meta.model_no) return ['none'];
    const items = (await window.WLExt.dmmSearch(vid)).items || [];
    if (items.length !== 1) return [items.length ? 'multi' : 'notfound'];
    const picked = { ...items[0] };
    FIELDS.forEach(f => { if (isSet(f, f.cur(meta))) picked[f.key] = f.list ? [] : ''; });
    const fills = FIELDS.some(f => isSet(f, picked[f.key]));
    // 埋める項目が無く、カバー画像も無ければ送らない (サーバーは更新日時だけを変えてしまう)
    const r = fills || picked.imageLarge ? await extSend('POST', '/ext/api/dmm/apply', { id: vid, item: picked, rename: !!rename && fills }) : {};
    return [fills || r.coverSet ? 'filled' : 'same', r.renamed];
}
// auto: 開いたらすぐ始める (スキャンのあとの自動取得。v3.11.0。SettingsPage.jsx)
export function BulkMetaFetchDialog({ ids, onDone, onClose, auto }) {
    const [st, setSt] = useState(null);   // null = 始める前。{ n, filled, same, skipped: [{ vid, name, why, msg }], running, retry }
    const stop = useRef(false);
    useEffect(() => () => { stop.current = true; }, []);
    const start = async () => {
        stop.current = false;
        const s = { n: 0, filled: 0, same: 0, renamed: 0, skipped: [], running: true, retry: 0 };
        const cfg = isLocalPC ? await extGet('/ext/api/settings').catch(() => ({})) : {};
        const show = () => setSt({ ...s, skipped: s.skipped.slice(), stopping: stop.current });
        let fatal = false;
        const run = async (vid) => {
            let name = String(vid);
            try {
                const meta = await loadMeta(vid);
                name = (meta.model_no ? meta.model_no + '  ' : '') + (meta.file_name || '');
                const [res, rn] = await fetchOne(vid, meta, cfg.rename_on_fetch);
                if (res === 'filled') s.filled++; else if (res === 'same') s.same++; else s.skipped.push({ vid, name, why: res });
                if (rn?.status === 'done') s.renamed++;
                if (rn?.status === 'error') s.skipped.push({ vid, name, why: 'rename', msg: rn.error });   // 詳細情報は埋めた。飛ばした数には入れない
            } catch (e) {
                const msg = e.message || String(e);
                s.skipped.push({ vid, name, why: 'error', msg });
                // API ID が無いときは、残りも同じなので止める
                if (/未設定/.test(msg)) { toast(msg, 'error'); fatal = true; }
            }
        };
        show();
        for (const vid of ids) {
            if (stop.current || fatal) break;
            await run(vid);
            s.n++;
            show();
        }
        // 失敗した動画は、最後に3秒おいてもう1回だけやり直す (DMM への接続が少しの間つながらないことがあるため)
        const failed = s.skipped.filter(x => x.why === 'error');
        if (!stop.current && !fatal && failed.length) {
            s.retry = failed.length;
            show();
            await new Promise(r => setTimeout(r, 3000));
            for (const x of failed) {
                if (stop.current) break;
                s.skipped = s.skipped.filter(y => y !== x);
                await run(x.vid);
                show();
            }
            s.retry = 0;
        }
        s.running = false;
        show();
        if (s.filled) onDone?.();   // 一覧を取り直させる
    };
    // 描画のあとで始める (effect の中で直に setState しない)
    useEffect(() => {
        if (!auto) return;
        const t = setTimeout(start, 0);
        return () => clearTimeout(t);
    }, []);   // eslint-disable-line react-hooks/exhaustive-deps
    const pct = st ? Math.round(st.n / ids.length * 100) : 0;
    const halt = () => { stop.current = true; setSt(p => ({ ...p, stopping: true })); };
    return (
        <ExtDialog title={'動画情報を取得（' + ids.length + '本）'}
            onClose={st?.running ? halt : onClose}
            cancelLabel={!st ? null : st.running ? '中止' : '閉じる'}
            onSave={st ? null : start} saveLabel="取得する">
            <div style={{ fontSize: '0.85rem', lineHeight: 1.7 }}>
                {auto && <div>スキャンで増えた動画のうち、品番があってメーカーが空の動画です。</div>}
                <div>選んだ動画を品番で FANZA から検索し、品番の一致する商品が1つだけなら、<b>空の項目だけ</b>を埋めます。今の値がある項目は変えません。カバー画像は未設定のときだけ取得します。</div>
                {st && <>
                    <div className="wlext-bulkfetch-bar"><div style={{ width: pct + '%' }} /></div>
                    <div>{st.n + ' / ' + ids.length + ' 本' + (st.running ? (st.stopping ? '（中止しています…）' : st.retry ? '（失敗した ' + st.retry + '本をやり直しています…）' : '') : (st.n < ids.length ? '（中止しました）' : '（終わりました）'))}</div>
                    <div>{'埋めた ' + st.filled + '本・埋める項目なし ' + st.same + '本・飛ばした ' + st.skipped.filter(x => x.why !== 'rename').length + '本'
                        + (st.renamed ? '・ファイル名を変えた ' + st.renamed + '本' : '')}</div>
                    {st.skipped.length > 0 && <div className="wlext-bulkfetch-list">
                        {st.skipped.map(x => (
                            <div key={x.vid}>
                                <span className="why">{WHY[x.why]}</span>
                                {/* 一覧を残したまま1本ずつ直せるよう、別のタブで開く */}
                                <a href={'/watch/' + x.vid} target="_blank" rel="noreferrer" title={x.msg || ''}>{x.name}</a>
                            </div>
                        ))}
                    </div>}
                </>}
            </div>
        </ExtDialog>
    );
}
