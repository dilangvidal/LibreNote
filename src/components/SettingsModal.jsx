import React, { useState } from 'react';
import { Settings, Cloud, CloudOff, Info, Loader, Sun, Moon, Monitor, Sparkles, Eye, EyeOff, Key } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function SettingsModal({ gdriveConnected, onConnect, onDisconnect, onClose }) {
    const [activeTab, setActiveTab] = useState('gdrive');
    const [connecting, setConnecting] = useState(false);
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [geminiKey, setGeminiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [keySaved, setKeySaved] = useState(false);

    // Load Gemini key on mount
    React.useEffect(() => {
        const api = window.librenote;
        if (api?.getGeminiKey) {
            api.getGeminiKey().then(k => setGeminiKey(k || ''));
        }
    }, []);

    async function handleConnect() {
        setConnecting(true);
        try {
            await onConnect();
        } finally {
            setConnecting(false);
        }
    }

    const themeOptions = [
        { key: 'system', label: 'Sistema', icon: <Monitor size={14} /> },
        { key: 'light', label: 'Claro', icon: <Sun size={14} /> },
        { key: 'dark', label: 'Oscuro', icon: <Moon size={14} /> },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <h2><Settings size={18} /> Configuración</h2>

                <div style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--border-default)', paddingBottom: 8 }}>
                    <button className={`btn ${activeTab === 'gdrive' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('gdrive')}>
                        <Cloud size={12} /> Google Drive
                    </button>
                    <button className={`btn ${activeTab === 'appearance' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('appearance')}>
                        {resolvedTheme === 'dark' ? <Moon size={12} /> : <Sun size={12} />} Apariencia
                    </button>
                    <button className={`btn ${activeTab === 'about' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('about')}>
                        <Info size={12} /> Acerca de
                    </button>
                    <button className={`btn ${activeTab === 'gemini' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setActiveTab('gemini')}>
                        <Sparkles size={12} /> Gemini AI
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
                                        {gdriveConnected ? 'Cuenta conectada y sincronizada' : 'No conectado'}
                                    </div>
                                </div>
                                <div className={`sync-dot ${gdriveConnected ? 'connected' : 'disconnected'}`} style={{ width: 10, height: 10 }} />
                            </div>
                        </div>

                        {!gdriveConnected && (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                                Conecta tu cuenta de Google para sincronizar tus notebooks automáticamente. Se abrirá tu navegador para autorizar el acceso a Google Drive.
                            </p>
                        )}

                        {gdriveConnected && (
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
                                Tus notebooks se sincronizan en la carpeta <strong>"NoteFlow"</strong> de tu Google Drive. Puedes sincronizar manualmente desde la barra lateral.
                            </p>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                            {gdriveConnected ? (
                                <button className="btn btn-danger" onClick={onDisconnect}><CloudOff size={13} /> Desconectar</button>
                            ) : (
                                <button className="btn btn-primary" onClick={handleConnect} disabled={connecting} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {connecting ? <Loader size={13} className="spin" /> : <Cloud size={13} />}
                                    {connecting ? 'Conectando...' : 'Conectar con Google Drive'}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'appearance' && (
                    <div>
                        <div style={{ padding: 14, background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', marginBottom: 14, border: '1px solid var(--border-default)' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                {resolvedTheme === 'dark' ? <Moon size={14} /> : <Sun size={14} />} Tema de la aplicación
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {themeOptions.map(opt => (
                                    <button
                                        key={opt.key}
                                        className={`btn ${theme === opt.key ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => setTheme(opt.key)}
                                        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px 8px' }}
                                    >
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                            {theme === 'system'
                                ? `Usando el tema del sistema (actualmente ${resolvedTheme === 'dark' ? 'oscuro' : 'claro'})`
                                : `Tema fijo: ${theme === 'dark' ? 'oscuro' : 'claro'}`}
                        </p>
                    </div>
                )}

                {activeTab === 'about' && (
                    <div style={{ textAlign: 'center', padding: 16 }}>
                        <div style={{ fontSize: 40, marginBottom: 8, color: 'var(--onenote-purple)' }}><Sparkles size={48} /></div>
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--onenote-purple)', marginBottom: 4 }}>LibreNote</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 12 }}>Versión 3.1.0</p>
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Aplicación de notas estilo OneNote para Mac, con editor de texto enriquecido, sincronización a Google Drive e integración con Gemini AI.
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16 }}>
                            Desarrollado con Electron + React + TipTap
                        </p>
                    </div>
                )}

                {activeTab === 'gemini' && (
                    <div>
                        <div style={{ padding: 14, background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', marginBottom: 14, border: '1px solid var(--border-default)' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Sparkles size={14} /> Gemini API Key
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
                                Ingresa tu API key de Google Gemini para habilitar la asistencia de IA en el editor. Puedes obtener una en <a href="https://aistudio.google.com/apikey" style={{ color: 'var(--onenote-purple)' }} target="_blank" rel="noreferrer">Google AI Studio</a>.
                            </p>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    <input
                                        type={showKey ? 'text' : 'password'}
                                        value={geminiKey}
                                        onChange={e => { setGeminiKey(e.target.value); setKeySaved(false); }}
                                        placeholder="AIza..."
                                        style={{ width: '100%', padding: '8px 36px 8px 10px', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontFamily: 'monospace', background: 'var(--bg-editor)', color: 'var(--text-primary)' }}
                                    />
                                    <button onClick={() => setShowKey(!showKey)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                                        {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={async () => {
                                    const api = window.librenote;
                                    if (api?.setGeminiKey) { await api.setGeminiKey(geminiKey); }
                                    setKeySaved(true);
                                    setTimeout(() => setKeySaved(false), 2000);
                                }}>
                                    <Key size={12} /> {keySaved ? '¡Guardada!' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                            Haz clic derecho en el editor y selecciona "Ayuda de Gemini" para usar la IA. Tu API key se almacena localmente.
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
