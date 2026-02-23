/**
 * Capa de abstracción de API — Principio SRP
 * Provee una interfaz unificada independiente de la plataforma (Electron vs Browser).
 */

const isElectron = typeof window !== 'undefined' && window.noteflow;

const browserStorage = {
    // ── Local Storage ──
    listNotebooks: async () => {
        const d = localStorage.getItem('noteflow-notebooks');
        return d ? JSON.parse(d) : [];
    },
    saveNotebook: async (nb) => {
        const nbs = await browserStorage.listNotebooks();
        const i = nbs.findIndex(n => n.id === nb.id);
        if (i >= 0) nbs[i] = nb; else nbs.push(nb);
        localStorage.setItem('noteflow-notebooks', JSON.stringify(nbs));
        return true;
    },
    deleteNotebook: async (id) => {
        const nbs = await browserStorage.listNotebooks();
        localStorage.setItem('noteflow-notebooks', JSON.stringify(nbs.filter(n => n.id !== id)));
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

    // ── File operations (stubs para navegador) ──
    pickImage: async () => null,
    pickFile: async () => null,
    openLocalFile: async () => false,
};

const api = isElectron ? window.noteflow : browserStorage;

export default api;
export { isElectron };
