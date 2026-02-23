const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { initGDrive, handleGDriveAuth, syncToGDrive, syncFromGDrive, isAuthenticated, logout, uploadFileToDrive, searchDriveFiles, getFileUrl, downloadDriveFile } = require('./gdrive');

const DATA_DIR = path.join(app.getPath('home'), 'LibreNoteData', 'notebooks');
const CONFIG_DIR = path.join(app.getPath('home'), 'LibreNoteData');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 400,
        minHeight: 500,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 12 },
        backgroundColor: '#F3F2F1',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    const isDev = !app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    }
}

function buildMenu() {
    const template = [
        {
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'quit' },
            ],
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' },
            ],
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC: Local Storage ──
ipcMain.handle('storage:list-notebooks', async () => {
    ensureDataDir();
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
        return data;
    });
});

ipcMain.handle('storage:save-notebook', async (_event, notebook) => {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, `${notebook.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(notebook, null, 2), 'utf-8');
    return true;
});

ipcMain.handle('storage:delete-notebook', async (_event, notebookId) => {
    const filePath = path.join(DATA_DIR, `${notebookId}.json`);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
    return true;
});

// ── IPC: File Operations ──
ipcMain.handle('file:pick-image', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'] },
        ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };
    const mime = mimeMap[ext] || 'image/png';
    const data = fs.readFileSync(filePath);
    const base64 = data.toString('base64');
    return { dataUrl: `data:${mime};base64,${base64}`, name: path.basename(filePath), path: filePath };
});

ipcMain.handle('file:pick', async (_event, acceptLabel) => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: acceptLabel || 'All Files', extensions: ['*'] },
        ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    return { name: path.basename(filePath), path: filePath, size: fs.statSync(filePath).size };
});

ipcMain.handle('file:open-local', async (_event, filePath) => {
    try {
        await shell.openPath(filePath);
        return true;
    } catch (e) {
        console.error('[File] Error opening file:', e);
        return false;
    }
});

// ── IPC: Google Drive ──
ipcMain.handle('gdrive:is-authenticated', async () => {
    return isAuthenticated();
});

ipcMain.handle('gdrive:auth', async () => {
    return await handleGDriveAuth();
});

ipcMain.handle('gdrive:logout', async () => {
    return logout();
});

ipcMain.handle('gdrive:sync-up', async (_event, notebooks) => {
    return await syncToGDrive(notebooks);
});

ipcMain.handle('gdrive:sync-down', async () => {
    return await syncFromGDrive();
});

ipcMain.handle('gdrive:upload-file', async (_event, filePath, fileName) => {
    return await uploadFileToDrive(filePath, fileName);
});

ipcMain.handle('gdrive:search-files', async (_event, query) => {
    return await searchDriveFiles(query);
});

ipcMain.handle('gdrive:get-file-url', async (_event, fileId) => {
    return await getFileUrl(fileId);
});

ipcMain.handle('gdrive:download-file', async (_event, fileId, fileName) => {
    return await downloadDriveFile(fileId, fileName);
});

// ── IPC: Config (API keys) ──
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        }
    } catch (e) { console.error('[Config] Error loading:', e); }
    return {};
}

function saveConfig(config) {
    try {
        if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) { console.error('[Config] Error saving:', e); }
}

ipcMain.handle('config:get-gemini-key', async () => {
    const config = loadConfig();
    return config.geminiApiKey || '';
});

ipcMain.handle('config:set-gemini-key', async (_event, key) => {
    const config = loadConfig();
    config.geminiApiKey = key;
    saveConfig(config);
    return true;
});

// ── IPC: Gemini AI ──
ipcMain.handle('gemini:chat', async (_event, prompt, pageContext, selectedText) => {
    try {
        const config = loadConfig();
        const apiKey = config.geminiApiKey;
        if (!apiKey) return { success: false, error: 'No se ha configurado la API key de Gemini. Ve a Configuración → Gemini AI.' };

        const systemInstruction = `Eres un asistente de escritura integrado en LibreNote, una aplicación de notas. Tu rol es ayudar al usuario a mejorar, expandir, resumir, traducir o generar contenido basándote en el contexto de su página.

IMPORTANTE: Responde SIEMPRE en el mismo idioma que el contenido de la página. Si la página está en español, responde en español. Si está en inglés, responde en inglés.

Devuelve tu respuesta en HTML listo para insertar en el editor (usa <p>, <strong>, <em>, <h2>, <h3>, <ul>, <li>, etc). NO uses markdown.`;

        let userMessage = prompt;
        if (selectedText) {
            userMessage += `\n\nTexto seleccionado:\n"""${selectedText}"""\n`;
        }
        if (pageContext) {
            userMessage += `\n\nContexto completo de la página:\n"""${pageContext}"""\n`;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: systemInstruction }] },
                contents: [{ parts: [{ text: userMessage }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('[Gemini] API error:', err);
            return { success: false, error: `Error de API (${response.status}): Verifica tu API key.` };
        }

        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { success: true, text };
    } catch (e) {
        console.error('[Gemini] Error:', e);
        return { success: false, error: `Error de conexión: ${e.message}` };
    }
});

// ── App lifecycle ──
app.whenReady().then(() => {
    initGDrive();
    buildMenu();
    createWindow();
});

app.on('window-all-closed', () => {
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
