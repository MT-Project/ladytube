import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@linaria/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { removeExtension } from '../utils/formatters';

const styles = {
    section: css`
        margin-bottom: 2rem;
    `,
    carousel: css`
        position: relative;
        width: 100%;
        overflow: hidden;
    `,
    carouselTrack: css`
        display: flex;
    `,
    carouselSlide: css`
        flex: 0 0 240px;
        aspect-ratio: 3/2;
        position: relative;
    `,
    carouselThumbnail: css`
        width: 100%;
        height: 100%;
        object-fit: cover;
        cursor: pointer;
        display: block;
    `,
    carouselNoImage: css`
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #1a1a1a;
        color: #4b5563;
        font-size: 0.65rem;
        font-weight: bold;
    `,
    carouselButton: css`
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background-color: rgba(0, 0, 0, 0.6);
        border: none;
        border-radius: 50%;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10;
        &:hover {
            background-color: rgba(0, 0, 0, 0.8);
        }
    `,
    carouselButtonLeft: css`
        left: 10px;
    `,
    carouselButtonRight: css`
        right: 10px;
    `,
};

export default function VideoCarousel({ videos = [], showExtension = true }) {
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(true);
    const intervalRef = useRef(null);

    // カルーセル用の動画配列を複製して無限ループを実現（前・中・後の3セット）
    const duplicatedCarouselVideos = [...videos, ...videos, ...videos];

    // 初期化および自動再生制御
    useEffect(() => {
        if (!videos || videos.length === 0) return;

        setCarouselIndex(videos.length);
        setIsTransitioning(false);

        const startAutoPlay = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            intervalRef.current = setInterval(() => {
                setIsTransitioning(true);
                setCarouselIndex(prev => prev + 1);
            }, 3000);
        };

        const stopAutoPlay = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                // バックグラウンド時はアニメーションとタイマーを停止
                stopAutoPlay();
            } else {
                // タブ復帰時は安全なインデックス位置に補正してアニメーションなしでリセット
                setIsTransitioning(false);
                setCarouselIndex(prev => {
                    const n = videos.length;
                    if (n === 0) return 0;
                    return n + (prev % n);
                });
                startAutoPlay();
            }
        };

        startAutoPlay();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopAutoPlay();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [videos.length]);

    const handleCarouselPrev = () => {
        setIsTransitioning(true);
        setCarouselIndex(prev => prev - 1);
    };

    const handleCarouselNext = () => {
        setIsTransitioning(true);
        setCarouselIndex(prev => prev + 1);
    };

    const handleTransitionEnd = () => {
        if (!videos || videos.length === 0) return;
        const n = videos.length;
        if (carouselIndex >= 2 * n) {
            setIsTransitioning(false);
            setCarouselIndex(carouselIndex - n);
        } else if (carouselIndex < n) {
            setIsTransitioning(false);
            setCarouselIndex(carouselIndex + n);
        }
    };

    if (!videos || videos.length === 0) {
        return null;
    }

    return (
        <section className={styles.section}>
            <div className={styles.carousel}>
                <div
                    className={styles.carouselTrack}
                    style={{
                        transform: `translateX(-${carouselIndex * 240}px)`,
                        transition: isTransitioning ? 'transform 0.5s ease-in-out' : 'none'
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    {duplicatedCarouselVideos.map((video, index) => {
                        const filenameToDisplay = showExtension ? video.filename : removeExtension(video.filename);
                        const fullTitle = `${filenameToDisplay}${video.display_name ? ` ${video.display_name}` : ''}`;
                        return (
                            <div key={`${video.id}-${index}`} className={styles.carouselSlide}>
                                <Link to={`/watch/${video.id}`} title={fullTitle}>
                                    {video.has_thumbnail ? (
                                        <img
                                            src={`/api/video/${video.id}/thumbnail?s=0`}
                                            title={fullTitle}
                                            alt={fullTitle}
                                            className={styles.carouselThumbnail}
                                        />
                                    ) : (
                                        <div className={styles.carouselNoImage} title={fullTitle}>NO IMAGE</div>
                                    )}
                                </Link>
                            </div>
                        );
                    })}
                </div>
                <button
                    onClick={handleCarouselPrev}
                    className={`${styles.carouselButton} ${styles.carouselButtonLeft}`}
                    aria-label="Previous"
                >
                    <ChevronLeft size={24} />
                </button>
                <button
                    onClick={handleCarouselNext}
                    className={`${styles.carouselButton} ${styles.carouselButtonRight}`}
                    aria-label="Next"
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </section>
    );
}
