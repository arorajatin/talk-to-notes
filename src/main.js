import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { runJxa } from 'run-jxa'
import { fileURLToPath } from 'url'
import EmbeddingService from './services/embeddingService.js'
import VectorStore from './services/vectorStore.js'
import ChatService from './services/chatService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow = null
let chatService = null

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset',
        show: false,
    })

    mainWindow.loadFile(path.join(__dirname, 'index.html'))

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show()
    })

    // Open DevTools in development
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools()
    }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// IPC handlers for folder operations
ipcMain.handle('get-folders', async () => {
    try {
        const folders = await runJxa(`
      const app = Application('Notes');
      const folders = app.folders();
      
      return folders.map(folder => {
        const notes = folder.notes();
        return {
          id: folder.id(),
          name: folder.name(),
          count: notes.length
        };
      });
    `)

        return { success: true, folders }
    } catch (error) {
        console.error('Error fetching folders:', error)
        return { success: false, error: error.message }
    }
})

function getCacheFilePath(folderName) {
    const safeFileName = folderName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const cacheFile = `./cache/notes_${safeFileName}.json`
    return cacheFile
}

ipcMain.handle('sync-folder', async (event, folderName) => {
    try {
        // Send progress updates to renderer
        const sendProgress = (message) => {
            event.sender.send('sync-progress', message)
        }

        sendProgress(`Starting sync of "${folderName}"...`)

        const notes = await runJxa(`
      const app = Application('Notes');
      const folder = app.folders.byName('${folderName}');
      const notes = folder.notes();
      const total = notes.length;
      
      const results = [];
      const batchSize = 10;

      console.log("Starting to sync the notes");
      
      for (let i = 0; i < total; i++) {
        try {
          const note = notes[i];
          results.push({
            id: note.id(),
            title: note.name(),
            body: note.body(),
            creationDate: note.creationDate().toISOString(),
            modificationDate: note.modificationDate().toISOString(),
            folder: '${folderName}'
          });
          
          // Send progress every 10 notes
          if ((i + 1) % batchSize === 0 || i === total - 1) {
            console.log('Progress: ' + (i + 1) + '/' + total);
          }
        } catch (e) {
          console.log('Error processing note ' + i + ': ' + e.toString());
        }
      }
      
      return results;
    `)

        sendProgress('Processing notes...')

        // Process the notes (extract plain text, format dates, etc.)
        const processedNotes = notes.map((note) => ({
            ...note,
            plainText: extractPlainText(note.body),
            creationDate: new Date(note.creationDate),
            modificationDate: new Date(note.modificationDate),
        }))

        // Save to cache
        const fs = await import('fs')
        await fs.promises.mkdir('./cache', { recursive: true })

        const cacheFile = getCacheFilePath(folderName)

        await fs.promises.writeFile(
            cacheFile,
            JSON.stringify(processedNotes, null, 2)
        )

        const embeddingService = new EmbeddingService()
        const vectorStore = new VectorStore()
        try {
            // init necessary services
            await embeddingService.checkConnection()
            await vectorStore.initialize()

            const folderExists = await vectorStore.folderExists(folderName)
            if (folderExists) {
                sendProgress('Cleaning up existing data...')
                await vectorStore.removeFolder(folderName)
            }

            // generate embeddings corresponding to the chunks
            const allChunks = await embeddingService.processNotes(
                processedNotes,
                (progress) => {
                    sendProgress(
                        `Generating embeddings: ${progress.percentage}%`
                    )
                }
            )

            sendProgress(`Adding ${allChunks.length} chunks to vector store...`)

            await vectorStore.addChunks(allChunks)
        } catch (err) {
            console.error(err)
            sendProgress(err.message)
            return {
                success: false,
            }
        }

        sendProgress('Sync completed!')

        return {
            success: true,
            count: processedNotes.length,
            cacheFile,
        }
    } catch (error) {
        console.error('Error syncing folder:', error)
        return { success: false, error: error.message }
    }
})

// Check if any notes have been cached
ipcMain.handle('has-cached-notes', async (event, folderName) => {
    try {
        const fs = await import('fs')
        const files = await fs.promises.readFile(getCacheFilePath(folderName))
        return files ? true : false
    } catch (error) {
        return false
    }
})

// Simple chat handler (will be enhanced with AI later)
ipcMain.handle('send-chat-message', async (event, message, folderName) => {
    try {
        // For now, return a simple response
        // TODO: Implement actual AI chat with vector search

        // Look for cached notes to provide context
        const fs = await import('fs')
        const cacheDir = './cache'

        try {
            // Initialize chat service if not already done
            if (!chatService) {
                chatService = new ChatService()
                await chatService.initialize()
            }
            
            const response = await chatService.chat(message, folderName)
            
            // If response is an object with response property, return just the text
            if (typeof response === 'object' && response.response) {
                return response.response
            }
            
            return response
        } catch (error) {
            console.error('Error reading cached notes:', error)
            return "I couldn't access the cached notes. Please sync some folders first!"
        }
    } catch (error) {
        console.error('Chat error:', error)
        return 'Sorry, I encountered an error while processing your message.'
    }
})

function extractPlainText(html) {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}
