import { NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import { Table } from '@tiptap/extension-table';
import React, { useRef, useState, useEffect } from 'react';

function TableNodeView({ node, getPos, editor, updateAttributes }) {
    const wrapperRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const resizeStartRef = useRef(null);

    // ── RESIZE ──
    function onResizeMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const tableEl = wrapperRef.current?.querySelector('table');
        const startW = tableEl?.offsetWidth || 400;
        const startH = tableEl?.offsetHeight || 100;

        resizeStartRef.current = { startX, startY, startW, startH };

        function onMouseMove(ev) {
            const dw = ev.clientX - startX;
            // Apply width to the table via inline style on the wrapper
            if (wrapperRef.current) {
                const newW = Math.max(200, startW + dw);
                wrapperRef.current.style.width = newW + 'px';
                const tableInner = wrapperRef.current.querySelector('table');
                if (tableInner) tableInner.style.width = '100%';
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    // ── DRAG ──
    function onDragHandleMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);

        const pos = getPos();
        const nodeSize = node.nodeSize;

        // Use TipTap's drag-and-drop via DataTransfer
        const dragEvent = new DragEvent('dragstart', { bubbles: true });
        wrapperRef.current?.dispatchEvent(dragEvent);

        // Simpler: use ProseMirror selection + cut/paste on drop
        // We'll use a drag ghost approach
        const ghost = document.createElement('div');
        ghost.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0.5;background:var(--bg-sidebar);padding:8px;border-radius:6px;font-size:12px;color:var(--text-primary);pointer-events:none;';
        ghost.textContent = '⠿ Tabla';
        document.body.appendChild(ghost);

        let dropIndicatorEl = null;
        let targetPos = null;

        function onMouseMove(ev) {
            // Find nearest block element in the editor
            const editorEl = document.querySelector('.ProseMirror');
            if (!editorEl) return;
            ghost.style.left = ev.clientX + 12 + 'px';
            ghost.style.top = ev.clientY - 10 + 'px';

            // Find closest paragraph/heading above cursor
            const elems = editorEl.querySelectorAll('p, h1, h2, h3, blockquote, ul, ol, hr');
            let closest = null, closestDist = Infinity, insertBefore = true;

            elems.forEach(el => {
                if (el.closest('table')) return; // skip cells
                const rect = el.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const dist = Math.abs(ev.clientY - midY);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = el;
                    insertBefore = ev.clientY < midY;
                }
            });

            // Clear old indicator
            if (dropIndicatorEl) {
                dropIndicatorEl.classList.remove('table-drop-before', 'table-drop-after');
            }

            if (closest) {
                dropIndicatorEl = closest;
                closest.classList.add(insertBefore ? 'table-drop-before' : 'table-drop-after');
                // Resolve ProseMirror position
                const editorView = editor.view;
                const domPos = editorView.posAtDOM(closest, 0);
                targetPos = insertBefore ? domPos - 1 : domPos + closest.textContent.length + 1;
            }
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            ghost.remove();
            setIsDragging(false);

            if (dropIndicatorEl) {
                dropIndicatorEl.classList.remove('table-drop-before', 'table-drop-after');
            }

            if (targetPos !== null) {
                const { state, dispatch } = editor.view;
                const from = pos;
                const to = from + nodeSize;

                if (targetPos < from || targetPos > to) {
                    const nodeToMove = state.doc.nodeAt(from);
                    if (!nodeToMove) return;

                    const tr = state.tr;
                    // Delete from original position
                    tr.delete(from, to);
                    // Adjust target position after deletion
                    const adjustedTarget = targetPos > from ? targetPos - nodeSize : targetPos;
                    // Insert at new position
                    tr.insert(Math.max(0, adjustedTarget), nodeToMove);
                    dispatch(tr);
                }
            }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    return (
        <NodeViewWrapper>
            <div
                ref={wrapperRef}
                className={`table-node-wrapper${isDragging ? ' is-dragging' : ''}`}
                contentEditable={false}
                style={{ userSelect: 'none' }}
            >
                {/* Drag handle */}
                <div
                    className="table-drag-handle"
                    onMouseDown={onDragHandleMouseDown}
                    title="Arrastrar tabla"
                >
                    ⠿
                </div>

                {/* The actual table content — editable */}
                <div contentEditable={true} suppressContentEditableWarning style={{ display: 'contents' }}>
                    <NodeViewContent as="table" />
                </div>

                {/* Resize handle */}
                <div
                    className="table-resize-handle"
                    onMouseDown={onResizeMouseDown}
                    title="Redimensionar tabla"
                />
            </div>
        </NodeViewWrapper>
    );
}

// Export an extended Table that uses this NodeView
export const TableWithWrapper = Table.extend({
    addNodeView() {
        return ReactNodeViewRenderer(TableNodeView);
    },
});