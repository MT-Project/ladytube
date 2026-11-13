
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Settings, Search, X, Moon, Sun, Home } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { css } from '@linaria/core';
import { api } from '../services/api';
import { theme } from '../theme';
import { useUI } from '../contexts/UIContext';
import { ExtHelpButton, ExtMenuButton } from './ExtNavParts';
import ExtSlot from './ExtSlot';

// Linaria styles
const styles = {
    nav: css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 50;
        border-bottom: 1px solid ${theme.colors.border.primary};
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 1.4rem;
        background-color: ${theme.colors.bg.primary};
        height: 3rem;
    `,
    logoContainer: css`
        display: flex;
        align-items: center;
        flex-shrink: 0;
        width: auto;
        margin-right: 1rem;
    `,
    logoLink: css`
        display: flex;
        align-items: center;
        font-size: 1.25rem;
        letter-spacing: -0.1rem;
        color: ${theme.colors.text.primary};
        font-weight: bold;
        text-decoration: none;
        &:hover {
            color: ${theme.colors.accent.primary};
        }
    `,
    logoText: css`
        display: inline;
        @media (max-width: 600px) {
            display: none;
        }
    `,
    logoHomeIcon: css`
        display: none;
        align-items: center;
        justify-content: center;
        color: ${theme.colors.text.primary};
        &:hover {
            color: ${theme.colors.accent.primary};
        }
        @media (max-width: 600px) {
            display: flex;
        }
    `,
    searchContainer: css`
        display: flex;
        flex: 1;
        justify-content: center;
        height: 2rem;
    `,
    searchWrapper: css`
        display: flex;
        position: relative;
        width: 100%;
        max-width: 400px;
    `,
    input: css`
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        padding: 4px 10px;
        outline: none;
        width: 100%;
        line-height: 1.25rem;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
        &:hover {
            border-color: ${theme.colors.border.focus};
        }
    `,
    inputWithClear: css`
        padding-right: 28px;
    `,
    clearButton: css`
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        color: ${theme.colors.text.secondary};
        display: flex;
        align-items: center;
        &:hover {
            color: ${theme.colors.text.primary};
        }
    `,
    historyDialog: css`
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        margin-top: 4px;
        background-color: ${theme.colors.bg.modal};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 100;
        max-height: 400px;
        overflow-y: auto;
        padding: 8px 0;
    `,
    historySection: css`
        padding: 4px 0;
    `,
    historyHeader: css`
        font-size: 0.75rem;
        color: ${theme.colors.text.secondary};
        padding: 4px 12px;
        font-weight: bold;
    `,
    historyItem: css`
        padding: 6px 16px;
        font-size: 0.875rem;
        cursor: pointer;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    tagSection: css`
        padding: 4px 0;
        border-top: 1px solid ${theme.colors.border.primary};
    `,
    tagSectionFirst: css`
        border-top: none;
    `,
    tagContainer: css`
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 4px 12px;
    `,
    tagItem: css`
        padding: 2px 8px;
        font-size: 0.75rem;
        background-color: ${theme.colors.bg.tertiary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        cursor: pointer;
        &:hover {
            border-color: ${theme.colors.border.focus};
            color: ${theme.colors.accent.primary};
        }
    `,
    actionIcon: css`
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        background-color: transparent;
        color: ${theme.colors.text.primary};
        cursor: pointer;
        border: none;
        padding: 0.25rem;
        &:hover {
            color: ${theme.colors.accent.primary};
        }
        &:active {
            opacity: 0.5;
        }
    `,
    searchIconBtn: css`
        width: 32px;
    `,
    rightActions: css`
        display: flex;
        align-items: center;
        flex-shrink: 0;
        justify-content: flex-end;
        margin-left: 0.25rem;
        gap: 0.7rem;

        @media (max-width: 600px) {
            display: none;
        }
    `,
    settingsLink: css`
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.25rem;
        color: ${theme.colors.text.primary};
        text-decoration: none;
        &:hover {
            color: ${theme.colors.accent.primary};
        }
        &:active {
            opacity: 0.5;
        }
    `,
};


export default function Navbar() {
    const { isDarkMode, toggleTheme } = useUI();

    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    // LadyTube: 管理画面だけは本体の歯車 (管理) のまま。ほかのページでは拡張のメニューに置き換える
    const onSettings = useLocation().pathname === '/settings';

    const initialQuery = searchParams.get('q') || '';
    const [localInput, setLocalInput] = useState(initialQuery);
    const [history, setHistory] = useState([]);
    const [tags, setTags] = useState([]);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        setLocalInput(initialQuery);
    }, [initialQuery]);

    useEffect(() => {
        // Load history from localStorage
        const stored = localStorage.getItem('search_history');
        if (stored) {
            try {
                setHistory(JSON.parse(stored));
            } catch (e) {
                setHistory([]);
            }
        }
        // Load preset tags from API
        api.getTags().then(data => {
            if (Array.isArray(data)) {
                setTags(data.map(t => t.name));
            }
        });
    }, []);

    const saveToHistory = useCallback((query) => {
        if (!query) return;
        // Normalization
        const normalized = query.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
        if (!normalized) return;

        setHistory(prev => {
            const next = [normalized, ...prev.filter(h => h !== normalized)].slice(0, 10);
            localStorage.setItem('search_history', JSON.stringify(next));
            return next;
        });
    }, []);

    const submitSearch = (queryToUse) => {
        const query = (typeof queryToUse === 'string' ? queryToUse : localInput).trim();
        const currentSort = searchParams.get('sort') || localStorage.getItem('search_sort') || 'updated_desc';
        const currentPerPage = searchParams.get('perPage') || localStorage.getItem('search_perPage') || '20';

        if (query) {
            saveToHistory(query);
        }

        navigate(`/search?q=${encodeURIComponent(query)}&sort=${currentSort}&page=1&perPage=${currentPerPage}`);
        setIsFocused(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            submitSearch();
        } else if (e.key === 'Escape') {
            setIsFocused(false);
        }
    };

    return (
        <>
            <nav className={styles.nav}>
                <div className={styles.logoContainer}>
                    <Link to="/" className={styles.logoLink} title="ホーム">
                        <span className={styles.logoText}>
                            {/* LadyTube: ロゴの画像 (明るい表示 / ダークモード。切り替えは index.css の .lt-logo) */}
                            <img src="/Logo-logo.png" alt="LadyTube" className="lt-logo lt-logo-light" />
                            <img src="/Logo-logo-dark.png" alt="LadyTube" className="lt-logo lt-logo-dark" />
                        </span>
                        <span className={styles.logoHomeIcon}>
                            <Home size={20} strokeWidth={1.5} />
                        </span>
                    </Link>
                    {/* LadyTube: 使用中のライブラリ名 (押すと切り替え。ライブラリが2つ以上のときだけ。server/ext/public/library.js) */}
                    <ExtSlot from="libraryPill" />
                </div>

                {/* Center: Search Bar */}
                <div className={styles.searchContainer}>
                    <div className={styles.searchWrapper}>
                        <input
                            id="navi-search"
                            type="text"
                            autoComplete="off"
                            placeholder="動画を検索..."
                            spellCheck="false"
                            className={`${styles.input} ${localInput ? styles.inputWithClear : ''}`}
                            value={localInput}
                            onChange={(e) => setLocalInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => {
                                // Delay hide to allow clicks on dialog
                                setTimeout(() => setIsFocused(false), 200);
                            }}
                        />
                        {localInput && (
                            <div onClick={() => setLocalInput('')} className={styles.clearButton}>
                                <X size={16} />
                            </div>
                        )}

                        {/* Search History Dialog */}
                        {isFocused && (history.length > 0 || tags.length > 0) && (
                            <div className={styles.historyDialog}>
                                {history.length > 0 && (
                                    <div className={styles.historySection}>
                                        <div className={styles.historyHeader}>最近の検索</div>
                                        {history.map((h, i) => (
                                            <div
                                                key={`hist-${i}`}
                                                onClick={() => submitSearch(h)}
                                                className={styles.historyItem}
                                            >
                                                {h}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {tags.length > 0 && (
                                    <div className={`${styles.tagSection} ${history.length === 0 ? styles.tagSectionFirst : ''}`}>
                                        <div className={styles.historyHeader}>タグ</div>
                                        <div className={styles.tagContainer}>
                                            {tags.map((t, i) => (
                                                <div
                                                    key={`tag-${i}`}
                                                    onClick={() => submitSearch(t)}
                                                    className={styles.tagItem}
                                                >
                                                    {t}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div
                        onClick={submitSearch}
                        className={`${styles.actionIcon} ${styles.searchIconBtn}`}
                        title="検索"
                    >
                        <Search size={20} strokeWidth={2} />
                    </div>
                    {/* LadyTube: 検索のヘルプ (？) */}
                    <ExtHelpButton />
                </div>

                {/* LadyTube: メニューを置くときは、狭い画面でも操作欄を出す (womanlive-ext.css の .wlext-actions-force) */}
                <div className={styles.rightActions + (onSettings ? '' : ' wlext-actions-force')}>
                    <button
                        onClick={toggleTheme}
                        className={styles.actionIcon}
                        title="ダークモード切替"
                    >
                        {isDarkMode ? <Moon fill="currentColor" size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
                    </button>
                    {onSettings ? (
                        <Link to="/settings" className={styles.settingsLink} title="管理">
                            <Settings size={20} strokeWidth={1.5} />
                        </Link>
                    ) : <ExtMenuButton />}
                </div>
            </nav>
        </>
    );
}
