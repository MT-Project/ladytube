import { lazy, Suspense, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { css } from '@linaria/core';
import { api } from '../services/api';
import { theme } from '../theme';
import { useUI } from '../contexts/UIContext';
import VideoList from '../components/VideoList';
import VideoCarousel from '../components/VideoCarousel';
import Navbar from '../components/Navbar';
import LoadingDots from '../components/LoadingDots';
import InitGuid from './InitGuid';
import { Search, QrCode, X, Image, Calendar, Folder } from 'lucide-react';
import { Icon } from '../components/ExtIcon';
import ExtSlot from '../components/ExtSlot';
import { savedSearchHref, useSavedSearches } from '../utils/savedSearches';
import { homeRowName, homeRowQuery, loadHomeLayout, normalizeHomeLayout } from '../utils/homeLayout';

// LadyTube: QR コードの部品は、ダイアログを開いたときに読む (最初に読む JS を軽くする)
const QRCodeSVG = lazy(() => import('qrcode.react').then(m => ({ default: m.QRCodeSVG })));

// LadyTube: 拡張のページへのリンク (v3.1.14 までの server/ext/public/homelinks.js)。拡張のページなので <a> でページごと開く。
// 個人用モジュールなどのリンクは WLExt.homeLinks に足すと、これらの後ろ (QRコードの前) に並ぶ (ExtSlot。本体のクラスは className で渡す)
const EXT_HOME_LINKS = [
    { href: '/bookmarks', icon: 'bookmark', label: 'ブックマーク' },
    { href: '/makers', icon: 'factory', label: 'メーカー一覧' },
    { href: '/series', icon: 'library', label: 'シリーズ一覧' },
    { href: '/performers', icon: 'users', label: '出演者一覧' },
    { href: '/tags', icon: 'tag', label: 'タグ一覧' },
];

// Linaria styles
const styles = {
    page: css`
        padding-top: 4rem;
        min-height: 100vh;
        background-color: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
    `,
    content: css`
        margin: 0 auto;
        padding: 0 1.4rem;
        max-width: 1400px;
    `,
    section: css`
        margin-bottom: 2rem;
    `,
    sectionHeader: css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    `,
    sectionTitle: css`
        font-size: 1rem;
        font-weight: 500;
        color: ${theme.colors.text.primary};
    `,
    moreLink: css`
        font-size: 0.8rem;
        color: ${theme.colors.text.secondary};
        text-decoration: none;
        &:hover {
            color: ${theme.colors.accent.primary};
        }
    `,
    emptyMessage: css`
        color: ${theme.colors.text.secondary};
        font-size: 0.875rem;
        padding: 5rem;
        text-align: center;
    `,
    loading: css`
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2.5rem;
    `,
    menuSection: css`
        margin-top: 0.5rem;
        margin-bottom: 2rem;
        background: ${theme.colors.bg.secondary};
        padding: 0.6rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
    `,
    menuItem: css`
        font-size: 0.8rem;
        color: ${theme.colors.text.primary};
        text-decoration: none;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.3rem 0.6rem;
        border-radius: 0.25rem;
        cursor: pointer;
        border: none;
        background: transparent;
        &:hover {
            color: ${theme.colors.accent.primary};
            background: ${theme.colors.bg.hover};
        }
    `,
    dialogOverlay: css`
        position: fixed;
        inset: 0;
        background-color: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    `,
    dialogCloseButton: css`
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: transparent;
        border: none;
        color: ${theme.colors.text.secondary};
        cursor: pointer;
        padding: 0.5rem;
        &:hover {
            color: ${theme.colors.text.primary};
        }
    `,
    dialogTitle: css`
        margin-bottom: 1rem;
        font-size: 1.25rem;
        font-weight: 600;
        color: ${theme.colors.text.primary};
    `,
    qrContainer: css`
        background-color: ${theme.colors.bg.secondary};
        padding: 1.5rem;
        border-radius: 0.75rem;
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 1rem;
    `,
    dialogBox: css`
        background-color: ${theme.colors.bg.modal};
        padding: 2.5rem;
        border-radius: 0.35rem;
        position: relative;
        text-align: center;
        max-width: 90%;
        min-width: 320px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    `,
    qrItem: css`
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    `,
    qrCodeWrapper: css`
        padding: 0.5rem;
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    `,
    qrUrlText: css`
        font-size: 0.8rem;
        color: ${theme.colors.text.primary};
        font-weight: 500;
    `,
    qrDescription: css`
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
        margin-bottom: 1.5rem;
        margin-top: -0.5rem;
    `,
    qrWarning: css`
        font-size: 0.85rem;
        color: ${theme.colors.status.error};
        margin-bottom: 1.5rem;
        margin-top: -0.5rem;
        font-weight: 500;
    `,
    qrDetailText: css`
        font-size: 0.9rem;
        color: ${theme.colors.text.secondary};
        line-height: 1.5;
        word-break: break-all;
    `,
    qrFooterText: css`
        font-size: 0.75rem;
        color: ${theme.colors.text.secondary};
        margin-top: 0.5rem;
        opacity: 0.8;
    `,
    qrLoadingPlaceholder: css`
        width: 180px;
        height: 180px;
        display: flex;
        align-items: center;
        justify-content: center;
    `,
};

export default function HomePage() {
    const navigate = useNavigate();
    const { showExtension } = useUI();
    const [carouselVideos, setCarouselVideos] = useState([]);
    // LadyTube: ホームの並び (v3.8.0。utils/homeLayout.js)。null は読み込み中。行の動画は表示する行の番号ごとに { name, href, videos } (無いあいだは読み込み中)
    const [layout, setLayout] = useState(null);
    const [rowData, setRowData] = useState({});
    const savedSearches = useSavedSearches();   // LadyTube: メニューに並べる保存した検索
    const [scanFolders, setScanFolders] = useState([]);
    const [allowPublic, setAllowPublic] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    // LadyTube: 拡張のメニューの「QRコード」(nav.js) からも開く。ホームでは wlext-open-qr、ほかのページからは /?qr=1 で来る
    const [showQR, setShowQR] = useState(() => new URLSearchParams(window.location.search).has('qr'));
    const [serverInfo, setServerInfo] = useState(null);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).has('qr')) navigate('/', { replace: true });   // 読み直しで開き直さない
        const open = () => setShowQR(true);
        window.addEventListener('wlext-open-qr', open);
        return () => window.removeEventListener('wlext-open-qr', open);
    }, [navigate]);

    // ページタイトル設定
    useEffect(() => {
        document.title = 'LadyTube';
    }, []);

    // スキャンフォルダーと設定を取得
    useEffect(() => {
        api.getSettings()
            .then(data => {
                setScanFolders(data.scan_folders || []);
                if (data.allow_public !== undefined) {
                    setAllowPublic(data.allow_public);
                }
                setLoadingSettings(false);
            })
            .catch(err => {
                console.error('Failed to fetch settings:', err);
                setLoadingSettings(false);
            });
    }, []);

    // QRコード表示時にサーバー情報を取得
    useEffect(() => {
        if (showQR && !serverInfo) {
            api.getServerInfo()
                .then(data => setServerInfo(data))
                .catch(err => console.error('Failed to fetch server info:', err));
        }
    }, [showQR, serverInfo]);

    const qrUrls = serverInfo && serverInfo.ips ? serverInfo.ips.map(ip => `http://${ip}:${serverInfo.port}`) : [];

    // LadyTube: ホームの並びを読む (読めなかったときは既定の並び)
    useEffect(() => {
        loadHomeLayout().then(setLayout, () => setLayout(normalizeHomeLayout(null)));
    }, []);

    // 各セクションの動画を取得（5分間固定シード、各セクション並行取得）
    // LadyTube: 行は並びの設定から作る (v3.8.0。v3.7.0 までは 最新動画/PICKUP・続きを見る・最近再生 の固定)
    useEffect(() => {
        if (!layout) return;
        const fiveMinSeedNum = Math.floor(Date.now() / (5 * 60 * 1000));

        // カルーセル用動画（ランダム15本）
        if (layout.carousel) api.getVideos({
            q: '',
            sort: 'random',
            perPage: 15,
            page: 1,
            seed: fiveMinSeedNum.toString()
        })
            .then(data => setCarouselVideos(data.videos || []))
            .catch(err => console.error('Failed to fetch carousel videos:', err));

        const rows = layout.rows.filter(r => r.show);
        const pickupShown = rows.some(r => r.type === 'pickup');
        const fetchRow = (d) => api.getVideos({ q: d.q, sort: d.sort, perPage: d.count, page: 1, ...(d.seed && { seed: d.seed }), ...(d.path && { path: d.path }) })
            .then(data => data.videos || []);
        rows.forEach((row, i) => {
            const d = homeRowQuery(row, fiveMinSeedNum, i);
            const put = (dd, videos) => setRowData(prev => ({ ...prev, [i]: { name: dd.name, href: savedSearchHref(dd), videos } }));
            fetchRow(d)
                .then(videos => {
                    // 新しい動画が無い場合、PICKUPとしてランダムに取得（カルーセルと重複しないよう異なるseed）。PICKUP の行を出しているときは代えない
                    if (!videos.length && row.type === 'new' && !pickupShown) {
                        const p = homeRowQuery({ type: 'pickup', count: row.count }, fiveMinSeedNum, i);
                        return fetchRow(p).then(v => put(p, v));
                    }
                    put(d, videos);
                })
                .catch(err => { console.error('Failed to fetch home row:', err); put(d, []); });
        });
    }, [layout]);

    const handleVideoClick = (video) => {
        const videoId = typeof video === 'object' && video !== null ? video.id : video;
        navigate(`/watch/${videoId}`);
    };

    const handleVideoUpdate = (updatedVideo) => {
        const swap = (list) => list.map(v => v.id === updatedVideo.id ? updatedVideo : v);
        setRowData(prev => Object.fromEntries(Object.entries(prev).map(([k, d]) => [k, { ...d, videos: swap(d.videos) }])));
        setCarouselVideos(swap);
    };

    // スキャンフォルダーがない場合はInitGuidを表示
    if (!loadingSettings && scanFolders.length === 0) {
        return <InitGuid />;
    }

    const shownRows = layout ? layout.rows.filter(r => r.show) : [];   // LadyTube: 並びの設定で出す行
    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                {/* カルーセルセクション (LadyTube: 並びの設定で隠せる) */}
                {layout && layout.carousel && <VideoCarousel videos={carouselVideos} showExtension={showExtension} />}

                {/* メニューセクション (LadyTube: 「すべての動画」の後ろは右上のメニュー (server/ext/public/nav.js の NAV_ITEMS) と同じ順。並びの設定で隠せる) */}
                {layout && layout.menu && <div className={styles.menuSection}>
                    <Link to="/search" className={styles.menuItem}>
                        <Search size={13} />
                        すべての動画
                    </Link>
                    <Link to="/screenshots" className={styles.menuItem}>
                        <Image size={13} />
                        スクリーンショット
                    </Link>
                    <Link to="/calendar" className={styles.menuItem}>
                        <Calendar size={13} />
                        カレンダー
                    </Link>
                    <Link to="/search?path=root" className={styles.menuItem}>
                        <Folder size={13} />
                        カテゴリー
                    </Link>
                    {EXT_HOME_LINKS.map(l => (
                        <a key={l.href} href={l.href} className={styles.menuItem + ' wlext-home-link'}>
                            <Icon name={l.icon} size={16} />
                            {l.label}
                        </a>
                    ))}
                    <ExtSlot from="homeLinks" args={{ className: styles.menuItem }} />
                    {/* LadyTube: 保存した検索 (v3.7.0。検索画面の「この条件を保存」) */}
                    {savedSearches.map((s, i) => (
                        <Link key={'saved-' + i} to={savedSearchHref(s)} className={styles.menuItem + ' wlext-home-link'}>
                            <Icon name="filter" size={16} />
                            {s.name}
                        </Link>
                    ))}
                    <span
                        className={styles.menuItem}
                        onClick={() => setShowQR(true)}
                    >
                        <QrCode size={13} />
                        QRコード
                    </span>
                </div>}

                {/* LadyTube: 行のセクション (v3.8.0。並びの設定の順。動画が無い行は出さない。v3.7.0 までは 最新動画/PICKUP・続きを見る・最近再生 の固定) */}
                {shownRows.map((row, i) => {
                    const d = rowData[i];
                    if (d && !d.videos.length) return null;
                    return (
                        <section key={i} className={styles.section}>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>{d ? d.name : homeRowName(row)}</div>
                                {d && <Link to={d.href} className={styles.moreLink}>もっと見る</Link>}
                            </div>
                            {d ? (
                                <VideoList
                                    videos={d.videos}
                                    onPlay={handleVideoClick}
                                    viewMode="home"
                                    onVideoUpdate={handleVideoUpdate}
                                />
                            ) : (
                                <div className={styles.loading}>
                                    <LoadingDots />
                                </div>
                            )}
                        </section>
                    );
                })}

                {/* LadyTube: 管理画面の「ホーム画面」へ */}
                {layout && <div className="wlext-home-edit"><Link to="/settings#home-layout"><Icon name="pencil" size={14} />ホームを編集</Link></div>}
            </div>

            {/* QRコードダイアログ */}
            {showQR && (
                <div className={styles.dialogOverlay} onClick={() => setShowQR(false)}>
                    <div
                        className={styles.dialogBox}
                        style={{ width: qrUrls.length > 1 ? 'auto' : '320px' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <button onClick={() => setShowQR(false)} className={styles.dialogCloseButton}>
                            <X size={20} />
                        </button>
                        <h2 className={styles.dialogTitle}>モバイルでアクセス</h2>

                        {qrUrls.length > 1 && (
                            <p className={styles.qrDescription}>
                                複数のネットワークがあります。<br />接続可能なものをスキャンしてください。
                            </p>
                        )}

                        {!allowPublic && (
                            <p className={styles.qrWarning}>
                                ネットワーク外部アクセス設定がオフです。
                            </p>
                        )}

                        <div className={styles.qrContainer}>
                            <Suspense fallback={null}>
                            {qrUrls.length > 0 ? (
                                qrUrls.map((url, idx) => (
                                    <div key={idx} className={styles.qrItem}>
                                        <div className={styles.qrCodeWrapper}>
                                            <QRCodeSVG value={url} size={qrUrls.length > 1 ? 140 : 180} />
                                        </div>
                                        <div className={styles.qrUrlText}>
                                            {url.replace('http://', '').split(':')[0]}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className={styles.qrLoadingPlaceholder}>
                                    <LoadingDots />
                                </div>
                            )}
                            </Suspense>
                        </div>

                        {qrUrls.length === 1 && (
                            <p className={styles.qrDetailText}>
                                {qrUrls[0]}
                            </p>
                        )}

                        <p className={styles.qrFooterText}>
                            同じネットワークに接続してスキャンしてください
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
