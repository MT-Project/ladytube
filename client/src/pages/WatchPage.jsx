import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { css } from '@linaria/core';
import Player from '../components/Player';
import Navbar from '../components/Navbar';
import VideoList from '../components/VideoList';
import VideoInfoEditDialog from '../components/VideoInfoEditDialog';
import LoadingDots from '../components/LoadingDots';
import { useUI } from '../contexts/UIContext';
import { ChevronLeft, Pencil, Play, Image, Trash2, X, LayoutGrid } from 'lucide-react';

import { formatDuration, formatDate, formatDateTime, formatFileSize, getFolderPath, getFolderName, videoName } from '../utils/formatters';
import { api } from '../services/api';
import { theme } from '../theme';

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Linaria styles
// Linaria styles
const styles = {
    page: css`
        background-color: ${theme.colors.bg.primary};
        min-height: 100vh;
        color: ${theme.colors.text.primary};
        padding-top: 3.5rem;
        padding-bottom: 4rem;
    `,
    errorPage: css`
        background-color: #121212;
        min-height: 100vh;
        color: #e5e7eb;
        padding-top: 3.5rem;
    `,
    errorBox: css`
        max-width: 600px;
        margin: 4rem auto;
        padding: 2rem;
        text-align: center;
        background-color: #1e1e1e;
        border-radius: 0.5rem;
        border: 1px solid rgba(255,255,255,0.1);
    `,
    loadingPage: css`
        background-color: #121212;
        min-height: 100vh;
        color: #e5e7eb;
        padding-top: 3.5rem;
    `,
    loadingContainer: css`
        display: flex;
        align-items: center;
        justify-content: center;
        height: calc(100vh - 3.5rem);
    `,
    overlay: css`
        position: fixed;
        inset: 0;
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: rgba(0,0,0,0.5);
    `,
    menuDialog: css`
        background-color: ${theme.colors.bg.modal};
        padding: 1.1rem;
        border-radius: 0.3rem;
        border: 1px solid ${theme.colors.border.primary};
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 24rem;
        width: 100%;
        margin: 0 1rem;
    `,
    menuButton: css`
        width: 100%;
        padding: 0.75rem 1rem;
        background-color: ${theme.colors.bg.tertiary};
        border-radius: 0.5rem;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        cursor: pointer;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    deleteButton: css`
        width: 100%;
        padding: 0.75rem 1rem;
        background-color: rgba(239, 68, 68, 0.1);
        color: ${theme.colors.status.error};
        border-radius: 0.5rem;
        text-align: left;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border: none;
        cursor: pointer;
        &:hover {
            background-color: rgba(239, 68, 68, 0.2);
        }
    `,
    probeDialog: css`
        background-color: ${theme.colors.bg.modal};
        border-radius: 0.5rem;
        border: 1px solid ${theme.colors.border.primary};
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 500px;
        width: 80%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
    `,
    probeHeader: css`
        padding: 1rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid ${theme.colors.border.primary};
        flex-shrink: 0;
    `,
    tagLink: css`
        font-size: 0.75rem;
        padding: 0.25rem 0.75rem;
        color: ${theme.colors.text.secondary};
        border-radius: 0.25rem;
        text-decoration: none;
        border: 1px solid ${theme.colors.border.primary};
        cursor: pointer;
        &:hover {
            color: ${theme.colors.accent.primary};
            border-color: ${theme.colors.accent.primary};
        }
    `,
    fab: css`
        position: fixed;
        bottom: 2rem;
        right: 2rem;
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 50%;
        background-color: ${theme.colors.accent.primary};
        opacity: 0.7;
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 100;
        &:hover {
            opacity: 1;
        }
    `,
    infoBox: css`
        margin-top: 0.5rem;
        padding: 1rem;
        background-color: ${theme.colors.bg.tertiary};
        border-radius: 4px;
        font-size: 0.875rem;
        color: ${theme.colors.text.secondary};
    `,
    screenshotCard: css`
        flex-shrink: 0;
        width: 160px;
        border-radius: 0.25rem;
        overflow: hidden;
        cursor: pointer;
        border: 1px solid ${theme.colors.border.primary};
        position: relative;
        background-color: ${theme.colors.bg.tertiary};
        &:hover {
            border-color: ${theme.colors.accent.primary};
        }
    `,
    probeTitle: css`
        font-size: 1.1rem;
        font-weight: bold;
        margin: 0;
        color: ${theme.colors.text.primary};
    `,
    probeCloseButton: css`
        background: transparent;
        border: none;
        color: ${theme.colors.text.secondary};
        cursor: pointer;
        padding: 0;
        display: flex;
    `,
    probeContent: css`
        padding: 0 1rem;
        overflow-y: auto;
    `,
    probeLoading: css`
        color: ${theme.colors.text.secondary};
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `,
    probeInfoWrapper: css`
        font-size: 0.875rem;
        color: ${theme.colors.text.secondary};
    `,
    probeSection: css`
        margin-bottom: 1.5rem;
    `,
    probeSectionTitle: css`
        color: ${theme.colors.text.primary};
        font-weight: bold;
        margin-bottom: 0.5rem;
        border-bottom: 1px solid ${theme.colors.border.primary};
        padding-bottom: 0.25rem;
    `,
    probeGrid: css`
        display: grid;
        grid-template-columns: minmax(120px, auto) 1fr;
        gap: 0.25rem 1rem;
    `,
    toastThumbnail: css`
        width: auto;
        height: 80px;
        border-radius: 0.25rem;
        border: 1px solid ${theme.colors.border.primary};
        object-fit: contain;
    `,
    setThumbnailToast: css`
        width: auto;
        height: 50px;
        border-radius: 0.25rem;
        border: 1px solid ${theme.colors.border.primary};
        object-fit: contain;
    `,
    errorTitle: css`
        font-size: 1.25rem;
        margin-bottom: 1rem;
        color: ${theme.colors.status.error};
    `,
    errorDescription: css`
        color: ${theme.colors.text.secondary};
        line-height: 1.6;
    `,
    loadingOverlayWrapper: css`
        text-align: center;
    `,
    loadingText: css`
        color: #9ca3af;
        font-size: 0.875rem;
        margin-top: 0.5rem;
    `,
    screenshotMenuPreviewContainer: css`
        margin-bottom: 1.5rem;
        display: flex;
        justify-content: center;
    `,
    screenshotMenuPreviewBox: css`
        width: 210px;
        aspect-ratio: 16/9;
        border-radius: 0.25rem;
        overflow: hidden;
        border: 1px solid ${theme.colors.border.primary};
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: ${theme.colors.bg.tertiary};
    `,
    screenshotMenuPreviewImage: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    screenshotMenuActions: css`
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    `,
    screenshotMenuCancelButton: css`
        width: 100%;
        margin-top: 1.5rem;
        padding: 0.5rem;
        color: #6b7280;
        background-color: transparent;
        border: none;
        cursor: pointer;
    `,
    playerSection: css`
        width: 100%;
        margin-bottom: 1rem;
        background-color: black;
    `,
    playerWrapper: css`
        width: 100%;
        aspect-ratio: var(--aspect-ratio, 16/9);
        max-height: 75vh;
        background-color: black;
        margin: 0 auto;
    `,
    pageContentContainer: css`
        margin: 0 auto;
        padding: 0 1rem;
    `,
    infoLayoutContainer: css`
        display: flex;
        gap: 1.3rem;
        align-items: flex-start;
        margin-bottom: 3rem;
    `,
    infoLeftColumn: css`
        flex: 1;
        min-width: 0;
    `,

    screenshotsSection: css`
        margin-bottom: 1rem;
    `,
    screenshotsGrid: css`
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
    `,
    screenshotImageWrapper: css`
        aspect-ratio: 16/9;
        display: flex;
        align-items: center;
        justify-content: center;
    `,
    screenshotImage: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    screenshotTimestamp: css`
        position: absolute;
        bottom: 4px;
        right: 4px;
        background: rgba(0,0,0,0.8);
        color: white;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 2px;
    `,
    noScreenshots: css`
        color: #6b7280;
        font-size: 0.875rem;
    `,
    videoInfoTitle: css`
        font-size: 1.15rem;
        font-weight: bold;
        margin-bottom: 0.5rem;
        color: ${theme.colors.text.primary};
    `,
    videoInfoFolder: css`
        font-size: 0.875rem;
        color: ${theme.colors.text.primary};
        margin-bottom: 0.3rem;
    `,
    videoInfoMeta: css`
        font-size: 0.875rem;
        color: ${theme.colors.text.secondary};
        margin-bottom: 1rem;
    `,
    tagList: css`
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.3rem;
    `,
    detailGrid: css`
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 0.5rem 1rem;
    `,
    pathText: css`
        word-break: break-all;
    `,
    loadingDotsLarge: css`
        font-size: 2rem;
        margin-bottom: 1rem;
        justify-content: center;
    `,
    imageListContainer: css`
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        padding: 0.5rem;
        background-color: ${theme.colors.bg.secondary};
        border-bottom: 1px solid ${theme.colors.border.primary};
        margin-bottom: 10px;
    `,
    imageListItemWrapper: css`
        position: relative;
        cursor: pointer;
        overflow: hidden;
        height: 60px;
    `,
    imageListItem: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    imageListLoading: css`
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        color: ${theme.colors.text.secondary};
        font-size: 0.875rem;
        background-color: ${theme.colors.bg.secondary};
        border-bottom: 1px solid ${theme.colors.border.primary};
        margin-bottom: 10px;
    `,
    imageListLoadingRow: css`
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `,
    normalButton: css`
        padding: 0.25rem 0.5rem;
        background-color: ${theme.colors.bg.secondary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        color: ${theme.colors.text.secondary};
        font-size: 0.75rem;
        cursor: pointer;
    `,
    imageListFab: css`
        position: fixed;
        bottom: 2.2rem;
        right: 5.5rem;
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 50%;
        background-color: ${theme.colors.accent.primary};
        opacity: 0.7;
        color: white;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        z-index: 100;
        &:hover {
            opacity: 1;
        }
    `,
    imageListControls: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 6px 1rem;
        background-color: ${theme.colors.bg.secondary};
        border-bottom: 1px solid ${theme.colors.border.primary};
        margin-bottom: 10px;
    `,
};

export default function WatchPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const startTime = parseFloat(searchParams.get('t')) || undefined;
    const { showToast, confirm, showExtension, showThumbnailButton, showDisplayName } = useUI();
    const [video, setVideo] = useState(null);
    const [knownTags, setKnownTags] = useState([]);
    const [selectedTag, setSelectedTag] = useState('');
    const [screenshots, setScreenshots] = useState([]);
    const playerRef = useRef(null);
    const [showImageList, setShowImageList] = useState(false);
    const [imageList, setImageList] = useState([]);
    const [isLoadingImageList, setIsLoadingImageList] = useState(false);
    const isLoadingImageListRef = useRef(false);
    const currentIdRef = useRef(id);
    const setIsLoadingImageListSynced = (value) => {
        isLoadingImageListRef.current = value;
        setIsLoadingImageList(value);
    };
    const [imageListProgress, setImageListProgress] = useState(0);
    const pollingIntervalRef = useRef(null);
    const [maxCount, setMaxCount] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('image_list_max_count');
            return stored ? parseInt(stored, 10) : 30;
        }
        return 30;
    });
    const [isLargeImageList, setIsLargeImageList] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('image_list_large') === 'true';
        }
        return false;
    });

    const handleLargeImageListChange = (checked) => {
        setIsLargeImageList(checked);
        localStorage.setItem('image_list_large', checked.toString());
    };

    const [relatedVideos, setRelatedVideos] = useState([]);
    const [nextVideoId, setNextVideoId] = useState(null);
    const [isError, setIsError] = useState(false);
    const [isCapturing, setIsCapturing] = useState(false);
    const [playerAspectRatio, setPlayerAspectRatio] = useState('16/9');

    const [showPreviewControls] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('showPreviewControls');
            return stored === null ? true : stored === 'true';
        }
        return true;
    });

    const [showEditButton] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('showEditButton');
            return stored === null ? true : stored === 'true';
        }
        return true;
    });

    // アンマウント時（ページ離脱・動画切り替え）に生成中のイメージリストをキャンセルする
    useEffect(() => {
        currentIdRef.current = id;
        return () => {
            if (isLoadingImageListRef.current) {
                const cancelId = currentIdRef.current;
                api.cancelVideoImageList(cancelId).catch(() => { });
            }
        };
    }, [id]);

    useEffect(() => {
        window.scrollTo(0, 0);
        setVideo(null);
        setNextVideoId(null);
        setIsError(false);
        setShowImageList(false);
        setImageList([]);
        setIsLoadingImageListSynced(false);
        setImageListProgress(0);
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    }, [id]);

    const startProgressPolling = (videoId) => {
        setImageListProgress(0);
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const result = await api.getVideoImageListProgress(videoId);
                setImageListProgress(result.progress || 0);
            } catch (e) {
                // エラーは無視して続行
            }
        }, 500);
    };

    const stopProgressPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setImageListProgress(0);
    };

    const toggleImageList = async () => {
        if (isLoadingImageList) {
            return;
        }

        if (showImageList) {
            setShowImageList(false);
            return;
        }

        if (!video.duration || isNaN(video.duration) || video.duration <= 10) {
            showToast('10秒以下の動画、または長さが不明な動画はイメージリストを作成できません。', 'error');
            return;
        }

        setShowImageList(true);

        if (imageList.length > 0) {
            return;
        }

        setIsLoadingImageListSynced(true);
        startProgressPolling(id);
        try {
            const list = await api.getVideoImageList(id, maxCount);
            setImageList(list);
        } catch (err) {
            console.error('[WatchPage] getVideoImageList failed:', err);
            if (err.status === 499) {
                // キャンセルはトーストなし
            } else if (err.status === 504) {
                showToast(err.message || '画像生成がタイムアウトしました', 'error');
            } else {
                showToast(err.message || 'イメージリストの取得に失敗しました', 'error');
            }
            setShowImageList(false);
        } finally {
            stopProgressPolling();
            setIsLoadingImageListSynced(false);
        }
    };

    const handleImageClick = (position) => {
        if (playerRef.current && playerRef.current.seekTo) {
            playerRef.current.seekTo(position);
        }
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const handleMaxCountChange = (value) => {
        setMaxCount(value);
        localStorage.setItem('image_list_max_count', value.toString());
    };

    const handleCancelImageList = async () => {
        try {
            await api.cancelVideoImageList(id);
        } catch (e) {
            // キャンセル要求のエラーは無視
        }
    };

    const handleRecreateImageList = async () => {
        if (isLoadingImageList) {
            return;
        }
        setIsLoadingImageListSynced(true);
        startProgressPolling(id);
        try {
            const list = await api.getVideoImageList(id, maxCount, true);
            setImageList(list);
            showToast('イメージリストを再作成しました', 'success');
        } catch (err) {
            console.error('[WatchPage] recreate image list failed:', err);
            if (err.status === 499) {
                showToast('画像生成をキャンセルしました', 'info');
                // キャンセル時はイメージリストを閉じて初期化する
                setImageList([]);
                setShowImageList(false);
            } else if (err.status === 504) {
                showToast(err.message || '画像生成がタイムアウトしました', 'error');
            } else {
                showToast(err.message || 'イメージリストの再作成に失敗しました', 'error');
            }
        } finally {
            stopProgressPolling();
            setIsLoadingImageListSynced(false);
        }
    };

    useEffect(() => {
        if (video && video.filename) {
            const filenameToDisplay = videoName(video, showExtension, showDisplayName);
            document.title = `${filenameToDisplay} - LadyTube`;
        }
    }, [video, showExtension, showDisplayName]);

    useEffect(() => {
        api.getVideo(id)
            .then(data => {
                setVideo(data.video);
                setRelatedVideos(data.relatedVideos || []);
                setNextVideoId(data.nextVideoId || null);
            })
            .catch(e => {
                console.error('[WatchPage] getVideo failed:', e);
                setIsError(true);
            });

        api.getTags()
            .then(setKnownTags)
            .catch(err => console.error('[WatchPage] getTags failed:', err));

        api.getScreenshots(id)
            .then(setScreenshots)
            .catch(err => console.error('[WatchPage] getScreenshots failed:', err));
    }, [id, navigate]);

    const [selectedScreenshot, setSelectedScreenshot] = useState(null);
    const [isEditingTags, setIsEditingTags] = useState(false);

    const handleOpenEditDialog = () => {
        setIsEditingTags(true);
    };

    const [isProbeDialogOpen, setIsProbeDialogOpen] = useState(false);

    const VideoProbeDialog = ({ isOpen, onClose, videoId }) => {
        const [info, setInfo] = useState(null);
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const NO_DATA = '?';

        useEffect(() => {
            if (isOpen && videoId) {
                setLoading(true);
                setError(null);
                api.getVideoProbeInfo(videoId)
                    .then(data => setInfo(data))
                    .catch(err => setError(err.message))
                    .finally(() => setLoading(false));
            } else {
                setInfo(null);
            }
        }, [isOpen, videoId]);

        if (!isOpen) return null;

        const calcFps = (expression) => {
            const parts = expression.split('/');
            return (Number(parts[0]) / Number(parts[1])).toFixed(3);
        };

        return (
            <div className={styles.overlay} onClick={onClose}>
                <div className={styles.probeDialog} onClick={e => e.stopPropagation()}>
                    <div className={styles.probeHeader}>
                        <h3 className={styles.probeTitle}>コーデック情報</h3>
                        <button onClick={onClose} className={styles.probeCloseButton}>
                            <X size={20} />
                        </button>
                    </div>

                    <div className={styles.probeContent}>
                        {loading && (
                            <div className={styles.probeLoading}>
                                読み込み中<LoadingDots />
                            </div>
                        )}
                        {error && <div style={{ color: theme.colors.status.error }}>エラー: {error}</div>}

                        {info && (
                            <div className={styles.probeInfoWrapper}>
                                <div className={styles.probeSection}>
                                    <h4 className={styles.probeSectionTitle}>コンテナ</h4>
                                    <div className={styles.probeGrid}>
                                        <div>形式</div>
                                        <div>{info.format.format_name || NO_DATA}</div>
                                        <div>説明</div>
                                        <div>{info.format.format_long_name || NO_DATA}</div>
                                        <div>総ビットレート</div>
                                        <div>{info.format.bit_rate ? Math.round(info.format.bit_rate / 1000).toLocaleString() : NO_DATA} Kbps</div>
                                    </div>
                                </div>

                                {info.streams.filter(s => s.codec_type === 'video').map((stream, i) => (
                                    <div key={`video-${i}`} className={styles.probeSection}>
                                        <h4 className={styles.probeSectionTitle}>映像 #{i + 1}</h4>
                                        <div className={styles.probeGrid}>
                                            <div>コーデック</div>
                                            <div>{stream.codec_name || NO_DATA}</div>
                                            <div>説明</div>
                                            <div>{stream.codec_long_name || NO_DATA}</div>
                                            <div>解像度</div>
                                            <div>{stream.width || NO_DATA} x {stream.height || NO_DATA}</div>
                                            <div>アスペクト比</div>
                                            <div>{stream.display_aspect_ratio || NO_DATA}</div>
                                            <div>フレームレート</div>
                                            <div>{stream.avg_frame_rate ? `${stream.avg_frame_rate} (${calcFps(stream.avg_frame_rate)} fps)` : NO_DATA}</div>
                                            <div>ビットレート</div>
                                            <div>{stream.bit_rate ? `${Math.round(stream.bit_rate / 1000).toLocaleString()} Kbps` : NO_DATA}</div>
                                        </div>
                                    </div>
                                ))}

                                {info.streams.filter(s => s.codec_type === 'audio').map((stream, i) => (
                                    <div key={`audio-${i}`} className={styles.probeSection}>
                                        <h4 className={styles.probeSectionTitle}>音声 #{i + 1}</h4>
                                        <div className={styles.probeGrid}>
                                            <div>コーデック</div>
                                            <div>{stream.codec_name || NO_DATA}</div>
                                            <div>説明</div>
                                            <div>{stream.codec_long_name || NO_DATA}</div>
                                            <div>チャンネル</div>
                                            <div>{stream.channels || NO_DATA} ch ({stream.channel_layout || NO_DATA})</div>
                                            <div>サンプルレート</div>
                                            <div>{stream.sample_rate || NO_DATA} Hz</div>
                                            <div>ビットレート</div>
                                            <div>{stream.bit_rate ? `${Math.round(stream.bit_rate / 1000).toLocaleString()} Kbps` : NO_DATA}</div>
                                            <div>言語</div>
                                            <div>{stream.tags && stream.tags.language ? stream.tags.language : NO_DATA}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const handleCaptureScreenshot = async () => {
        console.log('[WatchPage] handleCaptureScreenshot triggered');
        if (!playerRef.current) {
            console.error('[WatchPage] playerRef.current is null!');
            return;
        }
        if (isCapturing) {
            console.log('[WatchPage] Capture already in progress, skipping');
            return;
        }

        let time = 0;
        try {
            time = playerRef.current.getCurrentTime();
            console.log('[WatchPage] Current time from player:', time);
        } catch (err) {
            console.error('[WatchPage] Failed to get current time from player:', err);
            showToast('プレイヤー情報の取得に失敗しました: ' + err.message, 'error');
            return;
        }

        setIsCapturing(true);
        console.log('[WatchPage] Capturing screenshot at:', time);
        try {
            const res = await api.captureScreenshot(id, time);
            if (res.success) {
                const updatedScreenshots = await api.getScreenshots(id);
                setScreenshots(updatedScreenshots);

                const newlyCreatedScreenshot = updatedScreenshots.find(s => s.id === res.screenshot_id);
                if (newlyCreatedScreenshot) {
                    const thumbnailElement = (
                        <img
                            src={`/api/screenshot/${newlyCreatedScreenshot.id}/image`}
                            alt="Screenshot"
                            className={styles.toastThumbnail}
                        />
                    );
                    const isFullscreen = document.fullscreenElement !== null;
                    if (isFullscreen) {
                        if (playerRef.current.showToast) {
                            playerRef.current.showToast('スクリーンショットを取得しました', thumbnailElement);
                        }
                    } else {
                        showToast('スクリーンショットを取得しました', 'success', thumbnailElement);
                    }
                }
            } else {
                throw new Error('Screenshot failed');
            }
        } catch (e) {
            console.error('[WatchPage] Screenshot capture failed:', e);
            showToast('スクリーンショットの取得に失敗しました: ' + e.message, 'error');
        } finally {
            setIsCapturing(false);
        }
    };

    const handleVideoLoadedMetadata = (e) => {
        const video = e.target;
        if (video && video.videoWidth && video.videoHeight) {
            setPlayerAspectRatio(`${video.videoWidth}/${video.videoHeight}`);
        }
    };

    const handleScreenshotClick = (shot) => {
        setSelectedScreenshot(shot);
    };

    const handleMenuAction = (action) => {
        if (!selectedScreenshot) return;

        switch (action) {
            case 'play':
                if (playerRef.current && playerRef.current.seekTo) {
                    playerRef.current.seekTo(selectedScreenshot.timestamp);
                }
                break;
            case 'thumbnail':
                handleSetThumbnail(selectedScreenshot);
                break;
            case 'delete':
                handleDeleteScreenshot(selectedScreenshot);
                break;
        }
        setSelectedScreenshot(null);
    };

    const handleSetThumbnail = async (shot) => {
        try {
            await api.setThumbnail(id, shot.id);
            showToast('サムネイルを設定しました', 'success', (
                <img
                    src={`/api/screenshot/${shot.id}/image`}
                    alt="Thumbnail"
                    className={styles.setThumbnailToast}
                />
            ));
        } catch (e) {
            showToast('サムネイルの設定に失敗しました: ' + e.message, 'error');
        }
    };

    const handleDeleteScreenshot = async (shot) => {
        const isConfirmed = await confirm('このスクリーンショットを削除しますか？', { title: '削除確認', confirmLabel: '削除' });
        if (!isConfirmed) return;

        try {
            await api.deleteScreenshot(shot.id);
            setScreenshots(prev => prev.filter(s => s.id !== shot.id));
            showToast('削除しました', 'success');
        } catch (e) {
            showToast('削除に失敗しました: ' + e.message, 'error');
        }
    };

    if (isError) {
        return (
            <div className={styles.errorPage}>
                <Navbar />
                <div className={styles.errorBox}>
                    <div className={styles.errorTitle}>
                        ファイルが見つかりません
                    </div>
                    <div className={styles.errorDescription}>
                        移動または削除されています。
                    </div>
                </div>
            </div>
        );
    }

    if (!video) {
        return (
            <div className={styles.loadingPage}>
                <Navbar />
                <div className={styles.loadingContainer}>
                    <div className={styles.loadingOverlayWrapper}>
                        <LoadingDots className={styles.loadingDotsLarge} />
                        <div className={styles.loadingText}>読み込み中...</div>
                    </div>
                </div>
            </div>
        );
    }

    const currentTags = video.tags ? video.tags.split('\n').filter(t => t.trim()) : [];

    return (
        <div className={styles.page}>
            <Navbar />

            {/* Screenshot Menu Overlay */}
            {selectedScreenshot && (
                <div className={styles.overlay} onClick={() => setSelectedScreenshot(null)}>
                    <div className={styles.menuDialog} onClick={e => e.stopPropagation()}>
                        <div className={styles.screenshotMenuPreviewContainer}>
                            <div className={styles.screenshotMenuPreviewBox}>
                                <img
                                    src={`/api/screenshot/${selectedScreenshot.id}/image`}
                                    alt="Selected screenshot"
                                    className={styles.screenshotMenuPreviewImage}
                                />
                            </div>
                        </div>

                        <div className={styles.screenshotMenuActions}>
                            <button onClick={() => handleMenuAction('play')} className={styles.menuButton}>
                                <Play size={20} fill="currentColor" /> ここから再生
                            </button>
                            <button onClick={() => handleMenuAction('thumbnail')} className={styles.menuButton}>
                                <Image size={20} /> この画像をサムネイルにする
                            </button>
                            <button onClick={() => handleMenuAction('delete')} className={styles.deleteButton}>
                                <Trash2 size={20} /> 削除
                            </button>
                        </div>

                        <button
                            onClick={() => setSelectedScreenshot(null)}
                            className={styles.screenshotMenuCancelButton}
                        >
                            キャンセル
                        </button>
                    </div>
                </div>
            )}

            {/* Combined Edit Dialog */}
            {isEditingTags && (
                <VideoInfoEditDialog
                    video={video}
                    isOpen={isEditingTags}
                    onClose={() => setIsEditingTags(false)}
                    onUpdate={(updatedVideo) => setVideo(updatedVideo)}
                />
            )}

            {/* Video Probe Dialog */}
            {isProbeDialogOpen && (
                <VideoProbeDialog
                    isOpen={isProbeDialogOpen}
                    onClose={() => setIsProbeDialogOpen(false)}
                    videoId={video.id}
                />
            )}

            {/* Video Player Section */}
            <div className={styles.playerSection}>
                <div
                    className={styles.playerWrapper}
                    style={{ '--aspect-ratio': playerAspectRatio }}
                >
                    <Player
                        ref={playerRef}
                        video={video}
                        initialTime={startTime}
                        onClose={() => navigate('/')}
                        isEmbedded={true}
                        onCapture={handleCaptureScreenshot}
                        isCapturing={isCapturing}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        onVideoUpdate={(updatedVideo) => setVideo(updatedVideo)}
                        onVideoSelect={(selectedVideo) => navigate(`/watch/${selectedVideo.id}`)}
                        screenshots={screenshots}
                    />
                </div>
            </div>

            {showImageList && (
                isLoadingImageList ? (
                    <div className={styles.imageListLoading}>
                        <div className={styles.imageListLoadingRow}>
                            <span>画像を生成中... {imageListProgress}%</span>
                            <button
                                onClick={handleCancelImageList}
                                className={styles.normalButton}
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className={styles.imageListContainer} style={{ marginBottom: 0 }}>
                            {imageList.map((img, i) => (
                                <div
                                    key={i}
                                    className={styles.imageListItemWrapper}
                                    style={{ height: isLargeImageList ? '100px' : '60px' }}
                                    onClick={() => handleImageClick(img.position)}
                                    title={`${formatDuration(img.position)}`}
                                >
                                    <img
                                        src={img.url}
                                        alt={`Image at ${img.position}`}
                                        className={styles.imageListItem}
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className={styles.imageListControls}>
                            <label style={{ marginRight: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none', fontSize: '0.8rem', color: theme.colors.text.secondary }}>
                                <span>大きく表示</span>
                                <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                                    <input
                                        type="checkbox"
                                        checked={isLargeImageList}
                                        onChange={(e) => handleLargeImageListChange(e.target.checked)}
                                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        backgroundColor: isLargeImageList ? '#3b82f6' : '#4b5563',
                                        borderRadius: '20px',
                                    }}>
                                        <div style={{
                                            position: 'absolute',
                                            top: '2px',
                                            left: isLargeImageList ? '18px' : '2px',
                                            width: '16px',
                                            height: '16px',
                                            backgroundColor: 'white',
                                            borderRadius: '50%',
                                            transition: 'left 0.2s',
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                        }} />
                                    </div>
                                </div>
                            </label>
                            <div>
                                <select
                                    value={maxCount}
                                    onChange={(e) => handleMaxCountChange(Number(e.target.value))}
                                    style={{
                                        backgroundColor: theme.colors.bg.input,
                                        color: theme.colors.text.primary,
                                        border: `1px solid ${theme.colors.border.primary}`,
                                        borderRadius: '4px',
                                        padding: '2px 8px',
                                        fontSize: '0.8rem',
                                        outline: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {[30, 40, 50, 60].map(val => (
                                        <option key={val} value={val}>{val}枚</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleRecreateImageList}
                                    className={styles.normalButton}
                                >
                                    再作成
                                </button>
                            </div>
                        </div>
                    </>
                )
            )}

            <div className={styles.pageContentContainer}>

                {/* Screenshots Section (Full width) */}
                <div className={styles.screenshotsSection}>
                    <div className={styles.screenshotsGrid}>
                        {screenshots.length > 0 ? screenshots.map((shot, i) => (
                            <div
                                key={i}
                                onClick={() => handleScreenshotClick(shot)}
                                onMouseDown={(e) => {
                                    if (e.button === 1) {
                                        e.preventDefault();
                                        if (playerRef.current?.seekTo) {
                                            playerRef.current.seekTo(shot.timestamp);
                                        }
                                    }
                                }}
                                className={styles.screenshotCard}
                            >
                                <div className={styles.screenshotImageWrapper}>
                                    <img
                                        src={`/api/screenshot/${shot.id}/image`}
                                        alt={`Screenshot at ${shot.timestamp}`}
                                        className={styles.screenshotImage}
                                    />
                                    <div className={styles.screenshotTimestamp}>
                                        {formatDuration(shot.timestamp)}
                                    </div>
                                </div>
                            </div>
                        )) : (
                            <div className={styles.noScreenshots}>スクリーンショットはありません</div>
                        )}
                    </div>
                </div>

                {/* Title & Tags (Full width) */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 className={styles.videoInfoTitle}>
                        {videoName(video, showExtension, showDisplayName)}{video.display_name ? ` ${video.display_name}` : ''}
                    </h1>

                    <div className={styles.videoInfoFolder}>
                        {getFolderName(video.path)}
                    </div>

                    <div className={styles.videoInfoMeta}>
                        {video.play_count || 0} 回再生 &nbsp; {formatDateTime(video.updated_at)}
                    </div>

                    {/* Tags */}
                    <div className={styles.tagList}>
                        {currentTags.map((tag, i) => (
                            <Link key={i} to={`/search?q=${encodeURIComponent(tag)}`} className={styles.tagLink}>
                                {tag}
                            </Link>
                        ))}
                    </div>

                    {/* FAB: Floating Image List Toggle Button */}
                    <button onClick={toggleImageList} className={styles.imageListFab} title="イメージリスト">
                        <LayoutGrid size={16} />
                    </button>

                    {/* FAB: Floating Edit Button */}
                    <button onClick={handleOpenEditDialog} className={styles.fab} title="タグ編集">
                        <Pencil size={20} />
                    </button>
                </div>

                {/* Information, Transcode, Folder & Next Video Row */}
                <div className={styles.infoLayoutContainer}>
                    {/* Left: Info details */}
                    <div className={styles.infoLeftColumn}>
                        {/* Additional Info Section */}
                        <div className={styles.infoBox} style={{ marginTop: 0 }}>
                            <div className={styles.detailGrid}>
                                <div>長さ:</div>
                                <div>{video.duration === null ? '不明' : formatDuration(video.duration)}</div>

                                <div>サイズ:</div>
                                <div>{formatFileSize(video.size)}</div>

                                <div>前回再生:</div>
                                <div>{video.last_played_at ? formatDateTime(video.last_played_at) : '未再生'}</div>

                                <div>登録日:</div>
                                <div>{video.created_at ? formatDateTime(video.created_at) : '-'}</div>

                                <div>場所:</div>
                                <div className={styles.pathText}>{getFolderPath(video.path)}</div>
                            </div>
                        </div>

                        {/* Transcode Section */}
                        <div className={styles.infoBox}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', userSelect: 'none' }}>
                                    <span>トランスコード再生</span>
                                    <div style={{ position: 'relative', width: '36px', height: '20px' }}>
                                        <input
                                            type="checkbox"
                                            checked={video.use_transcode === 1}
                                            onChange={async (e) => {
                                                const newVal = e.target.checked ? 1 : 0;
                                                try {
                                                    await api.updateTranscodeSettings(id, newVal);
                                                    setVideo(prev => ({ ...prev, use_transcode: newVal }));
                                                    showToast(newVal ? 'トランスコードを有効にしました' : 'トランスコードを無効にしました', 'success');
                                                } catch (err) {
                                                    showToast('設定の保存に失敗しました: ' + err.message, 'error');
                                                }
                                            }}
                                            style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                                        />
                                        <div style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            right: 0,
                                            bottom: 0,
                                            backgroundColor: video.use_transcode === 1 ? theme.colors.accent.primary : '#4b5563',
                                            borderRadius: '20px',
                                            transition: 'background-color 0.2s',
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: video.use_transcode === 1 ? '18px' : '2px',
                                                width: '16px',
                                                height: '16px',
                                                backgroundColor: 'white',
                                                borderRadius: '50%',
                                                transition: 'left 0.2s',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
                                            }} />
                                        </div>
                                    </div>
                                </label>

                                <button
                                    onClick={() => setIsProbeDialogOpen(true)}
                                    className={styles.normalButton}
                                >
                                    コーデック情報
                                </button>
                            </div>
                        </div>

                        {/* Local execution commands (localhost only) */}
                        {isLocalhost && (
                            <div className={styles.infoBox}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.openVideoFolder(id);
                                            } catch (err) {
                                                showToast('フォルダーを開くのに失敗しました: ' + err.message, 'error');
                                            }
                                        }}
                                        className={styles.normalButton}
                                    >
                                        フォルダーを開く
                                    </button>
                                    <button
                                        onClick={async () => {
                                            try {
                                                await api.openVideoApp(id);
                                            } catch (err) {
                                                showToast('アプリの実行に失敗しました: ' + err.message, 'error');
                                            }
                                        }}
                                        className={styles.normalButton}
                                    >
                                        アプリで再生
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Related Videos Section (Full width) */}
                <div style={{ marginTop: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '1rem', color: theme.colors.text.secondary }}>関連動画</h3>
                    <VideoList
                        videos={relatedVideos}
                        onPlay={(v) => navigate(`/watch/${v.id}`)}
                        viewMode="grid-sm"
                        highlightedId={nextVideoId}
                        onVideoUpdate={(updatedVideo) => {
                            setRelatedVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
                        }}
                        showPreviewControls={showPreviewControls}
                        showThumbnailButton={showThumbnailButton}
                        showEditButton={showEditButton}
                    />
                </div>

            </div>
        </div>
    );
}
