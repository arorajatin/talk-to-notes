const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    getFolders: () => ipcRenderer.invoke('get-folders'),
    syncFolder: (folderName) => ipcRenderer.invoke('sync-folder', folderName),
    sendChatMessage: (message, folderId) =>
        ipcRenderer.invoke('send-chat-message', message, folderId),
    hasCachedNotes: (folderName) =>
        ipcRenderer.invoke('has-cached-notes', folderName),
    onSyncProgress: (callback) => {
        ipcRenderer.on('sync-progress', (event, message) => callback(message))
    },
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel)
    },
})
