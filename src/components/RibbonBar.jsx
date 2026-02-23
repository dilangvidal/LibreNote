import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, Highlighter, List, ListOrdered, CheckSquare, AlignLeft, AlignCenter, AlignRight, Quote, Code, Minus, Undo2, Redo2, Image, Paperclip, Search, Clipboard, Scissors, Copy, RemoveFormatting, Table2, Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Merge, Split, Trash, Columns, Rows } from 'lucide-react';

export default function RibbonBar({ editor, onOpenDriveSearch, gdriveConnected, api }) {
    const [activeTab, setActiveTab] = useState('home');
    const [showTablePicker, setShowTablePicker] = useState(false);
    const [hoverRows, setHoverRows] = useState(0);
    const [hoverCols, setHoverCols] = useState(0);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });
    const [isInTable, setIsInTable] = useState(false);
    const tableBtnRef = useRef(null);
    const tablePickerRef = useRef(null);

    function cls(active) { return `ribbon-btn ${active ? 'active' : ''}`; }

    // Detect when cursor is inside a table
    useEffect(() => {
        if (!editor) { setIsInTable(false); return; }
        const handleUpdate = () => {
            const inTable = editor.isActive('table');
            setIsInTable(inTable);
            // Auto-switch to table tab when entering a table
            if (inTable && activeTab !== 'table-layout') {
                setActiveTab('table-layout');
            }
            // Switch back when leaving a table
            if (!inTable && activeTab === 'table-layout') {
                setActiveTab('home');
            }
        };
        editor.on('selectionUpdate', handleUpdate);
        editor.on('transaction', handleUpdate);
        return () => {
            editor.off('selectionUpdate', handleUpdate);
            editor.off('transaction', handleUpdate);
        };
    }, [editor, activeTab]);

    // Close table picker on outside click
    useEffect(() => {
        if (!showTablePicker) return;
        const handleClick = (e) => {
            if (
                tablePickerRef.current && !tablePickerRef.current.contains(e.target) &&
                tableBtnRef.current && !tableBtnRef.current.contains(e.target)
            ) {
                setShowTablePicker(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showTablePicker]);

    function toggleTablePicker() {
        if (!showTablePicker && tableBtnRef.current) {
            const rect = tableBtnRef.current.getBoundingClientRect();
            setPickerPos({ top: rect.bottom + 4, left: rect.left });
        }
        setShowTablePicker(v => !v);
    }

    function noFocusLoss(e) { e.preventDefault(); }

    async function handleImageInsert() {
        if (typeof window !== 'undefined' && window.librenote?.pickImage) {
            const result = await window.librenote.pickImage();
            if (result?.dataUrl) {
                editor.chain().focus().setImage({ src: result.dataUrl }).run();
                if (gdriveConnected && result.path && api?.gdriveUploadFile) {
                    api.gdriveUploadFile(result.path, result.name).catch(console.error);
                }
            }
        } else {
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

    function handleClearFormatting() {
        if (!editor) return;
        editor.chain().focus().unsetAllMarks().clearNodes().run();
    }

    // Table picker via portal
    const tablePickerDropdown = showTablePicker ? ReactDOM.createPortal(
        <div
            className="table-picker-dropdown"
            ref={tablePickerRef}
            style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, zIndex: 9999 }}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="table-picker-label">{hoverRows > 0 ? `${hoverRows} × ${hoverCols}` : 'Selecciona tamaño'}</div>
            <div className="table-picker-grid">
                {Array.from({ length: 8 }, (_, r) =>
                    Array.from({ length: 10 }, (_, c) => (
                        <div
                            key={`${r}-${c}`}
                            className={`table-picker-cell ${r < hoverRows && c < hoverCols ? 'active' : ''}`}
                            onMouseEnter={() => { setHoverRows(r + 1); setHoverCols(c + 1); }}
                            onClick={() => {
                                editor.chain().focus().insertTable({ rows: r + 1, cols: c + 1, withHeaderRow: true }).run();
                                setShowTablePicker(false);
                                setHoverRows(0);
                                setHoverCols(0);
                            }}
                        />
                    ))
                )}
            </div>
        </div>,
        document.body
    ) : null;

    // Build ribbon tabs list — "Diseño" only appears when cursor is in a table
    const tabs = [
        { key: 'home', label: 'Inicio' },
        { key: 'insert', label: 'Insertar' },
    ];
    if (isInTable) {
        tabs.push({ key: 'table-layout', label: 'Diseño de tabla', contextual: true });
    }

    return (
        <>
            <div className="ribbon-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`ribbon-tab ${activeTab === tab.key ? 'active' : ''} ${tab.contextual ? 'contextual' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="ribbon-toolbar">
                {/* ── HOME TAB ── */}
                {activeTab === 'home' && editor && (
                    <>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => document.execCommand('paste')} title="Pegar"><Clipboard size={15} /><span className="label">Pegar</span></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => document.execCommand('cut')} title="Cortar"><Scissors size={14} /></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => document.execCommand('copy')} title="Copiar"><Copy size={14} /></button>
                        </div>
                        <div className="ribbon-group">
                            <select className="ribbon-select"
                                value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
                                onChange={e => { const v = e.target.value; if (v === 'p') editor.chain().focus().setParagraph().run(); else editor.chain().focus().toggleHeading({ level: parseInt(v[1]) }).run(); }}>
                                <option value="p">Normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option>
                            </select>
                        </div>
                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('bold'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleBold().run()} title="Negrita"><Bold size={15} /></button>
                            <button className={cls(editor.isActive('italic'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleItalic().run()} title="Cursiva"><Italic size={15} /></button>
                            <button className={cls(editor.isActive('underline'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Subrayado"><Underline size={15} /></button>
                            <button className={cls(editor.isActive('strike'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleStrike().run()} title="Tachado"><Strikethrough size={15} /></button>
                            <button className={cls(editor.isActive('highlight'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleHighlight().run()} title="Resaltar"><Highlighter size={15} /></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={handleClearFormatting} title="Quitar formato"><RemoveFormatting size={15} /></button>
                        </div>
                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('bulletList'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Viñetas"><List size={15} /></button>
                            <button className={cls(editor.isActive('orderedList'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numerada"><ListOrdered size={15} /></button>
                            <button className={cls(editor.isActive('taskList'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Tareas"><CheckSquare size={15} /></button>
                        </div>
                        <div className="ribbon-group">
                            <button className={cls(editor.isActive({ textAlign: 'left' }))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="Izquierda"><AlignLeft size={15} /></button>
                            <button className={cls(editor.isActive({ textAlign: 'center' }))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Centro"><AlignCenter size={15} /></button>
                            <button className={cls(editor.isActive({ textAlign: 'right' }))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="Derecha"><AlignRight size={15} /></button>
                        </div>
                        <div className="ribbon-group">
                            <button className={cls(editor.isActive('blockquote'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita"><Quote size={15} /></button>
                            <button className={cls(editor.isActive('codeBlock'))} onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code size={15} /></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus size={15} /></button>
                        </div>
                        {gdriveConnected && (
                            <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={onOpenDriveSearch} title="Buscar en Drive"><Search size={15} /><span className="label">Drive</span></button>
                            </div>
                        )}
                        <div className="ribbon-group" style={{ marginLeft: 'auto' }}>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer"><Undo2 size={15} /></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer"><Redo2 size={15} /></button>
                        </div>
                    </>
                )}

                {/* ── INSERT TAB ── */}
                {activeTab === 'insert' && editor && (
                    <>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onClick={handleImageInsert} title="Imagen"><Image size={15} /><span className="label">Imagen</span></button>
                            <button className="ribbon-btn" onClick={handleFileAttach} title="Archivo"><Paperclip size={15} /><span className="label">Archivo</span></button>
                        </div>
                        <div className="ribbon-group">
                            <button ref={tableBtnRef} className="ribbon-btn" onClick={toggleTablePicker} title="Tabla"><Table2 size={15} /><span className="label">Tabla</span></button>
                        </div>
                        <div className="ribbon-group">
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Línea"><Minus size={15} /><span className="label">Línea</span></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Código"><Code size={15} /><span className="label">Código</span></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleTaskList().run()} title="Tareas"><CheckSquare size={15} /><span className="label">Tareas</span></button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Cita"><Quote size={15} /><span className="label">Cita</span></button>
                        </div>
                        {gdriveConnected && (
                            <div className="ribbon-group">
                                <button className="ribbon-btn" onClick={onOpenDriveSearch} title="Buscar en Drive"><Search size={15} /><span className="label">Buscar en Drive</span></button>
                            </div>
                        )}
                    </>
                )}

                {/* ── TABLE LAYOUT TAB (contextual, Word-style) ── */}
                {activeTab === 'table-layout' && editor && isInTable && (
                    <>
                        <div className="ribbon-group">
                            <span className="ribbon-group-title">Filas y columnas</span>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().addRowBefore().run()} title="Insertar fila arriba">
                                <ArrowUp size={14} /><span className="label">Arriba</span>
                            </button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().addRowAfter().run()} title="Insertar fila abajo">
                                <ArrowDown size={14} /><span className="label">Abajo</span>
                            </button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().addColumnBefore().run()} title="Insertar columna izquierda">
                                <ArrowLeft size={14} /><span className="label">Izquierda</span>
                            </button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().addColumnAfter().run()} title="Insertar columna derecha">
                                <ArrowRight size={14} /><span className="label">Derecha</span>
                            </button>
                        </div>

                        <div className="ribbon-group">
                            <span className="ribbon-group-title">Combinar</span>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().mergeCells().run()} title="Combinar celdas">
                                <Merge size={14} /><span className="label">Combinar</span>
                            </button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().splitCell().run()} title="Dividir celda">
                                <Split size={14} /><span className="label">Dividir</span>
                            </button>
                        </div>

                        <div className="ribbon-group">
                            <span className="ribbon-group-title">Eliminar</span>
                            <button className="ribbon-btn ribbon-btn-danger" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().deleteRow().run()} title="Eliminar fila">
                                <Rows size={14} /><span className="label">Fila</span>
                            </button>
                            <button className="ribbon-btn ribbon-btn-danger" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().deleteColumn().run()} title="Eliminar columna">
                                <Columns size={14} /><span className="label">Columna</span>
                            </button>
                            <button className="ribbon-btn ribbon-btn-danger" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().deleteTable().run()} title="Eliminar tabla">
                                <Trash size={14} /><span className="label">Tabla</span>
                            </button>
                        </div>

                        <div className="ribbon-group">
                            <span className="ribbon-group-title">Encabezado</span>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleHeaderRow().run()} title="Alternar fila de encabezado">
                                <Rows size={14} /><span className="label">Fila</span>
                            </button>
                            <button className="ribbon-btn" onMouseDown={noFocusLoss} onClick={() => editor.chain().focus().toggleHeaderColumn().run()} title="Alternar columna de encabezado">
                                <Columns size={14} /><span className="label">Columna</span>
                            </button>
                        </div>
                    </>
                )}

                {!editor && (
                    <div className="ribbon-group">
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, padding: '0 12px' }}>Selecciona una página para editar</span>
                    </div>
                )}
            </div>

            {tablePickerDropdown}
        </>
    );
}
