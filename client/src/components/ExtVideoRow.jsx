// LadyTube: 動画の一覧の1行 (サムネイル・長さ・続きの位置・名前・評価)。v3.2.1 までは拡張の server/ext/public/groupview.js の WL.videoRow。
//  ・ExtGroupMembers: 品番でまとめたカードの「N本」を押したときの、まとめた動画の一覧 (VideoList.jsx が openExtDialog で開く)
//  ・ExtStdSeries / ExtStdRelated: 動画ページの標準モードの右欄「同じシリーズ」「関連」(ExtStandard.jsx。v3.2.1 までは standard.js)
// 見た目は womanlive-ext.css の .wlext-vrow-* / .wlext-std-*。行を押すと動画ページへ (読み直さない)。
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExtDialog } from './ExtDialog';
import { ExtStars } from './ExtCardParts';
import { Icon } from './ExtIcon';
import { extGet } from '../services/extApi';
import { formatDuration, formatYmd, searchToken } from '../utils/formatters';

const searchHref = (token) => '/search?q=' + encodeURIComponent(token);
// 表示設定の「動画表示名で表示する」(既定はオン)
const displayNameOn = () => { try { return localStorage.getItem('wlext_use_display_name') !== '0'; } catch { return true; } };
const sameModel = (a, b) => !!a && !!b && String(a).toUpperCase() === String(b).toUpperCase();
const Msg = ({ children }) => <div className="wlext-std-msg">{children}</div>;

// current: 今の動画 / count: まとめた本数 (2 以上で「N本」) / stripPart: 名前の末尾のパート番号 _N を外す / date: 公開日 / note: 右に添える文
export function ExtVideoRow({ v, current, count, stripPart, date, note, onClick }) {
    let name = displayNameOn() && v.ext_display_name ? v.ext_display_name : String(v.filename || '').replace(/\.[^.\\/]+$/, '');
    if (stripPart) name = name.replace(/_\d+$/, '');
    return (
        <Link to={'/watch/' + v.id} className={'wlext-vrow' + (current ? ' current' : '')} title={name} onClick={onClick}>
            <div className="wlext-vrow-thumb">
                <img loading="lazy" alt="" src={v.has_thumbnail ? '/api/video/' + v.id + '/thumbnail?s=' + (v.thumbnail_size || 0) : undefined} />
                <span className="wlext-vrow-dur">{formatDuration(v.duration)}</span>
                {v.last_pos > 0 && v.duration > 0 && <div className="wlext-vrow-prog" style={{ width: Math.min(100, v.last_pos / v.duration * 100) + '%' }} />}
                {count > 1 && <span className="wlext-vrow-count"><Icon name="layers" size={11} /><span>{count + '本'}</span></span>}
            </div>
            <div className="wlext-vrow-info">
                <div className="wlext-vrow-name">{name}</div>
                <div className="wlext-vrow-sub">
                    {v.ext_rating > 0 && <ExtStars value={v.ext_rating} />}
                    {date && v.ext_release_date && <span>{formatYmd(v.ext_release_date)}</span>}
                    {note && <span className="wlext-vrow-note">{note}</span>}
                </div>
            </div>
        </Link>
    );
}

// まとめた動画の一覧。ids は中の動画 (本体の画面が一覧の結果の ext_group_ids から渡す)。行を押すと閉じて移る
export function ExtGroupMembers({ ids, onClose }) {
    const [r, setR] = useState(null);   // null = 読み込み中 / { error } / { videos }
    const key = ids.join(',');
    useEffect(() => {
        extGet('/ext/api/videos/brief?ids=' + key).then(setR, e => setR({ error: e.message }));
    }, [key]);
    return (
        <ExtDialog title={'まとめた動画（' + ids.length + '本）'} onClose={onClose}>
            <div className="wlext-vrow-list">
                {!r ? <div className="wlext-facets-msg">読み込み中...</div>
                    : r.error ? '読み込みに失敗しました: ' + r.error
                        : r.videos.map(v => <ExtVideoRow key={v.id} v={v} onClick={onClose} />)}
            </div>
        </ExtDialog>
    );
}

// 同じ品番 (分割されたパート) と、同じシリーズの作品。「同じ品番」・シリーズ名を押すとそれで検索
export function ExtStdSeries({ vid }) {
    const [r, setR] = useState(null);
    useEffect(() => {
        extGet('/ext/api/video/' + vid + '/siblings').then(setR, e => setR({ error: e.message }));
    }, [vid]);
    if (!r) return <Msg>読み込み中...</Msg>;
    if (r.error) return <Msg>{'読み込みに失敗しました: ' + r.error}</Msg>;
    if (r.parts.length <= 1 && !r.series) return <Msg>シリーズが設定されていません</Msg>;
    return (
        <>
            {r.parts.length > 1 && <>
                <div className="wlext-std-sec">
                    <Link to={searchHref('@' + searchToken('model', r.modelNo))} className="wlext-link" title={'品番「' + r.modelNo + '」で検索'}>同じ品番</Link>
                    <span className="wlext-std-sec-n">{'（' + r.parts.length + '本）'}</span>
                </div>
                <div className="wlext-vrow-list">
                    {r.parts.map(v => <ExtVideoRow key={v.id} v={v} current={String(v.id) === vid} />)}
                </div>
            </>}
            {r.series && <>
                <div className="wlext-std-sec">
                    <Link to={searchHref('@' + searchToken('series', r.series))} className="wlext-link" title={'「' + r.series + '」で検索'}>{r.series}</Link>
                    <span className="wlext-std-sec-n">{'（' + r.works.length + '作品）'}</span>
                </div>
                <div className="wlext-vrow-list">
                    {r.works.map(v => (
                        <ExtVideoRow key={v.id} v={v} count={v.group_count} stripPart={v.group_count > 1} date
                            current={String(v.id) === vid || sameModel(v.ext_model_no, r.modelNo)} />
                    ))}
                </div>
            </>}
        </>
    );
}

// 関連動画 (ids は動画ページが本体の API から受け取った並び)。次に再生する動画に「次に再生」
export function ExtStdRelated({ ids, nextVideoId }) {
    const [r, setR] = useState(null);
    const key = ids.join(',');
    useEffect(() => {
        if (key) extGet('/ext/api/videos/brief?ids=' + key).then(setR, e => setR({ error: e.message }));
    }, [key]);
    if (!key) return <Msg>関連動画はありません</Msg>;
    if (!r) return <Msg>読み込み中...</Msg>;
    if (r.error) return <Msg>{'読み込みに失敗しました: ' + r.error}</Msg>;
    return (
        <div className="wlext-vrow-list">
            {r.videos.map(v => <ExtVideoRow key={v.id} v={v} note={String(v.id) === String(nextVideoId) ? '次に再生' : ''} />)}
        </div>
    );
}
