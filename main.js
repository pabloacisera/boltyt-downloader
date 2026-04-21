import { app, BrowserWindow, ipcMain, dialog, protocol, net } from "electron";
import { spawn } from "child_process";
import { fileURLToPath, pathToFileURL } from "url";
import { join, dirname } from "path";
import fs from 'fs';
import { downloadRepository } from "./repositories/DownloadRepository.js";
import { settingsRepository } from "./repositories/SettingsRepository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Registrar el protocolo media:// para cargar archivos locales de forma segura
protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { bypassCSP: true, stream: true } }
]);

const isWindows = process.platform === "win32";

const ytDlpPath = join(__dirname, 'bin', isWindows ? 'yt-dlp.exe' : 'yt-dlp');
const nodePath = join(__dirname, 'bin', isWindows ? 'node.exe' : 'node');

let downloadsPath = null;

async function checkYoutubeSession() {
    const browser = settingsRepository.get("browser_name");
    if (!browser) return { active: false, browser: null };

    return new Promise((resolve) => {
        const timeout = setTimeout(() => {
            process.kill();
            resolve({ active: false, browser });
        }, 30000); // 30 segundos para dar margen al procesador

        const process = spawn(ytDlpPath, [
            "--js-runtimes", `node:${nodePath}`,
            "--cookies-from-browser", browser,
            "--no-check-certificate",
            "--get-id",
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        ]);

        process.on('close', (code) => {
            clearTimeout(timeout);
            resolve({ active: code === 0, browser });
        });

        process.on('error', () => {
            clearTimeout(timeout);
            resolve({ active: false, browser });
        });
    });
}

if (!fs.existsSync(ytDlpPath)) {
    dialog.showErrorBox('Error', `No se encuentra yt-dlp en: ${ytDlpPath}`);
    app.quit();
}

function createWindow() {
    const window = new BrowserWindow({
        width: 850,
        height: 600,
        webPreferences: {
            preload: join(__dirname, 'preload.js'), 
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    window.loadFile("index.html");
}

app.whenReady().then(() => {
    // Manejar el protocolo media://
    protocol.handle('media', (request) => {
        const filePath = decodeURIComponent(request.url.replace('media://', ''));
        return net.fetch(pathToFileURL(filePath).toString());
    });

    createWindow();
});

// IPC Handlers
ipcMain.on("set-setting", (event, { key, value }) => {
    try {
        settingsRepository.set(key, value);
    } catch (error) {
        console.error("Error saving setting:", error);
    }
});

ipcMain.on("get-setting", (event, key) => {
    const value = settingsRepository.get(key);
    event.reply("setting-get-response", { key, value });
});

ipcMain.on("set-browser", (event, browser) => {
    try {
        settingsRepository.set("browser_name", browser);
        event.reply("browser-set-response", { success: true, browser });
    } catch (error) {
        event.reply("browser-set-response", { success: false, error: error.message });
    }
});

ipcMain.on("get-browser", (event) => {
    const browser = settingsRepository.get("browser_name");
    event.reply("browser-get-response", browser);
});

ipcMain.on("check-session", async (event) => {
    const status = await checkYoutubeSession();
    event.reply("session-status-response", status);
});

ipcMain.on("update-position", (event, { id, seconds }) => {
    try {
        downloadRepository.updatePosition(id, seconds);
    } catch (error) {
        console.error("Error al actualizar posición:", error);
    }
});

ipcMain.on("check-video-file", (event, id) => {
    try {
        const video = downloadRepository.findById(id);
        if (!video) {
            event.reply("check-video-file-response", { exists: false, id });
            return;
        }

        let fullPath = video.file_path;

        // Caso 1: El path guardado es el archivo directo y existe
        if (fs.existsSync(fullPath) && !fs.lstatSync(fullPath).isDirectory()) {
            event.reply("check-video-file-response", { 
                exists: true, 
                id, 
                fullPath, 
                lastPosition: video.last_position 
            });
            return;
        }

        // Caso 2: El path guardado es un directorio (viejos registros) o el archivo se movió
        // Intentamos buscarlo en el directorio guardado por el título
        const directory = fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory() 
                          ? fullPath 
                          : dirname(fullPath);

        if (fs.existsSync(directory)) {
            const files = fs.readdirSync(directory);
            const sanitizedTitle = video.title.replace(/[\\/:*?"<>|]/g, "_");
            const matchingFile = files.find(f => f.includes(sanitizedTitle));

            if (matchingFile) {
                const newFullPath = join(directory, matchingFile);
                event.reply("check-video-file-response", { 
                    exists: true, 
                    id, 
                    fullPath: newFullPath, 
                    lastPosition: video.last_position 
                });
                return;
            }
        }
        
        event.reply("check-video-file-response", { exists: false, id, title: video.title });
    } catch (error) {
        event.reply("check-video-file-response", { exists: false, id, error: error.message });
    }
});

ipcMain.on("send-url", async (event, url) => {
    console.log("URL recibida:", url);

    const browser = settingsRepository.get("browser_name");
    const args = ["--dump-json", "--skip-download", url];
    if (browser) {
        args.unshift("--cookies-from-browser", browser);
    }

    const ytProcess = spawn(ytDlpPath, args);
    let stdout = "";
    let stderr = "";

    ytProcess.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    ytProcess.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    ytProcess.on('close', (code) => {
        if (code === 0) {
            try {
                const info = JSON.parse(stdout);
                const details = {
                    title: info.title,
                    channel: info.uploader,
                    duration: info.duration,
                    description: info.description ? info.description.substring(0, 300) : "Sin descripción.",
                    thumbnail: info.thumbnail,
                    views: info.view_count,
                    url: info.webpage_url
                };
                event.reply("video-details-response", details);
            } catch (err) {
                event.reply("video-details-error", "Error al parsear información del video.");
            }
        } else {
            let userFriendlyError = "Error al obtener información del video.";
            if (stderr.includes("Members-only content")) {
                userFriendlyError = "Acceso denegado: Se requiere membresía del canal.";
            } else if (stderr.includes("Sign in to confirm your age")) {
                userFriendlyError = "Inicia sesión en tu navegador para verificar tu edad.";
            } else if (stderr.includes("Video unavailable") || stderr.includes("This video is private")) {
                userFriendlyError = "El video ha sido eliminado o es privado.";
            }
            event.reply("video-details-error", userFriendlyError);
        }
    });
});

ipcMain.on("select-directory", async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Selecciona la carpeta de descargas predeterminada'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
        event.reply("directory-selected", result.filePaths[0]);
    }
});

ipcMain.on("download-video", async (event, videoUrl) => {
    // 1. Intentar obtener la carpeta fija de la base de datos
    let targetPath = settingsRepository.get("downloads_path");
    
    // 2. Si no hay carpeta fija, pedirla manualmente (comportamiento actual)
    if (!targetPath) {
        if (!downloadsPath) { // Si no se ha seleccionado una en esta sesión
            const result = await dialog.showOpenDialog({
                properties: ['openDirectory', 'createDirectory'],
                title: 'Selecciona la carpeta para guardar los videos'
            });
            
            if (result.canceled || result.filePaths.length === 0) {
                event.reply("download-error", "No se seleccionó ninguna carpeta");
                return;
            }
            downloadsPath = result.filePaths[0];
        }
        targetPath = downloadsPath;
    }
    
    console.log("Descargando en:", targetPath);
    event.reply("download-folder-selected", targetPath);

    const browser = settingsRepository.get("browser_name");
    const args = [
        "--js-runtimes", `node:${nodePath}`,
        "--newline",
        "--progress",
        "--progress-template", "[download] %(progress._percent_str)s",
        "--concurrent-fragments", "3",
        "--buffer-size", "16K",
        "--no-part",
        "-f", "b",
        "-P", targetPath,
        videoUrl
    ];
    if (browser) {
        args.unshift("--cookies-from-browser", browser);
    }
    
    const ytProcess = spawn(ytDlpPath, args);
    let stderr = "";
    
    let lastDownloadedFile = null;
    
    ytProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log("yt-dlp:", output.trim());
        
        // Detectar el archivo de destino final
        const destMatch = output.match(/\[download\] Destination: (.*)/);
        if (destMatch) {
            lastDownloadedFile = destMatch[1].trim();
        }

        // Detectar si se movió/corrigió el archivo final (Fixup/Merger)
        const moveMatch = output.match(/\[.*\] Merging formats into "(.*)"/i) || 
                          output.match(/\[.*\] Correcting container in "(.*)"/i) ||
                          output.match(/\[.*\] Fixing MPEG-TS in MP4 container of "(.*)"/i);
        if (moveMatch) {
            lastDownloadedFile = moveMatch[1].trim();
        }
        
        // Detectar progreso numérico
        const match = output.match(/\[download\]\s+([\d.]+)%/);
        if (match) {
            const progress = parseFloat(match[1]);
            event.reply("download-progress", { percent: progress, status: 'downloading' });
        }

        // Detectar fases de consolidación
        if (output.includes('[FixupM3u8]') || output.includes('[Merger]') || output.includes('[VideoConvertor]')) {
            event.reply("download-progress", { percent: 100, status: 'processing' });
        }
    });

    ytProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        stderr += msg;
        console.log("yt-dlp stderr:", msg.trim());
    });
    
    ytProcess.on('close', (code) => {
        if (code === 0) {
            event.reply("download-complete", { 
                message: `Video guardado`, 
                fullPath: lastDownloadedFile 
            });
        } else {
            let userFriendlyError = `El proceso terminó con código ${code}`;
            if (stderr.includes("Members-only content")) {
                userFriendlyError = "Acceso denegado: Se requiere membresía del canal.";
            } else if (stderr.includes("Sign in to confirm your age")) {
                userFriendlyError = "Inicia sesión en tu navegador para verificar tu edad.";
            } else if (stderr.includes("Video unavailable") || stderr.includes("This video is private")) {
                userFriendlyError = "El video ha sido eliminado o es privado.";
            }
            event.reply("download-error", userFriendlyError);
        }
    });
    
    ytProcess.on('error', (err) => {
        event.reply("download-error", err.message);
    });
});

ipcMain.on("save-video-data", (event, videoData) => {
    let videoDetails = {
        "title": videoData.title,
        "channel": videoData.channel,
        "url": videoData.url,
        "duration": videoData.duration,
        "views": videoData.views,
        "description": videoData.description,
        "thumbnail": videoData.thumbnail,
        "file_path": videoData.file_path || downloadsPath || "directorio no encontrado"
    }

    try {
        downloadRepository.saveVideo(videoDetails);
        event.reply("save-success");
    } catch (error) {
        console.error(error);
        event.reply("save-error", error.message);
    }
});

ipcMain.on("get-all-data", (event, options) => {
    let { page, limit } = options || { page: 1, limit: 10 };
    try {
        const result = downloadRepository.findAll(page, limit);
        event.reply("all-data-response", result);
    } catch (error) {
        console.error("error: ", error);
        event.reply("all-data-error", error.message);
    }
});

ipcMain.on("reset-downloads", (event) => {
    try {
        downloadRepository.resetDatabase();
        event.reply("reset-success");
    } catch (error) {
        console.error(error);
        event.reply("save-error", error.message);
    }
});

ipcMain.on("delete-video", async (event, id) => {
    try {
        const video = downloadRepository.findById(id);
        if (!video) {
            event.reply("delete-error", "Video no encontrado en la base de datos.");
            return;
        }

        downloadRepository.deleteVideo(id);

        const directory = video.file_path;
        if (fs.existsSync(directory)) {
            const files = fs.readdirSync(directory);
            const sanitizedTitle = video.title.replace(/[\\/:*?"<>|]/g, "_");
            const matchingFile = files.find(f => f.includes(sanitizedTitle));
            
            if (matchingFile) {
                const fullPath = join(directory, matchingFile);
                fs.unlinkSync(fullPath);
                event.reply("delete-success", `Video eliminado: ${video.title}`);
            } else {
                event.reply("delete-warning", "Registro eliminado, pero no se encontró el archivo local.");
            }
        } else {
            event.reply("delete-warning", "Registro eliminado, pero el directorio de descarga no existe.");
        }
    } catch (error) {
        console.error(error);
        event.reply("delete-error", "Error al eliminar: " + error.message);
    }
});
