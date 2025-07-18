import fetch from 'node-fetch'

/**
 * Service for generating embeddings using Ollama
 */
class EmbeddingService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
        this.embeddingModel =
            process.env.EMBEDDING_MODEL || 'nomic-embed-text:latest'
        this.chunkSize = 2500 // characters
        this.chunkOverlap = 250 // characters
    }

    /**
     * Check if Ollama is running and the embedding model is available
     */
    async checkConnection() {
        try {
            // Check if Ollama is running
            const response = await fetch(`${this.ollamaUrl}/api/tags`)
            if (!response.ok) {
                throw new Error('Ollama is not running')
            }

            // Check if embedding model is available
            const data = await response.json()
            const models = data.models || []
            const hasEmbeddingModel = models.some(
                (model) => model.name === this.embeddingModel
            )

            if (!hasEmbeddingModel) {
                throw new Error(
                    `Embedding model ${this.embeddingModel} not found. Please run: ollama pull ${this.embeddingModel}`
                )
            }
        } catch (error) {
            throw error
        }
    }

    /**
     * Split text into overlapping chunks
     */
    chunkText(text, chunkSize = this.chunkSize, overlap = this.chunkOverlap) {
        const chunks = []
        let start = 0

        while (start < text.length) {
            const end = Math.min(start + chunkSize, text.length)
            chunks.push({
                text: text.slice(start, end),
                start,
                end,
            })

            // Move start position forward, accounting for overlap
            start += chunkSize - overlap

            // If we're near the end, break to avoid tiny chunks
            if (text.length - start < overlap) {
                break
            }
        }

        return chunks
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text) {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.embeddingModel,
                    prompt: text,
                }),
            })

            if (!response.ok) {
                throw new Error(
                    `Embedding generation failed: ${response.status}`
                )
            }

            const data = await response.json()
            return data.embedding
        } catch (error) {
            console.error('Error generating embedding:', error)
            throw error
        }
    }

    /**
     * Generate embeddings for multiple texts in batch
     */
    async generateBatchEmbeddings(texts, onProgress) {
        const embeddings = []
        const total = texts.length

        for (let i = 0; i < total; i++) {
            try {
                const embedding = await this.generateEmbedding(texts[i])
                embeddings.push(embedding)

                // Report progress
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        percentage: Math.round(((i + 1) / total) * 100),
                    })
                }

                // Small delay to avoid overwhelming Ollama
                if (i < total - 1) {
                    await new Promise((resolve) => setTimeout(resolve, 50))
                }
            } catch (error) {
                console.error(`Error embedding text ${i}:`, error)
                // Return null for failed embeddings
                embeddings.push(null)
            }
        }

        return embeddings
    }

    /**
     * Process a note and generate embeddings for its chunks
     */
    async processNote(note) {
        // Combine title and body for more context
        const fullText = `${note.title}\n\n${note.plainText || note.body}`

        // Split into chunks
        const chunks = this.chunkText(fullText)

        // Generate embeddings for each chunk
        const chunkTexts = chunks.map((chunk) => chunk.text)
        const embeddings = await this.generateBatchEmbeddings(chunkTexts)

        // Return chunks with their embeddings
        return chunks.map((chunk, index) => ({
            noteId: note.id,
            noteTitle: note.title,
            text: chunk.text,
            embedding: embeddings[index],
            chunkIndex: index,
            totalChunks: chunks.length,
            metadata: {
                folder: note.folder,
                creationDate: note.creationDate,
                modificationDate: note.modificationDate,
            },
        }))
    }

    /**
     * Process multiple notes and generate embeddings
     */
    async processNotes(notes, onProgress) {
        const allChunks = []
        const total = notes.length

        for (let i = 0; i < total; i++) {
            const note = notes[i]

            try {
                // Process note and get chunks with embeddings
                const noteChunks = await this.processNote(note)
                allChunks.push(...noteChunks)

                // Report progress
                if (onProgress) {
                    onProgress({
                        current: i + 1,
                        total,
                        message: `Processing note: ${note.title}`,
                        percentage: Math.round(((i + 1) / total) * 100),
                    })
                }
            } catch (error) {
                console.error(`Error processing note ${note.id}:`, error)
            }
        }

        return allChunks
    }

    /**
     * Generate embedding for a search query
     */
    async embedQuery(query) {
        // Add a prefix to improve search quality
        const enhancedQuery = `search query: ${query}`
        return this.generateEmbedding(enhancedQuery)
    }
}

export default EmbeddingService
