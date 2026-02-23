import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import DraggableImage from '../extensions/DraggableImage.js';
import Link from '@tiptap/extension-link';
import { FileText, Check, RefreshCw, Download, ExternalLink, X, Loader2, Clipboard, RemoveFormatting, FileType } from 'lucide-react';
import { formatDate } from '../utils/helpers';

export default function EditorArea({ page, onTitleChange, onContentChange, onEditorReady, syncStatus, api, gdriveConnected }) {
    const [linkPopup, setLinkPopup] = useState(null);
    const [linkDownloading, setLinkDownloading] = useState(false);
    const [pastePopup, setPastePopup] = useState(null);
    const popupRef = useRef(null);
    const pastePopupRef = useRef(null);
    const pendingPasteRef = useRef(null);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            Underline,
            Placeholder.configure({ placeholder: 'Empieza a escribir aquí...' }),
            TaskList,
            TaskItem.configure({ nested: true }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            DraggableImage.configure({ allowBase64: true }),
            Link.configure({ openOnClick: false, HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' } }),
        ],
        content: page?.content || '',
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            if (onContentChange) onContentChange(html);
        },
        editorProps: {
            attributes: { spellcheck: 'true' },
            handlePaste: (view, event, slice) => {
                const clipboardData = event.clipboardData;
                if (!clipboardData) return false;

                const html = clipboardData.getData('text/html');
                const text = clipboardData.getData('text/plain');

                // Only show paste options if there's HTML content (formatted paste)
                if (html && html.trim()) {
                    event.preventDefault();

                    // Store the paste data for later use
                    pendingPasteRef.current = { html, text };

                    // Get cursor position for popup
                    const coords = view.coordsAtPos(view.state.selection.from);
                    const wrapperEl = view.dom.closest('.editor-wrapper');
                    const wrapperRect = wrapperEl?.getBoundingClientRect();

                    setPastePopup({
                        x: coords.left - (wrapperRect?.left || 0),
                        y: coords.bottom - (wrapperRect?.top || 0) + 8,
                    });

                    return true; // Prevent default paste
                }

                return false; // Let Tiptap handle plain text paste normally
            },
        },
    });

    useEffect(() => { if (editor && onEditorReady) onEditorReady(editor); }, [editor, onEditorReady]);
    useEffect(() => { if (editor && page) { const cur = editor.getHTML(); if (cur !== page.content) editor.commands.setContent(page.content || '', false); } }, [editor, page?.id]);
    useEffect(() => () => { if (onEditorReady) onEditorReady(null); }, []);

    // Close popups on outside click
    useEffect(() => {
        if (!linkPopup) return;
        const handleClickOutside = (e) => {
            if (popupRef.current && !popupRef.current.contains(e.target)) {
                setLinkPopup(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [linkPopup]);

    useEffect(() => {
        if (!pastePopup) return;
        const handleClickOutside = (e) => {
            if (pastePopupRef.current && !pastePopupRef.current.contains(e.target)) {
                // Auto-apply "keep original" if clicked outside
                handlePasteKeepOriginal();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [pastePopup]);

    // ── Paste option handlers ──
    function handlePasteKeepOriginal() {
        if (!editor || !pendingPasteRef.current) { setPastePopup(null); return; }
        const { html } = pendingPasteRef.current;
        editor.chain().focus().insertContent(html).run();
        pendingPasteRef.current = null;
        setPastePopup(null);
    }

    function handlePasteMergeFormat() {
        if (!editor || !pendingPasteRef.current) { setPastePopup(null); return; }
        const { html } = pendingPasteRef.current;
        // Strip inline styles but keep structural HTML (bold, italic, lists, etc.)
        const cleaned = html
            .replace(/\s*style="[^"]*"/gi, '')
            .replace(/\s*class="[^"]*"/gi, '')
            .replace(/<font[^>]*>/gi, '')
            .replace(/<\/font>/gi, '')
            .replace(/<span[^>]*>(.*?)<\/span>/gi, '$1');
        editor.chain().focus().insertContent(cleaned).run();
        pendingPasteRef.current = null;
        setPastePopup(null);
    }

    function handlePastePlainText() {
        if (!editor || !pendingPasteRef.current) { setPastePopup(null); return; }
        const { text } = pendingPasteRef.current;
        editor.chain().focus().insertContent(text || '').run();
        pendingPasteRef.current = null;
        setPastePopup(null);
    }

    // ── Click on Drive links → show action popup ──
    const handleEditorClick = useCallback((e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        // Check if it's a Google Drive link
        const driveMatch = href.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
        if (!driveMatch && !href.includes('drive.google.com')) {
            // Non-Drive link: open in default browser
            e.preventDefault();
            e.stopPropagation();
            window.open(href, '_blank');
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const fileId = driveMatch ? driveMatch[1] : null;
        const fileName = link.textContent || 'archivo';
        const rect = link.getBoundingClientRect();
        const wrapperRect = link.closest('.editor-wrapper')?.getBoundingClientRect();

        setLinkPopup({
            href,
            fileId,
            fileName,
            x: rect.left - (wrapperRect?.left || 0),
            y: rect.bottom - (wrapperRect?.top || 0) + 4,
        });
    }, []);

    async function handlePopupDownload() {
        if (!linkPopup || linkDownloading) return;
        const { fileId, fileName, href } = linkPopup;

        if (!fileId || !gdriveConnected || !api?.gdriveDownloadFile) {
            window.open(href, '_blank');
            setLinkPopup(null);
            return;
        }

        setLinkDownloading(true);
        try {
            const result = await api.gdriveDownloadFile(fileId, fileName);
            if (result?.success && result.path) {
                await api.openLocalFile(result.path);
            } else {
                window.open(href, '_blank');
            }
        } catch (err) {
            console.error('[EditorArea] Error descargando archivo:', err);
            window.open(href, '_blank');
        }
        setLinkDownloading(false);
        setLinkPopup(null);
    }

    function handlePopupViewOnline() {
        if (linkPopup?.href) {
            window.open(linkPopup.href, '_blank');
        }
        setLinkPopup(null);
    }

    // ── Click below content → append paragraphs ──
    const handleWrapperClick = useCallback((e) => {
        if (!editor) return;
        // Only handle clicks directly on the wrapper (not on editor content)
        if (e.target.closest('.ProseMirror')) return;

        const wrapperRect = e.currentTarget.getBoundingClientRect();
        const clickY = e.clientY - wrapperRect.top + e.currentTarget.scrollTop;
        const lineHeight = 28;
        const editorEl = e.currentTarget.querySelector('.ProseMirror');
        if (!editorEl) return;
        const editorHeight = editorEl.scrollHeight;

        if (clickY > editorHeight) {
            // Calculate how many empty paragraphs to add
            const linesNeeded = Math.ceil((clickY - editorHeight) / lineHeight);
            let content = '';
            for (let i = 0; i < linesNeeded; i++) {
                content += '<p></p>';
            }
            editor.chain().focus('end').insertContent(content).focus('end').run();
        }
    }, [editor]);

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
            <div className="editor-wrapper ruled" onClick={(e) => { handleEditorClick(e); handleWrapperClick(e); }} style={{ position: 'relative', cursor: 'text' }}>
                <EditorContent editor={editor} />

                {/* Drive link popup */}
                {linkPopup && (
                    <div className="file-action-popup" ref={popupRef} style={{ left: linkPopup.x, top: linkPopup.y }}>
                        <div className="file-action-popup-header">
                            <span className="file-action-popup-name">{linkPopup.fileName}</span>
                            <button className="btn-icon" onClick={() => setLinkPopup(null)}><X size={14} /></button>
                        </div>
                        <div className="file-action-popup-actions">
                            <button className="file-action-btn" onClick={handlePopupDownload} disabled={linkDownloading}>
                                {linkDownloading ? <Loader2 size={14} className="spin-icon" /> : <Download size={14} />}
                                <span>{linkDownloading ? 'Descargando...' : 'Descargar y abrir local'}</span>
                            </button>
                            <button className="file-action-btn" onClick={handlePopupViewOnline}>
                                <ExternalLink size={14} />
                                <span>Ver en el navegador</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Paste options popup */}
                {pastePopup && (
                    <div className="paste-options-popup" ref={pastePopupRef} style={{ left: pastePopup.x, top: pastePopup.y }}>
                        <div className="paste-options-label">Opciones de pegado</div>
                        <div className="paste-options-btns">
                            <button className="paste-option-btn" onClick={handlePasteKeepOriginal} title="Mantener formato de origen">
                                <Clipboard size={16} />
                                <span>Mantener formato</span>
                            </button>
                            <button className="paste-option-btn" onClick={handlePasteMergeFormat} title="Combinar formato">
                                <FileType size={16} />
                                <span>Combinar formato</span>
                            </button>
                            <button className="paste-option-btn" onClick={handlePastePlainText} title="Solo texto">
                                <RemoveFormatting size={16} />
                                <span>Solo texto</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
