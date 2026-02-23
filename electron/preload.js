const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noteflow', {
    // Local storage
    listNotebooks: () => ipcRenderer.invoke('storage:list-notebooks'),
    saveNotebook: (notebook) => ipcRenderer.invoke('storage:save-notebook', notebook),
    deleteNotebook: (notebookId) => ipcRenderer.invoke('storage:delete-notebook', notebookId),

    // File operations
    pickFile: (accept) => ipcRenderer.invoke('file:pick', accept),
    pickImage: () => ipcRenderer.invoke('file:pick-image'),

    // Google Drive
    isGDriveAuthenticated: () => ipcRenderer.invoke('gdrive:is-authenticated'),
    gdriveAuth: () => ipcRenderer.invoke('gdrive:auth'),
    gdriveLogout: () => ipcRenderer.invoke('gdrive:logout'),
    gdriveSyncUp: (notebooks) => ipcRenderer.invoke('gdrive:sync-up', notebooks),
    gdriveSyncDown: () => ipcRenderer.invoke('gdrive:sync-down'),
    gdriveUploadFile: (filePath, fileName) => ipcRenderer.invoke('gdrive:upload-file', filePath, fileName),
    gdriveSearchFiles: (query) => ipcRenderer.invoke('gdrive:search-files', query),
    gdriveGetFileUrl: (fileId) => ipcRenderer.invoke('gdrive:get-file-url', fileId),
});
