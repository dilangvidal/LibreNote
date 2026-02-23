const { shell } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const url = require('url');

// ── Config — se cargan desde electron/client_secret.json ──
const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(app.getPath('userData'), 'gdrive-token.json');

const config = {
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://127.0.0.1:8234',
    scopes: [
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/drive.readonly',
    ],
};

function loadConfig() {
    if (fs.existsSync(CLIENT_SECRET_PATH)) {
        try {
            const raw = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
            const creds = raw.installed || raw.web || {};
            config.clientId = creds.client_id || '';
            config.clientSecret = creds.client_secret || '';
            console.log('[GDrive] Credenciales cargadas desde client_secret.json');
        } catch (e) {
            console.error('[GDrive] Error al leer client_secret.json:', e.message);
        }
    } else {
        console.warn('[GDrive] No se encontró client_secret.json en', CLIENT_SECRET_PATH);
        console.warn('[GDrive] Consulta el README.md para configurar Google Drive.');
    }
}

let tokens = null;

function loadTokens() {
    if (fs.existsSync(TOKEN_PATH)) {
        try {
            tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        } catch (e) { tokens = null; }
    }
}

function saveTokens() {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

function initGDrive() {
    loadConfig();
    loadTokens();
    console.log('[GDrive] Inicializado. Autenticado:', isAuthenticated());
}

function isAuthenticated() {
    return tokens !== null && tokens.access_token != null;
}

function logout() {
    tokens = null;
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    return true;
}

// ── OAuth2 Flow — abre en el navegador predeterminado del sistema ──
function handleGDriveAuth() {
    return new Promise((resolve, reject) => {
        // Si ya estamos autenticados, resolver de inmediato
        if (isAuthenticated()) {
            resolve({ success: true });
            return;
        }

        // Crear servidor HTTP local para recibir el callback de OAuth
        const server = http.createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true);
            const code = parsedUrl.query.code;
            const error = parsedUrl.query.error;

            if (error) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="background:#1a1a2e;color:#ff6b6b;font-family:'Segoe UI',Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column">
                        <h2 style="margin-bottom:8px">❌ Error de autenticación</h2>
                        <p style="color:#ccc;font-size:14px">${error}</p>
                        <p style="color:#888;font-size:12px;margin-top:16px">Puedes cerrar esta pestaña.</p>
                    </body></html>
                `);
                server.close();
                reject(new Error(`Autenticación cancelada: ${error}`));
                return;
            }

            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html><body style="background:#1a1a2e;color:#00d68f;font-family:'Segoe UI',Inter,system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column">
                        <h2 style="margin-bottom:8px">✅ ¡Autenticación exitosa!</h2>
                        <p style="color:#ccc;font-size:14px">NoteFlow se ha conectado a tu Google Drive.</p>
                        <p style="color:#888;font-size:12px;margin-top:16px">Puedes cerrar esta pestaña y volver a la aplicación.</p>
                    </body></html>
                `);
                server.close();
                try {
                    await exchangeCodeForTokens(code);
                    resolve({ success: true });
                } catch (e) {
                    reject(e);
                }
            } else if (parsedUrl.pathname === '/favicon.ico') {
                res.writeHead(204);
                res.end();
            } else {
                res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end('<html><body style="background:#1a1a2e;color:#ff6b6b;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>No se recibió código de autorización</h2></body></html>');
            }
        });

        // Timeout de 5 minutos para la autenticación
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error('Tiempo de espera agotado para la autenticación'));
        }, 5 * 60 * 1000);

        server.on('close', () => clearTimeout(timeout));

        server.listen(8234, () => {
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(config.clientId)}` +
                `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
                `&response_type=code` +
                `&scope=${encodeURIComponent(config.scopes.join(' '))}` +
                `&access_type=offline` +
                `&prompt=consent`;

            // Abrir en el navegador predeterminado del sistema
            console.log('[GDrive] Abriendo navegador para autenticación...');
            shell.openExternal(authUrl);
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error('El puerto 8234 está en uso. Cierra otras instancias de NoteFlow e intenta de nuevo.'));
            } else {
                reject(err);
            }
        });
    });
}

function exchangeCodeForTokens(code) {
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            code,
            client_id: config.clientId,
            client_secret: config.clientSecret,
            redirect_uri: config.redirectUri,
            grant_type: 'authorization_code',
        }).toString();

        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const tokenData = JSON.parse(body);
                    if (tokenData.access_token) {
                        tokens = tokenData;
                        saveTokens();
                        resolve(tokenData);
                    } else {
                        reject(new Error(tokenData.error_description || 'Error al intercambiar el código por tokens'));
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function refreshAccessToken() {
    if (!tokens || !tokens.refresh_token) throw new Error('No hay refresh token');
    return new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: tokens.refresh_token,
            grant_type: 'refresh_token',
        }).toString();

        const req = https.request({
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
            },
        }, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.access_token) {
                        tokens.access_token = data.access_token;
                        saveTokens();
                        resolve(tokens);
                    } else {
                        reject(new Error('Error al refrescar el token'));
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// ── Drive API helpers ──
function driveRequest(method, pathStr, body, isUpload) {
    return new Promise(async (resolve, reject) => {
        if (!tokens) return reject(new Error('No autenticado'));
        const headers = {
            'Authorization': `Bearer ${tokens.access_token}`,
        };
        if (body && !isUpload) {
            headers['Content-Type'] = 'application/json';
        }
        const options = {
            hostname: 'www.googleapis.com',
            path: pathStr,
            method,
            headers,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 401) {
                    refreshAccessToken()
                        .then(() => driveRequest(method, pathStr, body, isUpload))
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                try { resolve(JSON.parse(data)); }
                catch { resolve(data); }
            });
        });
        req.on('error', reject);
        if (body) {
            if (typeof body === 'string') req.write(body);
            else req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function findOrCreateFolder(name) {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
    if (res.files && res.files.length > 0) return res.files[0].id;

    const folder = await driveRequest('POST', '/drive/v3/files', {
        name,
        mimeType: 'application/vnd.google-apps.folder',
    });
    return folder.id;
}

async function deleteDriveFile(fileId) {
    try {
        await driveRequest('DELETE', `/drive/v3/files/${fileId}`);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function syncToGDrive(notebooks) {
    try {
        const folderId = await findOrCreateFolder('NoteFlow');

        // Upload/update existing notebooks
        for (const nb of notebooks) {
            const fileName = `${nb.id}.json`;
            const content = JSON.stringify(nb, null, 2);

            const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
            const existing = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

            if (existing.files && existing.files.length > 0) {
                const fileId = existing.files[0].id;
                const boundary = '----NoteFlowBoundary';
                const delimiter = `\r\n--${boundary}\r\n`;
                const closeDelimiter = `\r\n--${boundary}--`;
                const multipartBody =
                    delimiter +
                    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                    JSON.stringify({ name: fileName }) +
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    content +
                    closeDelimiter;

                await new Promise((resolve, reject) => {
                    const req = https.request({
                        hostname: 'www.googleapis.com',
                        path: `/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': `multipart/related; boundary=${boundary}`,
                            'Content-Length': Buffer.byteLength(multipartBody),
                        },
                    }, (res) => {
                        let data = '';
                        res.on('data', (c) => data += c);
                        res.on('end', () => resolve(data));
                    });
                    req.on('error', reject);
                    req.write(multipartBody);
                    req.end();
                });
            } else {
                const boundary = '----NoteFlowBoundary';
                const delimiter = `\r\n--${boundary}\r\n`;
                const closeDelimiter = `\r\n--${boundary}--`;
                const metadata = { name: fileName, parents: [folderId] };
                const multipartBody =
                    delimiter +
                    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
                    JSON.stringify(metadata) +
                    delimiter +
                    'Content-Type: application/json\r\n\r\n' +
                    content +
                    closeDelimiter;

                await new Promise((resolve, reject) => {
                    const req = https.request({
                        hostname: 'www.googleapis.com',
                        path: `/upload/drive/v3/files?uploadType=multipart`,
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${tokens.access_token}`,
                            'Content-Type': `multipart/related; boundary=${boundary}`,
                            'Content-Length': Buffer.byteLength(multipartBody),
                        },
                    }, (res) => {
                        let data = '';
                        res.on('data', (c) => data += c);
                        res.on('end', () => resolve(data));
                    });
                    req.on('error', reject);
                    req.write(multipartBody);
                    req.end();
                });
            }
        }

        // Delete remote notebooks that no longer exist locally
        const localIds = new Set(notebooks.map(nb => `${nb.id}.json`));
        const allQuery = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
        const allRemote = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(allQuery)}&fields=files(id,name)`);
        if (allRemote.files) {
            for (const remoteFile of allRemote.files) {
                if (!localIds.has(remoteFile.name)) {
                    console.log(`[GDrive] Eliminando archivo remoto: ${remoteFile.name}`);
                    await deleteDriveFile(remoteFile.id);
                }
            }
        }

        return { success: true, count: notebooks.length };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function syncFromGDrive() {
    try {
        const folderId = await findOrCreateFolder('NoteFlow');
        const query = `'${folderId}' in parents and trashed=false and mimeType='application/json'`;
        const listing = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

        if (!listing.files || listing.files.length === 0) return { success: true, notebooks: [] };

        const notebooks = [];
        for (const file of listing.files) {
            const content = await driveRequest('GET', `/drive/v3/files/${file.id}?alt=media`);
            if (typeof content === 'object' && content.id) {
                notebooks.push(content);
            }
        }
        return { success: true, notebooks };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function uploadFileToDrive(filePath, fileName) {
    try {
        const folderId = await findOrCreateFolder('NoteFlow');
        const fileContent = fs.readFileSync(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const mimeMap = {
            '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
            '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.txt': 'text/plain', '.csv': 'text/csv', '.zip': 'application/zip',
        };
        const mimeType = mimeMap[ext] || 'application/octet-stream';
        const boundary = '----NoteFlowUpload';
        const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
        const delimiter = `\r\n--${boundary}\r\n`;
        const closeDelimiter = `\r\n--${boundary}--`;
        const multipartBody = Buffer.concat([
            Buffer.from(delimiter + 'Content-Type: application/json; charset=UTF-8\r\n\r\n' + metadata + delimiter + `Content-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`),
            Buffer.from(fileContent.toString('base64')),
            Buffer.from(closeDelimiter),
        ]);

        const result = await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'www.googleapis.com',
                path: '/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': `multipart/related; boundary=${boundary}`,
                    'Content-Length': multipartBody.length,
                },
            }, (res) => {
                let data = '';
                res.on('data', (c) => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); } catch { resolve(data); }
                });
            });
            req.on('error', reject);
            req.write(multipartBody);
            req.end();
        });
        return { success: true, file: result };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function searchDriveFiles(query) {
    try {
        const searchQuery = `name contains '${query.replace(/'/g, "\\'")}' and trashed=false`;
        const res = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(searchQuery)}&fields=files(id,name,mimeType,webViewLink,iconLink,modifiedTime)&pageSize=20`);
        return { success: true, files: res.files || [] };
    } catch (err) {
        return { success: false, error: err.message, files: [] };
    }
}

async function getFileUrl(fileId) {
    try {
        const res = await driveRequest('GET', `/drive/v3/files/${fileId}?fields=id,name,webViewLink,webContentLink`);
        return { success: true, url: res.webViewLink || res.webContentLink, name: res.name };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function downloadDriveFile(fileId, fileName) {
    try {
        if (!tokens) throw new Error('No autenticado');
        const downloadDir = path.join(app.getPath('home'), 'LibreNoteData', 'downloads');
        if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });

        const filePath = path.join(downloadDir, fileName);

        return new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'www.googleapis.com',
                path: `/drive/v3/files/${fileId}?alt=media`,
                method: 'GET',
                headers: { 'Authorization': `Bearer ${tokens.access_token}` },
            }, (res) => {
                if (res.statusCode === 401) {
                    refreshAccessToken()
                        .then(() => downloadDriveFile(fileId, fileName))
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    let body = '';
                    res.on('data', c => body += c);
                    res.on('end', () => reject(new Error(`Error ${res.statusCode}: ${body}`)));
                    return;
                }
                const fileStream = fs.createWriteStream(filePath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve({ success: true, path: filePath });
                });
                fileStream.on('error', (e) => {
                    fs.unlink(filePath, () => { });
                    reject(e);
                });
            });
            req.on('error', reject);
            req.end();
        });
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    initGDrive,
    handleGDriveAuth,
    isAuthenticated,
    logout,
    syncToGDrive,
    syncFromGDrive,
    uploadFileToDrive,
    searchDriveFiles,
    getFileUrl,
    downloadDriveFile,
    deleteDriveFile,
};
