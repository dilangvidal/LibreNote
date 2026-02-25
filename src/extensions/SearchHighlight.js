import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const searchHighlightKey = new PluginKey('searchHighlight');

/**
 * SearchHighlight — A ProseMirror plugin that highlights search matches
 * using Decorations instead of direct DOM manipulation.
 * This avoids corrupting ProseMirror's internal state.
 */
const SearchHighlight = Extension.create({
    name: 'searchHighlight',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: searchHighlightKey,
                state: {
                    init() {
                        return { searchTerm: '', activeIndex: 0, decorationSet: DecorationSet.empty };
                    },
                    apply(tr, prev, _oldState, newState) {
                        const meta = tr.getMeta(searchHighlightKey);
                        if (meta !== undefined) {
                            // Rebuild decorations from meta
                            const { searchTerm, activeIndex } = meta;
                            if (!searchTerm) {
                                return { searchTerm: '', activeIndex: 0, decorationSet: DecorationSet.empty };
                            }
                            const decorations = buildDecorations(newState.doc, searchTerm, activeIndex);
                            return { searchTerm, activeIndex, decorationSet: decorations };
                        }
                        // On document change, remap existing decorations
                        if (tr.docChanged && prev.searchTerm) {
                            const decorations = buildDecorations(newState.doc, prev.searchTerm, prev.activeIndex);
                            return { ...prev, decorationSet: decorations };
                        }
                        return prev;
                    },
                },
                props: {
                    decorations(state) {
                        return this.getState(state)?.decorationSet || DecorationSet.empty;
                    },
                },
            }),
        ];
    },
});

function buildDecorations(doc, searchTerm, activeIndex) {
    const decorations = [];
    const query = searchTerm.toLowerCase();
    let matchIndex = 0;

    doc.descendants((node, pos) => {
        if (!node.isText) return;
        const text = node.text.toLowerCase();
        let idx = 0;
        while (true) {
            const found = text.indexOf(query, idx);
            if (found === -1) break;
            const from = pos + found;
            const to = from + searchTerm.length;
            const className = matchIndex === activeIndex ? 'find-highlight-active' : 'find-highlight';
            decorations.push(Decoration.inline(from, to, { class: className }));
            matchIndex++;
            idx = found + 1;
        }
    });

    return DecorationSet.create(doc, decorations);
}

/**
 * Set the search term and active index in the plugin state.
 * Returns the total match count.
 */
export function setSearchHighlight(editor, searchTerm, activeIndex = 0) {
    if (!editor) return 0;
    const { state, view } = editor;
    const tr = state.tr.setMeta(searchHighlightKey, { searchTerm, activeIndex });
    view.dispatch(tr);

    // Count matches
    if (!searchTerm) return 0;
    const query = searchTerm.toLowerCase();
    let count = 0;
    state.doc.descendants((node) => {
        if (!node.isText) return;
        const text = node.text.toLowerCase();
        let idx = 0;
        while (true) {
            const found = text.indexOf(query, idx);
            if (found === -1) break;
            count++;
            idx = found + 1;
        }
    });
    return count;
}

/**
 * Clear all search highlights.
 */
export function clearSearchHighlight(editor) {
    if (!editor) return;
    const { state, view } = editor;
    const tr = state.tr.setMeta(searchHighlightKey, { searchTerm: '', activeIndex: 0 });
    view.dispatch(tr);
}

/**
 * Get the ProseMirror position of the Nth match.
 */
export function getMatchPosition(editor, searchTerm, matchIndex) {
    if (!editor || !searchTerm) return null;
    const query = searchTerm.toLowerCase();
    let currentMatch = 0;

    let result = null;
    editor.state.doc.descendants((node, pos) => {
        if (result) return false; // stop early
        if (!node.isText) return;
        const text = node.text.toLowerCase();
        let idx = 0;
        while (true) {
            const found = text.indexOf(query, idx);
            if (found === -1) break;
            if (currentMatch === matchIndex) {
                result = { from: pos + found, to: pos + found + searchTerm.length };
                return false;
            }
            currentMatch++;
            idx = found + 1;
        }
    });

    return result;
}

export default SearchHighlight;
