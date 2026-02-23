import Image from '@tiptap/extension-image';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * DraggableImage — Extensión Tiptap que permite arrastrar y redimensionar imágenes.
 * Extiende la extensión Image con soporte para drag & drop libre y resize.
 */
const DraggableImage = Image.extend({
    name: 'draggableImage',

    addAttributes() {
        return {
            ...this.parent?.(),
            isDraggable: { default: true },
            width: { default: null },
            height: { default: null },
        };
    },

    addNodeView() {
        return ({ node, getPos, editor }) => {
            const wrapper = document.createElement('div');
            wrapper.classList.add('draggable-image-wrapper');
            wrapper.setAttribute('draggable', 'true');
            wrapper.contentEditable = 'false';

            const dragHandle = document.createElement('div');
            dragHandle.classList.add('draggable-image-handle');
            dragHandle.innerHTML = '⠿';
            dragHandle.title = 'Arrastrar imagen';

            const img = document.createElement('img');
            img.src = node.attrs.src;
            img.alt = node.attrs.alt || '';
            img.title = node.attrs.title || '';
            if (node.attrs.width) img.style.width = node.attrs.width + 'px';
            if (node.attrs.height) img.style.height = node.attrs.height + 'px';
            img.classList.add('draggable-image');

            // Resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.classList.add('draggable-image-resize');

            let isResizing = false;
            let startX = 0, startY = 0, startWidth = 0, startHeight = 0;

            resizeHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = img.offsetWidth;
                startHeight = img.offsetHeight;

                const onMouseMove = (e) => {
                    if (!isResizing) return;
                    const newWidth = Math.max(50, startWidth + (e.clientX - startX));
                    const ratio = startHeight / startWidth;
                    const newHeight = Math.round(newWidth * ratio);
                    img.style.width = newWidth + 'px';
                    img.style.height = newHeight + 'px';
                };

                const onMouseUp = () => {
                    isResizing = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    // Save dimensions to node
                    if (typeof getPos === 'function') {
                        const pos = getPos();
                        if (pos != null) {
                            editor.view.dispatch(
                                editor.view.state.tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    width: img.offsetWidth,
                                    height: img.offsetHeight,
                                })
                            );
                        }
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            // Drag and drop: reorder via native ProseMirror drag
            wrapper.addEventListener('dragstart', (e) => {
                if (isResizing) {
                    e.preventDefault();
                    return;
                }
                wrapper.classList.add('dragging');
            });

            wrapper.addEventListener('dragend', () => {
                wrapper.classList.remove('dragging');
            });

            wrapper.appendChild(dragHandle);
            wrapper.appendChild(img);
            wrapper.appendChild(resizeHandle);

            return {
                dom: wrapper,
                update: (updatedNode) => {
                    if (updatedNode.type.name !== 'draggableImage') return false;
                    img.src = updatedNode.attrs.src;
                    if (updatedNode.attrs.width) img.style.width = updatedNode.attrs.width + 'px';
                    if (updatedNode.attrs.height) img.style.height = updatedNode.attrs.height + 'px';
                    return true;
                },
                destroy: () => { },
            };
        };
    },
});

export default DraggableImage;
