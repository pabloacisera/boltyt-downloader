# Manual Técnico: Youtube Download App V2 (Electron)

Este documento describe la arquitectura avanzada y los procesos internos de la versión V2 de la aplicación.

## 1. Arquitectura de Sistemas
La aplicación emplea una arquitectura desacoplada basada en procesos de Electron con una capa de persistencia SQL.

### 1.1 Procesos
- **Main Process (`main.js`)**: Gestiona el ciclo de vida, los protocolos personalizados (`media://`), y la ejecución de subprocesos (`yt-dlp`).
- **Preload Script (`preload.js`)**: Expone una API segura al renderer, limitando el acceso a Node.js por motivos de seguridad.
- **Renderer Process**: Interfaz de usuario reactiva que consume la API expuesta por el preload.

### 1.2 Protocolos Personalizados
- **`media://`**: Implementado para cargar archivos multimedia locales en el elemento `<video>`. Esto evita las restricciones de seguridad (CSP) que bloquean `file://`, permitiendo streaming de video fluido desde cualquier ruta del disco.

## 2. Capa de Datos (SQLite)
La persistencia se gestiona con `better-sqlite3`.

### 2.1 Esquema de Base de Datos
- **`downloads`**:
  - `id`: INTEGER PRIMARY KEY.
  - `url`: TEXT UNIQUE.
  - `file_path`: TEXT (Ruta absoluta al archivo final).
  - `last_position`: INTEGER (Segundos de reproducción guardados).
  - `is_active`: INTEGER (Borrado lógico).
- **`settings`**:
  - `key`: TEXT UNIQUE (Identificador de ajuste).
  - `value`: TEXT (Valor del ajuste).

### 2.2 Repositorios
- **`DownloadRepository`**: CRUD de videos y actualización de posición de reproducción.
- **`SettingsRepository`**: Gestión de preferencias (Navegador, Carpeta de descarga predeterminada).

## 3. Flujo de Descarga Optimizado (T4500)
Para CPUs de bajo rendimiento, se han implementado flags específicos de `yt-dlp`:
- `--concurrent-fragments 3`: Balance entre velocidad y uso de CPU.
- `--buffer-size 16K`: Optimización de memoria RAM.
- `--no-part`: Escritura directa para evitar procesos de post-descarga innecesarios (renombrado).

### 3.1 Tracking de Progreso
El sistema de progreso utiliza `--newline` y `--progress-template` para recibir actualizaciones limpias por `stdout`, que son procesadas mediante expresiones regulares para actualizar la UI en tiempo real.

## 4. Sistema de Autenticación (Cookie Bridge)
El acceso a contenido restringido se logra mediante:
- `yt-dlp --cookies-from-browser [browser]`.
- Validación periódica usando `--get-id` para verificar la vigencia de la sesión en el navegador configurado.

## 5. Reproductor y Persistencia
- **Modal de Video**: Inyectado dinámicamente en el DOM con soporte para controles de hardware.
- **Persistencia**: Se emite un evento `update-position` cada 5 segundos y al cerrar el reproductor para guardar el estado en la DB.
- **Verificación**: Antes de reproducir, `check-video-file` valida si el archivo sigue en la ruta guardada; si no, realiza una búsqueda por título en la última carpeta conocida.

## 6. Pipeline de Despliegue (CI/CD)
Ubicación: `.github/workflows/build.yml`
- **Plataformas**: Genera builds en paralelo para Windows y Linux.
- **Herramienta**: `electron-builder` empaqueta la aplicación con sus iconos nativos (`icons/`).
- **Disparador**: Creación de tags de versión (`v*`).

## 7. Mantenimiento y Resolución de Errores
- **Binarios**: Actualizar periódicamente `bin/yt-dlp` para compatibilidad con YouTube.
- **Migraciones**: El archivo `database/Connection.js` contiene lógica de migración para añadir columnas faltantes en bases de datos antiguas sin perder datos del usuario.
