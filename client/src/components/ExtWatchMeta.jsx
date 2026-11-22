// LadyTube: 動画ページの拡張メタデータの表示 (v3.1.13 までの server/ext/public/videometa.js の表示部分を移したもの)。
//  ・ExtRating: タイトルの下の評価 (★)。押すと保存する。v3.13.0 から再生回数・公開日と同じ行の右端
//  ・ExtMetaBlock: 詳細欄の先頭のジャンル・出演者と、作品情報 (公開日・品番・シリーズ名・メーカー・レーベル・作品監督) の欄
//  ・ExtFileInfo: その下のファイル情報の欄 (場所・動画ファイル名・カテゴリー・長さ・サイズ・前回再生・更新日・登録日。v3.12.0 までは本体の詳細欄)。
//    「動画ファイル名」の行に名前を変えるボタン (v3.12.0。PC だけ。ExtRename.jsx)。空白で区切った語は押すと検索ワードに足す (v3.14.0。ExtSearchWords.jsx)
//  ・ExtFoldBox: 作品情報とファイル情報の欄。見出しを押すと折りたたむ (閉じた欄は端末に覚える。v3.13.0)
//  ・ExtSummary: ジャンルの下の作品紹介 (v3.13.0)。最初は2行だけ出し、押すと全文。許可したタグだけを出す (utils/richText.js)。
//    標準モードでは右欄の中ではなくタイトルの下に出す (WatchPage が className="wlext-summary-std" でもう1つ置き、CSS の body.wlext-std で出し分ける)
//  ・ExtWatchFabs: 右下の丸ボタン (ブックマーク / 動画情報を検索 / タグを編集 / 詳細情報を編集)。本体のタグ編集ボタンの代わり。
//    ブックマークは ExtCardParts.jsx の ExtBookmarkButton (v3.1.15 までは bookmark.js が body に足していた)
// 詳細情報の読み書きとタグ編集は utils/videoMeta.js、編集ダイアログは ExtMetaEdit.jsx (v3.2.1 までは videometa.js)。
// 「動画情報を検索」(FANZA の検索と確認画面) は utils/metaSearch.jsx と ExtMetaSearch.jsx (v3.2.1 までは videometa.js)。
// private の metasearch.js などが WL._meta と WL.metaSearch / WL.showMetaPreview / WL.dmmSearch を使う。
// 詳細情報は WatchPage が loadMeta で読み、保存したあとは window に wlext-meta-updated ({ id, meta }) が来る。
// 拡張の関数 (window.WLExt) は、詳細情報が届いたあと (= 拡張は読み込み済み) か、押されたときにだけ呼ぶ。
// 検索や出演者へのリンクは読み直さずに移る (v3.2.1 までは拡張の WL.searchBy / WL.openPerformer でページごと読み直していた)。
// 中クリックは data-wlext-href を下で拾って新しいタブで開く (ボタンを中に持つチップがあり <a> にできないため。v3.2.1 までは拡張の core.js)。
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ExtIcon';
import { ExtBookmarkButton, ExtStarsEdit } from './ExtCardParts';
import { formatYmd, formatYmAgo, formatAgeYm, searchToken, formatDuration, formatDateTime, formatFileSize, getFolderPath, getFolderName } from '../utils/formatters';
import { cachedMeta, openTagEditor, saveRating } from '../utils/videoMeta';
import { openMetaSearch } from '../utils/metaSearch';
import { openExtDialog } from '../utils/extDialog';
import { isLocalPC } from '../utils/library';
import { openRenameDialog } from '../utils/fileRule';
import { toast } from '../utils/toast';
import { richText } from '../utils/richText';
import { ExtFileWords } from './ExtSearchWords';
import { extApi } from '../services/extApi';

const WL = () => window.WLExt;
const searchHref = (token) => '/search?q=' + encodeURIComponent(token);

// 中クリックで data-wlext-href の URL を新しいタブで開く (委譲なので後から描いた要素にも効く)
const midTarget = (e) => e.target.closest && e.target.closest('[data-wlext-href]');
document.addEventListener('mousedown', (e) => { if (e.button === 1 && midTarget(e)) e.preventDefault(); });
document.addEventListener('auxclick', (e) => {
    if (e.button !== 1) return;
    const el = midTarget(e);
    if (!el) return;
    e.preventDefault(); e.stopPropagation();
    window.open(el.getAttribute('data-wlext-href'), '_blank');
});

// 評価。変わったら WatchPage が key で作り直す (以前の「保存したら描き直す」と同じ)
export function ExtRating({ videoId, value }) {
    return (
        <div className="wlext-rating-host">
            <ExtStarsEdit value={value} onChange={(n) => saveRating(videoId, n)} />
        </div>
    );
}

// 除外検索ボタン: 虫メガネ＋マイナス。包含検索 (accent 色) と区別するため赤系 (womanlive-ext.css)
function ExcludeBtn({ token, label }) {
    const navigate = useNavigate();
    return (
        <span className="wlext-exclude-btn" title={'「' + label + '」を除外して検索'} data-wlext-href={searchHref(token)}
            onClick={(e) => { e.stopPropagation(); navigate(searchHref(token)); }}>
            <Icon name="zoom-out" size={14} />
        </span>
    );
}
function LinkVal({ text, token }) {
    const navigate = useNavigate();
    return <span className="wlext-link" title={'「' + text + '」で検索'} data-wlext-href={searchHref(token)} onClick={() => navigate(searchHref(token))}>{text}</span>;
}
// 包含リンク + 除外ボタン
function ValEx({ text, field }) {
    return (
        <span className="wlext-val-pair">
            <LinkVal text={text} token={'@' + searchToken(field, text)} />
            <ExcludeBtn token={'@' + searchToken('not' + field, text)} label={text} />
        </span>
    );
}
function PerformerImage({ p }) {
    const [failed, setFailed] = useState(false);
    const navigate = useNavigate();
    return (
        <div className="wlext-performer-img" title="出演者ページを開く" data-wlext-href={'/performer/' + p.id} onClick={() => navigate('/performer/' + p.id)}>
            {p.has_image && !failed
                ? <img alt={p.name} src={extApi.performerImageUrl(p.id)} onError={() => setFailed(true)} />
                : <Icon name="user" size="1.2em" sw={1.5} />}
        </div>
    );
}

// 作品情報とファイル情報の欄。閉じた欄の名前を端末に覚える (JSON の配列)
const FOLD_KEY = 'wlext_watch_fold';
const foldedNames = () => { try { const a = JSON.parse(localStorage.getItem(FOLD_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
export function ExtFoldBox({ name, title, children }) {
    const [closed, setClosed] = useState(() => foldedNames().includes(name));
    const toggle = () => {
        const next = !closed;
        setClosed(next);
        try { localStorage.setItem(FOLD_KEY, JSON.stringify(foldedNames().filter(n => n !== name).concat(next ? [name] : []))); } catch { /* 覚えられなくても開閉はする */ }
    };
    return (
        <div className={'wlext-infobox wlext-fold' + (closed ? ' closed' : '')}>
            <button type="button" className="wlext-fold-head" aria-expanded={!closed} title={closed ? '開く' : '折りたたむ'} onClick={toggle}>
                <Icon name="chevron-down" size={14} /><span>{title}</span>
            </button>
            {!closed && children}
        </div>
    );
}

// 表の行 ([項目名, 値] の並び → 「項目名:」と値のセル)
const gridRows = (list) => list.flatMap(([key, val]) => [<div key={key + ':k'} className="wlext-key">{key}:</div>, <div key={key + ':v'} className="wlext-val">{val}</div>]);

// ファイル情報 (本体の動画の情報だけで作るので、詳細情報を読む前から出す)
export function ExtFileInfo({ video }) {
    return (
        <ExtFoldBox name="file" title="ファイル情報">
            <div className="wlext-detail-grid">{gridRows([
                ['場所', getFolderPath(video.path)],
                ['動画ファイル名', <><span data-wlext-pick=""><ExtFileWords filename={video.filename} /></span>{isLocalPC && (
                    <button className="wlext-rename-btn" title="ファイル名を変更" onClick={() => openRenameDialog(String(video.id))}><Icon name="pencil" size={13} /></button>
                )}</>],
                ['カテゴリー', getFolderName(video.path)],
                ['長さ', video.duration === null ? '不明' : formatDuration(video.duration)],
                ['サイズ', formatFileSize(video.size)],
                ['前回再生', video.last_played_at ? formatDateTime(video.last_played_at) : '未再生'],
                ['更新日', formatDateTime(video.updated_at)],
                ['登録日', video.created_at ? formatDateTime(video.created_at) : '-'],
            ])}</div>
        </ExtFoldBox>
    );
}

// 作品紹介。閉じているときは2行だけ (押すと開く)。開閉は覚えない (動画を開くたびに閉じた状態から)
export function ExtSummary({ text, className }) {
    const [open, setOpen] = useState(false);
    const { nodes, plain } = richText(text);
    return (
        <div className={'wlext-summary' + (open ? ' open' : '') + (className ? ' ' + className : '')}>
            <button type="button" className="wlext-fold-head" aria-expanded={open} title={open ? '折りたたむ' : '全文を表示'} onClick={() => setOpen(!open)}>
                <Icon name="chevron-down" size={14} /><span>作品紹介</span>
            </button>
            <div className={'wlext-summary-body' + (plain ? ' plain' : '')} title={open ? undefined : '押すと全文を表示'} data-wlext-pick=""
                onClick={open ? undefined : () => { if (!String(window.getSelection())) setOpen(true); }}>{nodes}</div>
        </div>
    );
}

export function ExtMetaBlock({ meta }) {
    const navigate = useNavigate();
    const rows = [];
    const row = (key, val) => rows.push([key, val]);
    if (meta.release_date) row('公開日', <>{formatYmd(meta.release_date)}<span className="wlext-release-ago">{formatYmAgo(meta.release_date)}</span></>);
    if (meta.model_no) row('品番', <LinkVal text={meta.model_no} token={'@' + searchToken('model', meta.model_no)} />);
    if (meta.series) row('シリーズ名', <ValEx text={meta.series} field="series" />);
    if (meta.maker) row('メーカー', <ValEx text={meta.maker} field="maker" />);
    if (meta.label) row('レーベル', <ValEx text={meta.label} field="label" />);
    if (meta.directors && meta.directors.length) row('作品監督', <span className="wlext-multi">{meta.directors.map(d => <ValEx key={d} text={d} field="director" />)}</span>);
    const ref = meta.release_date || meta.video_date;
    return (
        <div className="wlext-meta-block">
            {meta.genres && meta.genres.length > 0 && (
                <div className="wlext-genres">
                    {meta.genres.map(name => (
                        <span key={name} className="wlext-genre-chip" title={'「' + name + '」で検索'} data-wlext-href={searchHref('@' + searchToken('genre', name))}
                            onClick={() => navigate(searchHref('@' + searchToken('genre', name)))}>
                            <span>{name}</span>
                            <ExcludeBtn token={'@' + searchToken('notgenre', name)} label={name} />
                        </span>
                    ))}
                </div>
            )}
            {meta.summary && <ExtSummary key={meta.summary} text={meta.summary} />}
            {meta.performers && meta.performers.length > 0 && (
                <div className="wlext-performers">
                    {meta.performers.map(p => {
                        const age = formatAgeYm(p.birthday, ref);
                        return (
                            <div key={p.id} className="wlext-performer-card">
                                <PerformerImage p={p} />
                                <div className="wlext-performer-name-row">
                                    <span className="wlext-performer-name" title={'「' + p.name + '」で検索'} data-wlext-href={searchHref('@performer:' + p.id)}
                                        onClick={() => navigate(searchHref('@performer:' + p.id))}>{p.name}</span>
                                    <ExcludeBtn token={'@notperformer:' + p.id} label={p.name} />
                                </div>
                                {age && <div className="wlext-performer-age">{age}</div>}
                            </div>
                        );
                    })}
                </div>
            )}
            <ExtFoldBox name="work" title="作品情報">
                {rows.length
                    ? <div className="wlext-detail-grid">{gridRows(rows)}</div>
                    : <div style={{ color: 'var(--text-secondary,#888)' }}>詳細情報は未設定です。右下の「詳細情報を編集」ボタン（鉛筆）から登録できます。</div>}
            </ExtFoldBox>
        </div>
    );
}

// 丸ボタン。以前と同じく body の末尾に置く (位置は womanlive-ext.css の .wlext-*-fab)
export function ExtWatchFabs({ videoId }) {
    const vid = String(videoId);
    const editMeta = () => {
        const meta = cachedMeta(vid);
        if (!meta) { toast('詳細情報を読み込み中です'); return; }
        // 編集ダイアログは開くときに読む (v3.13.0。最初に読む JS を 500KB 未満に保つため)
        import('./ExtMetaEdit').then(m => openExtDialog(m.ExtMetaEditDialog, { vid, meta }));
    };
    return createPortal(
        <>
            {/* 位置は CSS で決まる (右下に横一列。左から ブックマーク → 動画情報検索 → タグ編集 → 詳細情報を編集) */}
            <ExtBookmarkButton id={videoId} fab />
            {/* 説明は検索を差し替えたもの (WL.metaSearchTitle) があればそれ。拡張は defer で読むが、ここは動画を読み込んでから描くので間に合う */}
            <button className="wlext-search-fab" title={WL()?.metaSearchTitle || '動画情報を検索（品番でFANZA商品検索し、メタデータを自動設定）'} onClick={() => openMetaSearch(vid)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button className="wlext-tag-fab" title="タグを編集" onClick={() => openTagEditor(vid)}><Icon name="tag" size={22} /></button>
            <button className="wlext-tag-fab wlext-edit-fab" title="詳細情報を編集" onClick={editMeta}><Icon name="pencil" size={22} /></button>
        </>,
        document.body
    );
}
