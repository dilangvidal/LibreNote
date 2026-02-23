/**
 * Utilidades y constantes — Principio SRP
 */

export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

export const SECTION_COLORS = ['#7719AA', '#0078D4', '#038387', '#107C10', '#CA5010', '#D13438', '#E3008C', '#69797E'];
export const NOTEBOOK_COLORS = ['#7719AA', '#D13438', '#107C10', '#0078D4', '#CA5010', '#038387'];

export function createDefaultNotebook() {
    const pageId = generateId();
    const sectionId = generateId();
    return {
        id: generateId(),
        name: 'Mi Cuaderno',
        color: '#7719AA',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sections: [{
            id: sectionId,
            name: 'General',
            color: '#7719AA',
            pages: [{
                id: pageId,
                title: 'Bienvenido a LibreNote',
                content: '<h1>Bienvenido a LibreNote</h1><p>Tu espacio para capturar ideas, organizar pensamientos y crear contenido.</p><h2>Características</h2><ul><li>Editor de texto enriquecido con formato profesional</li><li>Notebooks organizados en secciones y páginas</li><li>Sincronización con Google Drive</li><li>Interfaz estilo Microsoft OneNote</li></ul><h2>Empezar</h2><p>Crea una nueva página o notebook desde el panel lateral. Usa <strong>/search</strong> en el editor para buscar archivos en Drive.</p>',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            }],
        }],
    };
}

export function formatDate(d, style = 'full') {
    if (!d) return '';
    if (style === 'short') {
        return new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    return new Date(d).toLocaleString('es', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function getTextPreview(html, maxLen = 60) {
    if (!html) return 'Página vacía';
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > maxLen ? text.substring(0, maxLen) + '...' : text || 'Página vacía';
}
