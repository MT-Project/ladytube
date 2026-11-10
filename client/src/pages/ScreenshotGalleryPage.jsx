import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from '../components/Navbar';
import { theme } from '../theme';
import { api } from '../services/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Linaria styles
const styles = {
    page: css`
        min-height: 100vh;
        padding-top: 4rem;
        padding-bottom: 4rem;
        box-sizing: border-box;
        background-color: ${theme.colors.bg.primary};
    `,
    content: css`
        max-width: 1280px;
        margin: 0 auto;
        padding: 1rem;
    `,
    header: css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    `,
    title: css`
        color: ${theme.colors.text.secondary};
        font-size: 0.9rem;
        font-weight: 500;
        margin: 0;
        display: flex;
        align-items: center;
        white-space: nowrap;
    `,
    countNumber: css`
        color: ${theme.colors.text.primary};
        font-size: 1.25rem;
        font-weight: bold;
        margin-right: 0.25rem;
    `,
    headerControls: css`
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `,
    perPageGroup: css`
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background-color: ${theme.colors.bg.tertiary};
        padding: 0.25rem;
        border-radius: 0.25rem;
        border: 1px solid ${theme.colors.border.primary};
        font-size: 0.875rem;
        font-family: monospace;
    `,
    perPageButton: css`
        padding: 0.375rem 0.6rem;
        border-radius: 0.25rem;
        cursor: pointer;
        user-select: none;
        color: ${theme.colors.text.secondary};
        font-size: 0.875rem;
        font-weight: 500;
        &:hover {
            background-color: ${theme.colors.bg.hover};
            color: ${theme.colors.text.primary};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: ${theme.colors.text.inverse};
            font-weight: bold;
        }
    `,
    sortContainer: css`
        display: flex;
        gap: 0.5rem;
        font-size: 0.875rem;
    `,
    sortButtonBase: css`
        cursor: pointer;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
        user-select: none;
    `,
    sortButtonActive: css`
        background-color: ${theme.colors.accent.primary};
        color: white;
        font-weight: bold;
    `,
    sortButtonInactive: css`
        color: ${theme.colors.text.secondary};
        background-color: transparent;
        &:hover {
            color: ${theme.colors.text.primary};
        }
    `,
    grid: css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 14px;
    `,
    card: css`
        aspect-ratio: 16/9;
        background-color: black;
        cursor: pointer;
        overflow: hidden;
        position: relative;
        border-radius: 4px;
        display: block;
        text-decoration: none;
        color: inherit;
    `,
    empty: css`
        text-align: center;
        color: ${theme.colors.text.secondary};
        margin-top: 5rem;
    `,
    paginationContainer: css`
        display: flex;
        justify-content: flex-start;
        align-items: center;
        gap: 0.5rem;
        margin-top: 2.5rem;
        flex-wrap: wrap;
        font-family: monospace;
        font-size: 1rem;
    `,
    pageButton: css`
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 2.5rem;
        height: 2.5rem;
        padding: 0 0.5rem;
        border-radius: 0.25rem;
        user-select: none;
        cursor: pointer;
        color: ${theme.colors.text.primary};
        &:hover:not(.active):not(.disabled) {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: ${theme.colors.text.inverse};
            font-weight: bold;
            transform: scale(1.05);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        &.disabled {
            color: ${theme.colors.text.secondary};
            cursor: default;
            opacity: 0.4;
        }
    `,
};

export default function ScreenshotGalleryPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const pageParam = parseInt(searchParams.get('page'), 10);
    const currentPage = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
    const sort = searchParams.get('sort') || 'recent';
    const seed = searchParams.get('seed') || '';

    const allowedPerPages = [40, 60, 100];
    const perPageParam = parseInt(searchParams.get('perPage'), 10);
    const defaultPerPage = parseInt(localStorage.getItem('screenshot_perPage'), 10) || 40;
    const itemsPerPage = allowedPerPages.includes(perPageParam)
        ? perPageParam
        : (allowedPerPages.includes(defaultPerPage) ? defaultPerPage : 40);

    const [screenshots, setScreenshots] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);

    // URLの初期パラメータ同期
    useEffect(() => {
        let changed = false;
        const newParams = new URLSearchParams(searchParams);

        if (!newParams.get('page')) {
            newParams.set('page', '1');
            changed = true;
        }
        if (!newParams.get('sort')) {
            newParams.set('sort', 'recent');
            changed = true;
        }
        if (newParams.get('sort') === 'random' && !newParams.get('seed')) {
            newParams.set('seed', Math.floor(Math.random() * 1000000).toString());
            changed = true;
        }
        const currentParamPerPage = parseInt(newParams.get('perPage'), 10);
        if (!allowedPerPages.includes(currentParamPerPage)) {
            newParams.set('perPage', itemsPerPage.toString());
            changed = true;
        }

        if (changed) {
            setSearchParams(newParams, { replace: true });
        }
    }, [searchParams, setSearchParams, itemsPerPage]);

    // perPageがURLパラメータとして有効な場合はlocalStorageにも同期保存
    useEffect(() => {
        if (allowedPerPages.includes(perPageParam)) {
            localStorage.setItem('screenshot_perPage', perPageParam.toString());
        }
    }, [perPageParam]);

    useEffect(() => {
        document.title = 'スクリーンショット';
    }, []);

    const fetchScreenshots = async () => {
        setLoading(true);
        try {
            const params = {
                sort,
                page: currentPage.toString(),
                perPage: itemsPerPage.toString()
            };
            if (sort === 'random' && seed) {
                params.seed = seed;
            }

            const data = await api.getScreenshotGallery(params);
            const items = data.screenshots || (Array.isArray(data) ? data : []);
            const total = typeof data.total === 'number' ? data.total : items.length;

            setScreenshots(items);
            setTotalCount(total);

            // スクロール位置の復元
            const savedScroll = sessionStorage.getItem('screenshotGalleryScroll');
            if (savedScroll) {
                setTimeout(() => {
                    window.scrollTo(0, parseInt(savedScroll, 10));
                    sessionStorage.removeItem('screenshotGalleryScroll');
                }, 50);
            }
        } catch (err) {
            console.error('Failed to fetch screenshots', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScreenshots();
    }, [currentPage, sort, seed, itemsPerPage]);

    const updateParams = (updates, scrollToTop = false) => {
        const next = new URLSearchParams(searchParams);
        for (const [key, val] of Object.entries(updates)) {
            if (val === null || val === undefined) {
                next.delete(key);
            } else {
                next.set(key, val.toString());
            }
        }
        setSearchParams(next);
        if (scrollToTop) {
            window.scrollTo(0, 0);
        }
    };

    const handlePerPageChange = (newPerPage) => {
        localStorage.setItem('screenshot_perPage', newPerPage.toString());
        updateParams({ perPage: newPerPage.toString(), page: '1' }, true);
    };

    const handleSortChange = (newSort) => {
        if (newSort === 'random') {
            const newSeed = Math.floor(Math.random() * 1000000).toString();
            updateParams({ sort: 'random', seed: newSeed, page: '1' }, true);
        } else {
            updateParams({ sort: 'recent', seed: null, page: '1' }, true);
        }
    };

    const totalPages = Math.ceil(totalCount / itemsPerPage);

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > totalPages || newPage === currentPage) return;
        updateParams({ page: newPage.toString() }, true);
    };

    const handleCardClick = (e, shot) => {
        sessionStorage.setItem('screenshotGalleryScroll', window.scrollY.toString());
        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            navigate(`/watch/${shot.video_id}?t=${shot.timestamp}`);
        }
    };

    return (
        <div className={styles.page}>
            <Navbar />

            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        <span className={styles.countNumber}>{totalCount}</span>
                        <span>のスクリーンショット</span>
                    </h1>
                    <div className={styles.headerControls}>
                        <div className={styles.perPageGroup} title="1ページあたりの表示件数">
                            {allowedPerPages.map(cnt => (
                                <div
                                    key={cnt}
                                    onClick={() => handlePerPageChange(cnt)}
                                    className={`${styles.perPageButton} ${itemsPerPage === cnt ? 'active' : ''}`}
                                >
                                    {cnt}
                                </div>
                            ))}
                        </div>
                        <div className={styles.sortContainer}>
                            {[
                                { key: 'recent', label: '最近' },
                                { key: 'random', label: 'ランダム' }
                            ].map(opt => (
                                <div
                                    key={opt.key}
                                    onClick={() => handleSortChange(opt.key)}
                                    className={`${styles.sortButtonBase} ${sort === opt.key ? styles.sortButtonActive : styles.sortButtonInactive}`}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.grid}>
                    {screenshots.map((shot, idx) => (
                        <Link
                            key={`${shot.id}-${idx}`}
                            to={`/watch/${shot.video_id}?t=${shot.timestamp}`}
                            draggable="false"
                            onDragStart={(e) => e.preventDefault()}
                            onClick={(e) => handleCardClick(e, shot)}
                            title={`${shot.path || ''}${shot.display_name ? ' ' + shot.display_name : ''}`}
                            className={styles.card}
                        >
                            {shot.id ? (
                                <img
                                    src={`/api/screenshot/${shot.id}/image`}
                                    alt=""
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain'
                                    }}
                                    loading="lazy"
                                />
                            ) : (
                                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5563', fontSize: '0.75rem' }}>
                                    No Image
                                </div>
                            )}
                        </Link>
                    ))}
                </div>

                {!loading && totalCount === 0 && (
                    <div className={styles.empty}>
                        <p style={{ fontSize: '1.25rem' }}>スクリーンショットはありません</p>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className={styles.paginationContainer}>
                        <div
                            onClick={() => handlePageChange(currentPage - 1)}
                            className={`${styles.pageButton} ${currentPage === 1 ? 'disabled' : ''}`}
                            title="前のページ"
                        >
                            <ChevronLeft size={20} />
                        </div>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                            <div
                                key={p}
                                onClick={() => handlePageChange(p)}
                                className={`${styles.pageButton} ${p === currentPage ? 'active' : ''}`}
                            >
                                {p}
                            </div>
                        ))}

                        <div
                            onClick={() => handlePageChange(currentPage + 1)}
                            className={`${styles.pageButton} ${currentPage >= totalPages ? 'disabled' : ''}`}
                            title="次のページ"
                        >
                            <ChevronRight size={20} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
