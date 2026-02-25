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
    gdriveDeleteFile: async () => ({ success: false }),

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
    readFileText: async () => null,

    // Export
    exportPdf: async (htmlContent, suggestedName) => {
        // Browser fallback: open styled HTML in a new window and trigger print
        const printWin = window.open('', '_blank', 'width=800,height=600');
        if (!printWin) return { success: false, error: 'No se pudo abrir la ventana de impresión' };
        printWin.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${suggestedName || 'Exportación'}</title>
<style>
body { font-family: 'Segoe UI', -apple-system, sans-serif; padding: 40px; color: #323130; font-size: 13px; line-height: 1.6; }
h1 { font-size: 24px; font-weight: 600; margin: 20px 0 8px; border-bottom: 2px solid #7719AA; padding-bottom: 6px; }
h2 { font-size: 18px; font-weight: 600; color: #7719AA; margin: 16px 0 6px; }
h3 { font-size: 15px; font-weight: 600; color: #605E5C; margin: 12px 0 4px; }
h4 { font-size: 13px; font-weight: 600; margin: 10px 0 4px; }
p { margin: 4px 0; } ul, ol { padding-left: 1.5em; } li { margin: 2px 0; }
blockquote { border-left: 3px solid #7719AA; padding-left: 12px; color: #605E5C; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { border: 1px solid #D2D0CE; padding: 6px 10px; text-align: left; }
th { background: #F3ECFA; font-weight: 600; }
img { max-width: 100%; } .page-break { page-break-before: always; }
.section-header { background: #F3ECFA; padding: 8px 16px; margin: 16px 0 8px; border-radius: 4px; }
.page-title { color: #7719AA; font-size: 18px; font-weight: 300; margin: 12px 0 6px; border-bottom: 1px solid #EDEBE9; padding-bottom: 4px; }
</style></head><body>${htmlContent}</body></html>`);
        printWin.document.close();
        setTimeout(() => { printWin.print(); }, 300);
        return { success: true };
    },
};

const api = isElectron ? window.librenote : browserStorage;

export default api;
export { isElectron };
