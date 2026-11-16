// LadyTube: 出演者のページ (/performer/:id)。写真・氏名・ふりがな・評価・身長などの情報、関連動画、関連スクリーンショット。
// 情報は押すとその場で編集して保存する (氏名・ふりがな・身長・体重・血液型・誕生日。スリーサイズ・別名・出演者タグはダイアログ)。
// 写真は押すと拡大 (無ければ画像を選んで正方形に切り取る)。スクリーンショットは「最近」8件か「ランダム」(押すたびに抽選)。
// 差し込み口 WL.performerExtras に「部品を作る関数 (id) => 要素」を足すと、ページを開くたびに置く (ExtSlot。丸ボタンなどは position: fixed で)。
// v3.2.1 までは拡張の server/ext/public/performer.js。見た目は拡張のときと同じ womanlive-ext.css のクラス。
// ダイアログは ExtDialog。ライトボックス・切り取り・出演者タグの選択は拡張の WL.* (core.js。React より先に読まれる)
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ExtListPage } from '../components/ExtListParts';
import { ExtStarsEdit } from '../components/ExtCardParts';
import ExtSlot from '../components/ExtSlot';
import { ExtDialog } from '../components/ExtDialog';
import { ChipInput } from '../components/ExtChipInput';
import { useChips } from '../utils/chips';
import { openExtDialog } from '../utils/extDialog';
import { toast } from '../utils/toast';
import { extApi } from '../services/extApi';
import { formatAgeYm, formatDuration, formatYmd } from '../utils/formatters';
import { toDateInput } from '../utils/videoMeta';
import ExtPresetTagDialog from '../components/ExtPresetTagDialog';
import { cropDialog, lightbox } from '../utils/imageDialogs';

const muted = { color: 'var(--text-secondary,#888)' };
const isEmpty = (v) => v === null || v === undefined || v === '';

// 見出しの氏名・ふりがな。押すと入力欄に替え、Enter / 外す で保存、Esc で取り消し
function HeaderEdit({ as, className, value, empty, big, onSave }) {
    const [editing, setEditing] = useState(false);
    const done = useRef(false);   // Enter で閉じたあとの blur で二度保存しない
    const input = useRef(null);
    useLayoutEffect(() => { if (editing) input.current.focus(); }, [editing]);
    if (!editing) {
        const Tag = as;
        return <Tag className={className} style={{ cursor: 'pointer' }} title="クリックで編集" onClick={() => { done.current = false; setEditing(true); }}>{value || empty}</Tag>;
    }
    const finish = (save) => {
        if (done.current) return;
        done.current = true;
        const v = input.current.value.trim();
        setEditing(false);
        if (save) onSave(v);
    };
    return (
        <input ref={input} className="wlext-input" defaultValue={value || ''} style={big ? { fontSize: '1.3rem', fontWeight: 'bold' } : undefined}
            onKeyDown={(e) => { if (e.key === 'Enter') finish(true); else if (e.key === 'Escape') finish(false); }}
            onBlur={() => finish(true)} />
    );
}

// 情報の値。押すとその場で入力欄に替え (edit = { value, type, onSave })、Enter / 外す で保存、Esc で取り消し。onOpen を渡すと代わりにそれを呼ぶ
function ValueCell({ text, empty, edit, onOpen }) {
    const [editing, setEditing] = useState(false);
    const done = useRef(false);
    const input = useRef(null);
    useLayoutEffect(() => { if (editing) input.current.focus(); }, [editing]);
    if (!editing) {
        return (
            <div className={'v editable' + (empty ? ' empty' : '')} title="クリックで編集"
                onClick={() => { if (onOpen) onOpen(); else { done.current = false; setEditing(true); } }}>{text}</div>
        );
    }
    const commit = () => {
        if (done.current) return;
        done.current = true;
        const v = input.current.value.trim();
        setEditing(false);
        edit.onSave(v);
    };
    return (
        <input ref={input} className="wlext-input" type={edit.type === 'date' ? 'date' : 'text'} defaultValue={edit.value} style={{ padding: '2px 6px' }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); else if (e.key === 'Escape') { done.current = true; setEditing(false); } }}
            onBlur={commit} />
    );
}

const Row = ({ label, children, style }) => <div className="wlext-pp-row" style={style}><span className="k">{label}</span>{children}</div>;

const Field = ({ label, children }) => <div className="wlext-field"><label>{label}</label>{children}</div>;

function ThreeSizeDialog({ perf, save, onClose }) {
    const bust = useRef(null), cup = useRef(null), waist = useRef(null), hip = useRef(null);
    const ok = async () => {
        await save({ bust: bust.current.value.trim(), cup: cup.current.value.trim(), waist: waist.current.value.trim(), hip: hip.current.value.trim() });
        onClose();
    };
    return (
        <ExtDialog title="スリーサイズを編集" onClose={onClose} onSave={ok}>
            <div className="wlext-row2">
                <Field label="バスト"><input ref={bust} className="wlext-input" defaultValue={perf.bust || ''} /></Field>
                <Field label="カップ数"><input ref={cup} className="wlext-input" defaultValue={perf.cup || ''} /></Field>
                <Field label="ウェスト"><input ref={waist} className="wlext-input" defaultValue={perf.waist || ''} /></Field>
                <Field label="ヒップ"><input ref={hip} className="wlext-input" defaultValue={perf.hip || ''} /></Field>
            </div>
        </ExtDialog>
    );
}

// 別名などの複数値 (Enter か「,」で足す)
function MultiDialog({ label, arr, onSave, onClose }) {
    const chips = useChips(arr);
    return (
        <ExtDialog title={label + 'を編集'} onClose={onClose} onSave={async () => { await onSave(chips.all()); onClose(); }}>
            <div className="wlext-field"><ChipInput chips={chips} placeholder={label + 'を入力してEnter'} /></div>
        </ExtDialog>
    );
}

// 別名・出演者タグの行 (チップと「✎編集」)
function ChipRow({ label, values, onEdit }) {
    return (
        <div>
            <Row label={label}>
                <div className="v">
                    <span className="wlext-pp-tags">{values.map((a, i) => <span key={i} className="wlext-pp-tag">{a}</span>)}</span>
                    <span className="wlext-link" style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }} onClick={onEdit}>✎編集</span>
                </div>
            </Row>
        </div>
    );
}

function VideoCard({ v }) {
    const title = v.ext_display_name || v.filename || '';
    return (
        <Link className="wlext-video-card" to={'/watch/' + v.id}>
            <div className="wlext-video-thumb">
                {v.has_thumbnail
                    ? <img src={'/api/video/' + v.id + '/thumbnail?s=' + (v.thumbnail_size || 0)} loading="lazy" alt={title} />
                    : <div className="noimg">NO IMAGE</div>}
                <div className="wlext-video-dur">{formatDuration(v.duration)}</div>
            </div>
            <div className="wlext-video-title" title={title}>{title}</div>
        </Link>
    );
}

function PerformerView({ id }) {
    const [perf, setPerf] = useState(null);       // null = 読み込み中 / false = 見つからない
    const [title, setTitle] = useState('出演者');
    const [img, setImg] = useState(() => ({ v: Date.now(), broken: false }));   // v は写真の URL に付ける印
    const [videos, setVideos] = useState(null);   // null = 読み込み中 / false = 失敗
    const [shots, setShots] = useState({ mode: 'recent', list: null });

    useEffect(() => {
        const api = extApi;
        let alive = true;
        api.getPerformer(id).then(p => {
            if (!alive) return;
            setPerf(p);
            setTitle(p.name || '出演者');
            api.performerVideos(id).then(v => { if (alive) setVideos(v); }, () => { if (alive) setVideos(false); });
            api.performerScreenshots(id, '').then(l => { if (alive) setShots({ mode: 'recent', list: l }); }, () => { if (alive) setShots({ mode: 'recent', list: false }); });
        }, () => { if (alive) setPerf(false); });
        return () => { alive = false; };
    }, [id]);

    if (perf === null) return <ExtListPage title={title}><div>読み込み中...</div></ExtListPage>;
    if (perf === false) return <ExtListPage title={title}><div>出演者が見つかりません。</div></ExtListPage>;

    // 情報は出演者まるごと送る (拡張のときと同じ)
    const save = async (patch) => {
        const next = { ...perf, ...patch };
        setPerf(next);
        try { await extApi.updatePerformer(id, next); } catch (e) { toast('保存に失敗: ' + e.message, 'error'); }
    };
    const pickAndCrop = () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*'; input.style.display = 'none';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = () => cropDialog(reader.result, async (dataUrl) => {
                try {
                    await extApi.setPerformerImage(id, dataUrl);
                    setPerf(p => ({ ...p, has_image: true }));
                    setImg({ v: Date.now(), broken: false });
                    toast('画像を登録しました', 'success');
                } catch (e) { toast('画像の登録に失敗: ' + e.message, 'error'); }
            }, { aspect: [1, 1], outW: 600, title: '画像を切り取り', hint: 'ドラッグで位置調整・スライダーで拡大し、正方形に切り取ります。' });
            reader.readAsDataURL(file);
        });
        document.body.appendChild(input); input.click(); setTimeout(() => input.remove(), 1000);
    };
    const loadShots = (mode) => {
        setShots({ mode, list: null });
        extApi.performerScreenshots(id, mode === 'random' ? 'random' : '').then(list => setShots({ mode, list }), () => setShots({ mode, list: false }));
    };

    const field = (key) => ({ value: perf[key] || '', type: 'text', onSave: (v) => save({ [key]: v }) });
    const plain = (key) => <ValueCell text={isEmpty(perf[key]) ? '未設定' : perf[key]} empty={isEmpty(perf[key])} edit={field(key)} />;
    const { bust: b, cup: c, waist: w, hip: hp, birthday } = perf;
    const hasSize = b || c || w || hp;
    const age = birthday ? formatAgeYm(birthday) : '';
    return (
        <ExtListPage title={title}>
            <div className="wlext-pp-header">
                <div className="wlext-pp-image" title="画像をクリックで拡大"
                    onClick={() => { if (perf.has_image) lightbox(extApi.performerImageUrl(id, Date.now()), { onEdit: pickAndCrop }); else pickAndCrop(); }}>
                    {perf.has_image && !img.broken
                        ? <img alt={perf.name} src={extApi.performerImageUrl(id, img.v)} onError={() => setImg(x => ({ ...x, broken: true }))} />
                        : '👤'}
                </div>
                <div className="wlext-pp-info">
                    <div className="wlext-pp-namerow">
                        <div className="wlext-pp-namecol">
                            <HeaderEdit as="h1" className="wlext-pp-name" value={perf.name} empty="(名称未設定)" big onSave={(v) => save({ name: v })} />
                            <HeaderEdit as="div" className="wlext-pp-furigana" value={perf.furigana} empty="ふりがな未設定" onSave={(v) => save({ furigana: v })} />
                        </div>
                        <div className="wlext-pp-rating"><ExtStarsEdit value={perf.rating || 0} onChange={(n) => save({ rating: n })} /></div>
                    </div>
                    <div className="wlext-pp-grid">
                        <Row label="身長">{plain('height')}</Row>
                        <Row label="体重">{plain('weight')}</Row>
                        <Row label="スリーサイズ">
                            <ValueCell text={hasSize ? ((b || '?') + (c ? ' (' + c + ')' : '') + '/' + (w || '?') + '/' + (hp || '?')) : '未設定'} empty={!hasSize}
                                onOpen={() => openExtDialog(ThreeSizeDialog, { perf, save })} />
                        </Row>
                        <Row label="血液型">{plain('blood_type')}</Row>
                        {/* 誕生日は現在の年齢を併記。折り返さないよう全幅 */}
                        <Row label="誕生日" style={{ gridColumn: '1 / -1' }}>
                            <ValueCell text={birthday ? (formatYmd(birthday) + (age ? ' (' + age + ')' : '')) : '未設定'} empty={!birthday}
                                edit={{ value: toDateInput(birthday || ''), type: 'date', onSave: (v) => save({ birthday: v }) }} />
                        </Row>
                    </div>
                    <ChipRow label="別名" values={perf.aliases || []} onEdit={() => openExtDialog(MultiDialog, { label: '別名', arr: perf.aliases || [], onSave: (arr) => save({ aliases: arr }) })} />
                    <ChipRow label="出演者タグ" values={perf.tags || []} onEdit={() => openExtDialog(ExtPresetTagDialog, {
                        title: '出演者タグを設定',
                        current: perf.tags || [],
                        loadPresets: () => extApi.getPerformerTags(),
                        savePresets: (arr) => extApi.savePerformerTags(arr),
                        onSave: (selected) => save({ tags: selected }),
                    })} />
                </div>
            </div>

            <div className="wlext-pp-section-title">{'関連動画（' + (perf.video_count || 0) + '）'}</div>
            <div className="wlext-video-grid">
                {videos === null ? <div style={muted}>読み込み中...</div>
                    : videos === false ? null
                        : videos.length ? videos.map(v => <VideoCard key={v.id} v={v} />)
                            : <div style={muted}>関連動画はありません</div>}
            </div>

            <div className="wlext-pp-section-title">
                <span>関連スクリーンショット</span>
                <span className="wlext-pp-title-actions">
                    <div className={'wlext-plist-sortbtn' + (shots.mode === 'recent' ? ' active' : '')} onClick={() => loadShots('recent')}>最近</div>
                    <div className={'wlext-plist-sortbtn' + (shots.mode === 'random' ? ' active' : '')} title="押すたびに8件を抽選します" onClick={() => loadShots('random')}>ランダム</div>
                </span>
            </div>
            <div className="wlext-video-grid">
                {shots.list === null ? <div style={muted}>読み込み中...</div>
                    : shots.list === false ? null
                        : shots.list.length ? shots.list.map(s => (
                            <Link key={s.id} className="wlext-ss-card" to={'/watch/' + s.video_id + '?t=' + Math.floor(s.timestamp || 0)}>
                                <img src={'/api/screenshot/' + s.id + '/image'} loading="lazy" />
                            </Link>
                        ))
                            : <div style={muted}>関連スクリーンショットはありません</div>}
            </div>
        </ExtListPage>
    );
}

// 出演者が変わったら作り直す (前の出演者の状態を持ち越さない)
export default function PerformerPage() {
    const { id } = useParams();
    return (
        <>
            <PerformerView key={id} id={id} />
            <ExtSlot from="performerExtras" args={id} />
        </>
    );
}
