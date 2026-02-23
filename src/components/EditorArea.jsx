import React, { useEffect, useRef } from 'react';
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

export default function EditorArea({ page, onTitleChange, onContentChange, onEditorReady, syncStatus, onSlashSearch }) {
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
            // Detect /search command
            const text = editor.getText();
            if (text.endsWith('/search')) {
                // Remove the /search text and open Drive search
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

    function formatDate(d) { if (!d) return ''; return new Date(d).toLocaleString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

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
            <div className="editor-wrapper ruled">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
