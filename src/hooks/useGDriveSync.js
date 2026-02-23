import { useState } from 'react';
import api from '../services/api';

/**
 * Hook para sincronización con Google Drive — Principio SRP
 */
export default function useGDriveSync(notebooks, setNotebooks) {
    const [gdriveConnected, setGdriveConnected] = useState(false);
    const [syncStatus, setSyncStatus] = useState('idle');

    async function checkGDriveAuth() {
        setGdriveConnected(await api.isGDriveAuthenticated());
    }

    async function handleGDriveConnect() {
        try {
            await api.gdriveAuth();
            setGdriveConnected(true);
        } catch (e) {
            console.error(e);
        }
    }

    async function handleGDriveDisconnect() {
        await api.gdriveLogout();
        setGdriveConnected(false);
    }

    async function handleSync() {
        setSyncStatus('syncing');
        try {
            const r = await api.gdriveSyncUp(notebooks);
            setSyncStatus(r.success ? 'success' : 'error');
        } catch {
            setSyncStatus('error');
        }
        setTimeout(() => setSyncStatus('idle'), 3000);
    }

    async function handleSyncDown() {
        setSyncStatus('syncing');
        try {
            const r = await api.gdriveSyncDown();
            if (r.success && r.notebooks?.length > 0) {
                const merged = [...notebooks];
                for (const remote of r.notebooks) {
                    const i = merged.findIndex(n => n.id === remote.id);
                    if (i >= 0 && new Date(remote.updatedAt) > new Date(merged[i].updatedAt)) {
                        merged[i] = remote;
                        await api.saveNotebook(remote);
                    } else if (i < 0) {
                        merged.push(remote);
                        await api.saveNotebook(remote);
                    }
                }
                setNotebooks(merged);
            }
            setSyncStatus('success');
        } catch {
            setSyncStatus('error');
        }
        setTimeout(() => setSyncStatus('idle'), 3000);
    }

    return {
        gdriveConnected, syncStatus,
        checkGDriveAuth, handleGDriveConnect, handleGDriveDisconnect,
        handleSync, handleSyncDown,
    };
}
