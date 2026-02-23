import { useState, useEffect } from 'react';

/**
 * Hook para layout responsive — Principio SRP
 */
export default function useResponsiveLayout() {
    const [navCollapsed, setNavCollapsed] = useState(window.innerWidth < 768);
    const [pageListCollapsed, setPageListCollapsed] = useState(window.innerWidth < 480);

    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < 768) setNavCollapsed(true);
            if (window.innerWidth < 480) setPageListCollapsed(true);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        navCollapsed, setNavCollapsed,
        pageListCollapsed, setPageListCollapsed,
    };
}
