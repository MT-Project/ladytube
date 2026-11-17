// LadyTube: カレンダー (v3.6.0 で書き直した。v3.5.0 までは本体の年月の一覧と、公開日の「公開カレンダー」/release-calendar の2ページ)。
// 上で [更新日 | 公開日] を切り替え、年 → 月 → 日を選ぶ (本数のある日だけ押せる)。下に選んだ範囲の動画を検索画面の1ページ分だけ出し、
// 「検索画面で開く」で同じ検索を開く。最後に選んだ側はその端末に覚える (初回は更新日)。選んだ範囲は URL (kind / ym / d / none) に置く
// (動画を開いて戻ったときに同じところへ戻るため)。/release-calendar は App.jsx が ?kind=release へ転送する。
// 日ごとの本数は /ext/api/calendar/days (server/ext/routes/search.js)。更新日は本体の検索 (>YYYY/MM/DD <YYYY/MM/DD) と同じ数え方
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from '../components/Navbar';
import LoadingDots from '../components/LoadingDots';
import VideoList from '../components/VideoList';
import { api } from '../services/api';
import { theme } from '../theme';
import { Icon } from '../components/ExtIcon';
import { searchToken } from '../utils/formatters';

const styles = {
    page: css`
        min-height: 100vh;
        background-color: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        padding-top: 4rem;
    `,
    content: css`
        max-width: 110rem;
        margin: 0 auto;
        padding: 1.5rem 1.4rem 3rem;
    `,
    head: css`
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
        margin-bottom: 1.25rem;
    `,
    title: css`
        font-size: 1rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin: 0;
    `,
    seg: css`
        display: inline-flex;
        padding: 3px;
        border-radius: 999px;
        background: ${theme.colors.bg.secondary};
        border: 1px solid ${theme.colors.border.primary};
        & > button {
            border: none;
            background: none;
            color: ${theme.colors.text.secondary};
            padding: 0.3rem 1rem;
            border-radius: 999px;
            font-size: 0.85rem;
            cursor: pointer;
        }
        & > button.on {
            background: ${theme.colors.accent.primary};
            color: #fff;
        }
    `,
    panel: css`
        display: grid;
        grid-template-columns: minmax(0, 20rem) minmax(0, 26rem);
        gap: 1.5rem 2.5rem;
        align-items: start;
        width: fit-content;
        max-width: 100%;
        box-sizing: border-box;
        padding: 1.25rem;
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.75rem;
        background: ${theme.colors.bg.secondary};
        @media (max-width: 760px) {
            grid-template-columns: minmax(0, 1fr);
            width: auto;
            padding: 1rem;
        }
    `,
    chips: css`
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin-bottom: 1rem;
    `,
    chip: css`
        border: 1px solid ${theme.colors.border.primary};
        background: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        border-radius: 999px;
        padding: 0.25rem 0.75rem;
        font-size: 0.85rem;
        cursor: pointer;
        &:hover { border-color: ${theme.colors.accent.primary}; }
        &.on {
            background: ${theme.colors.accent.primary};
            border-color: ${theme.colors.accent.primary};
            color: #fff;
        }
        & small { margin-left: 0.3rem; opacity: 0.7; }
    `,
    months: css`
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.4rem;
        @media (max-width: 760px) {
            grid-template-columns: repeat(6, minmax(0, 1fr));
        }
        @media (max-width: 480px) {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    `,
    cell: css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.1rem;
        min-height: 2.9rem;
        border: 1px solid transparent;
        border-radius: 0.5rem;
        background: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        font-size: 0.9rem;
        cursor: pointer;
        padding: 0.2rem;
        &:hover:not(:disabled) { border-color: ${theme.colors.accent.primary}; }
        &:disabled { cursor: default; opacity: 0.35; background: transparent; }
        &.on {
            background: ${theme.colors.accent.primary};
            color: #fff;
        }
        & small {
            font-size: 0.7rem;
            color: ${theme.colors.text.secondary};
            font-variant-numeric: tabular-nums;
        }
        &.on small { color: #fff; opacity: 0.85; }
    `,
    calHead: css`
        font-weight: 600;
        margin-bottom: 0.6rem;
    `,
    week: css`
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0.3rem;
        & > span {
            text-align: center;
            font-size: 0.75rem;
            color: ${theme.colors.text.secondary};
        }
    `,
    listHead: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.5rem 1rem;
        margin: 2rem 0 1rem;
        & h2 { font-size: 1.1rem; font-weight: 600; margin: 0; }
        & h2 small { font-size: 0.85rem; font-weight: 400; color: ${theme.colors.text.secondary}; margin-left: 0.4rem; }
    `,
    openBtn: css`
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.35rem 0.9rem;
        border-radius: 999px;
        border: 1px solid ${theme.colors.border.primary};
        color: ${theme.colors.text.primary};
        text-decoration: none;
        font-size: 0.85rem;
        &:hover { border-color: ${theme.colors.accent.primary}; color: ${theme.colors.accent.primary}; }
    `,
    message: css`
        text-align: center;
        color: ${theme.colors.text.secondary};
        padding: 2rem 0;
    `,
    loading: css`
        display: flex;
        justify-content: center;
        padding: 3rem 0;
    `,
};

const KIND_KEY = 'wlext_calendar_kind';
const KINDS = [['updated', '更新日'], ['release', '公開日']];
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];
const pad = (n) => String(n).padStart(2, '0');
const storage = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* 覚えられなくても動く */ } return null; };

// 選んだ範囲 (sel: { none } / { ym } / { ym, d }) の検索語。更新日は本体の検索、公開日は拡張の項目トークン
function queryFor(kind, sel) {
    if (sel.none) return '@release:none';
    if (kind === 'release') return '@' + (sel.d ? searchToken('release', sel.d) : searchToken('releasemonth', sel.ym));
    if (sel.d) { const s = sel.d.replace(/-/g, '/'); return `>${s} <${s}`; }
    const [y, m] = sel.ym.split('-');
    return `>${y}/${m}/01 <${y}/${m}/${pad(new Date(+y, +m, 0).getDate())}`;
}

export default function CalendarPage() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const kind = params.get('kind') === 'release' ? 'release' : params.get('kind') === 'updated' ? 'updated' : (storage(KIND_KEY) === 'release' ? 'release' : 'updated');
    const [days, setDays] = useState({ kind: null });   // { kind, list: [[d, n]], none } / { kind, error }

    useEffect(() => { document.title = 'カレンダー - LadyTube'; }, []);
    useEffect(() => {
        let stale = false;
        fetch('/ext/api/calendar/days?kind=' + kind)
            .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || r.statusText); return j; })
            .then(j => { if (!stale) setDays({ kind, list: j.days || [], none: j.none || 0 }); })
            .catch(e => { if (!stale) setDays({ kind, error: e.message }); });
        return () => { stale = true; };
    }, [kind]);
    const loaded = days.kind === kind;

    // 日・月・年ごとの本数
    const { byDay, byMonth, years } = useMemo(() => {
        const byDay = new Map(), byMonth = new Map();
        (loaded && days.list || []).forEach(([d, n]) => {
            byDay.set(d, n);
            byMonth.set(d.slice(0, 7), (byMonth.get(d.slice(0, 7)) || 0) + n);
        });
        const years = [...new Set([...byMonth.keys()].map(ym => ym.slice(0, 4)))].sort().reverse();
        return { byDay, byMonth, years };
    }, [days, loaded]);
    const latestIn = (y) => [...byMonth.keys()].filter(ym => !y || ym.startsWith(y)).sort().pop();

    // 選んでいる範囲。URL に無い・本数が無いときは、いちばん新しい月
    const none = kind === 'release' && params.get('none') === '1';
    const ymParam = params.get('ym');
    const ym = none ? null : (byMonth.has(ymParam) ? ymParam : latestIn());
    const dParam = params.get('d');
    const d = ym && dParam && dParam.startsWith(ym) && byDay.has(dParam) ? dParam : null;
    const sel = none ? { none: true } : ym ? { ym, d } : null;
    const go = (next) => setParams({ kind, ...next }, { replace: true });
    const setKind = (k) => { storage(KIND_KEY, k); setParams({ kind: k }, { replace: true }); };

    const year = ym ? ym.slice(0, 4) : null;
    const count = !sel ? 0 : sel.none ? days.none : (d ? byDay.get(d) : byMonth.get(ym)) || 0;
    const q = sel ? queryFor(kind, sel) : null;
    const label = !sel ? '' : sel.none ? '公開日なし'
        : `${year}年${+ym.slice(5)}月` + (d ? `${+d.slice(8)}日` : '');

    // 月の格子 (日曜始まり)。前の空きは null
    const cells = [];
    if (ym) {
        const [y, m] = ym.split('-').map(Number);
        for (let i = new Date(y, m - 1, 1).getDay(); i > 0; i--) cells.push(null);
        for (let i = 1, n = new Date(y, m, 0).getDate(); i <= n; i++) cells.push(`${ym}-${pad(i)}`);
    }

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.head}>
                    <h1 className={styles.title}><Icon name="calendar" size={20} /> カレンダー</h1>
                    <div className={styles.seg} role="tablist">
                        {KINDS.map(([k, text]) => (
                            <button key={k} role="tab" aria-selected={k === kind} className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>{text}</button>
                        ))}
                    </div>
                </div>

                {!loaded ? (
                    <div className={styles.loading}><LoadingDots /></div>
                ) : days.error ? (
                    <div className={styles.message}>{'読み込みに失敗しました: ' + days.error}</div>
                ) : (
                    <>
                        {years.length === 0 && (
                            <div className={styles.message}>
                                {kind === 'release' ? '公開日が設定された動画がありません。動画の詳細情報で公開日を設定してください。' : '動画が見つかりませんでした。'}
                            </div>
                        )}
                        {(years.length > 0 || days.none > 0) && (
                            <div className={styles.chips}>
                                {years.map(y => (
                                    <button key={y} className={styles.chip + (y === year ? ' on' : '')} onClick={() => go({ ym: latestIn(y) })}>{y}</button>
                                ))}
                                {kind === 'release' && days.none > 0 && (
                                    <button className={styles.chip + (none ? ' on' : '')} title="公開日が未設定の動画" onClick={() => go({ none: '1' })}>
                                        公開日なし<small>{days.none}</small>
                                    </button>
                                )}
                            </div>
                        )}
                        {ym && (
                            <div className={styles.panel}>
                                <div className={styles.months}>
                                    {Array.from({ length: 12 }, (_, i) => {
                                        const key = `${year}-${pad(i + 1)}`, n = byMonth.get(key) || 0;
                                        return (
                                            <button key={key} className={styles.cell + (key === ym && !d ? ' on' : '')} disabled={!n} onClick={() => go({ ym: key })}>
                                                <span>{(i + 1) + '月'}</span><small>{n || ''}</small>
                                            </button>
                                        );
                                    })}
                                </div>
                                <div>
                                    <div className={styles.calHead}>{`${year}年${+ym.slice(5)}月`}</div>
                                    <div className={styles.week}>
                                        {WEEK.map(w => <span key={w}>{w}</span>)}
                                        {cells.map((day, i) => {
                                            if (!day) return <span key={'e' + i} />;
                                            const n = byDay.get(day) || 0;
                                            return (
                                                <button key={day} className={styles.cell + (day === d ? ' on' : '')} disabled={!n}
                                                    title={n ? `${n}本` : ''} onClick={() => go(day === d ? { ym } : { ym, d: day })}>
                                                    <span>{+day.slice(8)}</span><small>{n || ''}</small>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                        {sel && <CalendarList key={q} q={q} label={label} count={count} onPlay={(v) => navigate(`/watch/${v.id}`)} />}
                    </>
                )}
            </div>
        </div>
    );
}

// 選んだ範囲の動画 (検索画面の1ページ分。件数と表示の形式は検索画面の設定)。q が変わると key で作り直す
function CalendarList({ q, label, count, onPlay }) {
    const [videos, setVideos] = useState(null);
    const perPage = storage('search_perPage') || '20';
    useEffect(() => {
        let stale = false;
        api.getVideos({ q, perPage, page: 1 })
            .then(r => { if (!stale) setVideos(r.videos || []); })
            .catch(() => { if (!stale) setVideos([]); });
        return () => { stale = true; };
    }, [q, perPage]);
    return (
        <>
            <div className={styles.listHead}>
                <h2>{label}<small>{count + '本'}</small></h2>
                <Link className={styles.openBtn} to={'/search?q=' + encodeURIComponent(q)}><Icon name="search" size={14} />検索画面で開く</Link>
            </div>
            {videos === null ? <div className={styles.loading}><LoadingDots /></div>
                : <VideoList videos={videos} onPlay={onPlay} viewMode={storage('viewMode') || 'grid-lg'} extMeta
                    coverThumbs={storage('wlext_thumb_mode') === 'cover'}
                    onVideoUpdate={(u) => setVideos(vs => vs.map(v => (v.id === u.id ? u : v)))} />}
        </>
    );
}
