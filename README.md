<p align="center">
  <img src="assets/banner.png" alt="LibreNote Banner" width="600" />
</p>

<h1 align="center">LibreNote</h1>

<p align="center">
  <strong>Aplicación de notas de escritorio estilo OneNote — libre y de código abierto</strong><br>
  Editor enriquecido • Google Drive • Imágenes arrastrables • Modo Oscuro
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react" />
  <img src="https://img.shields.io/badge/TipTap-2.6-1A1A2E" />
  <img src="https://img.shields.io/badge/Platform-macOS-000?logo=apple" />
  <img src="https://img.shields.io/badge/License-MIT-green" />
</p>

---

## ✨ Características

- 📝 **Editor de texto enriquecido** — Títulos, negrita, cursiva, listas, tareas, bloques de código, citas, imágenes
- 📓 **Organización tipo OneNote** — Notebooks → Secciones → Páginas
- ☁️ **Sincronización con Google Drive** — Sube, descarga y elimina notebooks automáticamente
- 🌙 **Modo oscuro / claro** — Detecta el sistema o configúralo manualmente
- 📎 **Archivos adjuntos** — Inserta imágenes y archivos con upload a Drive
- 🔍 **Búsqueda en Drive** — Botón "Drive" en la pestaña Inicio para buscar e insertar archivos de Google Drive
- 📥 **Vista dual de archivos** — Descarga y abre local, o visualiza en el navegador
- 📋 **Opciones de pegado** — Al pegar contenido formateado: mantener formato, combinar o solo texto
- 🧹 **Quitar formato** — Botón en la barra de Inicio para limpiar el formato del texto seleccionado
- 🖼️ **Imágenes arrastrables** — Arrastra y redimensiona imágenes dentro de la página
- ✍️ **Escribe en cualquier parte** — Haz clic en cualquier lugar de la página para empezar a escribir
- ⚠️ **Confirmación de eliminación** — Modal de confirmación con advertencia de sincronización en la nube
- 📱 **Diseño responsive** — Se adapta a pantallas pequeñas

<p align="center">
  <img src="assets/app-dark.png" alt="LibreNote en modo oscuro" width="700" />
</p>

## 🚀 Instalación

### Descargar

Descarga la última versión compilada para macOS desde [Releases](https://github.com/dilangvidal/LibreNote/releases).

### Desde el código fuente

#### Requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

#### Clonar y ejecutar

```bash
git clone https://github.com/dilangvidal/LibreNote.git
cd LibreNote
npm install
npm run dev
```

Esto lanza simultáneamente Vite (frontend) y Electron (desktop).

#### Compilar para producción

```bash
npm run build
```

Genera un `.dmg` instalable para macOS en la carpeta `release/`.

## 🔑 Configuración de Google Drive

Para habilitar la sincronización con Google Drive:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto o selecciona uno existente
3. Habilita la **Google Drive API**
4. Crea credenciales **OAuth 2.0** (tipo "Desktop App")
5. Descarga el archivo `client_secret.json` y colócalo en `electron/`
6. En la pantalla de consentimiento OAuth, agrega tu email como **usuario de prueba**

> **Nota:** El archivo `client_secret.json` está en `.gitignore` por seguridad.

## 📁 Estructura del Proyecto

```
LibreNote/
├── electron/                  # Proceso principal de Electron
│   ├── main.js                # Ventana, menú, IPC handlers
│   ├── gdrive.js              # Autenticación y API de Google Drive
│   └── preload.js             # Bridge seguro al renderer
├── src/                       # Frontend React
│   ├── context/
│   │   └── ThemeContext.jsx    # Modo oscuro/claro
│   ├── hooks/
│   │   ├── useNotebooks.js    # CRUD de notebooks
│   │   ├── useGDriveSync.js   # Sincronización con Drive
│   │   └── useResponsiveLayout.js
│   ├── services/
│   │   └── api.js             # Abstracción Electron/Browser
│   ├── utils/
│   │   └── helpers.js         # Utilidades reutilizables
│   ├── extensions/
│   │   └── DraggableImage.js  # Extensión TipTap para imágenes arrastrables
│   ├── components/
│   │   ├── EditorArea.jsx     # Editor TipTap con Link extension
│   │   ├── RibbonBar.jsx      # Barra de herramientas
│   │   ├── Sidebar.jsx        # Panel de notebooks
│   │   ├── PageList.jsx       # Lista de páginas
│   │   ├── ConfirmDeleteModal.jsx  # Modal de confirmación
│   │   ├── SettingsModal.jsx  # Configuración
│   │   └── DriveSearchPopup.jsx    # Búsqueda en Drive
│   ├── App.jsx                # Orquestador principal
│   ├── main.jsx               # Entry point con ThemeProvider
│   └── index.css              # Design system completo
├── assets/                    # Recursos estáticos
├── package.json
└── vite.config.js
```

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|------------|-----|
| **Electron 28** | App de escritorio para macOS |
| **React 18** | UI declarativa con hooks |
| **TipTap 2.6** | Editor WYSIWYG basado en ProseMirror |
| **Vite 5** | Build tool ultrarrápido |
| **Lucide React** | Iconos SVG modernos |
| **Google Drive API** | Sincronización bidireccional en la nube |

## 📄 Licencia

MIT — Puedes usar, modificar y distribuir libremente.

---

<p align="center">
  Hecho con 💜 usando Electron + React + TipTap
</p>
