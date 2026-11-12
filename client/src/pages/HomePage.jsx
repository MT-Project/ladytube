import { useState, useEffect } from 'react';
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
import { QRCodeSVG } from 'qrcode.react';

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

// 1ヶ月前の日付を取得 (YYYY-MM-DD形式)
function getOneMonthAgo() {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export default function HomePage() {
    const navigate = useNavigate();
    const { showExtension } = useUI();
    const [carouselVideos, setCarouselVideos] = useState([]);
    const [newVideos, setNewVideos] = useState([]);
    const [pickupVideos, setPickupVideos] = useState([]);
    const [pickupSeed, setPickupSeed] = useState('');
    const [reservedVideos, setReservedVideos] = useState([]);
    const [recentVideos, setRecentVideos] = useState([]);
    const [loadingCarousel, setLoadingCarousel] = useState(true);
    const [loadingNew, setLoadingNew] = useState(true);
    const [loadingPickup, setLoadingPickup] = useState(false);
    const [loadingReserved, setLoadingReserved] = useState(true);
    const [loadingRecent, setLoadingRecent] = useState(true);
    const [scanFolders, setScanFolders] = useState([]);
    const [allowPublic, setAllowPublic] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    // LadyTube: 拡張のメニューの「QRコードでアクセス」(nav.js) からも開く。ホームでは wlext-open-qr、ほかのページからは /?qr=1 で来る
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

    // 各セクションの動画を取得（5分間固定シード、各セクション並行取得）
    useEffect(() => {
        const fiveMinSeedNum = Math.floor(Date.now() / (5 * 60 * 1000));
        const fiveMinSeed = fiveMinSeedNum.toString();
        const pickupSeedVal = (fiveMinSeedNum + 1).toString();
        const oneMonthAgo = getOneMonthAgo();

        // カルーセル用動画（ランダム15本）
        api.getVideos({
            q: '',
            sort: 'random',
            perPage: 15,
            page: 1,
            seed: fiveMinSeed
        })
            .then(data => {
                const videos = data.videos || [];
                setCarouselVideos(videos);
            })
            .catch(err => console.error('Failed to fetch carousel videos:', err))
            .finally(() => setLoadingCarousel(false));

        // 新しい動画（1ヶ月以内、ランダム8本）
        api.getVideos({
            q: `>${oneMonthAgo}`,
            sort: 'random',
            perPage: 8,
            page: 1,
            seed: fiveMinSeed
        })
            .then(data => {
                const videos = data.videos || [];
                setNewVideos(videos);
                // 新しい動画が無い場合、PICKUPとしてランダム8本を取得（カルーセルと重複しないよう異なるseedを指定）
                if (videos.length === 0) {
                    setLoadingPickup(true);
                    setPickupSeed(pickupSeedVal);
                    api.getVideos({
                        q: '',
                        sort: 'random',
                        perPage: 8,
                        page: 1,
                        seed: pickupSeedVal
                    })
                        .then(pickupData => setPickupVideos(pickupData.videos || []))
                        .catch(err => console.error('Failed to fetch pickup videos:', err))
                        .finally(() => setLoadingPickup(false));
                }
            })
            .catch(err => console.error('Failed to fetch new videos:', err))
            .finally(() => setLoadingNew(false));

        // 予約中の動画（!予約タグ、ランダム8本）
        api.getVideos({
            q: '!予約',
            sort: 'random',
            perPage: 8,
            page: 1,
            seed: fiveMinSeed
        })
            .then(data => setReservedVideos(data.videos || []))
            .catch(err => console.error('Failed to fetch reserved videos:', err))
            .finally(() => setLoadingReserved(false));

        // 最近再生した動画（再生日時でソート、8本）
        api.getVideos({
            q: '',
            sort: 'history_desc',
            perPage: 8,
            page: 1
        })
            .then(data => setRecentVideos(data.videos || []))
            .catch(err => console.error('Failed to fetch recent videos:', err))
            .finally(() => setLoadingRecent(false));
    }, []);

    const handleVideoClick = (video) => {
        const videoId = typeof video === 'object' && video !== null ? video.id : video;
        navigate(`/watch/${videoId}`);
    };

    const handleVideoUpdate = (updatedVideo) => {
        setNewVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
        setPickupVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
        setReservedVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
        setRecentVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
        setCarouselVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
    };

    // スキャンフォルダーがない場合はInitGuidを表示
    if (!loadingSettings && scanFolders.length === 0) {
        return <InitGuid />;
    }

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                {/* カルーセルセクション */}
                <VideoCarousel videos={carouselVideos} showExtension={showExtension} />

                {/* メニューセクション */}
                <div className={styles.menuSection}>
                    <Link to="/search" className={styles.menuItem}>
                        <Search size={13} />
                        すべての動画
                    </Link>
                    <Link to="/search?path=root" className={styles.menuItem}>
                        <Folder size={13} />
                        カテゴリー
                    </Link>
                    <Link to="/calendar" className={styles.menuItem}>
                        <Calendar size={13} />
                        カレンダー
                    </Link>
                    <Link to="/screenshots" className={styles.menuItem}>
                        <Image size={13} />
                        スクリーンショット
                    </Link>
                    <span
                        className={styles.menuItem}
                        onClick={() => setShowQR(true)}
                    >
                        <QrCode size={13} />
                        QRコード
                    </span>
                </div>

                {/* 最新動画セクション / PICKUPセクション */}
                <section className={styles.section}>
                    {loadingNew ? (
                        <>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>最新動画（1ヶ月以内）</div>
                            </div>
                            <div className={styles.loading}>
                                <LoadingDots />
                            </div>
                        </>
                    ) : newVideos.length > 0 ? (
                        <>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>最新動画（1ヶ月以内）</div>
                                <Link
                                    to={`/search?q=>${getOneMonthAgo()}&sort=random`}
                                    className={styles.moreLink}
                                >
                                    もっと見る
                                </Link>
                            </div>
                            <VideoList
                                videos={newVideos}
                                onPlay={handleVideoClick}
                                viewMode="home"
                                onVideoUpdate={handleVideoUpdate}
                            />
                        </>
                    ) : (
                        <>
                            <div className={styles.sectionHeader}>
                                <div className={styles.sectionTitle}>PICKUP</div>
                                <Link
                                    to={`/search?q=&sort=random&seed=${pickupSeed}`}
                                    className={styles.moreLink}
                                >
                                    もっと見る
                                </Link>
                            </div>
                            {loadingPickup ? (
                                <div className={styles.loading}>
                                    <LoadingDots />
                                </div>
                            ) : pickupVideos.length === 0 ? (
                                <div className={styles.emptyMessage}>該当する動画はありません</div>
                            ) : (
                                <VideoList
                                    videos={pickupVideos}
                                    onPlay={handleVideoClick}
                                    viewMode="home"
                                    onVideoUpdate={handleVideoUpdate}
                                />
                            )}
                        </>
                    )}
                </section>

                {/* 予約中セクション */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>予約中（予約タグ）</div>
                        {reservedVideos.length !== 0 &&
                            <Link
                                to="/search?q=!予約&sort=random"
                                className={styles.moreLink}
                            >
                                もっと見る
                            </Link>
                        }
                    </div>
                    {loadingReserved ? (
                        <div className={styles.loading}>
                            <LoadingDots />
                        </div>
                    ) : reservedVideos.length === 0 ? (
                        <div className={styles.emptyMessage}>該当する動画はありません</div>
                    ) : (
                        <VideoList
                            videos={reservedVideos}
                            onPlay={handleVideoClick}
                            viewMode="home"
                            onVideoUpdate={handleVideoUpdate}
                        />
                    )}
                </section>

                {/* 最近再生した動画セクション */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div className={styles.sectionTitle}>最近再生した動画</div>
                        {recentVideos.length !== 0 &&
                            <Link
                                to="/search?q=&sort=history_desc"
                                className={styles.moreLink}
                            >
                                もっと見る
                            </Link>
                        }
                    </div>
                    {loadingRecent ? (
                        <div className={styles.loading}>
                            <LoadingDots />
                        </div>
                    ) : recentVideos.length === 0 ? (
                        <div className={styles.emptyMessage}>該当する動画はありません</div>
                    ) : (
                        <VideoList
                            videos={recentVideos}
                            onPlay={handleVideoClick}
                            viewMode="home"
                            onVideoUpdate={handleVideoUpdate}
                        />
                    )}
                </section>
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
