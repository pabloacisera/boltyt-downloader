const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
    // arrow functions(anonymous functions)
    // send
    sendUrl: (url) => ipcRenderer.send("send-url", url),
    downloadVideo: (url) => ipcRenderer.send("download-video", url),
    saveVideoData: (data) => ipcRenderer.send("save-video-data", data),
    getAllData: (options) => ipcRenderer.send("get-all-data", options),
    resetDownloads: () => ipcRenderer.send("reset-downloads"),
    deleteVideo: (id) => ipcRenderer.send("delete-video", id),
    updatePosition: (id, seconds) => ipcRenderer.send("update-position", { id, seconds }),
    checkVideoFile: (id) => ipcRenderer.send("check-video-file", id),
    selectDirectory: () => ipcRenderer.send("select-directory"),

    // session management
    setBrowser: (browser) => ipcRenderer.send("set-browser", browser),
    getBrowser: () => ipcRenderer.send("get-browser"),
    checkSession: () => ipcRenderer.send("check-session"),
    setSetting: (key, value) => ipcRenderer.send("set-setting", { key, value }),
    getSetting: (key) => ipcRenderer.send("get-setting", key),

    // listeners
    onBrowserSet: (callback) => ipcRenderer.on("browser-set-response", (event, data) => callback(data)),
    onBrowserGet: (callback) => ipcRenderer.on("browser-get-response", (event, data) => callback(data)),
    onSessionStatus: (callback) => ipcRenderer.on("session-status-response", (event, data) => callback(data)),
    onDirectorySelected: (callback) => ipcRenderer.on("directory-selected", (event, data) => callback(data)),
    onSettingGet: (callback) => ipcRenderer.on("setting-get-response", (event, data) => callback(data)),
    onVideoDetails: (callback) => ipcRenderer.on("video-details-response", (event, data) => callback(data)),
    onVideoError: (callback) => ipcRenderer.on("video-details-error", (event, error)=>callback(error)),
    onDownloadComplete: (callback) => ipcRenderer.on("download-complete", (event, message)=> callback(message)),
    onDownloadProgress: (callback) => ipcRenderer.on("download-progress", (event, progress) => callback(progress)),
    onDownloadError: (callback) => ipcRenderer.on('download-error', (event, error) => callback(error)),
    onDownloadFolderSelected: (callback) => ipcRenderer.on('download-folder-selected', (event, folder) => callback(folder)),
    onSaveSuccess: (callback) => ipcRenderer.on('save-success', (event, result) => callback(result)),
    onSaveError: (callback) => ipcRenderer.on('save-error', (event, error) => callback(error)),
    onAllData: (callback) => ipcRenderer.on("all-data-response", (event, data) => callback(data)),
    onCheckVideoFile: (callback) => ipcRenderer.on("check-video-file-response", (event, data) => callback(data)),
    onResetSuccess: (callback) => ipcRenderer.on("reset-success", () => callback()),
    onDeleteSuccess: (callback) => ipcRenderer.on("delete-success", (event, message) => callback(message)),
    onDeleteError: (callback) => ipcRenderer.on("delete-error", (event, error) => callback(error)),
    onDeleteWarning: (callback) => ipcRenderer.on("delete-warning", (event, message) => callback(message)),
});