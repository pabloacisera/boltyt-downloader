# CHANGELOG - Fixes de producción (.deb)

## Bug 1 — Permisos de ejecución no preservados en el .deb

**Causa raíz:** electron-builder no garantiza que los archivos en `extraResources` conserven el bit de ejecución (+x). El `chmod +x` en el CI se hace antes del build pero no se refleja en el instalador .deb resultante.

**Fix aplicado:** En `main.js`, al iniciar la app, se verifica y aplica `chmod 0o755` programáticamente a los binarios `yt-dlp` y `node` antes de invocar `spawn`.

**Verificación:**
- Ver logs de inicio: debe mostrar `[INIT] Aplicando chmod a binarios empaquetados...`
- Los binarios en `/opt/Bolt Downloader/resources/bin/` deben tener permisos 755

---

## Bug 2 — Evento 'error' no manejado en spawn de send-url

**Causa raíz:** El handler `ipcMain.on("send-url", ...)` usa `spawn` pero no escuchaba el evento `'error'`. Si el proceso no puede iniciarse (permiso denegado, binario no encontrado), el renderer nunca recibe respuesta y la UI queda colgada mostrando el modal.

**Fix aplicado:** Se agregó el handler `'error'` en el spawn de `send-url`:
```js
ytProcess.on('error', (err) => {
  event.reply("video-details-error", `Error al iniciar yt-dlp: ${err.message}`);
});
```

**Verificación:**
- Ingresar una URL con binarios sin permisos de ejecución
- Debe mostrar el modal de error con mensaje específico, no quedar colgado

---

## Bug 3 — --js-runtimes ausente en fetch de info del video

**Causa raíz:** El flag `--js-runtimes node:${nodePath}` se incluía en el spawn de descarga pero NO en el spawn de `--dump-json` (handler send-url). Esto causaba que la obtención de info de videos fallara en producción cuando YouTube requiere el runtime JS.

**Fix aplicado:** Se agregó `"--js-runtimes", `node:${nodePath}`` en el array `args` del handler `send-url`.

**Verificación:**
- Probar con videos de YouTube que requieren JS (videos con возрастное ограничение)
- Antes del fix: error o timeout al obtener info
- Después del fix: obtiene la metadata correctamente

---

## Bug 4 — preload.js no accesible desde app.asar

**Causa raíz:** En `createWindow()`, el preload se resolvia con `join(__dirname, 'preload.js')`. En producción con asar, `__dirname` apunta dentro del .asar, pero los preload scripts deben estar fuera del archivo empaquetado.

**Fix aplicado:**
1. En `package.json` build config: se agregó `"asarUnpack": ["preload.js"]`
2. En `main.js`: se cambió la resolución del preload a:
   ```js
   const preloadPath = app.isPackaged
       ? join(app.getAppPath(), 'preload.js')
       : join(__dirname, 'preload.js');
   ```

**Verificación:**
- Ver logs de inicio: debe mostrar `[INIT] preload path: /opt/Bolt Downloader/resources/app.asar.unpacked/preload.js`
- La app debe iniciar sin errores de preload

---

## Mejora adicional — Logging de inicio

**Causa raíz:** Necesidad de diagnóstico en producción.

**Fix aplicado:** Se agregó logging detallado al iniciar la app:
- Información de binarios (existencia, permisos)
- Rutas de recursos
- Estado de empaquetado

**Verificación:**
- Ver logs en consola durante inicio de la app empaquetada

---

## Mejora adicional — IPC debug-info

**Causa raíz:** Necesidad de diagnóstico en tiempo real desde el renderer.

**Fix aplicado:** Se agregó handler IPC `"debug-info"` que retorna:
- Versión de app
- Estado de empaquetado
- Plataforma
- Rutas de binarios
- Existencia y permisos de binarios

**Verificación:**
- Llamar `ipcRenderer.send('debug-info')` desde renderer
- Recibir respuesta con `ipcRenderer.on('debug-info-response', ...)`

---

## Nota sobre better-sqlite3

**Causa raíz:** Las dependencias nativas como `better-sqlite3` deben ser recompiladas para el target de Electron.

**Fix aplicado:**
1. Se agregó `"postinstall": "electron-builder install-app-deps"` en scripts
2. Se agregó step `npx electron-rebuild` en el CI
3. Se agregó `electron-rebuild` a devDependencies

**Verificación:**
- El build de Linux debe completar sin errores de native module
- La base de datos SQLite debe funcionar en producción
