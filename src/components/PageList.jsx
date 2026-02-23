import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, Copy, MoveRight, GripVertical } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

export default function PageList({
    collapsed, section, activePageId, onSelectPage,
    onAddPage, onDeletePage, onDuplicatePage, onReorderPages, onMovePageToSection,
    gdriveConnected, notebooks, activeNotebookId, activeSectionId,
}) {
    const [ctx, setCtx] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [moveMenu, setMoveMenu] = useState(null);
    const dragItemRef = useRef(null);
    const dragOverRef = useRef(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [panelWidth, setPanelWidth] = useState(() => {
        const saved = localStorage.getItem('noteflow-pagelist-width');
        return saved ? parseInt(saved, 10) : 240;
    });
    const isResizingRef = useRef(false);
    const panelRef = useRef(null);

    const handleResizeMouseDown = useCallback((e) => {
        if (window.innerWidth <= 768) return;
        e.preventDefault();
        isResizingRef.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const panelLeft = panelRef.current?.getBoundingClientRect().left || 0;
        const onMouseMove = (ev) => {
            if (!isResizingRef.current) return;
            const newWidth = Math.min(450, Math.max(160, ev.clientX - panelLeft));
            setPanelWidth(newWidth);
        };
        const onMouseUp = () => {
            isResizingRef.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, []);

    useEffect(() => {
        localStorage.setItem('noteflow-pagelist-width', String(panelWidth));
    }, [panelWidth]);

    useEffect(() => {
        if (ctx) {
            const fn = (e) => { if (!e.target.closest('.context-menu')) setCtx(null); };
            document.addEventListener('click', fn);
            return () => document.removeEventListener('click', fn);
        }
    }, [ctx]);

    useEffect(() => {
        if (moveMenu) {
            const fn = (e) => { if (!e.target.closest('.move-submenu')) setMoveMenu(null); };
            document.addEventListener('click', fn);
            return () => document.removeEventListener('click', fn);
        }
    }, [moveMenu]);

    function formatDate(d) {
        if (!d) return '';
        return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }

    function getPreview(c) {
        if (!c) return 'Página vacía';
        const t = c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        return t.length > 60 ? t.substring(0, 60) + '...' : t || 'Página vacía';
    }

    function requestDeletePage(pageId) {
        const page = section?.pages.find(p => p.id === pageId);
        setDeleteConfirm({
            type: 'page',
            name: page?.title || 'Sin título',
            onConfirm: () => { onDeletePage(pageId); setDeleteConfirm(null); },
        });
        setCtx(null);
    }

    // ── Drag handlers ──
    function handleDragStart(e, index) {
        dragItemRef.current = index;
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
    }

    function handleDragOver(e, index) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        dragOverRef.current = index;
        setDragOverIndex(index);
    }

    function handleDragEnd(e) {
        e.currentTarget.classList.remove('dragging');
        if (dragItemRef.current !== null && dragOverRef.current !== null && dragItemRef.current !== dragOverRef.current) {
            onReorderPages(dragItemRef.current, dragOverRef.current);
        }
        dragItemRef.current = null;
        dragOverRef.current = null;
        setDragOverIndex(null);
    }

    // ── Move to section: build list of all sections except current ──
    function getMoveSections() {
        if (!notebooks) return [];
        const targets = [];
        notebooks.forEach(nb => {
            nb.sections.forEach(sec => {
                if (nb.id === activeNotebookId && sec.id === activeSectionId) return;
                targets.push({ nbId: nb.id, nbName: nb.name, secId: sec.id, secName: sec.name });
            });
        });
        return targets;
    }

    const panelStyle = !collapsed && window.innerWidth > 768
        ? { width: panelWidth, minWidth: panelWidth, maxWidth: panelWidth }
        : {};

    if (!section) {
        return (
            <div className={`page-list-panel ${collapsed ? 'collapsed' : ''}`} ref={panelRef} style={panelStyle}>
                <div className="page-list-header"><h3>Páginas</h3></div>
                <div className="empty-state" style={{ padding: 20 }}><p style={{ fontSize: 12 }}>Selecciona una sección</p></div>
            </div>
        );
    }

    return (
        <div className={`page-list-panel ${collapsed ? 'collapsed' : ''}`} ref={panelRef} style={panelStyle}>
            <div className="page-list-header">
                <h3 style={{ color: section.color || '#7719AA' }}>{section.name}</h3>
                <button className="btn-icon" onClick={onAddPage} title="Nueva página"><Plus size={15} /></button>
            </div>
            <div className="page-list-content">
                {section.pages.map((page, index) => (
                    <div key={page.id}
                        className={`page-item ${activePageId === page.id ? 'active' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
                        draggable
                        onDragStart={e => handleDragStart(e, index)}
                        onDragOver={e => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectPage(page.id)}
                        onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, pageId: page.id }); setMoveMenu(null); }}>
                        <div className="page-item-drag-handle"><GripVertical size={12} /></div>
                        <div className="page-item-body">
                            <div className="page-item-title">{page.title || 'Sin título'}</div>
                            <div className="page-item-preview">{getPreview(page.content)}</div>
                            <div className="page-item-date">{formatDate(page.updatedAt)}</div>
                        </div>
                    </div>
                ))}
                <button className="add-item-btn" onClick={onAddPage}><Plus size={12} /> Agregar página</button>
            </div>

            {/* Context menu */}
            {ctx && (
                <div className="context-menu" style={{ left: ctx.x, top: ctx.y }}>
                    <button className="context-menu-item" onClick={() => { onDuplicatePage(ctx.pageId); setCtx(null); }}>
                        <Copy size={12} /> Duplicar página
                    </button>
                    <button className="context-menu-item" onClick={(e) => { e.stopPropagation(); setMoveMenu(moveMenu ? null : ctx.pageId); }}>
                        <MoveRight size={12} /> Mover a sección…
                    </button>
                    {moveMenu && (
                        <div className="move-submenu">
                            {getMoveSections().length === 0 ? (
                                <div className="move-submenu-empty">No hay otras secciones</div>
                            ) : (
                                getMoveSections().map(t => (
                                    <button key={`${t.nbId}-${t.secId}`} className="context-menu-item"
                                        onClick={() => { onMovePageToSection(ctx.pageId, t.nbId, t.secId); setCtx(null); setMoveMenu(null); }}>
                                        <span className="move-target">{t.nbName} → {t.secName}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                    <div className="context-menu-divider" />
                    <button className="context-menu-item danger" onClick={() => requestDeletePage(ctx.pageId)}>
                        <Trash2 size={12} /> Eliminar página
                    </button>
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
            {!collapsed && <div className="panel-resize-handle" onMouseDown={handleResizeMouseDown} />}
        </div>
    );
}
