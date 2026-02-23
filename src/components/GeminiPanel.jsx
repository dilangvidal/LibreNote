import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Copy, Plus, Loader2, AlertCircle } from 'lucide-react';
import api from '../services/api.js';

export default function GeminiPanel({ editor, onClose, onInsert }) {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [modelUsed, setModelUsed] = useState('');
    const inputRef = useRef(null);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, []);

    async function handleSend() {
        if (!prompt.trim() || loading) return;

        setLoading(true);
        setError('');
        setResponse('');

        const pageContext = editor ? editor.getText() : '';
        const { from, to } = editor?.state?.selection || {};
        const selectedText = (from !== undefined && to !== undefined && from !== to)
            ? editor.state.doc.textBetween(from, to, ' ')
            : '';

        try {
            const result = await api.geminiChat(prompt, pageContext, selectedText);
            if (result.success) {
                setResponse(result.text);
                if (result.model) setModelUsed(result.model);
            } else {
                setError(result.error || 'Error desconocido');
            }
        } catch (e) {
            setError(`Error: ${e.message}`);
        } finally {
            setLoading(false);
        }
    }

    function handleInsert() {
        if (!response || !editor) return;
        // Clean markdown code blocks if the API returned them
        let html = response
            .replace(/```html\n?/gi, '')
            .replace(/```\n?/g, '')
            .trim();
        editor.chain().focus().insertContent(html).run();
        onClose();
    }

    function handleReplace() {
        if (!response || !editor) return;
        const { from, to } = editor.state.selection;
        let html = response.replace(/```html\n?/gi, '').replace(/```\n?/g, '').trim();
        if (from !== to) {
            editor.chain().focus().deleteRange({ from, to }).insertContent(html).run();
        } else {
            editor.chain().focus().insertContent(html).run();
        }
        onClose();
    }

    function handleCopy() {
        const text = response.replace(/<[^>]+>/g, '').trim();
        navigator.clipboard.writeText(text);
    }

    function handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
        if (e.key === 'Escape') onClose();
    }

    // Quick suggestions
    const suggestions = [
        { label: 'Resumir', prompt: 'Resume el contenido de esta página de forma concisa' },
        { label: 'Mejorar', prompt: 'Mejora la redacción del texto seleccionado, haciéndolo más claro y profesional' },
        { label: 'Expandir', prompt: 'Expande el contenido seleccionado con más detalle y ejemplos' },
        { label: 'Traducir EN', prompt: 'Traduce el texto seleccionado al inglés' },
        { label: 'Corregir', prompt: 'Corrige la ortografía y gramática del texto seleccionado' },
        { label: 'Lista', prompt: 'Convierte el texto seleccionado en una lista de puntos clave' },
    ];

    return (
        <div className="gemini-panel">
            <div className="gemini-panel-header">
                <div className="gemini-panel-title">
                    <Sparkles size={16} className="gemini-icon" />
                    <span>Gemini AI</span>
                    {modelUsed && <span style={{ fontSize: 10, opacity: 0.7, fontWeight: 400 }}>({modelUsed})</span>}
                </div>
                <button className="find-btn" onClick={onClose} title="Cerrar"><X size={14} /></button>
            </div>

            {/* Quick suggestions */}
            <div className="gemini-suggestions">
                {suggestions.map(s => (
                    <button key={s.label} className="gemini-suggestion-btn"
                        onClick={() => { setPrompt(s.prompt); }}>
                        {s.label}
                    </button>
                ))}
            </div>

            {/* Input area */}
            <div className="gemini-input-area">
                <textarea
                    ref={inputRef}
                    className="gemini-input"
                    placeholder="Escribe una instrucción... (ej: Resume esta página, Mejora el texto seleccionado)"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                />
                <button className="gemini-send-btn" onClick={handleSend} disabled={!prompt.trim() || loading}>
                    {loading ? <Loader2 size={16} className="spin-icon" /> : <Send size={16} />}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="gemini-error">
                    <AlertCircle size={14} /> {error}
                </div>
            )}

            {/* Response */}
            {response && (
                <div className="gemini-response-area">
                    <div className="gemini-response" dangerouslySetInnerHTML={{ __html: response.replace(/```html\n?/gi, '').replace(/```\n?/g, '') }} />
                    <div className="gemini-response-actions">
                        <button className="btn btn-sm btn-primary" onClick={handleInsert}>
                            <Plus size={12} /> Insertar al final
                        </button>
                        <button className="btn btn-sm btn-outline" onClick={handleReplace}>
                            <Sparkles size={12} /> Reemplazar selección
                        </button>
                        <button className="btn btn-sm btn-ghost" onClick={handleCopy}>
                            <Copy size={12} /> Copiar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
