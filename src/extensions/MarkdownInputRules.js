/**
 * MarkdownInputRules – A TipTap extension that adds mark-level input rules
 * for auto-converting typed Markdown into rich formatting.
 *
 * StarterKit already provides node-level input rules (headings, lists,
 * blockquote, code block, horizontal rule). This extension adds the
 * missing mark-based rules plus:
 *   - Links:      [text](url)  → clickable link
 *   - Task items: [ ] text / [x] text → task list checkbox
 */
import { Extension, markInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const MarkdownInputRules = Extension.create({
    name: 'markdownInputRules',

    addInputRules() {
        const rules = [];

        // Bold **text**
        if (this.editor.extensionManager.extensions.find(e => e.name === 'bold')) {
            rules.push(
                markInputRule({
                    find: /\*\*([^*]+)\*\*$/,
                    type: this.editor.schema.marks.bold,
                })
            );
            rules.push(
                markInputRule({
                    find: /__([^_]+)__$/,
                    type: this.editor.schema.marks.bold,
                })
            );
        }

        // Italic *text*
        if (this.editor.extensionManager.extensions.find(e => e.name === 'italic')) {
            rules.push(
                markInputRule({
                    find: /(?<![*\w])\*([^*]+)\*$/,
                    type: this.editor.schema.marks.italic,
                })
            );
            rules.push(
                markInputRule({
                    find: /(?<![_\w])_([^_]+)_$/,
                    type: this.editor.schema.marks.italic,
                })
            );
        }

        // Strikethrough ~~text~~
        if (this.editor.extensionManager.extensions.find(e => e.name === 'strike')) {
            rules.push(
                markInputRule({
                    find: /~~([^~]+)~~$/,
                    type: this.editor.schema.marks.strike,
                })
            );
        }

        // Inline code `code`
        if (this.editor.extensionManager.extensions.find(e => e.name === 'code')) {
            rules.push(
                markInputRule({
                    find: /`([^`]+)`$/,
                    type: this.editor.schema.marks.code,
                })
            );
        }

        // Highlight ==text==
        if (this.editor.extensionManager.extensions.find(e => e.name === 'highlight')) {
            rules.push(
                markInputRule({
                    find: /==([^=]+)==$/,
                    type: this.editor.schema.marks.highlight,
                })
            );
        }

        return rules;
    },

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            // ── Markdown link [text](url) auto-convert ──
            new Plugin({
                key: new PluginKey('markdownLinkInput'),
                props: {
                    handleTextInput(view, from, to, text) {
                        // Only trigger on closing parenthesis
                        if (text !== ')') return false;

                        const { state } = view;
                        const $from = state.doc.resolve(from);
                        const paragraph = $from.parent;
                        if (!paragraph.isTextblock) return false;

                        // Get the full text of the current textblock up to cursor + the ")" we're about to type
                        const offsetInParent = from - $from.start();
                        const textBefore = paragraph.textContent.slice(0, offsetInParent) + ')';

                        // Match [linkText](url)
                        const match = textBefore.match(/\[([^\]]+)\]\(([^)]+)\)$/);
                        if (!match) return false;

                        const [fullMatch, linkText, url] = match;
                        const matchStart = $from.start() + offsetInParent - fullMatch.length + 1; // +1 for the ")"

                        // Check if the link schema mark exists
                        const linkMark = state.schema.marks.link;
                        if (!linkMark) return false;

                        // Build the replacement: linked text
                        const tr = state.tr;
                        tr.replaceWith(matchStart, from + 1, state.schema.text(linkText, [
                            linkMark.create({ href: url, target: '_blank' }),
                        ]));

                        view.dispatch(tr);
                        return true;
                    },
                },
            }),
        ];
    },
});

export default MarkdownInputRules;
