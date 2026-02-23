/**
 * MarkdownTablePlugin – A ProseMirror plugin that auto-converts markdown table
 * syntax into real TipTap table nodes as the user types.
 *
 * Detection: When the user presses Enter at the end of a line that looks like
 * a table row (`| ... |`), the plugin checks previous lines to see if they
 * form a complete markdown table (header + separator + ≥0 body rows).
 * If so, all those lines are replaced by a real table node.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

const TABLE_ROW_RE = /^\s*\|(.+)\|\s*$/;
const TABLE_SEP_RE = /^\s*\|[\s:|-]+\|\s*$/;

/**
 * Parse a single table row string into an array of cell contents.
 */
function parseCells(rowText) {
    return rowText
        .replace(/^\s*\|/, '')
        .replace(/\|\s*$/, '')
        .split('|')
        .map(c => c.trim());
}

/**
 * Walk backwards from `pos` collecting consecutive lines that look like
 * markdown table rows. Returns { startPos, endPos, headerCells, bodyRows, alignments }
 * or null if not a valid table.
 */
function detectTable(doc, pos) {
    // Collect consecutive table-looking paragraphs ending at or before `pos`
    const lines = [];
    let node = null;
    let nodePos = null;

    // Find the node at the current position
    doc.nodesBetween(0, doc.content.size, (n, p) => {
        if (n.isTextblock && p <= pos && p + n.nodeSize > pos) {
            node = n;
            nodePos = p;
        }
    });

    if (!node) return null;

    // Now walk backwards and collect consecutive table-row paragraphs
    const allBlocks = [];
    doc.descendants((n, p) => {
        if (n.isTextblock) {
            allBlocks.push({ node: n, pos: p });
        }
    });

    // Find the index of our current block
    let currentIdx = -1;
    for (let i = 0; i < allBlocks.length; i++) {
        if (allBlocks[i].pos === nodePos) {
            currentIdx = i;
            break;
        }
    }

    if (currentIdx < 0) return null;

    // Collect backwards from current position
    const tableBlocks = [];
    for (let i = currentIdx; i >= 0; i--) {
        const text = allBlocks[i].node.textContent;
        if (TABLE_ROW_RE.test(text) || TABLE_SEP_RE.test(text)) {
            tableBlocks.unshift({ text, pos: allBlocks[i].pos, size: allBlocks[i].node.nodeSize });
        } else {
            break;
        }
    }

    if (tableBlocks.length < 2) return null;

    // Find the separator line (should be second line)
    const sepIdx = tableBlocks.findIndex(b => TABLE_SEP_RE.test(b.text));
    if (sepIdx < 1) return null; // separator must not be the first line

    // Header is everything before separator (usually just 1 line)
    const headerText = tableBlocks[sepIdx - 1].text;
    const headerCells = parseCells(headerText);

    // Parse alignment from separator
    const sepCells = parseCells(tableBlocks[sepIdx].text);
    const alignments = sepCells.map(c => {
        c = c.trim().replace(/\s/g, '');
        if (c.startsWith(':') && c.endsWith(':')) return 'center';
        if (c.endsWith(':')) return 'right';
        return null; // default left
    });

    // Body rows are everything after separator
    const bodyRows = [];
    for (let i = sepIdx + 1; i < tableBlocks.length; i++) {
        bodyRows.push(parseCells(tableBlocks[i].text));
    }

    // We need at least header + separator (2 lines) to make a valid table
    // startPos = beginning of the first table block,
    // endPos = end of the last table block
    const startPos = tableBlocks[sepIdx - 1].pos;
    const endPos = tableBlocks[tableBlocks.length - 1].pos + tableBlocks[tableBlocks.length - 1].size;

    return {
        startPos,
        endPos,
        headerCells,
        bodyRows,
        alignments,
        colCount: headerCells.length,
    };
}

/**
 * Build a table node JSON structure that TipTap can insert.
 */
function buildTableJSON(headerCells, bodyRows, alignments, colCount) {
    const headerRow = {
        type: 'tableRow',
        content: headerCells.map((cell, i) => ({
            type: 'tableHeader',
            attrs: alignments[i] ? { textAlign: alignments[i] } : {},
            content: [{ type: 'paragraph', content: cell ? [{ type: 'text', text: cell }] : [] }],
        })),
    };

    const dataRows = bodyRows.map(cells => ({
        type: 'tableRow',
        content: Array.from({ length: colCount }, (_, i) => ({
            type: 'tableCell',
            attrs: alignments[i] ? { textAlign: alignments[i] } : {},
            content: [{ type: 'paragraph', content: cells[i] ? [{ type: 'text', text: cells[i] }] : [] }],
        })),
    }));

    return {
        type: 'table',
        content: [headerRow, ...dataRows],
    };
}

export const MarkdownTablePlugin = Extension.create({
    name: 'markdownTablePlugin',

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                key: new PluginKey('markdownTablePlugin'),

                props: {
                    handleKeyDown(view, event) {
                        if (event.key !== 'Enter') return false;

                        const { state } = view;
                        const { selection } = state;
                        const { $from } = selection;

                        // Only trigger at end of a textblock
                        if (!$from.parent.isTextblock) return false;

                        const currentText = $from.parent.textContent;

                        // Quick check: current line must look like a table row
                        if (!TABLE_ROW_RE.test(currentText)) return false;

                        const result = detectTable(state.doc, $from.pos);
                        if (!result) return false;

                        // We have a valid markdown table! Replace the text with a real table node.
                        event.preventDefault();

                        const tableNode = buildTableJSON(
                            result.headerCells,
                            result.bodyRows,
                            result.alignments,
                            result.colCount
                        );

                        // Replace the range with the table
                        const tr = state.tr;
                        tr.replaceWith(result.startPos, result.endPos, [
                            state.schema.nodeFromJSON(tableNode),
                            // Add an empty paragraph after the table for continued typing
                            state.schema.nodes.paragraph.create(),
                        ]);

                        view.dispatch(tr);
                        return true;
                    },
                },
            }),
        ];
    },
});

export default MarkdownTablePlugin;
