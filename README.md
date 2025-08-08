<div align="center">
  <img src="assets/logo.png" alt="Talk to Notes Logo" width="120" height="120">
  
  # Talk to Notes - AI-Powered Apple Notes Chat
  
  > 🤖 A local AI chatbot that transforms your Apple Notes into an intelligent, searchable knowledge base
</div>

Talk to Notes is a privacy-first macOS application that syncs with Apple Notes and enables natural language conversations with your personal notes using local AI models. No cloud services required - everything runs on your machine.

## 🌟 Features

### ✅ Current Features
- **🏠 Local AI Processing** - Uses Ollama for completely offline AI chat
- **🔍 Hybrid Search** - Combines semantic vector search with statistical BM25 ranking for optimal results
- **📁 Smart Folder Management** - Browse, select, and sync specific Apple Notes folders
- **💾 Intelligent Caching** - Efficient storage using JSON + LanceDB vector database
- **💬 Folder-Specific Chat** - Separate conversations for each synced folder
- **📊 Progress Tracking** - Real-time sync progress with detailed feedback
- **🎨 Native macOS Design** - Clean, modern interface that feels at home on macOS
- **⚡ Fast Performance** - Optimized text processing without stemming for multilingual support
- **🔒 Complete Privacy** - All data stays on your machine

### 🔄 Sync Capabilities
- **📚 Full Note Content** - Extracts plain text from rich Apple Notes
- **🏷️ Metadata Preservation** - Maintains creation/modification dates and folder structure
- **⚡ Batch Processing** - Efficient handling of large note collections
- **🔄 Progress Indicators** - Visual feedback for embedding generation and indexing

### 🤖 AI Chat Features
- **🧠 Contextual Conversations** - Maintains chat history per folder
- **📖 Source Attribution** - Shows which notes informed each response
- **⚡ Fast Response Times** - Optimized retrieval and generation pipeline
- **🎯 Relevance Filtering** - Only shows responses when relevant content is found

## 📋 Upcoming Features

### 🚀 Near-term Improvements
- **🔄 Chat Reset Functionality** - Clear conversation history and start fresh
- **📝 Markdown Message Support** - Rich text rendering for better formatted responses  
- **🔍 Enhanced BM25 Matching** - Fine-tuned keyword search with proper noun preservation
- **⚡ Smart Re-sync Algorithm** - Differential sync that only updates changed notes
- **💾 Embedding Caching** - Persistent embedding storage to avoid regeneration
- **📊 Search Analytics** - Insights into search performance and query patterns

### 🔮 Future Enhancements
- **🌍 Multi-language Support** - Improved tokenization for non-English notes
- **📎 Attachment Handling** - Process images and PDFs within notes
- **🔗 Note Linking** - Detect and utilize relationships between notes
- **📈 Usage Statistics** - Track most accessed notes and common queries
- **🎨 Custom Themes** - Dark mode and personalization options
- **🔍 Advanced Filters** - Search by date ranges, tags, and content types
- **📤 Export Options** - Save conversations and search results

## 🚀 Quick Start

### Prerequisites
- **macOS** (for Apple Notes integration)
- **[Bun](https://bun.sh)** runtime
- **[Ollama](https://ollama.ai)** with embedding and chat models
- **Apple Notes** app with existing notes

### Installation

1. **Clone and install:**
   ```bash
   git clone https://github.com/yourusername/talk-to-notes.git
   cd talk-to-notes
   bun install
   ```

2. **Set up Ollama:**
   ```bash
   # Install Ollama models
   ollama pull nomic-embed-text    # For embeddings
   ollama pull gemma2:9b           # For chat (or your preferred model)
   ```

3. **Run the app:**
   ```bash
   # Development mode
   bun run dev
   
   # Production mode  
   bun run start
   ```

### Building for Distribution

```bash
# Build DMG for distribution
bun run build:dmg

# Build for specific architecture
bun run electron-builder --mac --x64    # Intel Macs
bun run electron-builder --mac --arm64  # Apple Silicon
```

## 🎯 How It Works

### Architecture Overview

```
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Apple Notes   │───▶│  JXA Bridge  │───▶│   Electron App  │
│   (via JXA)     │    │   (run-jxa)  │    │   (Frontend)    │
└─────────────────┘    └──────────────┘    └─────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Processing Pipeline                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Text Chunking │   Embedding     │        Indexing             │
│   (2500 chars)  │   Generation    │   (LanceDB + BM25)         │
│   + Overlap     │   (Ollama)      │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
                                                      │
                                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hybrid Search System                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│  Semantic Search │   BM25 Keyword   │    Result Fusion         │
│  (Vector Sim.)   │   Statistical    │   (RRF Algorithm)        │
│                  │   Ranking        │                          │
└──────────────────┴──────────────────┴───────────────────────────┘
                                                      │
                                                      ▼
┌─────────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Chat Context  │───▶│   LLM Gen.   │───▶│   Response UI   │
│   Building      │    │   (Ollama)   │    │   + Sources     │
└─────────────────┘    └──────────────┘    └─────────────────┘
```

### Search Strategy

The app uses a **hybrid search approach** that combines multiple retrieval methods:

1. **Semantic Search** - Vector similarity using Ollama embeddings
2. **BM25 Statistical Ranking** - Keyword-based relevance scoring  
3. **Exact Phrase Matching** - For quoted queries and specific terms
4. **Reciprocal Rank Fusion** - Intelligently combines results from all methods

## 📁 Project Structure

```
talk-to-notes/
├── src/
│   ├── main.js                 # Electron main process & IPC handlers
│   ├── preload.js             # Secure IPC bridge
│   ├── renderer.js            # Frontend application logic
│   ├── index.html             # Main UI layout
│   ├── styles.css            # macOS-style styling
│   └── services/
│       ├── embeddingService.js    # Ollama embedding generation
│       ├── vectorStore.js         # LanceDB vector operations
│       ├── chatService.js         # Chat orchestration
│       ├── llmService.js          # Ollama chat completion
│       ├── hybridSearchService.js # Multi-method search
│       ├── bm25Service.js         # Statistical text ranking
│       ├── bm25Index.js           # BM25 data structures
│       └── textProcessor.js       # Tokenization & preprocessing
├── build/
│   └── entitlements.mac.plist # macOS security entitlements
├── dist/                      # Built applications
├── cache/                     # Local user data (gitignored)
└── package.json              # Dependencies & build config
```

## 🔧 Configuration

### Ollama Models
The app works with various Ollama models:

**Embedding Models:**
- `nomic-embed-text` (recommended) - 137M params, good quality
- `all-minilm` - Lightweight alternative

**Chat Models:**
- `gemma2:9b` - Balanced performance/quality
- `llama3.1:8b` - Alternative option
- `qwen2:7b` - Good for code and technical content

### Performance Tuning
- **Chunk Size**: 2,500 characters (optimized for 32k context models)
- **Chunk Overlap**: 200 characters for context preservation
- **Search Results**: Top 10 chunks per query
- **Context Window**: 30,000 tokens for chat generation

## 🛠️ Development

### Contributing
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Style
- **JavaScript**: ES6+ modules with modern syntax
- **Services**: Async/await pattern with proper error handling
- **UI**: Vanilla JavaScript with event-driven architecture
- **Styling**: CSS custom properties with macOS design principles

### Testing
```bash
# Run development server
bun run dev

# Test specific features
# TODO: Add comprehensive test suite
```

## 🤔 FAQ

### Why local AI instead of cloud APIs?
- **Privacy**: Your notes never leave your machine
- **Cost**: No per-query charges or API limits
- **Speed**: No network latency for responses
- **Reliability**: Works offline and doesn't depend on external services

### How accurate are the search results?
The hybrid search system combines semantic understanding with keyword matching, providing highly relevant results for both conceptual queries and specific term searches.

### Can I use different AI models?
Yes! The app works with any Ollama-compatible models. Just pull your preferred model and update the configuration in the services.

### What about Apple Notes formatting?
Currently, rich formatting is converted to plain text for processing. Markdown support for responses is planned for a future release.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Ollama](https://ollama.ai)** for local AI model serving
- **[LanceDB](https://lancedb.com)** for vector storage
- **[Electron](https://electronjs.org)** for cross-platform desktop development
- **[run-jxa](https://github.com/sindresorhus/run-jxa)** for Apple Notes integration

---

<div align="center">
  <strong>Built with ❤️ for privacy-conscious note-takers</strong>
</div>