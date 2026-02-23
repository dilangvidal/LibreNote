import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, Plus, BookOpen, Trash2, Pencil, FolderPlus, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

export default function Sidebar({
    collapsed, notebooks, activeNotebookId, activeSectionId,
    onSelectNotebook, onSelectSection, onAddNotebook, onDeleteNotebook, onRenameNotebook,
    onAddSection, onDeleteSection, onRenameSection,
    gdriveConnected, syncStatus, onSync,
}) {
    const [expandedNbs, setExpandedNbs] = useState({});
    const [renamingId, setRenamingId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [ctx, setCtx] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const renameRef = useRef(null);

    useEffect(() => { if (renamingId && renameRef.current) { renameRef.current.focus(); renameRef.current.select(); } }, [renamingId]);
    useEffect(() => { if (activeNotebookId) setExpandedNbs(p => ({ ...p, [activeNotebookId]: true })); }, [activeNotebookId]);
    useEffect(() => { if (ctx) { const fn = () => setCtx(null); document.addEventListener('click', fn); return () => document.removeEventListener('click', fn); } }, [ctx]);

    function toggleNb(id) { setExpandedNbs(p => ({ ...p, [id]: !p[id] })); }
    function startRename(id, name, type) { setRenamingId(`${type}-${id}`); setRenameValue(name); setCtx(null); }
    function commitRename(type, nbId, secId) { if (renameValue.trim()) { if (type === 'notebook') onRenameNotebook(nbId, renameValue.trim()); else onRenameSection(nbId, secId, renameValue.trim()); } setRenamingId(null); }
    function handleCtx(e, type, nbId, secId) { e.preventDefault(); e.stopPropagation(); setCtx({ x: e.clientX, y: e.clientY, type, nbId, secId }); }

    function requestDeleteNotebook(nbId) {
        const nb = notebooks.find(n => n.id === nbId);
        setDeleteConfirm({ type: 'notebook', name: nb?.name || 'Sin título', onConfirm: () => { onDeleteNotebook(nbId); setDeleteConfirm(null); } });
        setCtx(null);
    }

    function requestDeleteSection(nbId, secId) {
        const nb = notebooks.find(n => n.id === nbId);
        const sec = nb?.sections.find(s => s.id === secId);
        setDeleteConfirm({ type: 'section', name: sec?.name || 'Sin título', onConfirm: () => { onDeleteSection(nbId, secId); setDeleteConfirm(null); } });
        setCtx(null);
    }

    return (
        <aside className={`nav-panel ${collapsed ? 'collapsed' : ''}`}>
            <div className="nav-header">
                <h2><BookOpen size={15} /> Notebooks</h2>
            </div>
            <div className="nav-notebooks">
                {notebooks.map(nb => (
                    <div key={nb.id} className="nb-item">
                        <div className={`nb-header ${activeNotebookId === nb.id ? 'active' : ''}`}
                            onClick={() => { onSelectNotebook(nb.id); toggleNb(nb.id); }}
                            onContextMenu={e => handleCtx(e, 'notebook', nb.id)}>
                            <span className={`nb-chevron ${expandedNbs[nb.id] ? 'open' : ''}`}><ChevronRight size={10} /></span>
                            <div className="nb-color-bar" style={{ background: nb.color || '#7719AA' }} />
                            {renamingId === `notebook-${nb.id}` ? (
                                <input ref={renameRef} className="rename-input" value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onBlur={() => commitRename('notebook', nb.id)}
                                    onKeyDown={e => { if (e.key === 'Enter') commitRename('notebook', nb.id); if (e.key === 'Escape') setRenamingId(null); }}
                                    onClick={e => e.stopPropagation()} />
                            ) : <span className="nb-name">{nb.name}</span>}
                            <div className="nb-actions">
                                <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={e => { e.stopPropagation(); onAddSection(nb.id); }} title="Nueva sección"><Plus size={13} /></button>
                            </div>
                        </div>
                        {expandedNbs[nb.id] && (
                            <div className="section-list">
                                {nb.sections.map(sec => (
                                    <div key={sec.id} className={`section-item ${activeSectionId === sec.id ? 'active' : ''}`}
                                        onClick={() => onSelectSection(nb.id, sec.id)}
                                        onContextMenu={e => handleCtx(e, 'section', nb.id, sec.id)}>
                                        <div className="section-color-dot" style={{ background: sec.color || '#7719AA' }} />
                                        {renamingId === `section-${sec.id}` ? (
                                            <input ref={renameRef} className="rename-input" value={renameValue}
                                                onChange={e => setRenameValue(e.target.value)}
                                                onBlur={() => commitRename('section', nb.id, sec.id)}
                                                onKeyDown={e => { if (e.key === 'Enter') commitRename('section', nb.id, sec.id); if (e.key === 'Escape') setRenamingId(null); }}
                                                onClick={e => e.stopPropagation()} />
                                        ) : <span className="section-name">{sec.name}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                <button className="add-item-btn" onClick={onAddNotebook}><Plus size={13} /> Agregar Notebook</button>
            </div>
            <div className="sync-status-bar">
                <div className={`sync-dot ${gdriveConnected ? (syncStatus === 'syncing' ? 'syncing' : 'connected') : 'disconnected'}`} />
                <span className="sync-label">{gdriveConnected ? (syncStatus === 'syncing' ? 'Sincronizando...' : syncStatus === 'success' ? 'Sincronizado' : 'Google Drive') : 'No conectado'}</span>
                {gdriveConnected && <button className="btn btn-ghost btn-sm" onClick={onSync} disabled={syncStatus === 'syncing'}><RefreshCw size={11} /></button>}
            </div>
            {ctx && (
                <div className="context-menu" style={{ left: ctx.x, top: ctx.y }}>
                    {ctx.type === 'notebook' && <>
                        <button className="context-menu-item" onClick={() => startRename(ctx.nbId, notebooks.find(n => n.id === ctx.nbId)?.name, 'notebook')}><Pencil size={12} /> Renombrar</button>
                        <button className="context-menu-item" onClick={() => { onAddSection(ctx.nbId); setCtx(null); }}><FolderPlus size={12} /> Nueva Sección</button>
                        <button className="context-menu-item danger" onClick={() => requestDeleteNotebook(ctx.nbId)}><Trash2 size={12} /> Eliminar</button>
                    </>}
                    {ctx.type === 'section' && <>
                        <button className="context-menu-item" onClick={() => { const nb = notebooks.find(n => n.id === ctx.nbId); const sec = nb?.sections.find(s => s.id === ctx.secId); startRename(ctx.secId, sec?.name, 'section'); }}><Pencil size={12} /> Renombrar</button>
                        <button className="context-menu-item danger" onClick={() => requestDeleteSection(ctx.nbId, ctx.secId)}><Trash2 size={12} /> Eliminar</button>
                    </>}
                </div>
            )}
            {deleteConfirm && (
                <ConfirmDeleteModal
                    type={deleteConfirm.type}
                    name={deleteConfirm.name}
                    gdriveConnected={gdriveConnected}
                    onConfirm={deleteConfirm.onConfirm}
                    onCancel={() => setDeleteConfirm(null)}
                />
            )}
        </aside>
    );
}
