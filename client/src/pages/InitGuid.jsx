import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from '../components/Navbar';
import { Settings } from 'lucide-react';
import { theme } from '../theme';
import { api } from '../services/api';

// Linaria styles
const styles = {
    page: css`
        min-height: 100vh;
        background-color: ${theme.colors.bg.primary};
        padding-top: 2rem;
    `,
    content: css`
        max-width: 600px;
        margin: 0 auto;
        padding: 2rem 1rem;
    `,
    centerSection: css`
        margin-bottom: 2rem;
        margin-top: 4rem;
    `,
    warningText: css`
        color: ${theme.colors.text.secondary};
        font-size: 0.9rem;
        line-height: 1.5;
    `,
    title: css`
        font-size: 2rem;
        font-weight: 800;
        color: ${theme.colors.text.primary};
        margin-bottom: 2rem;
        margin-top: 0.5rem;
        letter-spacing: -0.1rem;
    `,
    settingsLink: css`
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 1.5rem;
        color: var(--accent);
        font-size: 0.85rem;
        text-decoration: none;
        cursor: pointer;
        &:hover {
            color: ${theme.colors.accent.primary};
        }
    `,
};

export default function InitGuid() {
    useEffect(() => {
        document.title = 'ホーム - LadyTube';
    }, []);

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.centerSection}>
                    <h1 className={styles.title}>LadyTube</h1>
                    <div className={styles.warningText}>
                        LadyTubeへようこそ。<br />
                        <br />
                        最初に動画を登録します。<br />
                        管理画面で、動画があるフォルダーを指定して「スキャン開始」ボタンで開始します。<br />
                        スキャンが終わったら、戻るボタンで戻ると動画の検索や再生ができるようになります。<br />
                        (スキャン中でも、登録が完了したものから順次検索や再生が可能です)<br />
                    </div>
                    <Link to="/settings" className={styles.settingsLink}>
                        <Settings size={15} />
                        管理画面はこちら
                    </Link>
                </div>
            </div>
        </div>
    );
}
