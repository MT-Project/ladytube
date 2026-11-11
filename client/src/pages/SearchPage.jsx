import { useState, useEffect, useRef, useMemo } from 'react';
import { useUI } from '../contexts/UIContext';
import { api } from '../services/api';
import { css } from '@linaria/core';
import VideoList from '../components/VideoList';
import Navbar from '../components/Navbar';
import LoadingDots from '../components/LoadingDots';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { LayoutGrid, Grid, Square, List as ListIcon, ChevronLeft, ChevronRight, MonitorCog, RectangleHorizontal, Folder, Layers } from 'lucide-react';
import { theme } from '../theme';
import { removeExtension } from '../utils/formatters';

// Linaria styles
const styles = {
  page: css`
        padding-top: 4rem;
        padding-bottom: 4rem;
        min-height: 100vh;
        box-sizing: border-box;
        background-color: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        position: relative;
    `,
  listLoadingContainer: css`
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4rem 0;
    `,
  content: css`
        margin: 0 auto;
        padding: 0 1.4rem;
    `,
  statusBar: css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
        width: 100%;
    `,
  statusRow: css`
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
    `,
  countDisplay: css`
        font-size: 0.875rem;
        font-weight: 500;
        color: ${theme.colors.text.secondary};
        display: flex;
        align-items: center;
        white-space: nowrap;
    `,
  countNumber: css`
        color: ${theme.colors.text.primary};
        font-size: 1.125rem;
        font-weight: bold;
        margin-right: 0.25rem;
    `,
  controlsRow: css`
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `,
  controlGroup: css`
        display: flex;
        align-items: center;
        gap: 0.25rem;
        background-color: ${theme.colors.bg.tertiary};
        padding: 0.25rem;
        border-radius: 0.25rem;
        border: 1px solid ${theme.colors.border.primary};
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
  sortContainer: css`
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 2rem;
        font-size: 0.875rem;
    `,
  sortButton: css`
        cursor: pointer;
        padding: 0.375rem 0.75rem;
        border-radius: 0.25rem;
        user-select: none;
        color: ${theme.colors.text.secondary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: white;
            font-weight: bold;
        }
    `,
  paginationContainer: css`
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 0.5rem;
        margin-top: 4rem;
        margin-bottom: 5rem;
        font-family: monospace;
        font-size: 1rem;
    `,
  pageButton: css`
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.25rem;
        user-select: none;
        cursor: pointer;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: ${theme.colors.text.inverse};
            font-weight: bold;
            transform: scale(1.1);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
    `,
  viewModeButton: css`
        padding: 0.375rem;
        border-radius: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: ${theme.colors.text.secondary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: ${theme.colors.text.inverse};
            font-weight: bold;
        }
    `,
  perPageButton: css`
        padding: 0.4rem 0.5rem;
        border-radius: 0.25rem;
        cursor: pointer;
        user-select: none;
        color: ${theme.colors.text.secondary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &.active {
            background-color: ${theme.colors.accent.primary};
            color: ${theme.colors.text.inverse};
            font-weight: bold;
        }
    `,
  showThumbnailButton: css`
        padding: 0.375rem;
        border-radius: 0.25rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: ${theme.colors.text.secondary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
  loadingContainer: css`
        text-align: center;
    `,
  loadingText: css`
        color: #9ca3af;
        font-size: 0.875rem;
    `,
  listContainer: css`
        width: 100%;
    `,
  videoCountBadge: css`
        font-size: 0.75rem;
        margin-right: 0.5rem;
    `,
  loadingDotsLarge: css`
        font-size: 2rem;
        margin-bottom: 1rem;
        justify-content: center;
    `,
  categoryContainer: css`
        margin-bottom: 1.5rem;
        padding: 1.25rem;
        border: 1px solid ${theme.colors.border.primary};
    `,
  breadcrumbList: css`
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
    `,
  breadcrumbItem: css`
        cursor: pointer;
        color: ${theme.colors.text.secondary};
        &:hover {
            color: ${theme.colors.accent.primary};
            text-decoration: underline;
        }
        &.active {
            cursor: default;
            color: ${theme.colors.text.primary};
            font-weight: 500;
            &:hover {
                text-decoration: none;
            }
        }
    `,
  breadcrumbSeparator: css`
        color: #6b7280;
        user-select: none;
    `,
  folderGrid: css`
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 0.75rem;
        margin-top: 1rem;
    `,
  folderCard: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.6rem 0.85rem;
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.375rem;
        cursor: pointer;
        text-decoration: none;
        color: ${theme.colors.text.primary};
        user-select: none;
    `,
  folderInfo: css`
        display: flex;
        align-items: center;
        gap: 0.5rem;
        overflow: hidden;
        min-width: 0;
    `,
  folderIcon: css`
        color: ${theme.colors.accent.primary};
        flex-shrink: 0;
    `,
  folderName: css`
        font-size: 0.8rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `,
  folderCount: css`
        font-size: 0.8rem;
        font-family: monospace;
        color: ${theme.colors.text.secondary};
        margin-left: 0.75rem;
        flex-shrink: 0;
    `,
  categoryEmpty: css`
        display: none;
    `,
};

function buildBreadcrumbs(categoryPath, scanFolders) {
  if (!categoryPath) return [];
  if (categoryPath === 'root') {
    return [{ label: 'カテゴリー', path: 'root', isCurrent: true }];
  }

  const breadcrumbs = [{ label: 'カテゴリー', path: 'root', isCurrent: false }];

  // パスの正規化（セパレータを統一）
  const normalizedCurrent = categoryPath.replace(/\\/g, '/').replace(/\/+$/, '');

  // 一致するスキャンフォルダを検索
  let matchingScanFolder = null;
  let matchingScanFolderNormalized = '';

  for (const sf of scanFolders) {
    const normSf = sf.replace(/\\/g, '/').replace(/\/+$/, '');
    if (normalizedCurrent === normSf || normalizedCurrent.startsWith(normSf + '/')) {
      matchingScanFolder = sf;
      matchingScanFolderNormalized = normSf;
      break;
    }
  }

  const getFolderDisplayName = (p) => {
    const parts = p.split('/').filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : p;
  };

  if (matchingScanFolder) {
    const sfDisplayName = getFolderDisplayName(matchingScanFolderNormalized);
    const isExactMatch = normalizedCurrent === matchingScanFolderNormalized;

    breadcrumbs.push({
      label: sfDisplayName,
      path: matchingScanFolder,
      isCurrent: isExactMatch
    });

    if (!isExactMatch) {
      const relPath = normalizedCurrent.substring(matchingScanFolderNormalized.length + 1);
      const segments = relPath.split('/').filter(Boolean);
      let cumulative = matchingScanFolderNormalized;

      segments.forEach((seg, idx) => {
        cumulative += '/' + seg;
        const fullPath = categoryPath.includes('\\') ? cumulative.replace(/\//g, '\\') : cumulative;
        const isLast = idx === segments.length - 1;
        breadcrumbs.push({
          label: seg,
          path: fullPath,
          isCurrent: isLast
        });
      });
    }
  } else {
    const segments = normalizedCurrent.split('/').filter(Boolean);
    let cumulative = '';
    segments.forEach((seg, idx) => {
      cumulative = cumulative ? cumulative + '/' + seg : seg;
      const fullPath = categoryPath.includes('\\') ? cumulative.replace(/\//g, '\\') : cumulative;
      const isLast = idx === segments.length - 1;
      breadcrumbs.push({
        label: seg,
        path: fullPath,
        isCurrent: isLast
      });
    });
  }

  return breadcrumbs;
}

function getSubfolderDisplayName(subfolderPath) {
  if (!subfolderPath) return '';
  const normalized = subfolderPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : subfolderPath;
}

export default function SearchPage() {
  const { showToast, showThumbnailButton, setIsDisplaySettingsOpen } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showDelayedLoading, setShowDelayedLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // LadyTube: 同じ品番の動画を1枚にまとめる (既定はまとめる。キーは v2.x の拡張機能から引き継いだもの)
  const [groupByModel, setGroupByModel] = useState(() => localStorage.getItem('wlext_group_model') !== '0');

  const q = searchParams.get('q') || '';
  const sortBy = searchParams.get('sort') || 'updated_desc';
  const currentPage = parseInt(searchParams.get('page')) || 1;
  const itemsPerPage = parseInt(searchParams.get('perPage')) || 20;
  const seed = searchParams.get('seed') || '';
  const categoryPath = searchParams.get('path') || '';

  // カテゴリー機能の状態
  const [subFolders, setSubFolders] = useState([]);
  const [scanFolders, setScanFolders] = useState([]);
  const [loadingFolders, setLoadingFolders] = useState(false);

  const isCategoryMode = !!categoryPath;

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('viewMode') || 'grid-lg';
    }
    return 'grid-lg';
  });

  useEffect(() => {
    localStorage.setItem('viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let changed = false;

    const storedSort = localStorage.getItem('search_sort') || 'updated_desc';
    const storedPerPage = localStorage.getItem('search_perPage') || '20';

    const defaultParams = {
      page: '1',
      perPage: storedPerPage,
      sort: storedSort
    };

    for (const [key, value] of Object.entries(defaultParams)) {
      if (!params.get(key)) {
        params.set(key, value);
        changed = true;
      }
    }

    if (params.get('sort') === 'random' && !params.get('seed')) {
      params.set('seed', Math.floor(Math.random() * 1000000).toString());
      changed = true;
    }

    if (changed) {
      setSearchParams(params, { replace: true });
    }
  }, [location.search, setSearchParams]);

  const abortControllerRef = useRef(null);
  const loadingTimerRef = useRef(null);

  const fetchVideos = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentAbort = abortControllerRef.current;

    // 1秒以上の遅延時のみローディングを表示するタイマーをセット
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
    }
    setShowDelayedLoading(false);
    loadingTimerRef.current = setTimeout(() => {
      setShowDelayedLoading(true);
    }, 1000);

    const currentQ = searchParams.get('q') || '';
    const currentSort = searchParams.get('sort') || localStorage.getItem('search_sort') || 'updated_desc';
    const currentPageVal = searchParams.get('page') || '1';
    const currentPerPageVal = searchParams.get('perPage') || localStorage.getItem('search_perPage') || '20';
    const currentSeed = searchParams.get('seed') || '';
    const currentCategoryPath = searchParams.get('path') || '';

    const listParams = {
      q: currentQ,
      sort: currentSort,
      page: currentPageVal,
      perPage: currentPerPageVal
    };
    if (currentSort === 'random' && currentSeed) {
      listParams.seed = currentSeed;
    }
    if (currentCategoryPath && currentCategoryPath !== 'root') {
      listParams.path = currentCategoryPath;
    }

    const countParams = {
      q: currentQ,
      sort: currentSort
    };
    if (currentCategoryPath && currentCategoryPath !== 'root') {
      countParams.path = currentCategoryPath;
    }
    // LadyTube: 同じ品番の動画を1枚にまとめる (表示形式ボタンの右のトグル。toggleGroupByModel が
    // localStorage に書いてからここを呼ぶので、state ではなく localStorage を読む)
    if (localStorage.getItem('wlext_group_model') !== '0') {
      listParams.group = '1';
      countParams.group = '1';
    }

    // 1. リスト取得（最優先）
    api.getVideos(listParams)
      .then(data => {
        if (currentAbort.signal.aborted) return;
        if (loadingTimerRef.current) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setShowDelayedLoading(false);
        setVideos(data.videos || []);

        const savedScroll = sessionStorage.getItem('searchPageScroll');
        if (savedScroll) {
          setTimeout(() => {
            window.scrollTo(0, parseInt(savedScroll));
            sessionStorage.removeItem('searchPageScroll');
          }, 100);
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') {
          console.error("List fetch error:", e);
          showToast(e.message || '検索に失敗しました', 'error');
          setVideos([]);
        }
        if (!currentAbort.signal.aborted) {
          if (loadingTimerRef.current) {
            clearTimeout(loadingTimerRef.current);
            loadingTimerRef.current = null;
          }
          setShowDelayedLoading(false);
        }
      });

    // 2. カウント取得（後から取得・更新）
    api.getVideoCount(countParams)
      .then(data => {
        if (currentAbort.signal.aborted) return;
        setTotalCount(data.totalCount || 0);
      })
      .catch(e => {
        if (e.name !== 'AbortError') {
          console.error("Count fetch error:", e);
        }
      });
  };

  const fetchVideosRef = useRef(fetchVideos);
  useEffect(() => { fetchVideosRef.current = fetchVideos; });

  useEffect(() => {
    fetchVideos();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [searchParams]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchVideosRef.current();
    };
    window.addEventListener('library-updated', handleUpdate);
    return () => {
      window.removeEventListener('library-updated', handleUpdate);
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (q) {
      document.title = `${q} - LadyTube`;
    } else {
      document.title = 'すべての動画 - LadyTube';
    }
  }, [q]);

  // スキャンフォルダーを取得（パンくずリスト生成用）
  useEffect(() => {
    if (!isCategoryMode) return;
    api.getSettings()
      .then(data => setScanFolders(data.scan_folders || []))
      .catch(err => console.error('Failed to fetch scan folders:', err));
  }, [isCategoryMode]);

  // カテゴリーフォルダー一覧を取得
  useEffect(() => {
    if (!isCategoryMode) {
      setSubFolders([]);
      return;
    }
    setLoadingFolders(true);
    api.getFolders(categoryPath)
      .then(data => setSubFolders(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to fetch folders:', err))
      .finally(() => setLoadingFolders(false));
  }, [categoryPath, isCategoryMode]);

  const handleVideoClick = (video) => {
    const videoId = typeof video === 'object' && video !== null ? video.id : video;
    sessionStorage.setItem('searchPageScroll', window.scrollY);
    navigate(`/watch/${videoId}`);
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const currentVideos = videos;

  const updateParams = (updates) => {
    const newParams = {
      q,
      sort: sortBy,
      page: currentPage.toString(),
      perPage: itemsPerPage.toString(),
      seed,
      ...updates
    };
    if (categoryPath) {
      newParams.path = categoryPath;
    }
    if (newParams.sort !== 'random') {
      delete newParams.seed;
    }
    setSearchParams(newParams);
  };

  const handleFolderClick = (folderPath) => {
    const newParams = {
      q,
      sort: sortBy,
      page: '1',
      perPage: itemsPerPage.toString(),
      path: folderPath
    };
    setSearchParams(newParams);
    window.scrollTo(0, 0);
  };

  const handleSort = (sort) => {
    localStorage.setItem('search_sort', sort);
    const updates = { sort, page: '1' };
    if (sort === 'random') {
      updates.seed = Math.floor(Math.random() * 1000000).toString();
    }
    updateParams(updates);
  };

  const toggleGroupByModel = () => {
    const next = !groupByModel;
    localStorage.setItem('wlext_group_model', next ? '1' : '0');
    setGroupByModel(next);
    fetchVideosRef.current();   // 一覧と件数を取り直す
  };

  const handlePerPage = (cnt) => {
    const val = cnt.toString();
    localStorage.setItem('search_perPage', val);
    updateParams({ perPage: val, page: '1' });
  };

  const handlePage = (p) => {
    if (p < 1 || p > totalPages) return;
    updateParams({ page: p.toString() });
    window.scrollTo(0, 0);
  };

  // LadyTube: keys の2つを持つ項目 (表示名・評価・スクショ数) は、押すたびに向きを切り替える (最初は keys[0])。
  // 並べ替えはサーバー (server/ext/db.js の SORT_MAP) が行う
  const sortOptions = [
    { key: 'updated_desc', label: '新しい' },
    { key: 'updated_asc', label: '古い' },
    { key: 'name_asc', label: '名前' },
    { keys: ['ext_displayname_asc', 'ext_displayname_desc'], label: '表示名' },
    { key: 'duration_desc', label: '長さ' },
    { key: 'created_desc', label: '新着' },
    { key: 'history_desc', label: '再生履歴' },
    { key: 'play_count_desc', label: '再生数' },
    { key: 'random', label: 'ランダム' },
    { keys: ['ext_rating_desc', 'ext_rating_asc'], label: '評価' },
    { keys: ['ext_screenshots_desc', 'ext_screenshots_asc'], label: 'スクショ数' },
  ];

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const handleVideoUpdate = (updatedVideo) => {
    setVideos(prev => prev.map(v => v.id === updatedVideo.id ? updatedVideo : v));
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.content}>

        {/* カテゴリーパネル */}
        {isCategoryMode && (() => {
          const breadcrumbs = buildBreadcrumbs(categoryPath, scanFolders);
          return (
            <div className={styles.categoryContainer}>
              {/* パンくずリスト */}
              <div className={styles.breadcrumbList}>
                {breadcrumbs.map((crumb, idx) => (
                  <span key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {idx > 0 && <span className={styles.breadcrumbSeparator}>›</span>}
                    <span
                      className={`${styles.breadcrumbItem} ${crumb.isCurrent ? 'active' : ''}`}
                      onClick={() => !crumb.isCurrent && handleFolderClick(crumb.path)}
                    >
                      {crumb.label}
                    </span>
                  </span>
                ))}
              </div>

              {/* サブフォルダーグリッド */}
              {loadingFolders ? (
                <div style={{ display: 'none', fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>...</div>
              ) : subFolders.length === 0 ? (
                <div className={styles.categoryEmpty}></div>
              ) : (
                <div className={styles.folderGrid}>
                  {subFolders.map((folder) => (
                    <div
                      key={folder.subfolder}
                      className={styles.folderCard}
                      onClick={() => handleFolderClick(folder.subfolder)}
                    >
                      <div className={styles.folderInfo} title={getSubfolderDisplayName(folder.subfolder)}>
                        <span className={styles.folderName}>
                          {getSubfolderDisplayName(folder.subfolder)}
                        </span>
                      </div>
                      <span className={styles.folderCount}>{folder.count.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Status Bar */}
        <div className={styles.statusBar}>
          <div className={styles.statusRow}>
            <div className={styles.countDisplay}>
              <span className={styles.countNumber}>{totalCount}</span>
              <span className={styles.videoCountBadge}>の動画</span>
            </div>

            <div className={styles.controlsRow}>
              {/* View Modes */}
              <div className={styles.controlGroup}>
                {[
                  { id: 'grid-lg', icon: LayoutGrid, title: '大きいグリッド' },
                  { id: 'grid-sm', icon: Grid, title: '小さいグリッド' },
                  { id: 'grid-poster', icon: RectangleHorizontal, title: 'ポスター' },
                  { id: 'list', icon: ListIcon, title: 'リスト' }
                ].map(({ id, icon: Icon, title }) => (
                  <div
                    key={id}
                    onClick={() => setViewMode(id)}
                    className={`${styles.viewModeButton} ${viewMode === id ? 'active' : ''}`}
                    title={title}
                  >
                    <Icon size={20} strokeWidth={2} />
                  </div>
                ))}
              </div>

              {/* LadyTube: 同じ品番の動画をまとめて表示。サムネイル切替 (server/ext/public/covermode.js) は
                  表示形式ボタンの枠の直後に入るので、並びは 表示形式 / サムネイル切替 / これ になる */}
              <div className={`${styles.controlGroup} wlext-groupmode`}>
                <div
                  onClick={toggleGroupByModel}
                  className={`${styles.viewModeButton} ${groupByModel ? 'active' : ''}`}
                  title={groupByModel ? '同じ品番の動画をまとめて表示中（押すと1本ずつ表示）' : '同じ品番の動画をまとめて表示'}
                >
                  <Layers size={20} strokeWidth={2} />
                </div>
              </div>

              {/* Per Page */}
              <div className={styles.perPageGroup} title="1ページあたりの表示件数">
                {[20, 40, 60, 100].map(cnt => (
                  <div
                    key={cnt}
                    onClick={() => handlePerPage(cnt)}
                    className={`${styles.perPageButton} ${itemsPerPage === cnt ? 'active' : ''}`}
                  >
                    {cnt}
                  </div>
                ))}
              </div>

              {/* Display Settings Toggle */}
              <div
                onClick={() => setIsDisplaySettingsOpen(true)}
                className={styles.showThumbnailButton}
                title='表示設定'
              >
                <MonitorCog size={20} />
              </div>
            </div>
          </div>
        </div>

        {/* Sort Links */}
        <div className={styles.sortContainer}>
          {sortOptions.map(opt => {
            const keys = opt.keys || [opt.key];
            const active = keys.includes(sortBy);
            const arrow = opt.keys && active ? (sortBy.endsWith('_asc') ? ' ↑' : ' ↓') : '';
            return (
              <div
                key={keys[0]}
                onClick={() => handleSort(sortBy === keys[0] && keys[1] ? keys[1] : keys[0])}
                className={`${styles.sortButton} ${active ? 'active' : ''}`}
              >
                {opt.label}{arrow}
              </div>
            );
          })}
        </div>

        {/* Video List */}
        <div className={styles.listContainer}>
          {showDelayedLoading ? (
            <div className={styles.listLoadingContainer}>
              <LoadingDots className={styles.loadingDotsLarge} />
              <div className={styles.loadingText}>読み込み中...</div>
            </div>
          ) : (
            <VideoList
              videos={currentVideos}
              onPlay={(video) => handleVideoClick(video.id)}
              viewMode={viewMode}
              onVideoUpdate={handleVideoUpdate}
              showThumbnailButton={showThumbnailButton}
              extMeta
            />
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={styles.paginationContainer}>
            <div
              onClick={() => handlePage(currentPage - 1)}
              className={styles.pageButton}
              style={{
                color: currentPage === 1 ? theme.colors.text.secondary : theme.colors.text.primary,
                cursor: currentPage === 1 ? 'default' : 'pointer'
              }}
            >
              <ChevronLeft size={24} />
            </div>

            {getPageNumbers().map((p, i) => (
              <div
                key={i}
                onClick={() => typeof p === 'number' ? handlePage(p) : null}
                className={`${styles.pageButton} ${p === currentPage ? 'active' : ''}`}
                style={{
                  cursor: p === '...' ? 'default' : 'pointer',
                  color: p === '...' ? theme.colors.text.secondary : undefined
                }}
              >
                {p}
              </div>
            ))}

            <div
              onClick={() => handlePage(currentPage + 1)}
              className={styles.pageButton}
              style={{
                color: currentPage === totalPages ? theme.colors.text.secondary : theme.colors.text.primary,
                cursor: currentPage === totalPages ? 'default' : 'pointer'
              }}
            >
              <ChevronRight size={24} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
