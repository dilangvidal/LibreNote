import { useState, useCallback, useRef, useEffect } from 'react';
import api from '../services/api';
import { generateId, SECTION_COLORS, NOTEBOOK_COLORS, createDefaultNotebook } from '../utils/helpers';

/**
 * Hook para gestión CRUD de notebooks — Principio SRP
 */
export default function useNotebooks() {
    const [notebooks, setNotebooks] = useState([]);
    const [activeNotebookId, setActiveNotebookId] = useState(null);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [activePageId, setActivePageId] = useState(null);
    const saveTimeoutRef = useRef(null);

    const activeNotebook = notebooks.find(n => n.id === activeNotebookId);
    const activeSection = activeNotebook?.sections.find(s => s.id === activeSectionId);
    const activePage = activeSection?.pages.find(p => p.id === activePageId);

    // ── Carga inicial ──
    async function loadNotebooks() {
        let nbs = await api.listNotebooks();
        if (!nbs || nbs.length === 0) {
            const defaultNb = createDefaultNotebook();
            await api.saveNotebook(defaultNb);
            nbs = [defaultNb];
        }
        nbs = nbs.map(nb => ({
            ...nb,
            sections: nb.sections.map((s, i) => ({
                ...s,
                color: s.color || SECTION_COLORS[i % SECTION_COLORS.length],
            })),
        }));
        setNotebooks(nbs);
        if (nbs.length > 0) {
            const nb = nbs[0];
            setActiveNotebookId(nb.id);
            if (nb.sections.length > 0) {
                setActiveSectionId(nb.sections[0].id);
                if (nb.sections[0].pages.length > 0) {
                    setActivePageId(nb.sections[0].pages[0].id);
                }
            }
        }
    }

    // ── Persistencia con debounce ──
    const saveNotebook = useCallback((nb) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => {
            nb.updatedAt = new Date().toISOString();
            await api.saveNotebook(nb);
        }, 800);
    }, []);

    function updateNotebooks(updater) {
        setNotebooks(prev => {
            const next = updater(prev);
            const changed = next.find(n => n.id === activeNotebookId);
            if (changed) saveNotebook(changed);
            return next;
        });
    }

    // ── CRUD Notebooks ──
    function addNotebook() {
        const nb = {
            id: generateId(),
            name: 'Nuevo Cuaderno',
            color: NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sections: [{
                id: generateId(),
                name: 'Sección 1',
                color: SECTION_COLORS[0],
                pages: [{
                    id: generateId(),
                    title: 'Página sin título',
                    content: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }],
            }],
        };
        setNotebooks(prev => [...prev, nb]);
        api.saveNotebook(nb);
        setActiveNotebookId(nb.id);
        setActiveSectionId(nb.sections[0].id);
        setActivePageId(nb.sections[0].pages[0].id);
    }

    function deleteNotebook(id) {
        api.deleteNotebook(id);
        setNotebooks(prev => prev.filter(n => n.id !== id));
        if (activeNotebookId === id) {
            setActiveNotebookId(null);
            setActiveSectionId(null);
            setActivePageId(null);
        }
    }

    function renameNotebook(id, name) {
        updateNotebooks(prev => prev.map(n => n.id === id ? { ...n, name } : n));
    }

    // ── CRUD Sections ──
    function addSection(nbId) {
        const sid = generateId(), pid = generateId();
        const nb = notebooks.find(n => n.id === nbId);
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : {
            ...n,
            sections: [...n.sections, {
                id: sid,
                name: 'Nueva Sección',
                color: SECTION_COLORS[(nb?.sections.length || 0) % SECTION_COLORS.length],
                pages: [{
                    id: pid,
                    title: 'Página sin título',
                    content: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }],
            }],
        }));
        setActiveSectionId(sid);
        setActivePageId(pid);
    }

    function deleteSection(nbId, secId) {
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : {
            ...n,
            sections: n.sections.filter(s => s.id !== secId),
        }));
        if (activeSectionId === secId) {
            setActiveSectionId(null);
            setActivePageId(null);
        }
    }

    function renameSection(nbId, secId, name) {
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : {
            ...n,
            sections: n.sections.map(s => s.id === secId ? { ...s, name } : s),
        }));
    }

    // ── CRUD Pages ──
    function addPage(nbId, secId) {
        const pid = generateId();
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : {
            ...n,
            sections: n.sections.map(s => s.id !== secId ? s : {
                ...s,
                pages: [...s.pages, {
                    id: pid,
                    title: 'Página sin título',
                    content: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }],
            }),
        }));
        setActivePageId(pid);
    }

    function deletePage(nbId, secId, pid) {
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : {
            ...n,
            sections: n.sections.map(s => s.id !== secId ? s : {
                ...s,
                pages: s.pages.filter(p => p.id !== pid),
            }),
        }));
        if (activePageId === pid) setActivePageId(null);
    }

    function updatePageTitle(title) {
        updateNotebooks(prev => prev.map(n => n.id !== activeNotebookId ? n : {
            ...n,
            sections: n.sections.map(s => s.id !== activeSectionId ? s : {
                ...s,
                pages: s.pages.map(p => p.id === activePageId ? { ...p, title, updatedAt: new Date().toISOString() } : p),
            }),
        }));
    }

    function updatePageContent(content) {
        updateNotebooks(prev => prev.map(n => n.id !== activeNotebookId ? n : {
            ...n,
            sections: n.sections.map(s => s.id !== activeSectionId ? s : {
                ...s,
                pages: s.pages.map(p => p.id === activePageId ? { ...p, content, updatedAt: new Date().toISOString() } : p),
            }),
        }));
    }

    // ── Búsqueda local ──
    function searchNotebooks(query) {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        const results = [];
        notebooks.forEach(nb => {
            nb.sections.forEach(sec => {
                sec.pages.forEach(page => {
                    const titleMatch = (page.title || '').toLowerCase().includes(q);
                    const contentMatch = (page.content || '').replace(/<[^>]+>/g, '').toLowerCase().includes(q);
                    if (titleMatch || contentMatch) {
                        results.push({ notebook: nb, section: sec, page, nbId: nb.id, secId: sec.id, pageId: page.id });
                    }
                });
            });
        });
        return results;
    }

    function selectSearchResult(result) {
        setActiveNotebookId(result.nbId);
        setActiveSectionId(result.secId);
        setActivePageId(result.pageId);
    }

    function selectSection(nbId, secId) {
        setActiveNotebookId(nbId);
        setActiveSectionId(secId);
        const nb = notebooks.find(n => n.id === nbId);
        const sec = nb?.sections.find(s => s.id === secId);
        if (sec?.pages.length > 0) setActivePageId(sec.pages[0].id);
    }

    return {
        notebooks, setNotebooks,
        activeNotebookId, setActiveNotebookId,
        activeSectionId, setActiveSectionId,
        activePageId, setActivePageId,
        activeNotebook, activeSection, activePage,
        loadNotebooks,
        addNotebook, deleteNotebook, renameNotebook,
        addSection, deleteSection, renameSection,
        addPage, deletePage, updatePageTitle, updatePageContent,
        searchNotebooks, selectSearchResult, selectSection,
    };
}
