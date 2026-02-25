import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { NodeViewWrapper } from '@tiptap/react';
import {
    FileText, File, FileSpreadsheet, FileImage, FileVideo, FileAudio,
    Presentation, Archive, Code2, FolderOpen, Download, Link, Trash2,
    X, RotateCcw, Loader2, RefreshCw, Sparkles, AlertTriangle, GripVertical,
    ExternalLink
} from 'lucide-react';

// ── File type → icon + color mapping ──
const FILE_TYPE_MAP = {
    'application/pdf': { icon: FileText, color: '#E53935', label: 'PDF' },
    'application/msword': { icon: FileText, color: '#2B579A', label: 'Word' },
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: '#2B579A', label: 'Word' },
    'application/vnd.google-apps.document': { icon: FileText, color: '#4285F4', label: 'Google Docs' },
    'application/vnd.ms-excel': { icon: FileSpreadsheet, color: '#217346', label: 'Excel' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileSpreadsheet, color: '#217346', label: 'Excel' },
    'application/vnd.google-apps.spreadsheet': { icon: FileSpreadsheet, color: '#0F9D58', label: 'Google Sheets' },
    'application/vnd.ms-powerpoint': { icon: Presentation, color: '#D24726', label: 'PowerPoint' },
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': { icon: Presentation, color: '#D24726', label: 'PowerPoint' },
    'application/vnd.google-apps.presentation': { icon: Presentation, color: '#F4B400', label: 'Google Slides' },
    'application/zip': { icon: Archive, color: '#795548', label: 'ZIP' },
    'application/x-rar-compressed': { icon: Archive, color: '#795548', label: 'RAR' },
    'text/plain': { icon: FileText, color: '#616161', label: 'Texto' },
    'text/csv': { icon: FileSpreadsheet, color: '#217346', label: 'CSV' },
    'application/json': { icon: Code2, color: '#F4A261', label: 'JSON' },
};

function getFileTypeInfo(mimeType, fileName) {
    if (mimeType && FILE_TYPE_MAP[mimeType]) return FILE_TYPE_MAP[mimeType];
    if (mimeType?.startsWith('image/')) return { icon: FileImage, color: '#00897B', label: 'Imagen' };
    if (mimeType?.startsWith('video/')) return { icon: FileVideo, color: '#7719AA', label: 'Video' };
    if (mimeType?.startsWith('audio/')) return { icon: FileAudio, color: '#E91E63', label: 'Audio' };
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    const extMap = {
        pdf: FILE_TYPE_MAP['application/pdf'],
        doc: FILE_TYPE_MAP['application/msword'],
        docx: FILE_TYPE_MAP['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        xls: FILE_TYPE_MAP['application/vnd.ms-excel'],
        xlsx: FILE_TYPE_MAP['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        ppt: FILE_TYPE_MAP['application/vnd.ms-powerpoint'],
        pptx: FILE_TYPE_MAP['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        zip: FILE_TYPE_MAP['application/zip'],
        rar: FILE_TYPE_MAP['application/x-rar-compressed'],
        txt: FILE_TYPE_MAP['text/plain'],
        csv: FILE_TYPE_MAP['text/csv'],
        json: FILE_TYPE_MAP['application/json'],
        png: { icon: FileImage, color: '#00897B', label: 'PNG' },
        jpg: { icon: FileImage, color: '#00897B', label: 'JPG' },
        jpeg: { icon: FileImage, color: '#00897B', label: 'JPG' },
        gif: { icon: FileImage, color: '#00897B', label: 'GIF' },
        mp4: { icon: FileVideo, color: '#7719AA', label: 'MP4' },
        mp3: { icon: FileAudio, color: '#E91E63', label: 'MP3' },
        wav: { icon: FileAudio, color: '#E91E63', label: 'WAV' },
    };
    return extMap[ext] || { icon: File, color: '#9E9E9E', label: 'Archivo' };
}

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

// Mime types that can be edited and synced from Drive
const SYNCABLE_TYPES = new Set([
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.google-apps.document', 'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'text/plain', 'text/csv',
]);

// Types Gemini can analyze (NO Word/Office — binary formats can't be read as text)
const GEMINI_ANALYZABLE = new Set([
    'application/pdf', 'text/plain', 'text/csv', 'application/json',
]);

function isGeminiAnalyzable(mimeType, fileName) {
    if (mimeType && GEMINI_ANALYZABLE.has(mimeType)) return true;
    if (mimeType?.startsWith('image/')) return true;
    if (mimeType?.startsWith('text/')) return true;
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    return ['pdf', 'txt', 'csv', 'json', 'md', 'png', 'jpg', 'jpeg'].includes(ext);
}

export default function FileAttachmentCard({ node, updateAttributes, deleteNode, editor }) {
    const { fileName, fileSize, mimeType, driveId, driveUrl, localPath, status, uploadProgress } = node.attrs;
    const [contextMenu, setContextMenu] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteFromDrive, setDeleteFromDrive] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const cardRef = useRef(null);
    const contextMenuRef = useRef(null);

    const typeInfo = getFileTypeInfo(mimeType, fileName);
    const IconComponent = typeInfo.icon;
    const canSync = driveId && SYNCABLE_TYPES.has(mimeType);
    const canGemini = isGeminiAnalyzable(mimeType, fileName);

    // Check if Gemini is configured
    const [geminiAvailable, setGeminiAvailable] = useState(false);
    useEffect(() => {
        (async () => {
            try {
                const key = await (window.librenote?.getGeminiKey?.() ?? localStorage.getItem('librenote-gemini-key'));
                setGeminiAvailable(!!key);
            } catch { setGeminiAvailable(false); }
        })();
    }, []);

    // Close context menu on outside click
    useEffect(() => {
        if (!contextMenu) return;
        const handleClose = (e) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
                setContextMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClose);
        return () => document.removeEventListener('mousedown', handleClose);
    }, [contextMenu]);

    // ── Open file natively ──
    const handleOpen = useCallback(async () => {
        if (status !== 'success') return;
        try {
            if (localPath && window.librenote?.openLocalFile) {
                await window.librenote.openLocalFile(localPath);
            } else if (driveId && window.librenote?.gdriveDownloadFile) {
                const result = await window.librenote.gdriveDownloadFile(driveId, fileName);
                if (result?.success && result.path) {
                    updateAttributes({ localPath: result.path });
                    await window.librenote.openLocalFile(result.path);
                }
            } else if (driveUrl) {
                window.open(driveUrl, '_blank');
            }
        } catch (err) {
            console.error('[FileAttachment] Error opening:', err);
        }
    }, [status, localPath, driveId, driveUrl, fileName, updateAttributes]);

    // ── Sync: re-download latest version from Drive ──
    const handleSync = useCallback(async () => {
        if (!driveId || syncing) return;
        setSyncing(true);
        try {
            if (window.librenote?.gdriveDownloadFile) {
                const result = await window.librenote.gdriveDownloadFile(driveId, fileName);
                if (result?.success && result.path) {
                    updateAttributes({ localPath: result.path });
                }
            }
        } catch (err) {
            console.error('[FileAttachment] Sync error:', err);
        }
        setSyncing(false);
    }, [driveId, fileName, syncing, updateAttributes]);

    // ── Retry upload ──
    const handleRetry = useCallback(() => {
        if (localPath && window.librenote?.gdriveUploadFile) {
            updateAttributes({ status: 'uploading', uploadProgress: 0 });
            window.librenote.gdriveUploadFile(localPath, fileName).then(result => {
                if (result?.success && result.file) {
                    updateAttributes({
                        status: 'success',
                        driveId: result.file.id || '',
                        driveUrl: result.file.webViewLink || '',
                        uploadProgress: 100,
                    });
                } else {
                    updateAttributes({ status: 'error' });
                }
            }).catch(() => updateAttributes({ status: 'error' }));
        }
    }, [localPath, fileName, updateAttributes]);

    // ── Open in Drive (system browser) ──
    const handleOpenInDrive = useCallback(() => {
        setContextMenu(null);
        if (driveUrl) {
            // Use shell.openExternal via IPC to open in the system's default browser
            if (window.librenote?.openExternal) {
                window.librenote.openExternal(driveUrl);
            } else {
                window.open(driveUrl, '_blank');
            }
        }
    }, [driveUrl]);

    // ── Context menu actions ──
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Clamp position so menu doesn't overflow viewport
        const menuHeight = 320; // estimated max height
        const menuWidth = 240;
        const x = Math.min(e.clientX, window.innerWidth - menuWidth - 8);
        const y = e.clientY + menuHeight > window.innerHeight
            ? Math.max(8, e.clientY - menuHeight)
            : e.clientY;
        setContextMenu({ x, y });
    };

    const handleCopyLink = () => {
        if (driveUrl) navigator.clipboard.writeText(driveUrl);
        setContextMenu(null);
    };

    const handleDownload = async () => {
        setContextMenu(null);
        if (driveId && window.librenote?.gdriveDownloadFile) {
            const result = await window.librenote.gdriveDownloadFile(driveId, fileName);
            if (result?.success && result.path) {
                updateAttributes({ localPath: result.path });
            }
        }
    };

    // ── Delete with confirmation modal ──
    const handleDeleteRequest = () => {
        setContextMenu(null);
        setDeleteFromDrive(false);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        setShowDeleteModal(false);
        // If user chose to also delete from Drive
        if (deleteFromDrive && driveId) {
            try {
                if (typeof window !== 'undefined' && window.librenote?.gdriveDeleteFile) {
                    const result = await window.librenote.gdriveDeleteFile(driveId);
                    if (!result?.success) {
                        // Trash failed — don't remove from note
                        alert(`No se pudo enviar "${fileName}" a la papelera de Drive: ${result?.error || 'Error desconocido'}`);
                        return;
                    }
                    console.log('[FileAttachment] Archivo movido a papelera de Drive');
                }
            } catch (err) {
                console.error('[FileAttachment] Drive trash error:', err);
                alert(`Error al enviar a papelera: ${err.message}`);
                return;
            }
        }
        // Use a flagged transaction so the protection plugin allows it
        if (editor) {
            const pos = editor.state.doc.descendants((node, p) => {
                if (node.type.name === 'fileAttachment' && node.attrs.driveId === driveId && node.attrs.fileName === fileName) {
                    return false; // stop
                }
            });
            // Find the node position and delete via flagged transaction
            let nodePos = -1;
            editor.state.doc.descendants((node, p) => {
                if (nodePos >= 0) return false;
                if (node.type.name === 'fileAttachment' && node.attrs.fileName === fileName) {
                    nodePos = p;
                    return false;
                }
            });
            if (nodePos >= 0) {
                const tr = editor.state.tr;
                tr.setMeta('fileAttachmentDelete', true);
                tr.delete(nodePos, nodePos + 1);
                editor.view.dispatch(tr);
            } else {
                deleteNode();
            }
        } else {
            deleteNode();
        }
    };

    // ── Send file to Gemini ──
    const handleGeminiAnalyze = useCallback(async () => {
        setContextMenu(null);
        if (!editor) return;

        // Try to read the file content for context
        let fileContext = `[Archivo adjunto: ${fileName}`;
        if (fileSize) fileContext += `, ${formatFileSize(fileSize)}`;
        if (typeInfo.label) fileContext += `, tipo: ${typeInfo.label}`;
        fileContext += ']';

        if (driveUrl) fileContext += `\nEnlace Drive: ${driveUrl}`;

        // If local path exists, try to read text-based files
        if (localPath && window.librenote?.readFileText) {
            try {
                const content = await window.librenote.readFileText(localPath);
                if (content) fileContext += `\n\nContenido del archivo:\n${content}`;
            } catch { /* not text-readable */ }
        }

        // Insert the file context as selected text and open Gemini
        // We need to find the GeminiPanel toggle — dispatch a custom event
        const event = new CustomEvent('librenote:open-gemini', {
            detail: { fileContext, fileName },
        });
        window.dispatchEvent(event);
    }, [editor, fileName, fileSize, typeInfo.label, driveUrl, localPath]);

    // ── Render: Uploading state ──
    if (status === 'uploading') {
        return (
            <NodeViewWrapper data-drag-handle>
                <div className="file-attachment-card file-attachment-uploading" contentEditable={false}>
                    <div className="file-attachment-icon-area" style={{ '--file-color': typeInfo.color }}>
                        <Loader2 size={28} className="file-attachment-spinner" />
                    </div>
                    <div className="file-attachment-info">
                        <div className="file-attachment-name">{fileName}</div>
                        <div className="file-attachment-meta">
                            Subiendo…
                        </div>
                        <div className="file-attachment-progress-track">
                            <div className="file-attachment-progress-fill file-attachment-progress-indeterminate" />
                        </div>
                    </div>
                </div>
            </NodeViewWrapper>
        );
    }

    // ── Render: Error state ──
    if (status === 'error') {
        return (
            <NodeViewWrapper data-drag-handle>
                <div className="file-attachment-card file-attachment-error" contentEditable={false}>
                    <div className="file-attachment-icon-area file-attachment-icon-error">
                        <X size={28} />
                    </div>
                    <div className="file-attachment-info">
                        <div className="file-attachment-name">{fileName}</div>
                        <div className="file-attachment-meta file-attachment-error-text">
                            No se pudo subir
                        </div>
                    </div>
                    <button className="file-attachment-retry-btn" onClick={handleRetry}>
                        <RotateCcw size={14} />
                        <span>Reintentar</span>
                    </button>
                </div>
            </NodeViewWrapper>
        );
    }

    // ── Render: Success state ──
    return (
        <NodeViewWrapper data-drag-handle>
            <div
                ref={cardRef}
                className={`file-attachment-card file-attachment-success ${isHovered ? 'hovered' : ''}`}
                contentEditable={false}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={handleOpen}
                onDoubleClick={handleOpen}
                onContextMenu={handleContextMenu}
                title={fileName}
            >
                {/* Drag handle — visible on hover */}
                <div className="file-attachment-drag-handle" data-drag-handle title="Arrastrar">
                    <GripVertical size={14} />
                </div>

                <div className="file-attachment-icon-area" style={{ '--file-color': typeInfo.color }}>
                    <IconComponent size={28} />
                </div>
                <div className="file-attachment-info">
                    <div className="file-attachment-name">{fileName}</div>
                    <div className="file-attachment-meta">
                        {typeInfo.label}
                        {fileSize ? ` · ${formatFileSize(fileSize)}` : ''}
                    </div>
                </div>

                {/* Sync button (visible on hover for syncable files) */}
                {canSync && isHovered && (
                    <button
                        className="file-attachment-sync-btn"
                        onClick={(e) => { e.stopPropagation(); handleSync(); }}
                        title="Sincronizar con Drive"
                        disabled={syncing}
                    >
                        <RefreshCw size={13} className={syncing ? 'file-attachment-spinner' : ''} />
                    </button>
                )}

                {localPath && <div className="file-attachment-local-badge" title="Guardado localmente">✓</div>}

                {/* Context menu — rendered via portal to appear above everything */}
                {contextMenu && ReactDOM.createPortal(
                    <div
                        ref={contextMenuRef}
                        className="file-attachment-context-menu"
                        style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y }}
                        onMouseDown={e => e.stopPropagation()}
                    >
                        <button className="file-attachment-ctx-item" onClick={(e) => { e.stopPropagation(); handleOpen(); setContextMenu(null); }}>
                            <FolderOpen size={14} /><span>Abrir</span>
                        </button>
                        <button className="file-attachment-ctx-item" onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                            <Download size={14} /><span>Descargar copia local</span>
                        </button>
                        {canSync && (
                            <button className="file-attachment-ctx-item" onClick={(e) => { e.stopPropagation(); setContextMenu(null); handleSync(); }}>
                                <RefreshCw size={14} /><span>Sincronizar desde Drive</span>
                            </button>
                        )}
                        {driveUrl && (
                            <>
                                <button className="file-attachment-ctx-item" onClick={(e) => { e.stopPropagation(); handleOpenInDrive(); }}>
                                    <ExternalLink size={14} /><span>Ir a Drive</span>
                                </button>
                                <button className="file-attachment-ctx-item" onClick={(e) => { e.stopPropagation(); handleCopyLink(); }}>
                                    <Link size={14} /><span>Copiar enlace Drive</span>
                                </button>
                            </>
                        )}
                        {/* Gemini analysis */}
                        {geminiAvailable && canGemini && (
                            <>
                                <div className="file-attachment-ctx-divider" />
                                <button className="file-attachment-ctx-item file-attachment-ctx-gemini" onClick={(e) => { e.stopPropagation(); handleGeminiAnalyze(); }}>
                                    <Sparkles size={14} /><span>Preguntar a Gemini</span>
                                </button>
                            </>
                        )}
                        <div className="file-attachment-ctx-divider" />
                        <button className="file-attachment-ctx-item file-attachment-ctx-danger" onClick={(e) => { e.stopPropagation(); handleDeleteRequest(); }}>
                            <Trash2 size={14} /><span>Eliminar de la nota</span>
                        </button>
                    </div>,
                    document.body
                )}
            </div>

            {/* Delete confirmation modal */}
            {showDeleteModal && (
                <>
                    <div className="file-attachment-modal-overlay" onClick={() => setShowDeleteModal(false)} />
                    <div className="file-attachment-delete-modal">
                        <div className="file-attachment-modal-icon">
                            <AlertTriangle size={24} />
                        </div>
                        <div className="file-attachment-modal-title">¿Eliminar archivo?</div>
                        <div className="file-attachment-modal-text">
                            Se eliminará <strong>{fileName}</strong> de esta nota.
                        </div>
                        {driveId && (
                            <label className="file-attachment-modal-check">
                                <input
                                    type="checkbox"
                                    checked={deleteFromDrive}
                                    onChange={(e) => setDeleteFromDrive(e.target.checked)}
                                />
                                <span>También eliminar de Google Drive</span>
                            </label>
                        )}
                        {deleteFromDrive && (
                            <div className="file-attachment-modal-warn">
                                ⚠️ Esta acción es permanente y no se puede deshacer.
                            </div>
                        )}
                        <div className="file-attachment-modal-actions">
                            <button className="file-attachment-modal-btn file-attachment-modal-cancel" onClick={() => setShowDeleteModal(false)}>
                                Cancelar
                            </button>
                            <button className="file-attachment-modal-btn file-attachment-modal-confirm" onClick={handleDeleteConfirm}>
                                Eliminar
                            </button>
                        </div>
                    </div>
                </>
            )}
        </NodeViewWrapper>
    );
}
