// LadyTube: 動画ページの拡張メタデータの表示 (v3.1.13 までの server/ext/public/videometa.js の表示部分を移したもの)。
//  ・ExtRating: タイトルの下の評価 (★)。押すと保存する
//  ・ExtMetaBlock: 詳細欄の先頭のジャンル・出演者・品番などの表
//  ・ExtWatchFabs: 右下の丸ボタン (ブックマーク / 動画情報を検索 / タグを編集 / 詳細情報を編集)。本体のタグ編集ボタンの代わり。
//    ブックマークは ExtCardParts.jsx の ExtBookmarkButton (v3.1.15 までは bookmark.js が body に足していた)
// 詳細情報の読み込みと保存、編集ダイアログ、DMM 検索、タグ編集は videometa.js のまま
// (private の metasearch.js などが WL._meta と差し込み口 WL.metaSearch / WL.showMetaPreview を使うため)。
// 詳細情報は WatchPage が WL.loadMeta で読み、保存したあとは videometa.js が window に wlext-meta-updated ({ id, meta }) を投げる。
// 拡張の関数 (window.WLExt) は、詳細情報が届いたあと (= 拡張は読み込み済み) か、押されたときにだけ呼ぶ。
// 検索や出演者へのリンクは以前と同じくページごと読み直す (WL.searchBy / WL.openPerformer)。中クリックは data-wlext-href を core.js が拾う。
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './ExtIcon';
import { ExtBookmarkButton } from './ExtCardParts';
import { formatYmd, formatYmAgo, formatAgeYm } from '../utils/formatters';

const WL = () => window.WLExt;
const searchHref = (token) => '/search?q=' + encodeURIComponent(token);

// 評価。変わったら WatchPage が key で作り直す (以前の「保存したら描き直す」と同じ)
export function ExtRating({ videoId, value }) {
    const [cur, setCur] = useState(value || 0);
    const [hover, setHover] = useState(null);
    const shown = hover === null ? cur : hover;
    const pick = (e, n) => { e.stopPropagation(); e.preventDefault(); setCur(n); WL().saveRating(videoId, n); };
    return (
        <div className="wlext-rating-host">
            <div className="wlext-rating" onMouseLeave={() => setHover(null)}>
                {[1, 2, 3, 4, 5].map(i => (
                    <span key={i} className={'wlext-star' + (i <= shown ? ' on' : '')} onMouseEnter={() => setHover(i)} onClick={(e) => pick(e, i)}>★</span>
                ))}
                <span className="wlext-rating-clear" onClick={(e) => pick(e, 0)}>クリア</span>
            </div>
        </div>
    );
}

// 除外検索ボタン: 虫メガネ＋マイナス。包含検索 (accent 色) と区別するため赤系 (womanlive-ext.css)
function ExcludeBtn({ token, label }) {
    return (
        <span className="wlext-exclude-btn" title={'「' + label + '」を除外して検索'} data-wlext-href={searchHref(token)}
            onClick={(e) => { e.stopPropagation(); WL().searchBy(token); }}>
            <Icon name="zoom-out" size={14} />
        </span>
    );
}
function LinkVal({ text, token }) {
    return <span className="wlext-link" title={'「' + text + '」で検索'} data-wlext-href={searchHref(token)} onClick={() => WL().searchBy(token)}>{text}</span>;
}
// 包含リンク + 除外ボタン
function ValEx({ text, field }) {
    return (
        <span className="wlext-val-pair">
            <LinkVal text={text} token={'@' + field + ':"' + text + '"'} />
            <ExcludeBtn token={'@not' + field + ':"' + text + '"'} label={text} />
        </span>
    );
}
function PerformerImage({ p }) {
    const [failed, setFailed] = useState(false);
    return (
        <div className="wlext-performer-img" title="出演者ページを開く" data-wlext-href={'/performer/' + p.id} onClick={() => WL().openPerformer(p.id)}>
            {p.has_image && !failed
                ? <img alt={p.name} src={WL().api.performerImageUrl(p.id)} onError={() => setFailed(true)} />
                : '👤'}
        </div>
    );
}

export function ExtMetaBlock({ meta }) {
    const rows = [];
    const row = (key, val) => rows.push(<div key={key + ':k'} className="wlext-key">{key}:</div>, <div key={key + ':v'} className="wlext-val">{val}</div>);
    if (meta.release_date) row('公開日', <>{formatYmd(meta.release_date)}<span className="wlext-release-ago">{formatYmAgo(meta.release_date)}</span></>);
    if (meta.file_name) row('動画ファイル名', meta.file_name);
    if (meta.model_no) row('品番', <LinkVal text={meta.model_no} token={'@model:"' + meta.model_no + '"'} />);
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
                        <span key={name} className="wlext-genre-chip" title={'「' + name + '」で検索'} data-wlext-href={searchHref('@genre:"' + name + '"')}
                            onClick={() => WL().searchBy('@genre:"' + name + '"')}>
                            <span>{name}</span>
                            <ExcludeBtn token={'@notgenre:"' + name + '"'} label={name} />
                        </span>
                    ))}
                </div>
            )}
            {meta.performers && meta.performers.length > 0 && (
                <div className="wlext-performers">
                    {meta.performers.map(p => {
                        const age = formatAgeYm(p.birthday, ref);
                        return (
                            <div key={p.id} className="wlext-performer-card">
                                <PerformerImage p={p} />
                                <div className="wlext-performer-name-row">
                                    <span className="wlext-performer-name" title={'「' + p.name + '」で検索'} data-wlext-href={searchHref('@performer:' + p.id)}
                                        onClick={() => WL().searchBy('@performer:' + p.id)}>{p.name}</span>
                                    <ExcludeBtn token={'@notperformer:' + p.id} label={p.name} />
                                </div>
                                {age && <div className="wlext-performer-age">{age}</div>}
                            </div>
                        );
                    })}
                </div>
            )}
            <div className="wlext-infobox">
                {rows.length
                    ? <div className="wlext-detail-grid">{rows}</div>
                    : <div style={{ color: 'var(--text-secondary,#888)' }}>詳細情報は未設定です。右下の「詳細情報を編集」ボタン（鉛筆）から登録できます。</div>}
            </div>
        </div>
    );
}

// 丸ボタン。以前と同じく body の末尾に置く (位置は womanlive-ext.css の .wlext-*-fab)
export function ExtWatchFabs({ videoId }) {
    const call = (name) => () => { const w = WL(); if (w && w[name]) w[name](String(videoId)); };
    return createPortal(
        <>
            {/* 位置は CSS で決まる (上から ブックマーク → 動画情報検索 → タグ編集 → 詳細情報を編集) */}
            <ExtBookmarkButton id={videoId} fab />
            <button className="wlext-search-fab" title="動画情報を検索（品番でFANZA商品検索し、メタデータを自動設定）" onClick={call('openMetaSearch')}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            </button>
            <button className="wlext-tag-fab" title="タグを編集" onClick={call('openTagEditor')}><Icon name="tag" size={22} /></button>
            <button className="wlext-tag-fab wlext-edit-fab" title="詳細情報を編集" onClick={call('openMetaEdit')}><Icon name="pencil" size={22} /></button>
        </>,
        document.body
    );
}
