import React, { useState } from 'react';
import { Bold, Italic, Underline, Strikethrough, Highlighter, List, ListOrdered, CheckSquare, AlignLeft, AlignCenter, AlignRight, Quote, Code, Minus, Undo2, Redo2, Image, Paperclip, FileSearch, Clipboard, Scissors, Copy } from 'lucide-react';

export default function RibbonBar({ editor, onOpenDriveSearch, gdriveConnected, api }) {
    const [activeTab, setActiveTab] = useState('home');

    function cls(active) { return `ribbon-btn ${active ? 'active' : ''}`; }

    async function handleImageInsert() {
        if (typeof window !== 'undefined' && window.librenote?.pickImage) {
            const result = await window.librenote.pickImage();
            if (result?.dataUrl) {
                editor.chain().focus().setImage({ src: result.dataUrl }).run();
                // Upload to Drive if connected
                if (gdriveConnected && result.path && api?.gdriveUploadFile) {
                    api.gdriveUploadFile(result.path, result.name).catch(console.error);
                }
            }
        } else {
            // Browser fallback: file input
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = () => editor.chain().focus().setImage({ src: reader.result }).run();
                    reader.readAsDataURL(file);
                }
            };
            input.click();
        }
    }

    async function handleFileAttach() {
        if (typeof window !== 'undefined' && window.librenote?.pickFile) {
            const result = await window.librenote.pickFile('All Files');
            if (result) {
                if (gdriveConnected && api?.gdriveUploadFile) {
                    const uploadResult = await api.gdriveUploadFile(result.path, result.name);
                    if (uploadResult?.success && uploadResult.file?.webViewLink) {
                        editor.chain().focus().insertContent(`<p><a href="${uploadResult.file.webViewLink}" target="_blank">${result.name}</a></p>`).run();
                    } else {
                        editor.chain().focus().insertContent(`<p><strong>[Archivo adjunto]</strong> ${result.name}</p>`).run();
                    }
                } else {
                    editor.chain().focus().insertContent(`<p><strong>[Archivo adjunto]</strong> ${result.name}</p>`).run();
                }
            }
        } else {
            // Browser fallback
            const input = document.createElement('input');
            input.type = 'file';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (file) {
                    editor.chain().focus().insertContent(`<p><strong>[Archivo adjunto]</strong> ${file.name} (${(file.size / 1024).toFixed(1)} KB)</p>`).run();
                }
            };
            input.click();
        }
    }

    return (
        <>
            <div className="ribbon-tabs">
                {[{ key: 'home', label: 'Inicio' }, { key: 'insert', label: 'Insertar' }].map(tab => (
                    <button key={tab.key} className={`ribbon-tab ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
                ))}
            </div>

            <div className="ribbon-toolbar">
                {activeTab === 'home' && editor && (
                    <>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onClick={() => document.execCommand('paste')} title="Pegar"><Clipboard size={15} /><span className="label">Pegar</span></button>
                            <button className="ribbon-btn" onClick={() => document.execCommand('cut')} title="Cortar"><Scissors size={14} /></button>
                            <button className="ribbon-btn" onClick={() => document.execCommand('copy')} title="Copiar"><Copy size={14} /></button>
                        </div>

                        <div className="ribbon-group">
                            <select className="ribbon-select"
                                value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
                                onChange={e => { const v = e.target.value; if (v === 'p') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) }).run(); }}>
                                <option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option>
                            </select>
                        </div>

                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita"><Bold size={15} /></button>
                            <button className={cls(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva"><Italic size={15} /></button>
                            <button className={cls(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado"><Underline size={15} /></button>
                            <button className={cls(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={15} /></button>
                            <button className={cls(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Resaltar"><Highlighter size={15} /></button>
                        </div>

                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Viñetas"><List size={15} /></button>
                            <button className={cls(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numerada"><ListOrdered size={15} /></button>
                            <button className={cls(editor.isActive('taskList'))} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Tareas"><CheckSquare size={15} /></button>
                        </div>

                        <div className="ribbon-group">
                            <button className={cls(editor.isActive({ textAlign: 'left' }))} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Izquierda"><AlignLeft size={15} /></button>
                            <button className={cls(editor.isActive({ textAlign: 'center' }))} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centro"><AlignCenter size={15} /></button>
                            <button className={cls(editor.isActive({ textAlign: 'right' }))} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Derecha"><AlignRight size={15} /></button>
                        </div>

                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita"><Quote size={15} /></button>
                            <button className={cls(editor.isActive('codeBlock'))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code size={15} /></button>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus size={15} /></button>
                        </div>

                        <div className="ribbon-group" style={{ marginLeft: 'auto' }}>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo2 size={15} /></button>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo2 size={15} /></button>
                        </div>
                    </>
                )}

                {activeTab === 'insert' && editor && (
                    <>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onClick={handleImageInsert} title="Imagen"><Image size={15} /><span className="label">Imagen</span></button>
                            <button className="ribbon-btn" onClick={handleFileAttach} title="Archivo"><Paperclip size={15} /><span className="label">Archivo</span></button>
                        </div>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus size={15} /><span className="label">Línea</span></button>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code size={15} /><span className="label">Código</span></button>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().toggleTaskList().run()} title="Tareas"><CheckSquare size={15} /><span className="label">Tareas</span></button>
                            <button className="ribbon-btn" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita"><Quote size={15} /><span className="label">Cita</span></button>
                        </div>
                        {gdriveConnected && (
                            <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={onOpenDriveSearch} title="Buscar en Drive"><FileSearch size={15} /><span className="label">Buscar en Drive</span></button>
                            </div>
                        )}
                    </>
                )}

                {!editor && (
                    <div className="ribbon-group">
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: '0 12px' }}>Selecciona una página para editar</span>
                    </div>
                )}
            </div>
        </>
    );
}
