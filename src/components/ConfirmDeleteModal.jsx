import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmDeleteModal({ type, name, gdriveConnected, onConfirm, onCancel }) {
    const typeLabels = {
        notebook: 'el notebook',
        section: 'la sección',
        page: 'la página',
    };

    return (
        <>
            <div className="confirm-delete-overlay" onClick={onCancel} />
            <div className="confirm-delete-modal">
                <div className="confirm-delete-header">
                    <div className="confirm-delete-icon">
                        <AlertTriangle size={24} />
                    </div>
                    <button className="btn-icon" onClick={onCancel}><X size={16} /></button>
                </div>
                <div className="confirm-delete-body">
                    <h3>¿Eliminar {typeLabels[type] || 'este elemento'}?</h3>
                    <p className="confirm-delete-name">"{name || 'Sin título'}"</p>
                    <p className="confirm-delete-desc">
                        Esta acción no se puede deshacer. Se eliminará {typeLabels[type]} y todo su contenido de forma permanente.
                    </p>
                    {gdriveConnected && (
                        <div className="confirm-delete-warning">
                            <AlertTriangle size={14} />
                            <span>
                                Si sincronizas con Google Drive, este elemento también se eliminará en la nube.
                            </span>
                        </div>
                    )}
                </div>
                <div className="confirm-delete-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
                    <button className="btn btn-danger" onClick={onConfirm}>
                        <Trash2 size={14} />
                        Eliminar
                    </button>
                </div>
            </div>
        </>
    );
}
