import EmbeddingService from './embeddingService.js'
import VectorStore from './vectorStore.js'
import LLMService from './llmService.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Enhanced ChatService with comprehensive error handling and response formatting
 */
class ChatService {
    constructor() {
        this.embeddingService = new EmbeddingService()
        this.vectorStore = new VectorStore()
        this.llmService = new LLMService()
        this.conversationHistory = new Map()
        this.maxContextTokens = 30000 // for 32k context window
        this.initialized = false
    }

    /**
     * Initialize all required services
     */
    async initialize() {
        if (this.initialized) return true

        try {
            await this.embeddingService.checkConnection()
            await this.vectorStore.initialize()
            await this.llmService.checkConnection()
            this.initialized = true
            return true
        } catch (error) {
            console.error('Failed to initialize chat service:', error)
            throw error
        }
    }

    /**
     * Main chat method with enhanced response formatting
     */
    async chat(userQuery, folderName, options = {}) {
        try {
            // Ensure services are initialized
            if (!this.initialized) {
                await this.initialize()
            }

            // Input validation
            if (!userQuery || userQuery.trim() === '') {
                return this.formatResponse('Please enter a question.', [], {
                    error: true,
                })
            }

            const startTime = Date.now()
            const conversationId = options.conversationId || uuidv4()

            // Generate embedding for the query
            const queryEmbedding =
                await this.embeddingService.embedQuery(userQuery)

            // Search for relevant chunks
            const searchResults = await this.vectorStore.search(
                queryEmbedding,
                folderName,
                options.maxResults || 10
            )

            // Filter by relevance (convert distance to similarity)
            const relevantChunks = searchResults.filter((result) => {
                const similarity = 1 - result.score / 1000 // Normalize score
                return similarity >= (options.relevanceThreshold || 0.5)
            })

            // Handle no results
            if (relevantChunks.length === 0) {
                return this.formatResponse(
                    `I couldn't find any relevant information about "${userQuery}" in the ${folderName} folder. Try asking a different question or check if the right folder is selected.`,
                    [],
                    { noResults: true }
                )
            }

            // Build context for LLM
            const context = this.buildContext(relevantChunks, folderName)

            // Get conversation history
            const history = this.getConversationHistory(folderName)

            console.log(`Talking to LLM with query: "${userQuery}"`)

            // Generate AI response
            const llmResponse = await this.llmService.generateResponse({
                query: userQuery,
                context: context,
                history: history,
                folderName: folderName,
            })

            // Update conversation history
            this.updateConversationHistory(folderName, userQuery, llmResponse)

            // Format and return response
            return this.formatResponse(llmResponse, relevantChunks, {
                conversationId: conversationId,
                processingTime: Date.now() - startTime,
                chunksSearched: searchResults.length,
                chunksUsed: relevantChunks.length,
            })
        } catch (error) {
            console.error('Chat error:', error)
            return this.handleError(error, userQuery, folderName)
        }
    }

    /**
     * Build context from search results
     */
    buildContext(chunks, folderName) {
        const uniqueNotes = new Map()

        // Group chunks by note
        chunks.forEach((chunk) => {
            if (!uniqueNotes.has(chunk.noteId)) {
                uniqueNotes.set(chunk.noteId, {
                    title: chunk.noteTitle,
                    chunks: [],
                })
            }
            uniqueNotes.get(chunk.noteId).chunks.push(chunk.text)
        })

        // Build context string
        let context = `Searching in folder: ${folderName}\n\n`

        for (const [noteId, noteInfo] of uniqueNotes) {
            context += `From note "${noteInfo.title}":\n`
            noteInfo.chunks.forEach((chunk, index) => {
                context += `[Excerpt ${index + 1}]: ${chunk}\n`
            })
            context += '\n'
        }

        return context
    }

    /**
     * Get conversation history for a folder
     */
    getConversationHistory(folderName) {
        const history = this.conversationHistory.get(folderName) || []
        // Return last 5 exchanges
        return history.slice(-10)
    }

    /**
     * Update conversation history
     */
    updateConversationHistory(folderName, query, response) {
        const history = this.conversationHistory.get(folderName) || []

        history.push(
            { role: 'user', content: query },
            { role: 'assistant', content: response }
        )

        // Keep only last 20 messages
        if (history.length > 20) {
            history.splice(0, history.length - 20)
        }

        this.conversationHistory.set(folderName, history)
    }

    /**
     * Format response with metadata
     */
    formatResponse(text, sources, metadata = {}) {
        const response = {
            response: text,
            sources: this.formatSources(sources),
            timestamp: new Date().toISOString(),
            ...metadata,
        }

        if (metadata.conversationId) {
            response.conversationId = metadata.conversationId
        }

        if (metadata.processingTime) {
            response.metadata = {
                processingTime: metadata.processingTime,
                chunksSearched: metadata.chunksSearched || 0,
                chunksUsed: metadata.chunksUsed || 0,
            }
        }

        return response
    }

    /**
     * Format sources for display
     */
    formatSources(chunks) {
        const uniqueSources = new Map()

        chunks.forEach((chunk) => {
            if (!uniqueSources.has(chunk.noteId)) {
                uniqueSources.set(chunk.noteId, {
                    noteTitle: chunk.noteTitle,
                    folder: chunk.folder,
                    relevanceScore: 1 - chunk.score / 1000,
                })
            }
        })

        return Array.from(uniqueSources.values())
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 5)
    }

    /**
     * Handle errors gracefully
     */
    handleError(error, query, folderName) {
        console.error('Chat service error:', error)

        let errorMessage =
            'I encountered an error while processing your question. '

        if (error.message.includes('Ollama')) {
            errorMessage +=
                'Please make sure Ollama is running and the model is installed.'
        } else if (error.message.includes('vector')) {
            errorMessage +=
                'There was an issue searching your notes. Please try syncing the folder again.'
        } else {
            errorMessage += 'Please try again or rephrase your question.'
        }

        return this.formatResponse(errorMessage, [], {
            error: true,
            errorType: error.name || 'UnknownError',
            errorMessage: error.message,
        })
    }

    /**
     * Clear conversation history for a folder
     */
    clearHistory(folderName) {
        if (folderName) {
            this.conversationHistory.delete(folderName)
        } else {
            this.conversationHistory.clear()
        }
    }

    /**
     * Get all conversation histories
     */
    getAllHistories() {
        const histories = {}
        for (const [folder, history] of this.conversationHistory) {
            histories[folder] = history
        }
        return histories
    }
}

export default ChatService
