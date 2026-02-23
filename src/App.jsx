import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import PageList from './components/PageList.jsx';
import EditorArea from './components/EditorArea.jsx';
import RibbonBar from './components/RibbonBar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import DriveSearchPopup from './components/DriveSearchPopup.jsx';
import { Menu, Cloud, CloudOff, Settings, ArrowDown, Search } from 'lucide-react';

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

const SECTION_COLORS = ['#7719AA', '#0078D4', '#038387', '#107C10', '#CA5010', '#D13438', '#E3008C', '#69797E'];
const NOTEBOOK_COLORS = ['#7719AA', '#D13438', '#107C10', '#0078D4', '#CA5010', '#038387'];

function createDefaultNotebook() {
    const pageId = generateId();
    const sectionId = generateId();
    return {
        id: generateId(),
        name: 'Mi Cuaderno',
        color: '#7719AA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections: [{
            id: sectionId,
            name: 'General',
            color: '#7719AA',
            pages: [{
                id: pageId,
                title: 'Bienvenido a NoteFlow',
                content: '<h1>Bienvenido a NoteFlow</h1><p>Tu espacio para capturar ideas, organizar pensamientos y crear contenido.</p><h2>Características</h2><ul><li>Editor de texto enriquecido con formato profesional</li><li>Notebooks organizados en secciones y páginas</li><li>Sincronización con Google Drive</li><li>Interfaz estilo Microsoft OneNote</li></ul><h2>Empezar</h2><p>Crea una nueva página o notebook desde el panel lateral. Usa <strong>/search</strong> en el editor para buscar archivos en Drive.</p>',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }],
        }],
    };
}

const isElectron = typeof window !== 'undefined' && window.noteflow;
const browserStorage = {
    listNotebooks: () => { const d = localStorage.getItem('noteflow-notebooks'); return d ? JSON.parse(d) : []; },
    saveNotebook: (nb) => { const nbs = browserStorage.listNotebooks(); const i = nbs.findIndex(n => n.id === nb.id); if (i >= 0) nbs[i] = nb; else nbs.push(nb); localStorage.setItem('noteflow-notebooks', JSON.stringify(nbs)); return true; },
    deleteNotebook: (id) => { localStorage.setItem('noteflow-notebooks', JSON.stringify(browserStorage.listNotebooks().filter(n => n.id !== id))); return true; },
    isGDriveAuthenticated: () => false,
    gdriveAuth: () => ({ success: false }),
    gdriveLogout: () => true,
    gdriveSyncUp: () => ({ success: false }),
    gdriveSyncDown: () => ({ success: true, notebooks: [] }),
    gdriveSearchFiles: () => ({ success: false, files: [] }),
    gdriveGetFileUrl: () => ({ success: false }),
    gdriveUploadFile: () => ({ success: false }),
    pickImage: () => null,
    pickFile: () => null,
};
const api = isElectron ? window.noteflow : browserStorage;

export default function App() {
    const [notebooks, setNotebooks] = useState([]);
    const [activeNotebookId, setActiveNotebookId] = useState(null);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [activePageId, setActivePageId] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [showDriveSearch, setShowDriveSearch] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle');
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [navCollapsed, setNavCollapsed] = useState(window.innerWidth < 768);
    const [pageListCollapsed, setPageListCollapsed] = useState(window.innerWidth < 480);
    const [editorRef, setEditorRef] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const saveTimeoutRef = useRef(null);

    useEffect(() => { loadNotebooks(); checkGDriveAuth(); }, []);

    // Listen for /search in editor
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.key === '/' && e.target.closest('.ProseMirror')) {
                // We'll handle this via editor update in EditorArea
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle responsive resize
    useEffect(() => {
        function handleResize() {
            if (window.innerWidth < 768) setNavCollapsed(true);
            if (window.innerWidth < 480) setPageListCollapsed(true);
        }
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Notebook search
    function handleSearch(query) {
        setSearchQuery(query);
        if (!query.trim()) { setSearchResults([]); return; }
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
        setSearchResults(results);
    }

    function selectSearchResult(result) {
        setActiveNotebookId(result.nbId);
        setActiveSectionId(result.secId);
        setActivePageId(result.pageId);
        setSearchQuery('');
        setSearchResults([]);
    }

    async function loadNotebooks() {
        let nbs = await api.listNotebooks();
        if (!nbs || nbs.length === 0) {
            const defaultNb = createDefaultNotebook();
            await api.saveNotebook(defaultNb);
            nbs = [defaultNb];
        }
        nbs = nbs.map(nb => ({ ...nb, sections: nb.sections.map((s, i) => ({ ...s, color: s.color || SECTION_COLORS[i % SECTION_COLORS.length] })) }));
        setNotebooks(nbs);
        if (nbs.length > 0) {
            const nb = nbs[0];
            setActiveNotebookId(nb.id);
            if (nb.sections.length > 0) {
                setActiveSectionId(nb.sections[0].id);
                if (nb.sections[0].pages.length > 0) setActivePageId(nb.sections[0].pages[0].id);
            }
        }
    }

    async function checkGDriveAuth() { setGdriveConnected(await api.isGDriveAuthenticated()); }

    const activeNotebook = notebooks.find(n => n.id === activeNotebookId);
    const activeSection = activeNotebook?.sections.find(s => s.id === activeSectionId);
    const activePage = activeSection?.pages.find(p => p.id === activePageId);

    const saveNotebook = useCallback((nb) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(async () => { nb.updatedAt = new Date().toISOString(); await api.saveNotebook(nb); }, 800);
    }, []);

    function updateNotebooks(updater) {
        setNotebooks(prev => {
            const next = updater(prev);
            const changed = next.find(n => n.id === activeNotebookId);
            if (changed) saveNotebook(changed);
            return next;
        });
    }

    function addNotebook() {
        const nb = { id: generateId(), name: 'Nuevo Cuaderno', color: NOTEBOOK_COLORS[notebooks.length % NOTEBOOK_COLORS.length], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sections: [{ id: generateId(), name: 'Sección 1', color: SECTION_COLORS[0], pages: [{ id: generateId(), title: 'Página sin título', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }] };
        setNotebooks(prev => [...prev, nb]);
        api.saveNotebook(nb);
        setActiveNotebookId(nb.id); setActiveSectionId(nb.sections[0].id); setActivePageId(nb.sections[0].pages[0].id);
    }

    function deleteNotebook(id) { api.deleteNotebook(id); setNotebooks(prev => prev.filter(n => n.id !== id)); if (activeNotebookId === id) { setActiveNotebookId(null); setActiveSectionId(null); setActivePageId(null); } }
    function renameNotebook(id, name) { updateNotebooks(prev => prev.map(n => n.id === id ? { ...n, name } : n)); }

    function addSection(nbId) {
        const sid = generateId(), pid = generateId();
        const nb = notebooks.find(n => n.id === nbId);
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : { ...n, sections: [...n.sections, { id: sid, name: 'Nueva Sección', color: SECTION_COLORS[(nb?.sections.length || 0) % SECTION_COLORS.length], pages: [{ id: pid, title: 'Página sin título', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }] }));
        setActiveSectionId(sid); setActivePageId(pid);
    }

    function deleteSection(nbId, secId) { updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : { ...n, sections: n.sections.filter(s => s.id !== secId) })); if (activeSectionId === secId) { setActiveSectionId(null); setActivePageId(null); } }
    function renameSection(nbId, secId, name) { updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : { ...n, sections: n.sections.map(s => s.id === secId ? { ...s, name } : s) })); }

    function addPage(nbId, secId) {
        const pid = generateId();
        updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : { ...n, sections: n.sections.map(s => s.id !== secId ? s : { ...s, pages: [...s.pages, { id: pid, title: 'Página sin título', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] }) }));
        setActivePageId(pid);
    }

    function deletePage(nbId, secId, pid) { updateNotebooks(prev => prev.map(n => n.id !== nbId ? n : { ...n, sections: n.sections.map(s => s.id !== secId ? s : { ...s, pages: s.pages.filter(p => p.id !== pid) }) })); if (activePageId === pid) setActivePageId(null); }
    function updatePageTitle(title) { updateNotebooks(prev => prev.map(n => n.id !== activeNotebookId ? n : { ...n, sections: n.sections.map(s => s.id !== activeSectionId ? s : { ...s, pages: s.pages.map(p => p.id === activePageId ? { ...p, title, updatedAt: new Date().toISOString() } : p) }) })); }
    function updatePageContent(content) { updateNotebooks(prev => prev.map(n => n.id !== activeNotebookId ? n : { ...n, sections: n.sections.map(s => s.id !== activeSectionId ? s : { ...s, pages: s.pages.map(p => p.id === activePageId ? { ...p, content, updatedAt: new Date().toISOString() } : p) }) })); }

    async function handleSync() { setSyncStatus('syncing'); try { const r = await api.gdriveSyncUp(notebooks); setSyncStatus(r.success ? 'success' : 'error'); } catch { setSyncStatus('error'); } setTimeout(() => setSyncStatus('idle'), 3000); }
    async function handleSyncDown() { setSyncStatus('syncing'); try { const r = await api.gdriveSyncDown(); if (r.success && r.notebooks?.length > 0) { const merged = [...notebooks]; for (const remote of r.notebooks) { const i = merged.findIndex(n => n.id === remote.id); if (i >= 0 && new Date(remote.updatedAt) > new Date(merged[i].updatedAt)) { merged[i] = remote; await api.saveNotebook(remote); } else if (i < 0) { merged.push(remote); await api.saveNotebook(remote); } } setNotebooks(merged); } setSyncStatus('success'); } catch { setSyncStatus('error'); } setTimeout(() => setSyncStatus('idle'), 3000); }
    async function handleGDriveConnect() { try { await api.gdriveAuth(); setGdriveConnected(true); } catch (e) { console.error(e); } }
    async function handleGDriveDisconnect() { await api.gdriveLogout(); setGdriveConnected(false); }

    // Insert Drive file link into editor
    function handleDriveFileInsert(file) {
        if (editorRef) {
            const link = file.webViewLink || '#';
            editorRef.chain().focus().insertContent(`<p><a href="${link}" target="_blank" class="file-attachment">${file.name}</a></p>`).run();
        }
        setShowDriveSearch(false);
    }

    return (
        <div className="app-container">
            <div className="titlebar">
                <button className="titlebar-btn" onClick={() => setNavCollapsed(!navCollapsed)} style={{ WebkitAppRegion: 'no-drag' }}>
                    <Menu size={16} />
                </button>
                <span className="titlebar-title">NoteFlow</span>
                <div className="titlebar-search">
                    <Search size={14} />
                    <input
                        placeholder="Buscar en los notebooks..."
                        value={searchQuery}
                        onChange={e => handleSearch(e.target.value)}
                    />
                </div>
                <div className="titlebar-actions">
                    {gdriveConnected && (
                        <>
                            <button className="titlebar-btn" onClick={handleSyncDown} title="Descargar de Drive" disabled={syncStatus === 'syncing'}><ArrowDown size={14} /></button>
                            <button className="titlebar-btn" onClick={handleSync} title="Sincronizar" disabled={syncStatus === 'syncing'}><Cloud size={14} /></button>
                        </>
                    )}
                    <button className="titlebar-btn" onClick={() => setShowSettings(true)} title="Configuración"><Settings size={14} /></button>
                </div>
            </div>

            {/* Search results dropdown */}
            {searchResults.length > 0 && (
                <>
                    <div className="drive-search-overlay" onClick={() => { setSearchQuery(''); setSearchResults([]); }} />
                    <div className="drive-search-popup" style={{ top: '70px', transform: 'translateX(-50%)' }}>
                        <div className="drive-search-results">
                            {searchResults.map(r => (
                                <button key={r.pageId} className="drive-search-item" onClick={() => selectSearchResult(r)}>
                                    <div className="drive-search-item-name">{r.page.title || 'Sin título'}</div>
                                    <div className="drive-search-item-meta">{r.notebook.name} / {r.section.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <RibbonBar editor={editorRef} onOpenDriveSearch={() => setShowDriveSearch(true)} gdriveConnected={gdriveConnected} api={api} />

            <div className="main-area">
                {!navCollapsed && window.innerWidth <= 768 && (
                    <div className="nav-overlay" onClick={() => setNavCollapsed(true)} />
                )}
                <Sidebar collapsed={navCollapsed} notebooks={notebooks} activeNotebookId={activeNotebookId} activeSectionId={activeSectionId}
                    onSelectNotebook={id => setActiveNotebookId(id)}
                    onSelectSection={(nbId, secId) => { setActiveNotebookId(nbId); setActiveSectionId(secId); const nb = notebooks.find(n => n.id === nbId); const sec = nb?.sections.find(s => s.id === secId); if (sec?.pages.length > 0) setActivePageId(sec.pages[0].id); }}
                    onAddNotebook={addNotebook} onDeleteNotebook={deleteNotebook} onRenameNotebook={renameNotebook}
                    onAddSection={addSection} onDeleteSection={deleteSection} onRenameSection={renameSection}
                    gdriveConnected={gdriveConnected} syncStatus={syncStatus} onSync={handleSync} onSyncDown={handleSyncDown}
                />
                <PageList collapsed={pageListCollapsed} section={activeSection} activePageId={activePageId}
                    onSelectPage={pid => setActivePageId(pid)}
                    onAddPage={() => { if (activeNotebookId && activeSectionId) addPage(activeNotebookId, activeSectionId); }}
                    onDeletePage={pid => { if (activeNotebookId && activeSectionId) deletePage(activeNotebookId, activeSectionId, pid); }}
                    onToggle={() => setPageListCollapsed(!pageListCollapsed)}
                />
                <EditorArea page={activePage} onTitleChange={updatePageTitle} onContentChange={updatePageContent}
                    onEditorReady={e => setEditorRef(e)} syncStatus={syncStatus}
                    onSlashSearch={() => setShowDriveSearch(true)}
                />
            </div>

            {showSettings && <SettingsModal gdriveConnected={gdriveConnected} onConnect={handleGDriveConnect} onDisconnect={handleGDriveDisconnect} onClose={() => setShowSettings(false)} />}
            {showDriveSearch && <DriveSearchPopup api={api} onInsert={handleDriveFileInsert} onClose={() => setShowDriveSearch(false)} />}
        </div>
    );
}
