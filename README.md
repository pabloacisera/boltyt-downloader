# Youtube Download App V2
Aplicación de escritorio moderna construida con Electron para la descarga y gestión de videos de YouTube, optimizada para equipos con recursos limitados (como Intel Pentium T4500).

## 1) Características Principales (V2)
- **Cookie Bridge**: Permite la descarga de videos con restricción de edad o contenido para miembros mediante la integración de cookies del navegador (Chrome, Firefox, Brave, Edge, etc.).
- **Motor de Descarga Optimizado**: Utiliza `yt-dlp` con configuraciones específicas para maximizar el rendimiento en CPUs antiguas:
  - Descarga concurrente de fragmentos.
  - Ajuste de buffer para bajo consumo de RAM.
  - Modo sin archivos temporales (.part) para mayor rapidez.
- **Reproductor Integrado**: Visualiza tus descargas directamente en la app con un modal de cine y controles nativos.
- **Persistencia de Reproducción**: La app recuerda automáticamente el segundo exacto donde dejaste cada video.
- **Gestión de Configuración**:
  - Selección de navegador para autenticación automática.
  - Opción de carpeta de descargas fija o selección manual por cada video.
- **Historial Avanzado**: Listado paginado con búsqueda, redescarga y eliminación física del archivo y registro.
- **CI/CD Automatizado**: Sistema de compilación automática mediante GitHub Actions para generar instaladores `.exe` (Windows) y `.deb` (Linux).

## 2) Stack Tecnológico
- **Runtime**: Electron 41+
- **Frontend**: HTML5, CSS3 (Material Symbols), JavaScript Vanilla.
- **Modales**: SweetAlert2 (CDN).
- **Base de Datos**: SQLite via `better-sqlite3`.
- **Core de Descarga**: `yt-dlp` (binario local).
- **Automatización**: GitHub Actions + `electron-builder`.

## 3) Estructura del Proyecto
```text
youtube_download_app.v2/
├── .github/workflows/   # Automatización de builds (GitHub Actions)
├── bin/                 # Binarios de yt-dlp y Node.js
├── database/            # Conexión y esquema SQLite
├── icons/               # Iconos de la aplicación (.ico, .png)
├── public/              # Recursos estáticos (CSS, JS)
├── repositories/        # Capa de datos (Downloads, Settings)
├── downloads.sqlite     # Base de datos local
├── index.html           # Interfaz principal
├── main.js              # Proceso principal (Electron)
├── preload.js           # Puente seguro IPC
└── package.json         # Dependencias y scripts de build
```

## 4) Instalación y Desarrollo
1. **Clonar y dependencias**:
```bash
npm install
```
2. **Permisos (Linux/macOS)**:
```bash
chmod +x bin/yt-dlp bin/node
```
3. **Ejecución**:
```bash
npm start
```

## 5) Configuración de Sesión (Importante)
Para descargar videos restringidos:
1. Abre la aplicación.
2. Haz clic en el icono de **Ajustes** (engranaje).
3. Selecciona el navegador que usas habitualmente (donde tengas iniciada tu sesión de YouTube).
4. El indicador en la barra superior pasará a **"Conectado: [Navegador]"**.

## 6) Generación de Ejecutables (Releases)
La app está configurada para compilarse automáticamente en GitHub. Para generar una nueva versión:
1. Actualiza la versión en `package.json`.
2. Crea un tag de git: `git tag v1.1.0`.
3. Sube el tag: `git push origin v1.1.0`.
4. GitHub Actions generará los archivos `.exe` y `.deb` en la sección de **Releases**.

## 7) Seguridad
- **Context Isolation**: El frontend no tiene acceso directo al sistema de archivos ni a Node.js.
- **Protocolo Media**: Se utiliza un protocolo personalizado `media://` para servir videos locales de forma segura.
- **Sanitización**: Todas las entradas de URL se procesan mediante `spawn` para evitar inyecciones de comandos en la shell.

## 8) Créditos
Desarrollado como una herramienta eficiente y ligera para la gestión de contenido multimedia de YouTube.
