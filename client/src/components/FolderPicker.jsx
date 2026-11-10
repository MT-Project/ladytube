import { useState, useEffect } from 'react';
import { Folder, ArrowUp, X } from 'lucide-react';
import { css } from '@linaria/core';
import { theme } from '../theme';

// Linaria styles
const overlayStyle = css`
    position: fixed;
    inset: 0;
    background-color: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
`;

const dialogStyle = css`
    background-color: ${theme.colors.bg.modal};
    width: 600px;
    max-width: 95%;
    height: 90%;
    max-height: 500px;
    border-radius: 0.25rem;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    overflow: hidden;
`;

const headerStyle = css`
    padding: 0.5rem;
    border-bottom: 1px solid ${theme.colors.border.primary};
    display: flex;
    align-items: center;
    justify-content: space-between;
`;

const headerTitleStyle = css`
    margin: 0;
    font-size: 0.9rem;
    color: ${theme.colors.text.primary};
`;

const closeButtonStyle = css`
    background: none;
    border: none;
    cursor: pointer;
    color: ${theme.colors.text.secondary};
    &:hover {
        color: ${theme.colors.text.primary};
    }
`;

const toolbarStyle = css`
    padding: 0.75rem 1rem;
    border-bottom: 1px solid ${theme.colors.border.primary};
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: ${theme.colors.bg.modal};
`;

const upButtonStyle = css`
    padding: 0.4rem;
    border-radius: 0.25rem;
    color: ${theme.colors.text.primary};
    border: 1px solid ${theme.colors.border.secondary};
    display: flex;
    cursor: pointer;
    align-items: center;
    background-color: ${theme.colors.bg.modal};
    &:hover:not(:disabled) {
        background-color: ${theme.colors.bg.hover};
    }
    &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
`;

const pathDisplayStyle = css`
    flex: 1;
    padding: 0.4rem 0.75rem;
    background-color: ${theme.colors.bg.tertiary};
    border-radius: 0.25rem;
    font-size: 0.9rem;
    color: ${theme.colors.text.primary};
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    border: 1px solid ${theme.colors.border.secondary};
`;

const fileListStyle = css`
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
`;

const fileListInnerStyle = css`
    display: flex;
    flex-direction: column;
`;

const loadingStyle = css`
    display: flex;
    justify-content: center;
    padding: 2rem;
    color: ${theme.colors.text.secondary};
`;

const errorStyle = css`
    text-align: center;
    padding: 2rem;
    color: ${theme.colors.status.error};
    font-size: 0.9rem;
`;

const emptyStyle = css`
    text-align: center;
    padding: 2rem;
    color: ${theme.colors.text.secondary};
    font-size: 0.9rem;
`;

const folderItemStyle = css`
    display: flex;
    align-items: center;
    padding: 0.6rem 1rem;
    cursor: pointer;
    border-radius: 0.375rem;
    gap: 0.5rem;
    &:hover {
        background-color: ${theme.colors.bg.hover};
    }
`;

const folderNameStyle = css`
    font-size: 0.9rem;
    color: ${theme.colors.text.primary};
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const footerStyle = css`
    padding: 0.8rem 1rem;
    border-top: 1px solid ${theme.colors.border.primary};
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
`;

const cancelButtonStyle = css`
    padding: 0.3rem 1rem;
    border-radius: 0.25rem;
    border: 1px solid ${theme.colors.border.secondary};
    background-color: ${theme.colors.bg.primary};
    color: ${theme.colors.text.primary};
    cursor: pointer;
    &:hover {
        background-color: ${theme.colors.bg.hover};
    }
`;

const selectButtonStyle = css`
    padding: 0.3rem 1rem;
    border-radius: 0.25rem;
    border: 1px solid ${theme.colors.border.secondary};
    background-color: ${theme.colors.button.primary.bg};
    color: ${theme.colors.button.primary.text};
    cursor: pointer;
    &:hover:not(:disabled) {
        background-color: ${theme.colors.button.primary.hover};
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
`;

export default function FolderPicker({ isOpen, onClose, onSelect }) {
    const [currentPath, setCurrentPath] = useState('/');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchItems(currentPath);
        }
    }, [isOpen, currentPath]);

    const fetchItems = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const encodedPath = encodeURIComponent(path);
            const res = await fetch(`/api/fs/list?path=${encodedPath}`);
            if (!res.ok) throw new Error('Failed to fetch directory contents');
            const data = await res.json();
            const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
            setItems(sorted);
        } catch (err) {
            console.error(err);
            setError('フォルダー情報の取得に失敗しました');
            setItems([]);
        } finally {
            setLoading(false);
        }
    };

    const handleNavigate = (path) => {
        setCurrentPath(path);
    };

    const handleUp = async () => {
        if (!currentPath || currentPath === '/') return;

        try {
            const res = await fetch(`/api/fs/resolve?base=${encodeURIComponent(currentPath)}&target=..`);
            if (!res.ok) throw new Error('Failed to resolve parent directory');
            const data = await res.json();
            setCurrentPath(data.path);
        } catch (err) {
            console.error(err);
            setError('親フォルダーの取得に失敗しました');
        }
    };

    if (!isOpen) return null;

    return (
        <div className={overlayStyle} onClick={onClose}>
            <div className={dialogStyle} onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className={headerStyle}>
                    <div className={headerTitleStyle}>フォルダー選択</div>
                    <button onClick={onClose} className={closeButtonStyle}>
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar / Current Path */}
                <div className={toolbarStyle}>
                    <button
                        onClick={handleUp}
                        disabled={currentPath === '/'}
                        className={upButtonStyle}
                        title="上へ"
                    >
                        <ArrowUp size={20} />
                    </button>
                    <div className={pathDisplayStyle}>
                        {currentPath || '/'}
                    </div>
                </div>

                {/* File List */}
                <div className={fileListStyle}>
                    {loading ? (
                        <div className={loadingStyle}>読み込み中...</div>
                    ) : error ? (
                        <div className={errorStyle}>{error}</div>
                    ) : (
                        <div className={fileListInnerStyle}>
                            {items.length === 0 ? (
                                <div className={emptyStyle}>フォルダーはありません</div>
                            ) : (
                                items.map((item, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => handleNavigate(item.path)}
                                        className={folderItemStyle}
                                    >
                                        <Folder size={20} fill="#fbbf24" color="#d97706" />
                                        <div className={folderNameStyle}>{item.name}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className={footerStyle}>
                    <button onClick={onClose} className={cancelButtonStyle}>
                        キャンセル
                    </button>
                    <button
                        onClick={() => {
                            if (currentPath && currentPath !== '/') {
                                onSelect(currentPath);
                                onClose();
                            }
                        }}
                        disabled={!currentPath || currentPath === '/'}
                        className={selectButtonStyle}
                    >
                        フォルダーを選択
                    </button>
                </div>
            </div>
        </div>
    );
}
