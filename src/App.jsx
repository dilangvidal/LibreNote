import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import PageList from './components/PageList.jsx';
import EditorArea from './components/EditorArea.jsx';
import RibbonBar from './components/RibbonBar.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import DriveSearchPopup from './components/DriveSearchPopup.jsx';
import ExportPdfModal from './components/ExportPdfModal.jsx';
import useNotebooks from './hooks/useNotebooks.js';
import useGDriveSync from './hooks/useGDriveSync.js';
import useResponsiveLayout from './hooks/useResponsiveLayout.js';
import api from './services/api.js';
import { Menu, Cloud, Settings, ArrowDown, Search } from 'lucide-react';

export default function App() {
    const nb = useNotebooks();
    const gdrive = useGDriveSync(nb.notebooks, nb.setNotebooks);
    const layout = useResponsiveLayout();

    const [showSettings, setShowSettings] = useState(false);
    const [showDriveSearch, setShowDriveSearch] = useState(false);
    const [showExportPdf, setShowExportPdf] = useState(false);
    const [editorRef, setEditorRef] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    useEffect(() => { nb.loadNotebooks(); gdrive.checkGDriveAuth(); }, []);

    function handleSearch(query) {
        setSearchQuery(query);
        setSearchResults(query.trim() ? nb.searchNotebooks(query) : []);
    }

    function handleSelectSearchResult(result) {
        nb.selectSearchResult(result);
        setSearchQuery('');
        setSearchResults([]);
    }

    function handleDriveFileInsert(file) {
        if (editorRef) {
            const link = file.webViewLink || '#';
            editorRef.chain().focus().insertContent(
                `<p><a href="${link}" target="_blank" class="file-attachment">${file.name}</a></p>`
            ).run();
        }
        setShowDriveSearch(false);
    }

    return (
        <div className="app-container">
            <div className="titlebar">
                <button className="titlebar-btn" onClick={() => layout.setNavCollapsed(!layout.navCollapsed)} style={{ WebkitAppRegion: 'no-drag' }}>
                    <Menu size={16} />
                </button>
                <span className="titlebar-title">LibreNote</span>
                <div className="titlebar-search">
                    <Search size={14} />
                    <input placeholder="Buscar en los notebooks..." value={searchQuery} onChange={e => handleSearch(e.target.value)} />
                </div>
                <div className="titlebar-actions">
                    {gdrive.gdriveConnected && (
                        <>
                            <button className="titlebar-btn" onClick={gdrive.handleSyncDown} title="Descargar de Drive" disabled={gdrive.syncStatus === 'syncing'}><ArrowDown size={14} /></button>
                            <button className="titlebar-btn" onClick={gdrive.handleSync} title="Sincronizar" disabled={gdrive.syncStatus === 'syncing'}><Cloud size={14} /></button>
                        </>
                    )}
                    <button className="titlebar-btn" onClick={() => setShowSettings(true)} title="Configuración"><Settings size={14} /></button>
                </div>
            </div>

            {searchResults.length > 0 && (
                <>
                    <div className="drive-search-overlay" onClick={() => { setSearchQuery(''); setSearchResults([]); }} />
                    <div className="drive-search-popup" style={{ top: '70px', transform: 'translateX(-50%)' }}>
                        <div className="drive-search-results">
                            {searchResults.map(r => (
                                <button key={r.pageId} className="drive-search-item" onClick={() => handleSelectSearchResult(r)}>
                                    <div className="drive-search-item-name">{r.page.title || 'Sin título'}</div>
                                    <div className="drive-search-item-meta">{r.notebook.name} / {r.section.name}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}

            <RibbonBar editor={editorRef} onOpenDriveSearch={() => setShowDriveSearch(true)} onOpenExportPdf={() => setShowExportPdf(true)} gdriveConnected={gdrive.gdriveConnected} api={api} />

            <div className="main-area">
                {!layout.navCollapsed && window.innerWidth <= 768 && (
                    <div className="nav-overlay" onClick={() => layout.setNavCollapsed(true)} />
                )}
                <Sidebar collapsed={layout.navCollapsed} notebooks={nb.notebooks}
                    activeNotebookId={nb.activeNotebookId} activeSectionId={nb.activeSectionId}
                    onSelectNotebook={id => nb.setActiveNotebookId(id)}
                    onSelectSection={(nbId, secId) => nb.selectSection(nbId, secId)}
                    onAddNotebook={nb.addNotebook} onDeleteNotebook={nb.deleteNotebook} onRenameNotebook={nb.renameNotebook}
                    onAddSection={nb.addSection} onDeleteSection={nb.deleteSection} onRenameSection={nb.renameSection}
                    gdriveConnected={gdrive.gdriveConnected} syncStatus={gdrive.syncStatus} onSync={gdrive.handleSync} onSyncDown={gdrive.handleSyncDown}
                />
                <PageList collapsed={layout.pageListCollapsed} section={nb.activeSection} activePageId={nb.activePageId}
                    onSelectPage={pid => nb.setActivePageId(pid)}
                    onAddPage={() => { if (nb.activeNotebookId && nb.activeSectionId) nb.addPage(nb.activeNotebookId, nb.activeSectionId); }}
                    onDeletePage={pid => { if (nb.activeNotebookId && nb.activeSectionId) nb.deletePage(nb.activeNotebookId, nb.activeSectionId, pid); }}
                    onDuplicatePage={pid => { if (nb.activeNotebookId && nb.activeSectionId) nb.duplicatePage(nb.activeNotebookId, nb.activeSectionId, pid); }}
                    onReorderPages={(from, to) => { if (nb.activeNotebookId && nb.activeSectionId) nb.reorderPages(nb.activeNotebookId, nb.activeSectionId, from, to); }}
                    onMovePageToSection={(pid, destNbId, destSecId) => { if (nb.activeNotebookId && nb.activeSectionId) nb.movePageToSection(nb.activeNotebookId, nb.activeSectionId, pid, destNbId, destSecId); }}
                    onToggle={() => layout.setPageListCollapsed(!layout.pageListCollapsed)}
                    gdriveConnected={gdrive.gdriveConnected}
                    notebooks={nb.notebooks} activeNotebookId={nb.activeNotebookId} activeSectionId={nb.activeSectionId}
                />
                <EditorArea page={nb.activePage} onTitleChange={nb.updatePageTitle} onContentChange={nb.updatePageContent}
                    onEditorReady={e => setEditorRef(e)} syncStatus={gdrive.syncStatus}
                    api={api} gdriveConnected={gdrive.gdriveConnected}
                />
            </div>

            {showSettings && <SettingsModal gdriveConnected={gdrive.gdriveConnected} onConnect={gdrive.handleGDriveConnect} onDisconnect={gdrive.handleGDriveDisconnect} onClose={() => setShowSettings(false)} />}
            {showDriveSearch && <DriveSearchPopup api={api} onInsert={handleDriveFileInsert} onClose={() => setShowDriveSearch(false)} />}
            {showExportPdf && <ExportPdfModal
                notebooks={nb.notebooks}
                activeNotebookId={nb.activeNotebookId}
                activeSectionId={nb.activeSectionId}
                activePageId={nb.activePageId}
                onClose={() => setShowExportPdf(false)}
            />}
        </div>
    );
}
