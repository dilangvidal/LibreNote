import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText } from 'lucide-react';
import ConfirmDeleteModal from './ConfirmDeleteModal.jsx';

export default function PageList({ collapsed, section, activePageId, onSelectPage, onAddPage, onDeletePage, gdriveConnected }) {
    const [ctx, setCtx] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);

    useEffect(() => { if (ctx) { const fn = () => setCtx(null); document.addEventListener('click', fn); return () => document.removeEventListener('click', fn); } }, [ctx]);

    function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    function getPreview(c) { if (!c) return 'Página vacía'; const t = c.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > 60 ? t.substring(0, 60) + '...' : t || 'Página vacía'; }

    function requestDeletePage(pageId) {
        const page = section?.pages.find(p => p.id === pageId);
        setDeleteConfirm({
            type: 'page',
            name: page?.title || 'Sin título',
            onConfirm: () => { onDeletePage(pageId); setDeleteConfirm(null); },
        });
        setCtx(null);
    }

    if (!section) {
        return (
            <div className={`page-list-panel ${collapsed ? 'collapsed' : ''}`}>
                <div className="page-list-header"><h3>Páginas</h3></div>
                <div className="empty-state" style={{ padding: 20 }}><p style={{ fontSize: 12 }}>Selecciona una sección</p></div>
            </div>
        );
    }

    return (
        <div className={`page-list-panel ${collapsed ? 'collapsed' : ''}`}>
            <div className="page-list-header">
                <h3 style={{ color: section.color || '#7719AA' }}>{section.name}</h3>
                <button className="btn-icon" onClick={onAddPage} title="Nueva página"><Plus size={15} /></button>
            </div>
            <div className="page-list-content">
                {section.pages.map(page => (
                    <div key={page.id} className={`page-item ${activePageId === page.id ? 'active' : ''}`}
                        onClick={() => onSelectPage(page.id)}
                        onContextMenu={e => { e.preventDefault(); setCtx({ x: e.clientX, y: e.clientY, pageId: page.id }); }}>
                        <div className="page-item-title">{page.title || 'Sin título'}</div>
                        <div className="page-item-preview">{getPreview(page.content)}</div>
                        <div className="page-item-date">{formatDate(page.updatedAt)}</div>
                    </div>
                ))}
                <button className="add-item-btn" onClick={onAddPage}><Plus size={12} /> Agregar página</button>
            </div>
            {ctx && (
                <div className="context-menu" style={{ left: ctx.x, top: ctx.y }}>
                    <button className="context-menu-item danger" onClick={() => requestDeletePage(ctx.pageId)}><Trash2 size={12} /> Eliminar página</button>
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
        </div>
    );
}
