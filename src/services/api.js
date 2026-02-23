/**
 * Capa de abstracción de API — Principio SRP
 * Provee una interfaz unificada independiente de la plataforma (Electron vs Browser).
 */

const isElectron = typeof window !== 'undefined' && window.librenote;

const browserStorage = {
    // ── Local Storage ──
    listNotebooks: async () => {
        const d = localStorage.getItem('librenote-notebooks');
        return d ? JSON.parse(d) : [];
    },
    saveNotebook: async (nb) => {
        const nbs = await browserStorage.listNotebooks();
        const i = nbs.findIndex(n => n.id === nb.id);
        if (i >= 0) nbs[i] = nb; else nbs.push(nb);
        localStorage.setItem('librenote-notebooks', JSON.stringify(nbs));
        return true;
    },
    deleteNotebook: async (id) => {
        const nbs = await browserStorage.listNotebooks();
        localStorage.setItem('librenote-notebooks', JSON.stringify(nbs.filter(n => n.id !== id)));
        return true;
    },

    // ── Google Drive (stubs para navegador) ──
    isGDriveAuthenticated: async () => false,
    gdriveAuth: async () => ({ success: false }),
    gdriveLogout: async () => true,
    gdriveSyncUp: async () => ({ success: false }),
    gdriveSyncDown: async () => ({ success: true, notebooks: [] }),
    gdriveSearchFiles: async () => ({ success: false, files: [] }),
    gdriveGetFileUrl: async () => ({ success: false }),
    gdriveUploadFile: async () => ({ success: false }),
    gdriveDownloadFile: async () => ({ success: false }),

    // Config
    getGeminiKey: async () => localStorage.getItem('librenote-gemini-key') || '',
    setGeminiKey: async (key) => { localStorage.setItem('librenote-gemini-key', key); return true; },

    // Gemini AI (browser fallback — calls API directly)
    geminiChat: async (prompt, pageContext, selectedText) => {
        const apiKey = localStorage.getItem('librenote-gemini-key');
        if (!apiKey) return { success: false, error: 'No se ha configurado la API key de Gemini.' };
        try {
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: `${prompt}\n\nContexto: ${pageContext || ''}\n\nSelección: ${selectedText || ''}` }] }] }),
            });
            const data = await resp.json();
            return { success: true, text: data?.candidates?.[0]?.content?.parts?.[0]?.text || '' };
        } catch (e) { return { success: false, error: e.message }; }
    },

    // File operations (stubs para navegador)
    pickImage: async () => null,
    pickFile: async () => null,
    openLocalFile: async () => false,
};

const api = isElectron ? window.librenote : browserStorage;

export default api;
export { isElectron };
