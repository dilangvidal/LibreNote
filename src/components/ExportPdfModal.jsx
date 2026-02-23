import React, { useState } from 'react';
import { FileDown, X, Book, FolderOpen, FileText, Loader2, Check } from 'lucide-react';
import api from '../services/api.js';

/**
 * ExportPdfModal – Modal that lets the user choose what to export to PDF:
 *   - Current page
 *   - Current section (all pages)
 *   - Entire notebook (all sections + pages)
 */
export default function ExportPdfModal({ notebooks, activeNotebookId, activeSectionId, activePageId, onClose }) {
    const [scope, setScope] = useState('page'); // 'page' | 'section' | 'notebook'
    const [exporting, setExporting] = useState(false);
    const [result, setResult] = useState(null);

    const notebook = notebooks.find(n => n.id === activeNotebookId);
    const section = notebook?.sections.find(s => s.id === activeSectionId);
    const page = section?.pages.find(p => p.id === activePageId);

    function buildPageHtml(p, includeTitle = true) {
        let html = '';
        if (includeTitle) {
            html += `<div class="page-title">${p.title || 'Sin título'}</div>`;
        }
        html += p.content || '<p><em>Página vacía</em></p>';
        return html;
    }

    function buildSectionHtml(sec) {
        let html = `<div class="section-header"><h2>${sec.name || 'Sin nombre'}</h2></div>`;
        sec.pages.forEach((p, i) => {
            if (i > 0) html += '<div class="page-break"></div>';
            html += buildPageHtml(p);
        });
        return html;
    }

    function buildNotebookHtml(nb) {
        const date = new Date().toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
        let html = `<div class="notebook-cover"><h1>${nb.name || 'Sin nombre'}</h1><div class="date">Exportado el ${date}</div></div>`;
        nb.sections.forEach((sec, i) => {
            if (i > 0 || true) html += '<div class="page-break"></div>';
            html += buildSectionHtml(sec);
        });
        return html;
    }

    async function handleExport() {
        setExporting(true);
        setResult(null);

        try {
            let htmlContent = '';
            let suggestedName = '';

            switch (scope) {
                case 'page':
                    if (!page) { setResult({ error: 'No hay página seleccionada' }); setExporting(false); return; }
                    htmlContent = buildPageHtml(page);
                    suggestedName = page.title || 'pagina';
                    break;
                case 'section':
                    if (!section) { setResult({ error: 'No hay sección seleccionada' }); setExporting(false); return; }
                    htmlContent = buildSectionHtml(section);
                    suggestedName = section.name || 'seccion';
                    break;
                case 'notebook':
                    if (!notebook) { setResult({ error: 'No hay notebook seleccionado' }); setExporting(false); return; }
                    htmlContent = buildNotebookHtml(notebook);
                    suggestedName = notebook.name || 'notebook';
                    break;
            }

            // Sanitize filename
            suggestedName = suggestedName.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ _-]/g, '').trim() || 'export';

            // Use Electron IPC if available, otherwise browser print fallback
            let res;
            if (typeof api.exportPdf === 'function') {
                res = await api.exportPdf(htmlContent, suggestedName);
            } else {
                // Browser / Electron fallback via print dialog
                const pdfStyles = `
body { font-family: 'Segoe UI', -apple-system, sans-serif; padding: 40px; color: #323130; font-size: 13px; line-height: 1.6; }
h1 { font-size: 24px; font-weight: 600; margin: 20px 0 8px; border-bottom: 2px solid #7719AA; padding-bottom: 6px; }
h2 { font-size: 18px; font-weight: 600; color: #7719AA; margin: 16px 0 6px; }
h3 { font-size: 15px; font-weight: 600; color: #605E5C; margin: 12px 0 4px; }
h4 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
p { margin: 4px 0; } ul, ol { padding-left: 1.5em; } li { margin: 2px 0; }
blockquote { border-left: 3px solid #7719AA; padding-left: 12px; color: #605E5C; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { border: 1px solid #D2D0CE; padding: 6px 10px; text-align: left; }
th { background: #F3ECFA; font-weight: 600; }
img { max-width: 100%; } .page-break { page-break-before: always; }
.section-header { background: #F3ECFA; padding: 8px 16px; margin: 16px 0 8px; border-radius: 4px; }
.page-title { color: #7719AA; font-size: 18px; font-weight: 300; margin: 12px 0 6px; border-bottom: 1px solid #EDEBE9; padding-bottom: 4px; }
.notebook-cover { text-align: center; padding: 60px 20px; }
.notebook-cover h1 { font-size: 32px; border: none; color: #7719AA; }
.notebook-cover .date { color: #A19F9D; font-size: 12px; margin-top: 8px; }`;
                const printWin = window.open('', '_blank', 'width=800,height=600');
                if (!printWin) { res = { success: false, error: 'No se pudo abrir la ventana de impresión' }; }
                else {
                    printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${suggestedName}</title><style>${pdfStyles}</style></head><body>${htmlContent}</body></html>`);
                    printWin.document.close();
                    setTimeout(() => { printWin.print(); }, 300);
                    res = { success: true };
                }
            }

            if (res.canceled) {
                setResult(null);
            } else if (res.success) {
                setResult({ success: true, path: res.path });
            } else {
                setResult({ error: res.error || 'Error desconocido' });
            }
        } catch (e) {
            setResult({ error: e.message });
        }

        setExporting(false);
    }

    const scopes = [
        { key: 'page', label: 'Página actual', icon: FileText, detail: page?.title || 'Sin título', disabled: !page },
        { key: 'section', label: 'Sección completa', icon: FolderOpen, detail: section ? `${section.name} (${section.pages.length} páginas)` : 'No seleccionada', disabled: !section },
        { key: 'notebook', label: 'Notebook completo', icon: Book, detail: notebook ? `${notebook.name} (${notebook.sections.length} secciones)` : 'No seleccionado', disabled: !notebook },
    ];

    return (
        <>
            <div className="drive-search-overlay" onClick={onClose} />
            <div className="export-pdf-modal">
                <div className="export-pdf-header">
                    <FileDown size={18} />
                    <h3>Exportar a PDF</h3>
                    <button className="btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }}><X size={16} /></button>
                </div>

                <div className="export-pdf-body">
                    <div className="export-scope-label">¿Qué deseas exportar?</div>
                    <div className="export-scope-options">
                        {scopes.map(s => (
                            <button
                                key={s.key}
                                className={`export-scope-btn ${scope === s.key ? 'selected' : ''}`}
                                onClick={() => setScope(s.key)}
                                disabled={s.disabled}
                            >
                                <s.icon size={20} />
                                <div className="export-scope-text">
                                    <div className="export-scope-name">{s.label}</div>
                                    <div className="export-scope-detail">{s.detail}</div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {result?.error && (
                        <div className="export-result error">
                            <span>{result.error}</span>
                        </div>
                    )}
                    {result?.success && (
                        <div className="export-result success">
                            <Check size={14} />
                            <span>PDF exportado exitosamente</span>
                        </div>
                    )}
                </div>

                <div className="export-pdf-footer">
                    <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
                    <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
                        {exporting ? <><Loader2 size={14} className="spin-icon" /> Exportando...</> : <><FileDown size={14} /> Exportar PDF</>}
                    </button>
                </div>
            </div>
        </>
    );
}
