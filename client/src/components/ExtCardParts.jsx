// LadyTube: 検索画面のカードに足す表示 (v3.1.4 までの server/ext/public/cardenh.js を移したもの)。
//  ・サムネ右上にメーカー名、左下にフォルダ名 (ポスター表示はフォルダ名なし)
//  ・評価の行 (リスト表示はシリーズ名も)。ポスター表示はサムネ左上に重ねる
//  ・リスト表示: 出演者と監督の行、ジャンル＋タグの行 (幅に収まらない分は「…」。マウスを乗せると全部)
// 項目は一覧 API (server/ext/routes/search.js の withCardFields) が返す。見た目は womanlive-ext.css のクラス。
// 評価の行 .wlext-card-meta の末尾にブックマークボタンとスクショ数 (ExtCardBadges。v3.1.15 までは
// server/ext/public/bookmark.js と screenshots.js がカードを探して足していた)。並びは CSS の order で決まる。
import { Fragment, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { Icon } from './ExtIcon';

const searchHref = (token) => '/search?q=' + encodeURIComponent(token);

// カード (動画へ移動) には伝えず、ページ全体を読み直して移動する。中クリック・修飾キー付きはブラウザに任せる
function ExtLink({ href, className, title, children }) {
    return (
        <a href={href} className={className} title={title}
            onClick={(e) => {
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                e.stopPropagation();
                window.location.assign(href);
            }}
        >{children}</a>
    );
}

const searchLink = (token, text, className) => (
    <ExtLink href={searchHref(token)} className={className} title={'「' + text + '」で検索'}>{text}</ExtLink>
);

export function ExtThumbOverlays({ video, folder, durationClass }) {
    return (
        <>
            {folder && <div className={`${durationClass} wlext-folder-ov`} title={folder}>{folder}</div>}
            {video.ext_maker && <div className="wlext-maker-ov" title={video.ext_maker}>{video.ext_maker}</div>}
        </>
    );
}

export function ExtCardMeta({ video, poster, list }) {
    const rating = video.ext_rating || 0;
    return (
        <div className={'wlext-card-meta' + (poster ? ' wlext-card-meta-poster' : '')}>
            {list && video.ext_series && searchLink('@series:"' + video.ext_series + '"', video.ext_series, 'wlext-card-series')}
            <div className="wlext-card-rating">
                {rating > 0 && (
                    <div className="wlext-rating readonly">
                        {[1, 2, 3, 4, 5].map(i => <span key={i} className={'wlext-star' + (i <= rating ? ' on' : '')}>★</span>)}
                    </div>
                )}
            </div>
            <ExtCardBadges id={video.id} />
        </div>
    );
}

// スクリーンショットの枚数: 描いたカードの分をまとめて1回で取る。ページを読み直すまで覚える
const ssCounts = {};          // id -> 枚数
const ssAsked = new Set();    // 取りに行った id
const ssListeners = new Set();
let ssQueue = [], ssTimer = null;
function askSsCount(id) {
    if (ssAsked.has(id)) return;
    ssAsked.add(id);
    ssQueue.push(id);
    if (ssTimer) return;
    ssTimer = setTimeout(() => {
        const ids = ssQueue;
        ssQueue = []; ssTimer = null;
        window.WLExt.api.ssCounts(ids).then(res => {
            const counts = (res && res.counts) || {};
            ids.forEach(i => { ssCounts[i] = counts[i] != null ? counts[i] : 0; });
            ssListeners.forEach(f => f());
        }).catch(() => ids.forEach(i => ssAsked.delete(i)));   // 失敗したら、次にそのカードを描いたとき取り直す
    }, 0);
}
const subscribeSs = (f) => { ssListeners.add(f); return () => ssListeners.delete(f); };
// ブックマーク済みの動画は拡張 (bookmark.js の WL._bmIds) が持ち、変わると wlext-bookmarks-changed を投げる
const subscribeBm = (f) => { window.addEventListener('wlext-bookmarks-changed', f); return () => window.removeEventListener('wlext-bookmarks-changed', f); };

// ブックマークボタン (押すとフォルダを選ぶダイアログ)。fab は動画ページの右下の丸ボタン (ExtWatchMeta.jsx の ExtWatchFabs)
export function ExtBookmarkButton({ id, fab }) {
    const on = useSyncExternalStore(subscribeBm, () => { const s = window.WLExt && window.WLExt._bmIds; return !!(s && s.has(Number(id))); });
    return (
        <button className={'wlext-bm-btn' + (fab ? ' wlext-bm-watch wlext-bm-fab' : '') + (on ? ' on' : '')} data-vid={id}
            title={on ? 'ブックマーク済み（クリックで編集）' : 'ブックマークに追加'}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.WLExt?.openBookmarkDialog?.(id); }}>
            {on
                ? <svg width="100%" height="100%" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                : <Icon name="bookmark-add" size="100%" />}
        </button>
    );
}

// カードのブックマークボタンとスクリーンショットの枚数
export function ExtCardBadges({ id }) {
    const n = useSyncExternalStore(subscribeSs, () => ssCounts[id]);
    useEffect(() => { if (n == null) askSsCount(id); }, [id, n]);
    return (
        <>
            <ExtBookmarkButton id={id} />
            <span className={'wlext-ss-badge' + (n == null ? ' loading' : '')} data-vid={id} title={n == null ? 'スクリーンショット枚数' : 'スクリーンショット ' + n + ' 枚'}>
                <Icon name="camera" size={14} />
                <span className="wlext-ss-num">{n == null ? '' : String(n)}</span>
            </span>
        </>
    );
}

export function ExtPerformers({ video }) {
    const performers = video.ext_performers || [];
    const directors = video.ext_directors || [];
    if (!performers.length && !directors.length) return null;
    const title = [performers.length ? '出演者：' + performers.map(p => p.name).join('、') : '',
                   directors.length ? '監督：' + directors.join('、') : ''].filter(Boolean).join('　');
    return (
        <div className="wlext-card-performers" title={title}>
            {performers.length > 0 && <span className="wlext-card-label">出演者：</span>}
            {performers.map((p, i) => (
                <Fragment key={'p' + i}>
                    {i > 0 && '、'}
                    <ExtLink href={'/performer/' + p.id} className="wlext-card-performer" title={p.name + 'のページを開く'}>{p.name}</ExtLink>
                </Fragment>
            ))}
            {directors.length > 0 && <span className={'wlext-card-label' + (performers.length ? ' wlext-card-label-gap' : '')}>監督：</span>}
            {directors.map((d, i) => (
                <Fragment key={'d' + i}>
                    {i > 0 && '、'}
                    {searchLink('@director:"' + d + '"', d, 'wlext-card-performer')}
                </Fragment>
            ))}
        </div>
    );
}

// ジャンル (押すと検索) を先に並べ、タグとの間に「│」を置く。あふれたら末尾 (タグ側) から隠して「…」を出す
export function ExtTagRow({ genres, tags, className, badgeClass }) {
    const ref = useRef(null);
    const sig = genres.join('\n') + '|' + tags.join('\n');
    useLayoutEffect(() => {
        const cont = ref.current;
        if (!cont) return;
        const fit = () => {
            const ell = cont.lastElementChild;
            const items = [...cont.children].filter(el => el !== ell);
            items.forEach(el => { el.style.display = ''; });
            ell.style.display = 'none';
            if (cont.scrollWidth <= cont.clientWidth) return;   // 全部入る
            ell.style.display = '';
            let n = items.length;
            while (cont.scrollWidth > cont.clientWidth && n > 0) items[--n].style.display = 'none';
            if (n > 0 && items[n - 1].classList.contains('wlext-tagsep')) items[n - 1].style.display = 'none';   // 区切りが末尾に残ったら隠す
        };
        fit();
        const ro = new ResizeObserver(fit);   // 幅が変わったら数え直す
        ro.observe(cont);
        return () => ro.disconnect();
    }, [sig]);
    const all = [genres.length ? 'ジャンル: ' + genres.join(' / ') : '', tags.length ? 'タグ: ' + tags.join(' / ') : ''].filter(Boolean).join('\n');
    // 1行に収める (本体の枠 tagBadgeContainer は折り返す)
    return (
        <div ref={ref} className={`${className} wlext-tagrow`} style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
            {genres.map((g, i) => <Fragment key={'g' + i}>{searchLink('@genre:"' + g + '"', g, 'wlext-genre-chip wlext-list-genre')}</Fragment>)}
            {genres.length > 0 && tags.length > 0 && <span className="wlext-tagsep">│</span>}
            {tags.map((t, i) => <span key={'t' + i} className={badgeClass}>{t}</span>)}
            <span className={`${badgeClass} wlext-tag-ell`} title={all}>…</span>
        </div>
    );
}
