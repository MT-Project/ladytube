import { useState, useEffect, useRef } from 'react';
import { css } from '@linaria/core';
import { useUI } from '../contexts/UIContext';
import { api } from '../services/api';
import { theme } from '../theme';

// Linaria styles
// Linaria styles
const styles = {
    overlay: css`
        position: fixed;
        inset: 0;
        z-index: 500;
        display: flex;
        align-items: flex-end;
        justify-content: flex-end;
        background-color: rgba(0,0,0,0.2);
    `,
    dialog: css`
        background-color: ${theme.colors.bg.modal};
        padding: 1rem 1.5rem 1.5rem;
        border-radius: 4px;
        border: 1px solid ${theme.colors.border.primary};
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        max-width: 400px;
        min-width: 200px;
        width: calc(100vw - 4rem);
        margin: 1rem 1rem 6rem;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        pointer-events: auto;
    `,
    title: css`
        font-size: 0.95rem;
        font-weight: 400;
        color: ${theme.colors.text.primary};
        margin-bottom: 1.5rem;
        margin-top: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    `,
    input: css`
        width: 100%;
        padding: 0.5rem;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 2px;
        font-size: 0.875rem;
        box-sizing: border-box;
        outline: none;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
    `,
    textarea: css`
        width: 100%;
        height: 100%;
        min-height: 25vh;
        padding: 0.5rem;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 2px;
        resize: none;
        font-size: 0.8rem;
        box-sizing: border-box;
        outline: none;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
    `,
    tagContainer: css`
        overflow-y: auto;
        flex: 0 1 auto;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        align-content: flex-start;
        margin-bottom: 1rem;
        max-height: 50vh;
        min-height: 25vh;
    `,
    tagItemBase: css`
        padding: 0.25rem 0.75rem;
        border-radius: 0.25rem;
        font-size: 0.75rem;
        cursor: pointer;
        text-align: center;
        user-select: none;
    `,
    tagItemSelected: css`
        border: 1px solid ${theme.colors.accent.primary};
        background-color: ${theme.colors.accent.primary};
        color: white;
    `,
    tagItemUnselected: css`
        border: 1px solid ${theme.colors.border.primary};
        background-color: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        &:hover {
            border-color: ${theme.colors.accent.primary};
        }
    `,
    actionsContainer: css`
        display: flex;
        gap: 0.5rem;
        justify-content: space-between;
    `,
    buttonBase: css`
        padding: 0.2rem 1rem;
        border-radius: 2px;
        cursor: pointer;
        border: 1px solid ${theme.colors.border.primary};
    `,
    cancelButton: css`
        background-color: transparent;
        color: ${theme.colors.text.primary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    editTagButton: css`
        background-color: transparent;
        color: ${theme.colors.text.primary};
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
    `,
    editTagActive: css`
        background-color: ${theme.colors.accent.primary};
        color: white;
    `,
    saveButton: css`
        padding: 0.2rem 1.5rem;
        background-color: ${theme.colors.accent.primary};
        color: white;
        border: none;
        font-weight: bold;
        &:hover:not(:disabled) {
            background-color: ${theme.colors.accent.hover};
        }
        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    `,
    fieldWrapper: css`
        margin-bottom: 1rem;
    `,
    buttonGroup: css`
        display: flex;
        gap: 0.5rem;
    `,
};

export default function VideoInfoEditDialog({ video, isOpen, onClose, onUpdate }) {
    const { showToast } = useUI();
    const [knownTags, setKnownTags] = useState([]);
    const [editingTags, setEditingTags] = useState([]);
    const [editingDisplayName, setEditingDisplayName] = useState('');
    const [isEditingPresetTags, setIsEditingPresetTags] = useState(false);
    const [presetTagsText, setPresetTagsText] = useState('');
    const displayNameRef = useRef(null);

    useEffect(() => {
        if (isOpen && video) {
            const currentTags = video.tags ? video.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
            setEditingTags(currentTags);
            setEditingDisplayName(video.display_name || '');
            setIsEditingPresetTags(false);

            api.getTags().then(setKnownTags);

            setTimeout(() => {
                if (displayNameRef.current) {
                    displayNameRef.current.focus();
                }
            }, 50);
        }
    }, [isOpen, video]);

    if (!isOpen || !video) return null;

    const handleToggleTag = (tagName) => {
        setEditingTags(prev => {
            if (prev.includes(tagName)) {
                return prev.filter(t => t !== tagName);
            } else {
                return [...prev, tagName];
            }
        });
    };

    const handleTogglePresetTagEdit = () => {
        if (!isEditingPresetTags) {
            const tagsText = knownTags.map(t => t.name).join('\n');
            setPresetTagsText(tagsText);
            setIsEditingPresetTags(true);
        }
    };

    const handleSavePresetTags = async () => {
        try {
            const tagsArray = presetTagsText.split('\n').filter(t => t.trim()).map(t => t.trim());
            await api.bulkUpdateTags(tagsArray);
            const updatedTags = await api.getTags();
            setKnownTags(updatedTags);
            setIsEditingPresetTags(false);
            showToast('タグを保存しました', 'success');
        } catch (e) {
            showToast('タグの保存に失敗しました: ' + e.message, 'error');
        }
    };

    const handleSaveEdits = async () => {
        try {
            const currentTags = video.tags ? video.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
            const tagsToAdd = editingTags.filter(t => !currentTags.includes(t));
            const tagsToRemove = currentTags.filter(t => !editingTags.includes(t));

            for (const tag of tagsToRemove) {
                await api.removeTag(video.id, tag);
            }

            for (const tag of tagsToAdd) {
                await api.addTag(video.id, tag);
            }

            await api.updateDisplayName(video.id, editingDisplayName);

            if (onUpdate) {
                onUpdate({
                    ...video,
                    tags: editingTags.length > 0 ? editingTags.join('\n') : '',
                    display_name: editingDisplayName
                });
            }
            onClose();
            showToast('タグを保存しました', 'success');
        } catch (e) {
            console.error(e);
            showToast('タグの保存に失敗しました: ' + e.message, 'error');
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.dialog} onClick={e => e.stopPropagation()}>
                {/* Title */}
                <h3 className={styles.title}>
                    タグ
                </h3>

                {/* Display Name Section */}
                <div className={styles.fieldWrapper}>
                    <input
                        ref={displayNameRef}
                        type="text"
                        value={editingDisplayName}
                        onChange={(e) => setEditingDisplayName(e.target.value)}
                        className={styles.input}
                        placeholder="追加の名前..."
                    />
                </div>

                {/* Tag Selection Section */}
                <div className={styles.tagContainer}>
                    {isEditingPresetTags ? (
                        <textarea
                            value={presetTagsText}
                            onChange={(e) => setPresetTagsText(e.target.value)}
                            className={styles.textarea}
                            placeholder="タグを1行に1つずつ入力..."
                        />
                    ) : (
                        <>
                            {(() => {
                                const currentTags = video.tags ? video.tags.split('\n').map(t => t.trim()).filter(t => t.length > 0) : [];
                                const allTagNames = new Set([...knownTags.map(t => t.name), ...currentTags]);
                                return Array.from(allTagNames).map((tagName, i) => {
                                    const isSelected = editingTags.includes(tagName);
                                    return (
                                        <div
                                            key={i}
                                            onClick={() => handleToggleTag(tagName)}
                                            role="button"
                                            className={`${styles.tagItemBase} ${isSelected ? styles.tagItemSelected : styles.tagItemUnselected}`}
                                        >
                                            {tagName}
                                        </div>
                                    );
                                });
                            })()}
                        </>
                    )}
                </div>

                <div className={styles.actionsContainer}>
                    <div className={styles.buttonGroup}>
                        <button
                            onClick={isEditingPresetTags ? handleSavePresetTags : handleTogglePresetTagEdit}
                            className={`${styles.buttonBase} ${isEditingPresetTags ? styles.editTagActive : styles.editTagButton}`}
                        >
                            {isEditingPresetTags ? 'タグ保存' : 'タグ編集...'}
                        </button>
                    </div>

                    <div className={styles.buttonGroup}>
                        <button onClick={onClose} className={`${styles.buttonBase} ${styles.cancelButton}`}>
                            キャンセル
                        </button>
                        <button
                            onClick={handleSaveEdits}
                            className={`${styles.buttonBase} ${styles.saveButton}`}
                            disabled={isEditingPresetTags}
                        >
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
