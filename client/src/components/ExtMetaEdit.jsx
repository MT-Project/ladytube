// LadyTube: 詳細情報の編集ダイアログ (openExtDialog で開く。見た目は womanlive-ext.css の .wlext-field・.wlext-chips・.wlext-suggest)。
//  ・ExtMetaEditDialog: 動画ページの「詳細情報を編集」(ExtWatchMeta.jsx)。v3.2.1 までは拡張の videometa.js。作品紹介の欄はこちらだけ (v3.13.0)
//  ・ExtBulkMetaDialog: 検索画面の一括操作 / ⋮ の「詳細情報編集」(ExtVideoMenu.jsx)。入力した項目だけ上書きし、表示動画名は無い
// 入力欄は ExtChipInput.jsx (監督・ジャンル) とここの PerformerInput (出演者)。拡張の WL.chipInput / WL.performerInput と同じ形と動き。
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ExtDialog } from './ExtDialog';
import { ExtStarsEdit } from './ExtCardParts';
import { Chip, ChipInput } from './ExtChipInput';
import { useChips } from '../utils/chips';
import { extGet, extSend } from '../services/extApi';
import { metaToPayload, saveMeta, toDateInput } from '../utils/videoMeta';
import { normalizeUrl } from '../../../server/ext/perfurl.mjs';
import { toast } from '../utils/toast';

const Field = ({ label, children }) => <div className="wlext-field"><label>{label}</label>{children}</div>;

// 出演者 ({ id, name } の並び)。打つと候補を出し、無ければ「＋「名前」を新規追加」(Enter でも同じ) で出演者を作って足す
function PerformerInput({ values, setValues }) {
    const input = useRef(null);
    const timer = useRef(0);
    const [suggest, setSuggest] = useState(null);   // { q, list, left, top }
    const close = () => setSuggest(null);
    const pick = (p) => { setValues(vs => [...vs, { id: p.id, name: p.name }]); input.current.value = ''; close(); };
    const add = async (name) => {
        name = name.trim(); if (!name) return;
        if (values.some(v => v.name === name)) { input.current.value = ''; close(); return; }
        try { const p = await extSend('POST', '/ext/api/performers', { name }); setValues(vs => [...vs, { id: p.id, name: p.name }]); }
        catch (e) { toast('出演者の追加に失敗: ' + e.message, 'error'); }
        input.current.value = ''; close();
    };
    const onInput = () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            const q = input.current.value.trim();
            close();
            if (!q) return;
            let list = [];
            try { list = await extGet('/ext/api/performers?q=' + encodeURIComponent(q)); } catch { /* 候補なしで新規追加だけ出す */ }
            const r = input.current.getBoundingClientRect();
            setSuggest({ q, list, left: r.left, top: r.bottom + 2 });
        }, 200);
    };
    return (
        <div className="wlext-chips" style={{ position: 'relative' }} onClick={() => input.current.focus()}>
            {values.map((v, i) => <Chip key={v.id} text={v.name} onRemove={() => setValues(values.filter((_, j) => j !== i))} />)}
            <input ref={input} className="wlext-chip-input" placeholder="出演者名を入力" onInput={onInput}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(e.currentTarget.value); } }}
                onBlur={() => setTimeout(close, 200)} />
            {suggest && createPortal(
                <div className="wlext-suggest" style={{ position: 'fixed', left: suggest.left + 'px', top: suggest.top + 'px' }}>
                    {suggest.list.filter(p => !values.some(v => v.id === p.id)).map(p => (
                        <div key={p.id} onMouseDown={(e) => { e.preventDefault(); pick(p); }}>{p.name + (p.furigana ? '（' + p.furigana + '）' : '')}</div>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border-primary,#ccc)', color: 'var(--accent,#007acc)' }}
                        onMouseDown={(e) => { e.preventDefault(); add(suggest.q); }}>{'＋「' + suggest.q + '」を新規追加'}</div>
                </div>,
                document.body
            )}
        </div>
    );
}

// 両方のダイアログの入力欄。m は初めの値 (一括は空)。読み出しは返す read()
function useMetaForm(m) {
    const rating = useRef(m.rating || 0);
    const refs = { display: useRef(null), model: useRef(null), release: useRef(null), series: useRef(null), maker: useRef(null), label: useRef(null) };
    const directors = useChips(m.directors || []);
    const genres = useChips(m.genres || []);
    const [performers, setPerformers] = useState((m.performersFull || []).map(p => ({ id: p.id, name: p.name })));
    const val = (k) => refs[k].current.value.trim();
    const read = () => ({
        rating: rating.current,
        model_no: val('model'), release_date: val('release'), series: val('series'), maker: val('maker'), label: val('label'),
        directors: directors.all(), genres: genres.all(), performers: performers.map(p => p.id),
    });
    const input = (k, init, type) => <input ref={refs[k]} className="wlext-input" type={type} defaultValue={init || undefined} />;
    const fields = {
        rating: <ExtStarsEdit value={m.rating || 0} onChange={(n) => { rating.current = n; }} />,
        performers: <PerformerInput values={performers} setValues={setPerformers} />,
        genres: <ChipInput chips={genres} placeholder="ジャンルを入力してEnter" />,
        rest: <>
            <div className="wlext-row2"><Field label="公開日">{input('release', toDateInput(m.release_date), 'date')}</Field><Field label="品番">{input('model', m.model_no)}</Field></div>
            <div className="wlext-row2"><Field label="シリーズ名">{input('series', m.series)}</Field><Field label="作品監督"><ChipInput chips={directors} placeholder="監督名を入力してEnter" /></Field></div>
            <div className="wlext-row2"><Field label="メーカー">{input('maker', m.maker)}</Field><Field label="レーベル">{input('label', m.label)}</Field></div>
        </>,
        display: input('display', m.display_name),
    };
    return { fields, read, displayName: () => val('display') };
}

export function ExtMetaEditDialog({ vid, meta, onClose }) {
    const { fields, read, displayName } = useMetaForm({ ...metaToPayload(meta), performersFull: meta.performers });
    const summary = useRef(null);   // 作品紹介 (v3.13.0。一括の編集には無い)
    const url = useRef(null);       // 作品のページの URL (v3.15.0。1つだけ。一括の編集には無い)
    const save = async () => {
        const u = url.current.value.trim();
        if (u && !normalizeUrl(u)) { toast('URL は http か https で始まるものだけです', 'error'); return; }
        try { await saveMeta(vid, { ...read(), display_name: displayName(), summary: summary.current.value, url: normalizeUrl(u) }); toast('保存しました', 'success'); onClose(); }
        catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title="詳細情報を編集" onClose={onClose} onSave={save}>
            <div>
                <Field label="評価"><div>{fields.rating}</div></Field>
                <Field label="表示動画名 (タイトルを置き換えます)">{fields.display}</Field>
                <Field label="出演者">{fields.performers}</Field>
                <Field label="ジャンル">{fields.genres}</Field>
                {fields.rest}
                <Field label="URL (作品のページ。動画ページのタイトルの後ろにリンクが出ます)">
                    <input ref={url} className="wlext-input" type="url" placeholder="https://" defaultValue={meta.url || ''} />
                </Field>
                <Field label="作品紹介 (改行と、太字・リンクなど一部のタグが使えます)">
                    <textarea ref={summary} className="wlext-input wlext-summary-input" rows={5} defaultValue={meta.summary || ''} />
                </Field>
            </div>
        </ExtDialog>
    );
}

// onDone は適用したあと (選択の解除と一覧の取り直し)
export function ExtBulkMetaDialog({ ids, onDone, onClose }) {
    const { fields, read } = useMetaForm({});
    const save = async () => {
        try { const r = await extSend('POST', '/ext/api/bulk/meta', { ids, meta: read() }); toast(r.count + '件を更新しました', 'success'); onClose(); onDone(); }
        catch (e) { toast('失敗: ' + e.message, 'error'); }
    };
    return (
        <ExtDialog title={'詳細情報を一括編集（' + ids.length + '件）'} onClose={onClose} onSave={save} saveLabel="適用">
            <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#888)', marginBottom: '0.6rem' }}>入力した項目のみ上書きします（空欄は変更しません）。ジャンルは既存に追加します。表示動画名は一括では変更できません。</div>
                <Field label="評価（★を選ぶと一括設定）"><div>{fields.rating}</div></Field>
                <Field label="出演者（上書き）">{fields.performers}</Field>
                <Field label="ジャンル（追加）">{fields.genres}</Field>
                {fields.rest}
            </div>
        </ExtDialog>
    );
}
