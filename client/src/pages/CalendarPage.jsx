import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { css } from '@linaria/core';
import Navbar from '../components/Navbar';
import LoadingDots from '../components/LoadingDots';
import { theme } from '../theme';
import { Calendar } from 'lucide-react';

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
        margin-bottom: 2rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    `,
    yearSection: css`
        margin-bottom: 3rem;
    `,
    yearTitle: css`
        font-size: 1.25rem;
        font-weight: 600;
        color: ${theme.colors.text.primary};
        margin-bottom: 1rem;
        border-bottom: 1px solid ${theme.colors.border.primary};
        padding-bottom: 0.5rem;
        cursor: pointer;

        &:hover {
            color: ${theme.colors.accent.primary};
        }
    `,
    monthGrid: css`
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
    `,
    monthItem: css`
        padding: 0.75rem 1rem;
        background-color: ${theme.colors.bg.secondary};
        border-radius: 0.5rem;
        cursor: pointer;
        border: 1px solid ${theme.colors.border.primary};
        display: flex;
        align-items: center;
        gap: 0.5rem;

        &:hover {
            background-color: ${theme.colors.bg.hover};
            border-color: ${theme.colors.accent.primary};
        }
    `,
    monthText: css`
        font-size: 1rem;
        color: ${theme.colors.text.primary};
        font-weight: 500;
    `,
    countText: css`
        font-size: 0.9rem;
        color: ${theme.colors.text.secondary};
    `,
    loadingContainer: css`
        display: flex;
        justify-content: center;
        align-items: center;
        height: 50vh;
    `,
};

export default function CalendarPage() {
    const [monthlyCounts, setMonthlyCounts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        document.title = 'カレンダー - LadyTube';
        fetch('/api/calendar/months')
            .then(res => res.json())
            .then(data => {
                setMonthlyCounts(data);
                setIsLoading(false);
            })
            .catch(err => {
                console.error('Failed to fetch monthly counts:', err);
                setIsLoading(false);
            });
    }, []);

    const groupedByYear = monthlyCounts.reduce((acc, item) => {
        if (!acc[item.year]) {
            acc[item.year] = { months: [], total: 0 };
        }
        acc[item.year].months.push(item);
        acc[item.year].total += item.count;
        return acc;
    }, {});

    const years = Object.keys(groupedByYear).sort((a, b) => b - a);

    // LadyTube: 押したときと中クリックで同じ URL を使うため、URL の組み立てを分けた
    const monthUrl = (year, month) => {
        // Calculate the last day of the month
        const nextMonth = new Date(parseInt(year), parseInt(month), 1);
        const lastDay = new Date(nextMonth - 1).getDate();

        const q = `>${year}/${month}/01 <${year}/${month}/${lastDay}`;
        return `/search?q=${encodeURIComponent(q)}`;
    };
    const yearUrl = (year) => `/search?q=${encodeURIComponent(`>${year}/01/01 <${year}/12/31`)}`;
    const handleMonthClick = (year, month) => navigate(monthUrl(year, month));
    const handleYearClick = (year) => navigate(yearUrl(year));
    // LadyTube: 年と月は <a> ではないので、中クリックで新しいタブに開けるようにする (v3.1.15 までの nav.js の patchCalendarLinks)
    const midClick = (url) => ({
        onMouseDown: (e) => { if (e.button === 1) e.preventDefault(); },
        onAuxClick: (e) => { if (e.button !== 1) return; e.preventDefault(); window.open(url, '_blank'); },
    });

    return (
        <div className={styles.page}>
            <Navbar />
            <div className={styles.content}>
                <h1 className={styles.title}><Calendar size={20} /> カレンダー</h1>

                {isLoading ? (
                    <div className={styles.loadingContainer}>
                        <LoadingDots />
                    </div>
                ) : (
                    years.length > 0 ? (
                        years.map(year => (
                            <div key={year} className={styles.yearSection}>
                                <h2
                                    className={styles.yearTitle}
                                    onClick={() => handleYearClick(year)}
                                    {...midClick(yearUrl(year))}
                                    title={`${year}年の動画を検索`}
                                >
                                    {year}年 ({groupedByYear[year].total})
                                </h2>
                                <div className={styles.monthGrid}>
                                    {groupedByYear[year].months.map(item => (
                                        <div
                                            key={item.month}
                                            className={styles.monthItem}
                                            onClick={() => handleMonthClick(year, item.month)}
                                            {...midClick(monthUrl(year, item.month))}
                                        >
                                            <span className={styles.monthText}>{parseInt(item.month)}月</span>
                                            <span className={styles.countText}>({item.count})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
                            動画が見つかりませんでした。
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
