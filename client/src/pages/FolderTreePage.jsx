import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@linaria/core';
import { PlusSquare, MinusSquare, Folder, FolderOpen } from 'lucide-react';
import Navbar from '../components/Navbar';
import LoadingDots from '../components/LoadingDots';
import { theme } from '../theme';

// Linaria styles
const styles = {
    page: css`
        min-height: 100vh;
        background-color: ${theme.colors.bg.primary};
        padding-top: 2rem;
    `,
    content: css`
        max-width: 60rem;
        margin: 0 auto;
        padding: 2rem 1rem;
    `,
    title: css`
        font-size: 1rem;
        font-weight: 500;
        color: ${theme.colors.text.primary};
        margin-bottom: 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `,
    treeContainer: css`
        padding: 1.5rem;
        border-radius: 0.5rem;
        border: 1px solid ${theme.colors.border.primary};
    `,
    treeNode: css`
        margin-left: 1.5rem;
    `,
    nodeHeader: css`
        display: flex;
        align-items: center;
        padding: 0.4rem 0.5rem;
        gap: 0.5rem;
        cursor: default;
        border-radius: 0.25rem;
        transition: background-color 0.2s;
    `,
    highlight: css`
        background-color: ${theme.colors.bg.tertiary};
        border: 1px solid ${theme.colors.border.primary};
    `,
    iconButton: css`
        cursor: pointer;
        display: flex;
        align-items: center;
        color: ${theme.colors.text.secondary};
        &:hover {
            color: ${theme.colors.accent.primary};
        }
    `,
    folderName: css`
        cursor: pointer;
        font-size: 0.95rem;
        color: ${theme.colors.text.primary};
        &:hover {
            color: ${theme.colors.accent.primary};
            text-decoration: underline;
        }
    `,
    countText: css`
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
        margin-left: 0.5rem;
    `,
};

function TreeNode({ folder, level = 0 }) {
    const [isExpanded, setIsExpanded] = useState(() => {
        const expanded = sessionStorage.getItem('folder_tree_expanded');
        if (expanded) {
            const pathList = JSON.parse(expanded);
            return pathList.includes(folder.path);
        }
        return false;
    });
    const [children, setChildren] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const nodeRef = useRef(null);

    const toggleExpand = async (e, forceExpand = false) => {
        if (e) e.stopPropagation();

        const newExpandedState = forceExpand ? true : !isExpanded;

        if (newExpandedState && children.length === 0 && folder.hasChildren) {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/folder-tree?parentPath=${encodeURIComponent(folder.path)}`);
                const data = await res.json();
                setChildren(data);
            } catch (err) {
                console.error('Failed to fetch subfolders:', err);
            } finally {
                setIsLoading(false);
            }
        }

        setIsExpanded(newExpandedState);

        // Update sessionStorage
        const expanded = sessionStorage.getItem('folder_tree_expanded');
        let pathList = expanded ? JSON.parse(expanded) : [];
        if (newExpandedState) {
            if (!pathList.includes(folder.path)) pathList.push(folder.path);
        } else {
            pathList = pathList.filter(p => p !== folder.path);
        }
        sessionStorage.setItem('folder_tree_expanded', JSON.stringify(pathList));
    };

    useEffect(() => {
        document.title = 'フォルダーツリー - LadyTube';
        if (isExpanded && children.length === 0 && folder.hasChildren) {
            toggleExpand(null, true);
        }
    }, []);

    useEffect(() => {
        const lastClicked = sessionStorage.getItem('folder_tree_last_clicked');
        if (lastClicked === folder.path && nodeRef.current) {
            nodeRef.current.scrollIntoView({ behavior: 'instant', block: 'center' });
            // Optional: clear it after scroll if we only want it once on "back"
            // But usually, it's fine to keep it for the session.
        }
    }, [isExpanded, children]); // Check after expanded and children loaded

    const handleFolderClick = () => {
        sessionStorage.setItem('folder_tree_last_clicked', folder.path);
        navigate(`/search?q="${encodeURIComponent(folder.path)}"`);
    };

    const isLastClicked = sessionStorage.getItem('folder_tree_last_clicked') === folder.path;

    return (
        <div ref={nodeRef} className={level === 0 ? '' : styles.treeNode}>
            <div className={`${styles.nodeHeader} ${isLastClicked ? styles.highlight : ''}`}>
                {folder.hasChildren ? (
                    <div className={styles.iconButton} onClick={(e) => toggleExpand(e)}>
                        {isExpanded ? <MinusSquare size={16} /> : <PlusSquare size={16} />}
                    </div>
                ) : (
                    <div style={{ width: 16 }}></div>
                )}

                {isExpanded ? (
                    <FolderOpen size={18} color={theme.colors.accent.primary} />
                ) : (
                    <Folder size={18} color={theme.colors.text.secondary} />
                )}

                <span className={styles.folderName} onClick={handleFolderClick}>
                    {folder.name}
                </span>
                <span className={styles.countText}>({folder.count})</span>
                {isLoading && <LoadingDots size="small" />}
            </div>

            {isExpanded && (
                <div>
                    {children.map(child => (
                        <TreeNode key={child.path} folder={child} level={level + 1} />
                    ))}
                    {children.length === 0 && !isLoading && folder.hasChildren && (
                        <div style={{ paddingLeft: '2rem', fontSize: '0.8rem', color: theme.colors.text.secondary }}>
                            読み込み中...
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function FolderTreePage() {
    const [rootFolders, setRootFolders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/folder-tree')
            .then(res => res.json())
            .then(data => {
                setRootFolders(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch root folders:', err);
                setIsLoading(false);
            });
    }, []);

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                <h1 className={styles.title}><Folder size={20} /> フォルダーツリー</h1>

                {isLoading ? (
                    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <LoadingDots />
                    </div>
                ) : (
                    <div className={styles.treeContainer}>
                        {rootFolders.length > 0 ? (
                            rootFolders.map(folder => (
                                <TreeNode key={folder.path} folder={folder} />
                            ))
                        ) : (
                            <div style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
                                設定されたスキャンフォルダーが見つかりません。
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
