import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import FileAttachmentCard from '../components/FileAttachmentCard.jsx';

/**
 * FileAttachment — A custom TipTap node for rich file attachment cards.
 * 
 * PROTECTION: Cards cannot be deleted via keyboard (Delete, Backspace),
 * cut (Cmd+X), or clicking outside. They can ONLY be removed via the
 * context menu "Eliminar de la nota" option, which sets a meta flag
 * on the transaction to bypass the protection.
 * 
 * Full document replacements (e.g. switching pages) are allowed.
 */
const FileAttachment = Node.create({
    name: 'fileAttachment',
    group: 'block',
    atom: true,
    draggable: true,
    selectable: true,

    addAttributes() {
        return {
            fileName: { default: '' },
            fileSize: { default: 0 },
            mimeType: { default: '' },
            driveId: { default: '' },
            driveUrl: { default: '' },
            thumbnailUrl: { default: '' },
            localPath: { default: '' },
            status: { default: 'success' },
            uploadProgress: { default: 0 },
            uploadId: { default: '' },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-file-attachment]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes({ 'data-file-attachment': '' }, HTMLAttributes)];
    },

    addNodeView() {
        return ReactNodeViewRenderer(FileAttachmentCard);
    },

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('fileAttachmentProtection'),
                filterTransaction: (tr, state) => {
                    // Allow non-doc-changing transactions (selection, focus, etc.)
                    if (!tr.docChanged) return true;

                    // Allow explicitly flagged deletions (context menu)
                    if (tr.getMeta('fileAttachmentDelete')) return true;

                    // Allow undo/redo
                    if (tr.getMeta('history$')) return true;

                    // Allow drag-and-drop
                    if (tr.getMeta('uiEvent') === 'drop') return true;

                    // Count file attachment nodes in the OLD document
                    let oldCount = 0;
                    state.doc.descendants(node => {
                        if (node.type.name === 'fileAttachment') oldCount++;
                    });

                    // No file attachments to protect? Allow everything
                    if (oldCount === 0) return true;

                    // Check if this is a FULL document replacement (e.g. page switch via setContent)
                    // Full replacements have a step that covers from 0 to the entire doc size
                    const docSize = state.doc.content.size;
                    for (const step of tr.steps) {
                        // ReplaceStep that spans the entire document = full content replacement
                        if (step.from === 0 && step.to >= docSize) {
                            return true; // Allow page switches
                        }
                    }

                    // Count file attachment nodes in the NEW document
                    let newCount = 0;
                    tr.doc.descendants(node => {
                        if (node.type.name === 'fileAttachment') newCount++;
                    });

                    // Block if any file attachment was removed
                    if (newCount < oldCount) return false;

                    return true;
                },
            }),
        ];
    },
});

export default FileAttachment;
