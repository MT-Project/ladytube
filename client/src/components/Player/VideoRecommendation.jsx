import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { css } from '@linaria/core';
import { api } from '../../services/api';
import { useUI } from '../../contexts/UIContext';
import { removeExtension } from '../../utils/formatters';
import { theme } from '../../theme';

const styles = {
    container: css`
        position: absolute;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: ${theme.colors.bg.modal};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        padding: 2rem;
        display: flex;
        gap: 1rem;
        justify-content: center;
        align-items: flex-start;
        z-index: 10;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        max-width: 90%;
    `,
    narrowContainer: css`
        position: absolute;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: ${theme.colors.bg.modal};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        padding: 1.5rem;
        display: flex;
        justify-content: center;
        z-index: 10;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
        max-width: 300px;
    `,
    videoCard: css`
        max-width: 33.3%;
        width: 280px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        text-decoration: none;
        color: inherit;
    `,
    narrowVideoCard: css`
        max-width: 200px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        text-decoration: none;
        color: inherit;
    `,
    thumbnailWrapper: css`
        position: relative;
        width: 100%;
        aspect-ratio: 16/9;
        background-color: ${theme.colors.bg.secondary};
        border-radius: 0.25rem;
        overflow: hidden;
        background-color: black;
    `,
    thumbnail: css`
        width: 100%;
        height: 100%;
        object-fit: contain;
    `,
    badge: css`
        font-size: 0.8rem;
        font-weight: 500;
    `,
    pickupBadge: css`
        color: ${theme.colors.text.secondary};
    `,
    nextBadge: css`
        color: ${theme.colors.accent.primary};
    `,
    title: css`
        color: ${theme.colors.text.primary};
        font-size: 0.85rem;
        font-weight: 400;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-all;        
    `,
    folder: css`
        color: ${theme.colors.text.secondary};
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: -0.3rem;
    `,
    durationBadge: css`
        position: absolute;
        bottom: 4px;
        right: 4px;
        background: rgba(0,0,0,0.8);
        color: white;
        font-size: 10px;
        padding: 0 4px;
        border-radius: 2px;
        font-family: monospace;
        line-height: 1.2;
        z-index: 1;
    `,
    loading: css`
        color: ${theme.colors.text.primary};
        font-size: 1rem;
    `,
};

const VideoRecommendation = ({ currentVideo, nextVideoId, onVideoSelect }) => {
    const [recommendations, setRecommendations] = useState([]);
    const [isWide, setIsWide] = useState(false);
    const [loading, setLoading] = useState(false);
    const { showExtension } = useUI();

    // 画面幅を監視
    useEffect(() => {
        const checkWidth = () => {
            setIsWide(window.innerWidth >= 640);
        };
        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    // 動画紹介データを取得
    useEffect(() => {
        if (!currentVideo) return;

        const fetchRecommendations = async () => {
            setLoading(true);
            try {
                const results = [];

                if (isWide) {
                    // 広い画面：ランダム2件 + 次の動画1件
                    try {
                        const randomVideos = await api.getVideos({
                            q: '',
                            perPage: 2,
                            sort: 'random',
                            seed: Date.now()
                        });

                        // 現在の動画を除外
                        const filteredRandom = (randomVideos.videos || []).filter(
                            v => v.id !== currentVideo.id
                        );

                        results.push(...filteredRandom.slice(0, 2).map(v => ({ ...v, type: 'pickup' })));
                    } catch (err) {
                        console.error('Failed to fetch random videos:', err);
                        // ランダム動画の取得に失敗しても次の動画は表示する
                    }

                    // 次の動画を取得
                    if (nextVideoId) {
                        try {
                            const nextVideo = await api.getVideo(nextVideoId);
                            results.push({ ...nextVideo.video, type: 'next' });
                        } catch (err) {
                            console.error('Failed to fetch next video:', err);
                        }
                    }
                } else {
                    // 狭い画面：次の動画のみ
                    if (nextVideoId) {
                        try {
                            const nextVideo = await api.getVideo(nextVideoId);
                            results.push({ ...nextVideo.video, type: 'next' });
                        } catch (err) {
                            console.error('Failed to fetch next video:', err);
                        }
                    }
                }

                setRecommendations(results);
            } catch (err) {
                console.error('Failed to fetch recommendations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [currentVideo, nextVideoId, isWide]);

    if (loading) {
        return (
            <div className={isWide ? styles.container : styles.narrowContainer}>
                <span className={styles.loading}>読み込み中...</span>
            </div>
        );
    }

    if (recommendations.length === 0) return null;

    const displayTitle = (video) => {
        const filename = showExtension ? video.filename : removeExtension(video.filename);
        return video.display_name ? `${filename} ${video.display_name}` : filename;
    };

    const displayFolder = (video) => {
        const pathParts = video.path.split(/[/\\]/);
        return pathParts.length > 1 ? pathParts[pathParts.length - 2] : video.path;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return "---";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className={isWide ? styles.container : styles.narrowContainer}>
            {recommendations.map((video) => (
                <Link
                    key={video.id}
                    to={`/watch/${video.id}`}
                    className={isWide ? styles.videoCard : styles.narrowVideoCard}
                    onClick={(e) => {
                        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                            e.preventDefault();
                            onVideoSelect(video);
                        }
                    }}
                >
                    <span className={`${styles.badge} ${video.type === 'pickup' ? styles.pickupBadge : styles.nextBadge}`}>
                        {video.type === 'pickup' ? 'PICKUP' : 'NEXT'}
                    </span>
                    <div className={`${styles.thumbnailWrapper} ${styles.thumbnailWrapperHover}`}>
                        {video.has_thumbnail ? (
                            <img
                                src={`/api/video/${video.id}/thumbnail`}
                                alt={displayTitle(video)}
                                className={styles.thumbnail}
                            />
                        ) : (
                            <div className={styles.thumbnail} style={{ backgroundColor: '#333' }} />
                        )}
                        <div className={styles.durationBadge}>{formatDuration(video.duration)}</div>
                    </div>
                    <div className={styles.title} title={displayTitle(video)}>
                        {displayTitle(video)}
                    </div>
                    <div className={styles.folder} title={video.path}>
                        {displayFolder(video)}
                    </div>
                </Link>
            ))}
        </div>
    );
};

export default VideoRecommendation;
