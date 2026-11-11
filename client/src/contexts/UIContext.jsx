import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import UIOverlay from '../components/UIOverlay';

const UIContext = createContext();

export const useUI = () => {
    return useContext(UIContext);
};

export const UIProvider = ({ children }) => {
    // Toast State
    const [toasts, setToasts] = useState([]);

    // Dark Mode State
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('theme_mode');
            if (stored) return stored === 'dark';
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    const toggleTheme = useCallback(() => {
        setIsDarkMode(prev => {
            const next = !prev;
            localStorage.setItem('theme_mode', next ? 'dark' : 'light');
            return next;
        });
    }, []);

    // Display Settings State
    const [showExtension, setShowExtension] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('show_extension');
            return stored === null ? false : stored === 'true';
        }
        return false;
    });

    const [showThumbnailButton, setShowThumbnailButton] = useState(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('show_thumbnail_button');
            if (stored !== null) return stored === 'true';
            const oldStored = localStorage.getItem('showThumbnailButton');
            return oldStored === null ? true : oldStored === 'true';
        }
        return true;
    });

    // LadyTube: 表示動画名で表示する (既定はON。キーは v2.x の拡張機能から引き継いだもの)
    const [showDisplayName, setShowDisplayName] = useState(() => {
        if (typeof window !== 'undefined') return localStorage.getItem('wlext_use_display_name') !== '0';
        return true;
    });

    const [isDisplaySettingsOpen, setIsDisplaySettingsOpen] = useState(false);

    const toggleDisplayName = useCallback(() => {
        setShowDisplayName(prev => {
            const next = !prev;
            localStorage.setItem('wlext_use_display_name', next ? '1' : '0');
            return next;
        });
    }, []);

    const toggleExtension = useCallback(() => {
        setShowExtension(prev => {
            const next = !prev;
            localStorage.setItem('show_extension', next.toString());
            return next;
        });
    }, []);

    const toggleThumbnailButton = useCallback(() => {
        setShowThumbnailButton(prev => {
            const next = !prev;
            localStorage.setItem('show_thumbnail_button', next.toString());
            localStorage.setItem('showThumbnailButton', next.toString());
            return next;
        });
    }, []);

    // Apply theme class
    React.useLayoutEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // Dialog State
    const [dialog, setDialog] = useState({
        isOpen: false,
        message: '',
        title: '',
        confirmLabel: 'OK',
        cancelLabel: 'キャンセル',
        type: 'confirm',
        hideCancel: false
    });

    // We need to store the resolve function for the dialog promise
    const dialogResolver = useRef(null);

    // Toast Actions
    const showToast = useCallback((message, type = 'info', customContent = null) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, customContent }]);

        // Auto remove after 3s
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 3000);
    }, []);

    // Dialog Actions
    const confirm = useCallback((message, options = {}) => {
        return new Promise((resolve) => {
            dialogResolver.current = resolve;
            setDialog({
                isOpen: true,
                message,
                title: options.title || '確認',
                confirmLabel: options.confirmLabel || 'OK',
                cancelLabel: options.cancelLabel || 'キャンセル',
                type: 'confirm',
                hideCancel: !!options.hideCancel
            });
        });
    }, []);

    const alert = useCallback((message, title = '通知') => {
        return new Promise((resolve) => {
            dialogResolver.current = resolve;
            setDialog({
                isOpen: true,
                message,
                title,
                confirmLabel: 'OK',
                type: 'alert'
            });
        });
    }, []);

    const handleDialogConfirm = () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (dialogResolver.current) {
            dialogResolver.current(true);
            dialogResolver.current = null;
        }
    };

    const handleDialogCancel = () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
        if (dialogResolver.current) {
            dialogResolver.current(false);
            dialogResolver.current = null;
        }
    };

    return (
        <UIContext.Provider value={{
            showToast, confirm, alert, isDarkMode, toggleTheme,
            showExtension, showThumbnailButton, toggleExtension, toggleThumbnailButton,
            showDisplayName, toggleDisplayName,
            isDisplaySettingsOpen, setIsDisplaySettingsOpen
        }}>
            {children}
            <UIOverlay
                toasts={toasts}
                dialog={dialog}
                onDialogConfirm={handleDialogConfirm}
                onDialogCancel={handleDialogCancel}
                isDisplaySettingsOpen={isDisplaySettingsOpen}
                setIsDisplaySettingsOpen={setIsDisplaySettingsOpen}
                showExtension={showExtension}
                showThumbnailButton={showThumbnailButton}
                toggleExtension={toggleExtension}
                toggleThumbnailButton={toggleThumbnailButton}
                showDisplayName={showDisplayName}
                toggleDisplayName={toggleDisplayName}
            />
        </UIContext.Provider>
    );
};
