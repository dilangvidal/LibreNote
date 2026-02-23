const { BrowserWindow } = require('electron');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const url = require('url');

// ── Config ──
const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(app.getPath('userData'), 'gdrive-token.json');

// Config loaded from bundled client_secret.json
let config = {
    clientId: '',
    clientSecret: '',
    redirectUri: 'http://127.0.0.1:8234',
    scopes: ['https://www.googleapis.com/auth/drive.file'],
};

let tokens = null;

function loadConfig() {
    // Load from bundled client_secret.json
    if (fs.existsSync(CLIENT_SECRET_PATH)) {
        try {
            const raw = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
            const creds = raw.installed || raw.web || {};
            config.clientId = creds.client_id || '';
            config.clientSecret = creds.client_secret || '';
            console.log('[GDrive] Loaded credentials from client_secret.json, clientId:', config.clientId.substring(0, 20) + '...');
        } catch (e) {
            console.error('[GDrive] Failed to load client_secret.json:', e.message);
        }
    } else {
        console.warn('[GDrive] client_secret.json not found at', CLIENT_SECRET_PATH);
    }
}



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
}

function isAuthenticated() {
    return tokens !== null && tokens.access_token != null;
}

function logout() {
    tokens = null;
    if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
    return true;
}

// ── OAuth2 Flow ──
function handleGDriveAuth(parentWindow) {
    return new Promise((resolve, reject) => {
        if (!config.clientId) {
            reject(new Error('No Google OAuth Client ID configured. Please set it in Settings.'));
            return;
        }

        // Start a local HTTP server to receive the redirect
        const server = http.createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url, true);
            const code = parsedUrl.query.code;
            if (code) {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<html><body style="background:#0f0f17;color:#fff;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><h2>✅ Authenticated! You can close this window.</h2></body></html>');
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
                res.writeHead(400);
                res.end('No code received');
            }
        });

        server.listen(8234, () => {
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
                `client_id=${encodeURIComponent(config.clientId)}` +
                `&redirect_uri=${encodeURIComponent(config.redirectUri)}` +
                `&response_type=code` +
                `&scope=${encodeURIComponent(config.scopes.join(' '))}` +
                `&access_type=offline` +
                `&prompt=consent`;

            const authWindow = new BrowserWindow({
                width: 600,
                height: 700,
                parent: parentWindow,
                modal: true,
                webPreferences: { nodeIntegration: false, contextIsolation: true },
            });

            authWindow.loadURL(authUrl);
            authWindow.on('closed', () => {
                server.close();
            });
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
                        reject(new Error(tokenData.error_description || 'Token exchange failed'));
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
    if (!tokens || !tokens.refresh_token) throw new Error('No refresh token');
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
                const data = JSON.parse(body);
                if (data.access_token) {
                    tokens.access_token = data.access_token;
                    saveTokens();
                    resolve(tokens);
                } else {
                    reject(new Error('Refresh failed'));
                }
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
        if (!tokens) return reject(new Error('Not authenticated'));
        const hostname = isUpload ? 'www.googleapis.com' : 'www.googleapis.com';
        const headers = {
            'Authorization': `Bearer ${tokens.access_token}`,
        };
        if (body && !isUpload) {
            headers['Content-Type'] = 'application/json';
        }
        const options = {
            hostname,
            path: pathStr,
            method,
            headers,
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 401) {
                    // Try refresh
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
    // Search for existing folder
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);
    if (res.files && res.files.length > 0) return res.files[0].id;

    // Create folder
    const folder = await driveRequest('POST', '/drive/v3/files', {
        name,
        mimeType: 'application/vnd.google-apps.folder',
    });
    return folder.id;
}

async function syncToGDrive(notebooks) {
    try {
        const folderId = await findOrCreateFolder('NoteFlow');

        for (const nb of notebooks) {
            const fileName = `${nb.id}.json`;
            const content = JSON.stringify(nb, null, 2);

            // Check if file exists
            const query = `name='${fileName}' and '${folderId}' in parents and trashed=false`;
            const existing = await driveRequest('GET', `/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`);

            if (existing.files && existing.files.length > 0) {
                // Update existing file
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
                // Create new file
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
};
