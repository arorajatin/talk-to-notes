import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { runJxa } from 'run-jxa'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hiddenInset',
    show: false
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
    const processedNotes = notes.map(note => ({
      ...note,
      plainText: extractPlainText(note.body),
      creationDate: new Date(note.creationDate),
      modificationDate: new Date(note.modificationDate)
    }))
    
    // Save to cache
    const fs = await import('fs')
    await fs.promises.mkdir('./cache', { recursive: true })
    
    const safeFileName = folderName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const cacheFile = `./cache/notes_${safeFileName}.json`
    
    await fs.promises.writeFile(cacheFile, JSON.stringify(processedNotes, null, 2))
    
    sendProgress('Sync completed!')
    
    return { 
      success: true, 
      count: processedNotes.length,
      cacheFile 
    }
  } catch (error) {
    console.error('Error syncing folder:', error)
    return { success: false, error: error.message }
  }
})

// Simple chat handler (will be enhanced with AI later)
ipcMain.handle('send-chat-message', async (event, message) => {
  try {
    // For now, return a simple response
    // TODO: Implement actual AI chat with vector search
    
    // Look for cached notes to provide context
    const fs = await import('fs')
    const cacheDir = './cache'
    
    try {
      const files = await fs.promises.readdir(cacheDir)
      const noteFiles = files.filter(file => file.startsWith('notes_') && file.endsWith('.json'))
      
      if (noteFiles.length === 0) {
        return "I don't have any notes to search through yet. Please sync some folders first!"
      }
      
      // Simple keyword search for now
      const searchTerm = message.toLowerCase()
      let foundNotes = []
      
      for (const file of noteFiles) {
        const filePath = path.join(cacheDir, file)
        const data = await fs.promises.readFile(filePath, 'utf-8')
        const notes = JSON.parse(data)
        
        const matches = notes.filter(note => 
          note.title.toLowerCase().includes(searchTerm) || 
          note.plainText.toLowerCase().includes(searchTerm)
        )
        
        foundNotes.push(...matches)
      }
      
      if (foundNotes.length === 0) {
        return `I couldn't find any notes containing "${message}". Try asking about different topics or sync more folders.`
      }
      
      // Return summary of found notes
      const notesSummary = foundNotes.slice(0, 3).map(note => 
        `"${note.title}" - ${note.plainText.substring(0, 100)}...`
      ).join('\n\n')
      
      return `I found ${foundNotes.length} notes related to "${message}":\n\n${notesSummary}`
      
    } catch (error) {
      return "I couldn't access the cached notes. Please sync some folders first!"
    }
    
  } catch (error) {
    console.error('Chat error:', error)
    return "Sorry, I encountered an error while processing your message."
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