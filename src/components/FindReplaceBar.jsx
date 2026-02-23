import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp, Replace, ReplaceAll } from 'lucide-react';

export default function FindReplaceBar({ editor, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [matches, setMatches] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const searchRef = useRef(null);

    useEffect(() => {
        if (searchRef.current) searchRef.current.focus();
    }, []);

    // Find all matches when search term changes
    useEffect(() => {
        if (!editor || !searchTerm) {
            setMatches([]);
            setCurrentIndex(0);
            clearHighlights();
            return;
        }

        const text = editor.getText();
        const query = searchTerm.toLowerCase();
        const found = [];
        let idx = 0;

        while (true) {
            const pos = text.toLowerCase().indexOf(query, idx);
            if (pos === -1) break;
            found.push({ from: pos, to: pos + searchTerm.length });
            idx = pos + 1;
        }

        setMatches(found);
        setCurrentIndex(found.length > 0 ? 0 : -1);

        // Highlight matches in the DOM
        highlightMatches(found, 0);
    }, [searchTerm, editor]);

    function clearHighlights() {
        if (!editor) return;
        const el = editor.view.dom;
        el.querySelectorAll('.find-highlight, .find-highlight-active').forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
    }

    function highlightMatches(foundMatches, activeIdx) {
        clearHighlights();
        if (!editor || foundMatches.length === 0) return;

        const fullText = editor.getText();
        const el = editor.view.dom;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        const textNodes = [];
        let node;
        while ((node = walker.nextNode())) {
            textNodes.push(node);
        }

        // Build a flat text → text-node mapping
        let charOffset = 0;
        const nodeMap = [];
        for (const tn of textNodes) {
            nodeMap.push({ node: tn, start: charOffset, end: charOffset + tn.textContent.length });
            charOffset += tn.textContent.length;
        }

        // Apply highlights in reverse order to not mess up offsets
        const sortedMatches = [...foundMatches].map((m, i) => ({ ...m, idx: i })).reverse();

        for (const match of sortedMatches) {
            const { from, to, idx: matchIdx } = match;

            // Find text nodes that contain this match
            for (const nm of nodeMap) {
                if (nm.end <= from || nm.start >= to) continue;

                const localFrom = Math.max(0, from - nm.start);
                const localTo = Math.min(nm.node.textContent.length, to - nm.start);
                const text = nm.node.textContent;

                const before = text.substring(0, localFrom);
                const matched = text.substring(localFrom, localTo);
                const after = text.substring(localTo);

                const mark = document.createElement('mark');
                mark.className = matchIdx === activeIdx ? 'find-highlight-active' : 'find-highlight';
                mark.textContent = matched;

                const parent = nm.node.parentNode;
                const frag = document.createDocumentFragment();
                if (before) frag.appendChild(document.createTextNode(before));
                frag.appendChild(mark);
                if (after) frag.appendChild(document.createTextNode(after));
                parent.replaceChild(frag, nm.node);

                // Scroll active match into view
                if (matchIdx === activeIdx) {
                    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                break; // Only handle first text node per match for simplicity
            }
        }
    }

    function goNext() {
        if (matches.length === 0) return;
        const next = (currentIndex + 1) % matches.length;
        setCurrentIndex(next);
        highlightMatches(matches, next);
    }

    function goPrev() {
        if (matches.length === 0) return;
        const prev = (currentIndex - 1 + matches.length) % matches.length;
        setCurrentIndex(prev);
        highlightMatches(matches, prev);
    }

    function replaceOne() {
        if (!editor || matches.length === 0 || currentIndex < 0) return;

        clearHighlights();

        const match = matches[currentIndex];
        const fullText = editor.getText();

        // Find the ProseMirror position by counting characters
        let pmFrom = 0;
        let charCount = 0;
        const doc = editor.state.doc;

        doc.descendants((node, pos) => {
            if (node.isText) {
                const nodeStart = charCount;
                const nodeEnd = charCount + node.text.length;
                if (match.from >= nodeStart && match.from < nodeEnd) {
                    pmFrom = pos + (match.from - nodeStart);
                }
                charCount += node.text.length;
            }
        });

        const pmTo = pmFrom + searchTerm.length;

        editor
            .chain()
            .focus()
            .setTextSelection({ from: pmFrom, to: pmTo })
            .deleteSelection()
            .insertContent(replaceTerm)
            .run();

        // Re-search after replace
        setTimeout(() => {
            setSearchTerm(st => {
                // Force re-search by toggling
                return st;
            });
            // Manually re-find
            const text = editor.getText();
            const query = searchTerm.toLowerCase();
            const found = [];
            let idx = 0;
            while (true) {
                const pos = text.toLowerCase().indexOf(query, idx);
                if (pos === -1) break;
                found.push({ from: pos, to: pos + searchTerm.length });
                idx = pos + 1;
            }
            setMatches(found);
            const newIdx = Math.min(currentIndex, found.length - 1);
            setCurrentIndex(newIdx >= 0 ? newIdx : 0);
            highlightMatches(found, newIdx >= 0 ? newIdx : 0);
        }, 50);
    }

    function replaceAll() {
        if (!editor || matches.length === 0) return;

        clearHighlights();

        // Get current HTML content, replace all occurrences
        const html = editor.getHTML();
        // Use a regex to replace text content (not HTML tags)
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(?<=^|>)([^<]*?)${escaped}`, 'gi');

        // Simple approach: replace in the plain text by rebuilding
        let newHtml = html;
        // Replace all occurrences case-insensitively
        const parts = [];
        let lastIdx = 0;
        const lowerHtml = html.toLowerCase();
        const lowerSearch = searchTerm.toLowerCase();

        // Walk through HTML carefully, only replacing text outside tags
        let inTag = false;
        let textStart = -1;

        for (let i = 0; i <= html.length; i++) {
            if (i < html.length && html[i] === '<') {
                if (textStart >= 0) {
                    // Process text segment
                    const segment = html.substring(textStart, i);
                    parts.push(segment.replace(new RegExp(escaped, 'gi'), replaceTerm));
                    textStart = -1;
                }
                inTag = true;
                const tagEnd = html.indexOf('>', i);
                if (tagEnd >= 0) {
                    parts.push(html.substring(i, tagEnd + 1));
                    i = tagEnd;
                }
                inTag = false;
            } else if (!inTag) {
                if (textStart < 0) textStart = i;
            }
        }
        if (textStart >= 0) {
            parts.push(html.substring(textStart).replace(new RegExp(escaped, 'gi'), replaceTerm));
        }

        newHtml = parts.join('');
        editor.commands.setContent(newHtml);
        setMatches([]);
        setCurrentIndex(0);
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            clearHighlights();
            onClose();
        } else if (e.key === 'Enter') {
            if (e.shiftKey) goPrev();
            else goNext();
        }
    }

    return (
        <div className="find-replace-bar" onKeyDown={handleKeyDown}>
            <div className="find-replace-row">
                <Search size={14} className="find-icon" />
                <input
                    ref={searchRef}
                    type="text"
                    className="find-input"
                    placeholder="Buscar…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
                <span className="find-count">
                    {matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : searchTerm ? '0' : ''}
                </span>
                <button className="find-btn" onClick={goPrev} title="Anterior (Shift+Enter)" disabled={matches.length === 0}>
                    <ChevronUp size={14} />
                </button>
                <button className="find-btn" onClick={goNext} title="Siguiente (Enter)" disabled={matches.length === 0}>
                    <ChevronDown size={14} />
                </button>
                <button className="find-btn" onClick={() => setShowReplace(!showReplace)} title="Reemplazar">
                    <Replace size={14} />
                </button>
                <button className="find-btn" onClick={() => { clearHighlights(); onClose(); }} title="Cerrar (Esc)">
                    <X size={14} />
                </button>
            </div>
            {showReplace && (
                <div className="find-replace-row">
                    <Replace size={14} className="find-icon" />
                    <input
                        type="text"
                        className="find-input"
                        placeholder="Reemplazar con…"
                        value={replaceTerm}
                        onChange={e => setReplaceTerm(e.target.value)}
                    />
                    <button className="find-btn replace-btn" onClick={replaceOne} disabled={matches.length === 0} title="Reemplazar">
                        Uno
                    </button>
                    <button className="find-btn replace-btn" onClick={replaceAll} disabled={matches.length === 0} title="Reemplazar todos">
                        Todos
                    </button>
                </div>
            )}
        </div>
    );
}
