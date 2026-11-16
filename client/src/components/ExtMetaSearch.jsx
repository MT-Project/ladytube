// LadyTube: 動画ページの「動画情報を検索」の画面 (v3.2.1 までは拡張の server/ext/public/videometa.js)。開くのは utils/metaSearch.jsx。
//  ・MetaSelectDialog: 検索結果が複数のとき、選ばせる
//  ・MetaPreviewDialog: 取り込む項目の確認。チェックを付けた項目だけを /ext/api/dmm/apply で反映する
//    (サーバーは空の項目を今の値のまま残すので、チェックを外した項目は空にして送る)
// 見た目は womanlive-ext.css の .wlext-dmm-* / .wlext-prev-*。
import { useRef } from 'react';
import { ExtDialog } from './ExtDialog';
import { extSend } from '../services/extApi';
import { formatYmd } from '../utils/formatters';
import { cachedMeta, loadMeta } from '../utils/videoMeta';
import { toast } from '../utils/toast';

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
    const checks = useRef({}), img = useRef(null);
    const rows = FIELDS.map(f => {
        const raw = item[f.key];
        const nv = f.list ? (raw || []) : (raw || '');
        if (f.list ? !nv.length : !nv) return null;   // 取れなかった項目は出さない
        const curVal = f.cur(meta);
        const curText = f.list ? (curVal || []).join('、') : curVal;
        const newText = f.list ? (f.merge ? mergeList(curVal, nv).join('、') : nv.join('、')) : (f.show ? f.show(nv) : nv);
        return (
            <label key={f.key} className="wlext-prev-row">
                <input type="checkbox" defaultChecked ref={el => { checks.current[f.key] = el; }} />
                <span className="wlext-prev-label">{f.label}</span>
                <span className="wlext-prev-cur">{curText || '(空)'}</span>
                <span className="wlext-prev-arrow">→</span>
                <span className="wlext-prev-new">{newText + (f.merge ? '（追加）' : '')}</span>
            </label>
        );
    }).filter(Boolean);
    const save = async () => {
        const picked = { ...item };
        FIELDS.forEach(f => { if (!checks.current[f.key]?.checked) picked[f.key] = f.list ? [] : ''; });
        if (!img.current?.checked) { picked.imageLarge = ''; picked.imageAlt = ''; }
        const any = FIELDS.some(f => (f.list ? picked[f.key].length : picked[f.key])) || picked.imageLarge;
        if (!any) { toast('設定する項目が選択されていません', 'error'); return; }
        try {
            const r = await extSend('POST', '/ext/api/dmm/apply', { id: vid, item: picked });
            let fresh = null;
            try { fresh = await loadMeta(vid); } catch { /* 表は次に開いたときに直る */ }
            window.dispatchEvent(new CustomEvent('wlext-meta-updated', { detail: { id: vid, meta: fresh } }));
            window.dispatchEvent(new CustomEvent('wlext-cover-refresh', { detail: { id: vid } }));   // 動画ページのカバーを取り直す
            toast('メタデータを設定しました' + (r.coverSet ? '（カバー画像も取得）' : ''), 'success');
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
                            <input type="checkbox" defaultChecked ref={img} />
                            <span className="wlext-prev-label">カバー画像</span>
                            <span className="wlext-prev-cur"></span>
                            <span className="wlext-prev-arrow">→</span>
                            <span className="wlext-prev-new">カバー画像が未設定なら取得して設定</span>
                        </label>}
                    </div>
                    : <div style={{ color: 'var(--text-secondary,#888)' }}>設定できる情報が取得できませんでした。</div>}
            </div>
        </ExtDialog>
    );
}
