# Talk to Notes - AI Chatbot for Apple Notes

A local AI chatbot that syncs Apple Notes and provides intelligent search and chat capabilities.

## Features

- 📁 Browse all Apple Notes folders
- 📊 See note counts for each folder
- ⚠️ Visual indicators for large folders
- 🔄 One-click folder sync
- 💾 Automatic caching of synced notes
- 💬 Chat interface with keyword search
- 🎨 Clean, modern macOS-style interface

## Setup

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Development mode:**
   ```bash
   bun run dev
   ```

3. **Production build:**
   ```bash
   bun run start
   ```

## Usage

1. **Launch the app** - The interface will automatically load your Apple Notes folders
2. **Select a folder** - Click on any folder to select it
3. **Sync notes** - Click the "Sync" button to download and cache the notes
4. **View progress** - A modal will show sync progress
5. **Start chatting** - Click "Start Chatting" after sync completes
6. **Ask questions** - Type questions about your notes to get relevant answers

## Folder Indicators

- ✅ **Green checkmark** - Small folder (<50 notes)
- ⚡ **Lightning bolt** - Medium folder (50-100 notes)  
- ⚠️ **Warning sign** - Large folder (>100 notes, may take time to sync)

## File Structure

```
src/
├── main.js         # Electron main process
├── preload.js      # Preload script for IPC
├── renderer.js     # Frontend JavaScript
├── index.html      # Main window HTML
└── styles.css      # Styling
```

## Integration

The app automatically saves synced notes to JSON files that can be consumed by:
- Vector databases (LanceDB, ChromaDB)
- LLM applications
- Search indexing systems
- Other note processing tools

## Requirements

- macOS (for Apple Notes access)
- Bun runtime
- Apple Notes app installed and configured

## Development

To extend the app:

1. **Backend logic** - Edit `src/main.js` for new IPC handlers
2. **Frontend** - Edit `src/renderer.js` and `src/index.html`
3. **Styling** - Modify `src/styles.css`

## Troubleshooting

- **"No folders found"** - Make sure Apple Notes is installed and has folders
- **Sync errors** - Check that Notes app has proper permissions
- **Performance** - Large folders (>100 notes) may take several minutes to sync