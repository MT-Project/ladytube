import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@linaria/core';
import { ChevronLeft, RefreshCw, Square, Folder, Wrench, FolderPlus, Tag, Globe } from 'lucide-react';
import { useUI } from '../contexts/UIContext';
import { api } from '../services/api';
import { theme } from '../theme';
import FolderPicker from '../components/FolderPicker';
import { ExtSettingsSection, ExtMetaReplace } from '../components/ExtSettingsParts';

// LadyTube: 本体の「タグ置換」は描かず、拡張の「メタデータ置換」(タグも置換できる) を代わりに置く
const SHOW_HOST_TAG_RENAME = false;

// Linaria styles
// Linaria styles
const styles = {
    page: css`
        min-height: 100vh;
    `,
    navBar: css`
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3rem;
        background-color: ${theme.colors.bg.secondary};
        border-bottom: 1px solid ${theme.colors.border.primary};
        display: flex;
        align-items: center;
        padding: 0 1.5rem;
        z-index: 1000;
    `,
    backButton: css`
        margin-right: 1rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: ${theme.colors.text.secondary};
        &:hover {
            color: ${theme.colors.text.primary};
        }
    `,
    container: css`
        max-width: 640px;
        margin: 0 auto;
        padding: 4rem 1.5rem 2rem;
        color: ${theme.colors.text.primary};
    `,
    section: css`
        margin-bottom: 1.5rem;
        padding: 0 1.5rem 1.5rem 1.5rem;
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 5px;
        background-color: ${theme.colors.bg.primary};
    `,
    sectionTitle: css`
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 1rem;
        color: ${theme.colors.text.primary};    
        display: flex;
        align-items: center;
    `,
    box: css`
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    `,
    textareaBase: css`
        width: 100%;
        height: 80px;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.9rem;
        line-height: 1.5;
        resize: vertical;
        outline: none;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
    `,
    input: css`
        width: 100%;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.9rem;
        line-height: 1.5;
        outline: none;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
    `,
    ignoreTextarea: css`
        width: 100%;
        height: 4rem;
        background-color: ${theme.colors.bg.input};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.primary};
        border-radius: 0.25rem;
        padding: 0.4rem 0.6rem;
        font-size: 0.9rem;
        line-height: 1.5;
        resize: vertical;
        outline: none;
        &:focus {
            border-color: ${theme.colors.border.focus};
            box-shadow: 0 0 0 2px ${theme.colors.accent.light};
        }
    `,
    buttonGroup: css`
        display: flex;
        gap: 0.75rem;
    `,
    actionButton: css`
        padding: 0.3rem 1.2rem;
        font-size: 0.85rem;
        cursor: pointer;
        background-color: ${theme.colors.bg.primary};
        color: ${theme.colors.text.primary};
        border: 1px solid ${theme.colors.border.secondary};
        border-radius: 0.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        user-select: none;
        font-weight: normal;
        min-width: 60px;
        &:hover {
            background-color: ${theme.colors.bg.hover};
        }
        &:disabled {
            cursor: not-allowed;
            background-color: ${theme.colors.bg.tertiary};
            color: ${theme.colors.text.secondary};
        }
    `,
    primaryButton: css`
        padding: 0.3rem 1.2rem;
        font-size: 0.85rem;
        cursor: pointer;
        background-color: ${theme.colors.accent.primary};
        color: white;
        border: 1px solid ${theme.colors.border.secondary};
        border-radius: 0.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        user-select: none;
        font-weight: normal;
        min-width: 60px;
        &:hover {
            background-color: ${theme.colors.accent.hover};
        }
    `,
    stopButton: css`
        padding: 0.3rem 1.2rem;
        font-size: 0.85rem;
        cursor: pointer;
        background-color: ${theme.colors.status.error};
        color: white;
        border: 1px solid ${theme.colors.border.secondary};
        border-radius: 0.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        user-select: none;
        font-weight: normal;
        min-width: 60px;
    `,
    progressText: css`
        font-size: 0.9rem;
        color: ${theme.colors.text.secondary};
        font-weight: normal;
        margin-left: 0.5rem;
    `,
    navTitle: css`
        font-size: 1.1rem;
        font-weight: bold;
        margin: 0;
        color: ${theme.colors.text.primary};
    `,
    sectionHeaderIcon: css`
        margin-right: 0.5rem;
        vertical-align: middle;
    `,
    formGroup: css`
        margin-bottom: 1rem;
    `,
    labelWrapper: css`
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
    `,
    labelText: css`
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
    `,
    extensionLabel: css`
        display: block;
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
        margin-bottom: 0.5rem;
    `,
    ignoreLabel: css`
        display: block;
        font-size: 0.85rem;
        color: ${theme.colors.text.secondary};
        margin-bottom: 0.5rem;
    `,
    ignoreHint: css`
        font-size: 0.8rem;
    `,
    checkboxContainer: css`
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.5rem;
    `,
    checkboxInput: css`
        cursor: pointer;
        accent-color: ${theme.colors.accent.primary};
        width: 16px;
        height: 16px;
    `,
    checkboxLabel: css`
        font-size: 0.85rem;
        cursor: pointer;
        user-select: none;
        color: ${theme.colors.text.secondary};
    `,
    tagRenameDescription: css`
        font-size: 0.85rem;
        margin-top: 0;
        margin-bottom: 1rem;
        color: ${theme.colors.text.secondary};
    `,
    tagRenameInputWrapper: css`
        margin-bottom: 0.5rem;
    `,
    maintenanceDescription: css`
        font-size: 0.85rem;
        margin-top: 0;
        margin-bottom: 0.25rem;
        color: ${theme.colors.text.secondary};
    `,
    switchContainer: css`
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0;
    `,
    switchBase: css`
        position: relative;
        display: inline-block;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
    `,
    switchInput: css`
        opacity: 0;
        width: 0;
        height: 0;
        &:checked + span {
            background-color: ${theme.colors.accent.primary};
        }
        &:focus + span {
            box-shadow: 0 0 1px ${theme.colors.accent.primary};
        }
        &:checked + span:before {
            transform: translateX(20px);
        }
    `,
    switchSlider: css`
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: ${theme.colors.bg.tertiary};
        transition: .3s;
        border-radius: 24px;
        &:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
    `,
};

export default function SettingsPage() {
    const { showToast, confirm } = useUI();
    const navigate = useNavigate();
    const [folderText, setFolderText] = useState('');
    const [extensionText, setExtensionText] = useState('');
    const [ignoreText, setIgnoreText] = useState('');
    const [scanning, setScanning] = useState(false);
    const [repairMode, setRepairMode] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [beforeTag, setBeforeTag] = useState('');
    const [afterTag, setAfterTag] = useState('');
    const [isRenaming, setIsRenaming] = useState(false);
    const [scanProgress, setScanProgress] = useState(null);
    const [allowPublic, setAllowPublic] = useState(false);
    const abortControllerRef = useRef(null);
    const progressTimerRef = useRef(null);

    const isTagRenameDisabled = () => !beforeTag.trim() || !afterTag.trim() || isRenaming;

    useEffect(() => {
        document.title = '管理 - LadyTube';
        fetchSettings();

        // Check if scan is already running (e.g. page reload)
        checkScanStatus();

        return () => {
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        };
    }, []);

    const checkScanStatus = async () => {
        try {
            const data = await api.getScanProgress();
            if (data.isScanning) {
                setScanning(true);
                setScanProgress(data);
                startPolling();
            }
        } catch (e) {
            console.error('Failed to check scan status', e);
        }
    };

    const startPolling = () => {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        progressTimerRef.current = setInterval(async () => {
            try {
                const data = await api.getScanProgress();
                setScanProgress(data);
                if (!data.isScanning) {
                    setScanning(false);
                    setScanProgress(null);
                    clearInterval(progressTimerRef.current);
                }
            } catch (e) {
                console.error('Polling error:', e);
            }
        }, 3000);
    };

    const fetchSettings = async () => {
        try {
            const data = await api.getSettings();
            if (data.scan_folders) {
                setFolderText(data.scan_folders.join('\n'));
            }
            if (data.video_extensions) {
                setExtensionText(data.video_extensions.join(','));
            }
            if (data.ignore_patterns) {
                setIgnoreText(data.ignore_patterns.join('\n'));
            }
            if (data.allow_public !== undefined) {
                setAllowPublic(data.allow_public);
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
            showToast(e.message || '設定の読み込みに失敗しました', 'error');
        }
    };

    const saveScanSettings = async () => {
        const folders = folderText.split('\n').map(f => f.trim()).filter(f => f);
        const extensions = extensionText.split(',').map(e => e.trim().startsWith('.') ? e.trim() : '.' + e.trim()).filter(e => e !== '.');
        const ignores = ignoreText.split('\n').map(i => i.trim()).filter(i => i);

        try {
            await api.updateScanSettings({
                scan_folders: folders,
                video_extensions: extensions,
                ignore_patterns: ignores
            });
            showToast('設定を保存しました', 'success');
            return true;
        } catch (e) {
            showToast(e.message || '保存に失敗しました', 'error');
            return false;
        }
    };

    const handleScan = async () => {
        if (scanning) {
            try {
                await api.cancelScan();
                // スキャン中止時は、スキャン実行中のループがエラー(499)で終了し、そこでメッセージが表示されるためここでは表示しない
            } catch (e) {
                showToast('スキャン中止エラー: ' + e.message, 'error');
            }
            return;
        }

        const saved = await saveScanSettings();
        if (!saved) return;

        setScanning(true);
        abortControllerRef.current = new AbortController();

        try {
            startPolling();
            await api.scan(repairMode, abortControllerRef.current.signal);
            showToast('スキャンが完了しました', 'success');
        } catch (e) {
            if (e.name === 'AbortError' || e.message === 'Cancelled' || e.status === 499) {
                showToast('スキャンを中止しました', 'info');
            } else {
                showToast('スキャンエラー: ' + e.message, 'error');
            }
        } finally {
            setScanning(false);
            setScanProgress(null);
            if (progressTimerRef.current) {
                clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
            }
            abortControllerRef.current = null;
        }
    };

    const handleCleanup = async () => {
        try {
            const countData = await api.getUnreferencedMetadataCount();
            const count = countData.count || 0;

            if (count === 0) {
                showToast('削除可能なメタデータはありません', 'info');
                return;
            }

            const isConfirmed = await confirm(
                `${count} 件の利用されていないメタデータと関連するスクリーンショットを削除しますか？\n（動画ファイルが見つからないメタデータがDBから削除されます）`,
                { title: 'クリーンアップ確認', confirmLabel: '削除' }
            );

            if (!isConfirmed) return;

            const data = await api.cleanupMetadata();
            showToast(`${data.count} 件のメタデータを削除しました`, 'success');
        } catch (e) {
            showToast(e.message || 'クリーンアップに失敗しました', 'error');
        }
    };

    const handleRenameTag = async () => {
        if (!beforeTag.trim() || !afterTag.trim()) return;

        const isConfirmed = await confirm(
            `置換すると元に戻せません。置換していいですか？\n${beforeTag} --> ${afterTag}`,
            { title: 'タグ置換', confirmLabel: '置換' }
        );

        if (!isConfirmed) return;

        setIsRenaming(true);
        try {
            const result = await api.renameTag(beforeTag.trim(), afterTag.trim());
            showToast(`${result.changes} 件の動画のタグを置換しました`, 'success');
            setBeforeTag('');
            setAfterTag('');
        } catch (e) {
            showToast('タグの置換に失敗しました: ' + e.message, 'error');
        } finally {
            setIsRenaming(false);
        }
    };

    const handleFolderSelect = (path) => {
        setFolderText(prev => {
            const trimmed = prev.trim();
            return trimmed ? trimmed + '\n' + path : path;
        });
    };

    const toggleNetworkAccess = async (enabled) => {
        setAllowPublic(enabled);
        try {
            await api.updateNetworkSettings({
                allow_public: enabled
            });
            showToast('設定を保存しました', 'success');
            await confirm('この設定を反映するにはLadyTubeを再起動してください', {
                title: 'ネットワーク設定',
                hideCancel: true
            });
        } catch (e) {
            showToast(e.message || '保存に失敗しました', 'error');
            // Revert state on failure
            setAllowPublic(!enabled);
        }
    };

    return (
        <div className={styles.page}>
            {/* Fixed Navigation Bar */}
            <div className={styles.navBar}>
                <div onClick={() => navigate(-1)} className={styles.backButton}>
                    <ChevronLeft size={24} />
                </div>
                <h1 className={styles.navTitle}>管理</h1>
            </div>

            <div className={styles.container}>
                {/* LadyTube: 項目の並びは管理画面の右のメニュー (settingsnav.js の ORDER) と同じ。拡張の項目は ExtSettingsParts.jsx */}
                {/* ライブラリ: スキャン対象フォルダもライブラリごとなので、その上 */}
                <ExtSettingsSection name="library" />
                {/* Scan Section */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <RefreshCw size={18} className={styles.sectionHeaderIcon} />
                        スキャン
                    </h2>
                    <div className={styles.box}>
                        <div className={styles.formGroup}>
                            <div className={styles.labelWrapper}>
                                <div className={styles.labelText}>
                                    動画のフォルダー (改行区切り)
                                </div>
                            </div>
                            <textarea
                                id="scan-folders"
                                name="scan_folders"
                                className={styles.textareaBase}
                                value={folderText}
                                onChange={(e) => setFolderText(e.target.value)}
                                placeholder="(例) C:\Videos"
                            />
                            <button onClick={() => setShowPicker(true)} className={styles.actionButton} style={{ marginTop: '0.4rem' }}>
                                参照...
                            </button>
                        </div>

                        <div className={styles.formGroup}>
                            <div className={styles.extensionLabel}>
                                動画の拡張子 (コンマ区切り)
                            </div>
                            <input
                                id="video-extensions"
                                name="video_extensions"
                                type="text"
                                spellCheck="false"
                                className={styles.input}
                                value={extensionText}
                                onChange={(e) => setExtensionText(e.target.value)}
                                placeholder="(例) .mp4, .mkv, .avi"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <div className={styles.ignoreLabel}>
                                除外設定 (改行区切り)
                                <br />
                                <span className={styles.ignoreHint}>パスに文字列が含まれる場合に除外します。スペース区切りでAND。</span>
                            </div>
                            <textarea
                                id="ignore-patterns"
                                name="ignore_patterns"
                                className={styles.ignoreTextarea}
                                value={ignoreText}
                                onChange={(e) => setIgnoreText(e.target.value)}
                                placeholder="(例) AAA BBB"
                            />
                        </div>

                        <div className={styles.checkboxContainer}>
                            <input
                                type="checkbox"
                                id="repair-mode"
                                checked={repairMode}
                                onChange={(e) => setRepairMode(e.target.checked)}
                                className={styles.checkboxInput}
                            />
                            <label
                                htmlFor="repair-mode"
                                className={styles.checkboxLabel}
                            >
                                修復スキャン (不足しているメタデータを再取得する)
                            </label>
                        </div>

                        <div className={styles.buttonGroup}>
                            <button onClick={saveScanSettings} className={styles.actionButton}>設定を保存</button>
                            <div>
                                <button onClick={handleScan} className={scanning ? styles.stopButton : styles.primaryButton}>
                                    {scanning ? 'スキャン中止' : 'スキャン開始'}
                                </button>
                                {scanning && scanProgress && scanProgress.total > 0 && (
                                    <span className={styles.progressText}>
                                        {`${Math.floor((scanProgress.processed / scanProgress.total) * 100)}% (${scanProgress.processed} / ${scanProgress.total})`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <ExtSettingsSection name="cover" />
                <ExtSettingsSection name="related" />
                <ExtSettingsSection name="tagRule" />

                {/* Tag Rename Section (LadyTube: 描かない。下の「メタデータ置換」が代わる) */}
                {SHOW_HOST_TAG_RENAME && <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Tag size={18} className={styles.sectionHeaderIcon} />
                        タグ置換
                    </h2>
                    <div className={styles.box}>
                        <p className={styles.tagRenameDescription}>
                            すでに設置済みのタグを置換します。(プリセットタグも変更されます)
                        </p>

                        <div className={styles.tagRenameInputWrapper}>
                            <input
                                type="text"
                                spellCheck="false"
                                className={styles.input}
                                value={beforeTag}
                                onChange={(e) => setBeforeTag(e.target.value)}
                                placeholder="置換対象のタグ"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <input
                                type="text"
                                spellCheck="false"
                                className={styles.input}
                                value={afterTag}
                                onChange={(e) => setAfterTag(e.target.value)}
                                placeholder="置換後のタグ"
                            />
                        </div>
                        <div className={styles.buttonGroup}>
                            <button
                                onClick={handleRenameTag}
                                disabled={isTagRenameDisabled()}
                                className={isTagRenameDisabled() ? styles.actionButton : styles.primaryButton}
                            >
                                {isRenaming ? '置換中...' : '置換'}
                            </button>
                        </div>
                    </div>
                </div>}

                {/* LadyTube: メタデータ置換 (本体の「タグ置換」の代わり) */}
                <ExtMetaReplace cls={{ section: styles.section, title: styles.sectionTitle, icon: styles.sectionHeaderIcon, box: styles.box, desc: styles.tagRenameDescription, input: styles.input, button: styles.actionButton }} />

                {/* Maintenance Section */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Wrench size={18} className={styles.sectionHeaderIcon} />
                        メンテナンス
                    </h2>
                    <div className={styles.box}>
                        <p className={styles.maintenanceDescription}>
                            利用していないメタデータを削除します。
                        </p>
                        <div className={styles.buttonGroup} style={{ marginTop: '1rem' }}>
                            <button onClick={handleCleanup} className={styles.actionButton}>クリーンアップ実行</button>
                        </div>
                    </div>
                </div>
                <ExtSettingsSection name="maintenance" />

                {/* Network Section */}
                <div className={styles.section}>
                    <h2 className={styles.sectionTitle}>
                        <Globe size={18} className={styles.sectionHeaderIcon} />
                        ネットワーク
                    </h2>
                    <div className={styles.box}>
                        <div className={styles.switchContainer}>
                            <label
                                htmlFor="allow-public"
                                className={styles.checkboxLabel}
                            >
                                他のデバイスからのアクセスを許可する
                            </label>
                            <label className={styles.switchBase}>
                                <input
                                    type="checkbox"
                                    id="allow-public"
                                    checked={allowPublic}
                                    onChange={(e) => toggleNetworkAccess(e.target.checked)}
                                    className={styles.switchInput}
                                />
                                <span className={styles.switchSlider}></span>
                            </label>
                        </div>
                    </div>
                </div>

                <ExtSettingsSection name="dmm" />
                <ExtSettingsSection name="backup" />
            </div>

            <FolderPicker
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                onSelect={handleFolderSelect}
            />
        </div >
    );
}
