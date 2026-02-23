import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

const THEME_KEY = 'noteflow-theme';

export function ThemeProvider({ children }) {
    const [theme, setThemeState] = useState(() => {
        return localStorage.getItem(THEME_KEY) || 'system';
    });

    const getResolvedTheme = useCallback((t) => {
        if (t === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return t;
    }, []);

    const [resolvedTheme, setResolvedTheme] = useState(() => getResolvedTheme(theme));

    function setTheme(newTheme) {
        setThemeState(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
    }

    // Aplicar tema al <html>
    useEffect(() => {
        const resolved = getResolvedTheme(theme);
        setResolvedTheme(resolved);
        document.documentElement.setAttribute('data-theme', resolved);
    }, [theme, getResolvedTheme]);

    // Escuchar cambios del sistema cuando tema es 'system'
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        function handler(e) {
            const resolved = e.matches ? 'dark' : 'light';
            setResolvedTheme(resolved);
            document.documentElement.setAttribute('data-theme', resolved);
        }
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}

export default ThemeContext;
