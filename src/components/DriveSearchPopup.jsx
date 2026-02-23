import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, File, FileSpreadsheet, Image, FileVideo, X, Download, ExternalLink, Loader2 } from 'lucide-react';

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
    const [selectedFile, setSelectedFile] = useState(null);
    const [downloading, setDownloading] = useState(false);
    const inputRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, []);

    function handleSearch(val) {
        setQuery(val);
        setSelectedFile(null);
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

    function handleFileClick(file) {
        setSelectedFile(selectedFile?.id === file.id ? null : file);
    }

    async function handleDownloadLocal(file) {
        if (!file || downloading) return;
        setDownloading(true);
        try {
            const driveMatch = (file.webViewLink || '').match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/);
            const fileId = driveMatch ? driveMatch[1] : file.id;
            if (fileId && api?.gdriveDownloadFile) {
                const result = await api.gdriveDownloadFile(fileId, file.name);
                if (result?.success && result.path && api?.openLocalFile) {
                    await api.openLocalFile(result.path);
                }
            }
            // Also insert the file as a link in the page
            if (onInsert) onInsert(file);
        } catch (err) {
            console.error('[DriveSearch] Error descargando:', err);
        }
        setDownloading(false);
    }

    function handleViewOnline(file) {
        if (!file) return;
        const link = file.webViewLink || file.webContentLink || '#';
        window.open(link, '_blank');
        onClose();
    }

    function handleInsertLink(file) {
        if (onInsert) onInsert(file);
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
                        <div key={file.id} className={`drive-search-item-wrapper ${selectedFile?.id === file.id ? 'selected' : ''}`}>
                            <button className="drive-search-item" onClick={() => handleFileClick(file)}>
                                {getFileIcon(file.mimeType)}
                                <div className="drive-search-item-name">{file.name}</div>
                                <div className="drive-search-item-meta">{formatDate(file.modifiedTime)}</div>
                            </button>
                            {selectedFile?.id === file.id && (
                                <div className="file-action-bar">
                                    <button className="file-action-btn" onClick={() => handleDownloadLocal(file)} disabled={downloading}>
                                        {downloading ? <Loader2 size={14} className="spin-icon" /> : <Download size={14} />}
                                        <span>{downloading ? 'Descargando...' : 'Abrir local'}</span>
                                    </button>
                                    <button className="file-action-btn" onClick={() => handleViewOnline(file)}>
                                        <ExternalLink size={14} />
                                        <span>Ver en línea</span>
                                    </button>
                                    <button className="file-action-btn insert-btn" onClick={() => handleInsertLink(file)}>
                                        <FileText size={14} />
                                        <span>Insertar enlace</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
