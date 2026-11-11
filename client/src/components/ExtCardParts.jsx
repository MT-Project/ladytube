// LadyTube: 検索画面のカードに足す表示 (v3.1.4 までの server/ext/public/cardenh.js を移したもの)。
//  ・サムネ右上にメーカー名、左下にフォルダ名 (ポスター表示はフォルダ名なし)
//  ・評価の行 (リスト表示はシリーズ名も)。ポスター表示はサムネ左上に重ねる
//  ・リスト表示: 出演者と監督の行、ジャンル＋タグの行 (幅に収まらない分は「…」。マウスを乗せると全部)
// 項目は一覧 API (server/ext/routes/search.js の withCardFields) が返す。見た目は womanlive-ext.css のクラス。
// 評価の行 .wlext-card-meta には、スクショ数 (screenshots.js) とブックマーク (bookmark.js) が拡張側から足される
// (並びは CSS の order で決まる)。
import { Fragment, useLayoutEffect, useRef } from 'react';

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
        </div>
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
    return (
        <div ref={ref} className={`${className} wlext-tagrow`}>
            {genres.map((g, i) => <Fragment key={'g' + i}>{searchLink('@genre:"' + g + '"', g, 'wlext-genre-chip wlext-list-genre')}</Fragment>)}
            {genres.length > 0 && tags.length > 0 && <span className="wlext-tagsep">│</span>}
            {tags.map((t, i) => <span key={'t' + i} className={badgeClass}>{t}</span>)}
            <span className={`${badgeClass} wlext-tag-ell`} title={all}>…</span>
        </div>
    );
}
