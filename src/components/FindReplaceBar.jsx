import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp, Replace, ReplaceAll } from 'lucide-react';
import { setSearchHighlight, clearSearchHighlight, getMatchPosition } from '../extensions/SearchHighlight.js';

export default function FindReplaceBar({ editor, onClose }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [showReplace, setShowReplace] = useState(false);
    const [matchCount, setMatchCount] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const searchRef = useRef(null);

    useEffect(() => {
        if (searchRef.current) searchRef.current.focus();
    }, []);

    // Update highlights when search term changes
    useEffect(() => {
        if (!editor) return;

        if (!searchTerm) {
            clearSearchHighlight(editor);
            setMatchCount(0);
            setCurrentIndex(0);
            return;
        }

        const count = setSearchHighlight(editor, searchTerm, 0);
        setMatchCount(count);
        setCurrentIndex(count > 0 ? 0 : -1);

        // Scroll to first match
        if (count > 0) {
            scrollToMatch(editor, searchTerm, 0);
        }
    }, [searchTerm, editor]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (editor) clearSearchHighlight(editor);
        };
    }, [editor]);

    function scrollToMatch(ed, term, idx) {
        const pos = getMatchPosition(ed, term, idx);
        if (!pos) return;
        // Use the editor's scrollIntoView via a temporary selection
        try {
            const domAtPos = ed.view.domAtPos(pos.from);
            if (domAtPos && domAtPos.node) {
                const el = domAtPos.node.nodeType === Node.TEXT_NODE ? domAtPos.node.parentElement : domAtPos.node;
                if (el && el.scrollIntoView) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        } catch (e) {
            // Ignore scroll errors silently
        }
    }

    function goNext() {
        if (matchCount === 0) return;
        const next = (currentIndex + 1) % matchCount;
        setCurrentIndex(next);
        setSearchHighlight(editor, searchTerm, next);
        scrollToMatch(editor, searchTerm, next);
    }

    function goPrev() {
        if (matchCount === 0) return;
        const prev = (currentIndex - 1 + matchCount) % matchCount;
        setCurrentIndex(prev);
        setSearchHighlight(editor, searchTerm, prev);
        scrollToMatch(editor, searchTerm, prev);
    }

    function replaceOne() {
        if (!editor || matchCount === 0 || currentIndex < 0) return;

        const pos = getMatchPosition(editor, searchTerm, currentIndex);
        if (!pos) return;

        editor
            .chain()
            .focus()
            .setTextSelection({ from: pos.from, to: pos.to })
            .deleteSelection()
            .insertContent(replaceTerm)
            .run();

        // Re-search after replace
        setTimeout(() => {
            const count = setSearchHighlight(editor, searchTerm, Math.min(currentIndex, matchCount - 2));
            setMatchCount(count);
            const newIdx = count > 0 ? Math.min(currentIndex, count - 1) : -1;
            setCurrentIndex(newIdx);
            if (count > 0 && newIdx >= 0) {
                setSearchHighlight(editor, searchTerm, newIdx);
            }
        }, 50);
    }

    function replaceAll() {
        if (!editor || matchCount === 0) return;

        // Get current HTML content, replace all occurrences in text (not in tags)
        const html = editor.getHTML();
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        // Walk through HTML carefully, only replacing text outside tags
        const parts = [];
        let textStart = -1;

        for (let i = 0; i <= html.length; i++) {
            if (i < html.length && html[i] === '<') {
                if (textStart >= 0) {
                    const segment = html.substring(textStart, i);
                    parts.push(segment.replace(new RegExp(escaped, 'gi'), replaceTerm));
                    textStart = -1;
                }
                const tagEnd = html.indexOf('>', i);
                if (tagEnd >= 0) {
                    parts.push(html.substring(i, tagEnd + 1));
                    i = tagEnd;
                }
            } else {
                if (textStart < 0) textStart = i;
            }
        }
        if (textStart >= 0) {
            parts.push(html.substring(textStart).replace(new RegExp(escaped, 'gi'), replaceTerm));
        }

        const newHtml = parts.join('');
        editor.commands.setContent(newHtml);
        clearSearchHighlight(editor);
        setMatchCount(0);
        setCurrentIndex(0);
    }

    function handleKeyDown(e) {
        if (e.key === 'Escape') {
            clearSearchHighlight(editor);
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
                    {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : searchTerm ? '0' : ''}
                </span>
                <button className="find-btn" onClick={goPrev} title="Anterior (Shift+Enter)" disabled={matchCount === 0}>
                    <ChevronUp size={14} />
                </button>
                <button className="find-btn" onClick={goNext} title="Siguiente (Enter)" disabled={matchCount === 0}>
                    <ChevronDown size={14} />
                </button>
                <button className="find-btn" onClick={() => setShowReplace(!showReplace)} title="Reemplazar">
                    <Replace size={14} />
                </button>
                <button className="find-btn" onClick={() => { clearSearchHighlight(editor); onClose(); }} title="Cerrar (Esc)">
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
                    <button className="find-btn replace-btn" onClick={replaceOne} disabled={matchCount === 0} title="Reemplazar">
                        Uno
                    </button>
                    <button className="find-btn replace-btn" onClick={replaceAll} disabled={matchCount === 0} title="Reemplazar todos">
                        Todos
                    </button>
                </div>
            )}
        </div>
    );
}
