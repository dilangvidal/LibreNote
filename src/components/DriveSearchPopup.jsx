import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, File, FileSpreadsheet, Image, FileVideo, X } from 'lucide-react';

function getFileIcon(mimeType) {
    if (!mimeType) return <File size={16} />;
    if (mimeType.includes('image')) return <Image size={16} />;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={16} />;
    if (mimeType.includes('video')) return <FileVideo size={16} />;
    if (mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('pdf')) return <FileText size={16} />;
    return <File size={16} />;
}

export default function DriveSearchPopup({ api, onInsert, onClose }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

    function handleSearch(val) {
        setQuery(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (!val.trim()) { setResults([]); return; }
        searchTimeoutRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.gdriveSearchFiles(val);
                if (res.success) setResults(res.files);
                else setResults([]);
            } catch { setResults([]); }
            setLoading(false);
        }, 400);
    }

    function formatDate(d) {
        if (!d) return '';
        return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    return (
        <>
            <div className="drive-search-overlay" onClick={onClose} />
            <div className="drive-search-popup">
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input
                        ref={inputRef}
                        className="drive-search-input"
                        placeholder="Buscar archivos en Google Drive..."
                        value={query}
                        onChange={e => handleSearch(e.target.value)}
                        style={{ border: 'none', flex: 1 }}
                    />
                    <button className="btn-icon" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="drive-search-results">
                    {loading && <div className="drive-search-empty">Buscando...</div>}
                    {!loading && results.length === 0 && query.trim() && <div className="drive-search-empty">No se encontraron archivos</div>}
                    {!loading && results.length === 0 && !query.trim() && <div className="drive-search-empty">Escribe para buscar en tu Google Drive</div>}
                    {results.map(file => (
                        <button key={file.id} className="drive-search-item" onClick={() => onInsert(file)}>
                            {getFileIcon(file.mimeType)}
                            <div className="drive-search-item-name">{file.name}</div>
                            <div className="drive-search-item-meta">{formatDate(file.modifiedTime)}</div>
                        </button>
                    ))}
                </div>
            </div>
        </>
    );
}
