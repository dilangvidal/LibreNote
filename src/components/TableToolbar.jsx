import React from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Merge, Split, Trash } from 'lucide-react';

/**
 * Floating toolbar that appears when the cursor is inside a table.
 * Provides controls for adding/deleting rows and columns, merging/splitting cells, and deleting the table.
 */
export default function TableToolbar({ editor }) {
    if (!editor || !editor.isActive('table')) return null;

    const btn = (onClick, title, icon, danger = false) => (
        <button
            className={`table-toolbar-btn ${danger ? 'danger' : ''}`}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
            onMouseDown={(e) => e.preventDefault()}
            title={title}
        >
            {icon}
        </button>
    );

    return (
        <div className="table-floating-toolbar">
            <div className="table-toolbar-group">
                <span className="table-toolbar-label">Columna</span>
                {btn(() => editor.chain().focus().addColumnBefore().run(), 'Insertar columna antes', <ArrowLeft size={13} />)}
                {btn(() => editor.chain().focus().addColumnAfter().run(), 'Insertar columna después', <ArrowRight size={13} />)}
                {btn(() => editor.chain().focus().deleteColumn().run(), 'Eliminar columna', <Trash2 size={13} />, true)}
            </div>
            <div className="table-toolbar-divider" />
            <div className="table-toolbar-group">
                <span className="table-toolbar-label">Fila</span>
                {btn(() => editor.chain().focus().addRowBefore().run(), 'Insertar fila arriba', <ArrowUp size={13} />)}
                {btn(() => editor.chain().focus().addRowAfter().run(), 'Insertar fila abajo', <ArrowDown size={13} />)}
                {btn(() => editor.chain().focus().deleteRow().run(), 'Eliminar fila', <Trash2 size={13} />, true)}
            </div>
            <div className="table-toolbar-divider" />
            <div className="table-toolbar-group">
                <span className="table-toolbar-label">Celdas</span>
                {btn(() => editor.chain().focus().mergeCells().run(), 'Combinar celdas', <Merge size={13} />)}
                {btn(() => editor.chain().focus().splitCell().run(), 'Dividir celda', <Split size={13} />)}
            </div>
            <div className="table-toolbar-divider" />
            {btn(() => editor.chain().focus().deleteTable().run(), 'Eliminar tabla', <Trash size={13} />, true)}
        </div>
    );
}
