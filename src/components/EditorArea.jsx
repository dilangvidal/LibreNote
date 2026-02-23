import React, { useEffect, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { FileText, Check, RefreshCw } from 'lucide-react';
import { formatDate } from '../utils/helpers';

export default function EditorArea({ page, onTitleChange, onContentChange, onEditorReady, syncStatus, onSlashSearch, api, gdriveConnected }) {
    const lastSlashRef = useRef('');

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            Placeholder.configure({ placeholder: 'Empieza a escribir aquí... (escribe /search para buscar en Drive)' }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Image,
        ],
        content: page?.content || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            if (onContentChange) onContentChange(html);
            // Detectar comando /search
            const text = editor.getText();
            if (text.endsWith('/search')) {
                const { from } = editor.state.selection;
                editor.chain().focus().deleteRange({ from: from - 7, to: from }).run();
                if (onSlashSearch) onSlashSearch();
            }
        },
        editorProps: { attributes: { spellcheck: 'true' } },
    });

    useEffect(() => { if (editor && onEditorReady) onEditorReady(editor); }, [editor, onEditorReady]);
    useEffect(() => { if (editor && page) { const cur = editor.getHTML(); if (cur !== page.content) editor.commands.setContent(page.content || '', false); } }, [editor, page?.id]);
    useEffect(() => () => { if (onEditorReady) onEditorReady(null); }, []);

    // ── Ctrl+Clic en links de Drive → descargar y abrir localmente ──
    const handleEditorClick = useCallback(async (e) => {
        // Solo procesar Ctrl+clic (o Cmd+clic en Mac)
        if (!e.ctrlKey && !e.metaKey) return;

        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Verificar si es un link de Google Drive
        const driveMatch = href.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
        if (!driveMatch && !href.includes('drive.google.com')) return;

        e.preventDefault();
        e.stopPropagation();

        const fileId = driveMatch ? driveMatch[1] : null;
        const fileName = link.textContent || 'archivo';

        if (!fileId) {
            // Si no pudimos extraer el ID, abrir en navegador
            if (api?.openLocalFile) {
                // Intentar abrir como URL externa
                window.open(href, '_blank');
            }
            return;
        }

        if (!gdriveConnected || !api?.gdriveDownloadFile) {
            window.open(href, '_blank');
            return;
        }

        // Indicar que está descargando
        link.style.opacity = '0.5';
        link.style.pointerEvents = 'none';

        try {
            const result = await api.gdriveDownloadFile(fileId, fileName);
            if (result?.success && result.path) {
                await api.openLocalFile(result.path);
            } else {
                // Fallback: abrir en navegador
                window.open(href, '_blank');
            }
        } catch (err) {
            console.error('[EditorArea] Error descargando archivo:', err);
            window.open(href, '_blank');
        } finally {
            link.style.opacity = '';
            link.style.pointerEvents = '';
        }
    }, [api, gdriveConnected]);

    if (!page) {
        return (
            <div className="editor-area">
                <div className="empty-state">
                    <FileText size={48} strokeWidth={1} />
                    <h2>Selecciona una página</h2>
                    <p>Elige una sección y una página del panel lateral para empezar a tomar notas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="editor-area">
            <div className="editor-header">
                <div className="editor-page-title">
                    <input value={page.title} onChange={e => onTitleChange(e.target.value)} placeholder="Título de la página" />
                </div>
                <div className="editor-meta">
                    <span>{formatDate(page.updatedAt)}</span>
                    {syncStatus === 'syncing' && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={11} /> Sincronizando...</span>}
                    {syncStatus === 'success' && <span style={{ color: '#107C10', display: 'flex', alignItems: 'center', gap: 4 }}><Check size={11} /> Guardado</span>}
                </div>
            </div>
            <div className="editor-wrapper ruled" onClick={handleEditorClick}>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
