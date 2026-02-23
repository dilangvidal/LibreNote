import React, { useState } from 'react';
import { Settings, Cloud, CloudOff, Info } from 'lucide-react';

export default function SettingsModal({ gdriveConnected, onConnect, onDisconnect, onClose }) {
    const [activeTab, setActiveTab] = useState('gdrive');

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2><Settings size={18} /> Configuración</h2>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>
                    <button className={`btn ${activeTab === 'gdrive' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('gdrive')}>
                        <Cloud size={12} /> Google Drive
                    </button>
                    <button className={`btn ${activeTab === 'about' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('about')}>
                        <Info size={12} /> Acerca de
                    </button>
                </div>

                {activeTab === 'gdrive' && (
                    <div>
                        <div style={{ padding: 14, background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', marginBottom: 14, border: '1px solid var(--border-default)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {gdriveConnected ? <Cloud size={14} /> : <CloudOff size={14} />} Google Drive
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                        {gdriveConnected ? 'Cuenta conectada' : 'No conectado'}
                                    </div>
                                </div>
                                <div className={`sync-dot ${gdriveConnected ? 'connected' : 'disconnected'}`} style={{ width: 10, height: 10 }} />
                            </div>
                        </div>

                        {!gdriveConnected && (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                                Haz clic en el botón para conectar tu cuenta de Google Drive. Tus notebooks se sincronizarán en la carpeta "NoteFlow" de tu Drive.
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                            {gdriveConnected ? (
                                <button className="btn btn-danger" onClick={onDisconnect}><CloudOff size={13} /> Desconectar</button>
                            ) : (
                                <button className="btn btn-primary" onClick={onConnect}><Cloud size={13} /> Conectar con Google Drive</button>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'about' && (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                        <div style={{ fontSize: 40, marginBottom: 8, color: 'var(--onenote-purple)' }}><Cloud size={48} /></div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--onenote-purple)', marginBottom: 4 }}>NoteFlow</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Versión 1.0.0</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Aplicación de notas estilo OneNote para Mac, con editor de texto enriquecido y sincronización a Google Drive.
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16 }}>
                            Desarrollado con Electron + React + TipTap
                        </p>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn btn-outline" onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}
