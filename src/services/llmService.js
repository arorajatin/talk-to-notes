import fetch from 'node-fetch'

/**
 * Enhanced LLMService with better prompt engineering and error handling
 */
class LLMService {
    constructor() {
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434'
        this.chatModel = process.env.CHAT_MODEL || 'gpt-oss:20b'
        this.maxTokens = 2048
        this.temperature = 0.7
    }

    /**
     * Check if Ollama is running and model is available
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/tags`)
            if (!response.ok) {
                throw new Error('Ollama is not running')
            }

            const data = await response.json()
            const models = data.models || []
            const hasModel = models.some(
                (model) =>
                    model.name === this.chatModel ||
                    model.name.startsWith(this.chatModel.split(':')[0])
            )

            if (!hasModel) {
                throw new Error(
                    `Chat model ${this.chatModel} not found. Please run: ollama pull ${this.chatModel}`
                )
            }

            return true
        } catch (error) {
            console.error('Ollama connection error:', error.message)
            throw error
        }
    }

    /**
     * Generate response with enhanced context handling
     */
    async generateResponse({ query, context, history, folderName }) {
        try {
            const messages = this.buildMessages(
                query,
                context,
                history,
                folderName
            )

            const response = await fetch(`${this.ollamaUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: this.chatModel,
                    messages: messages,
                    options: {
                        temperature: this.temperature,
                        num_predict: this.maxTokens,
                        top_k: 40,
                        top_p: 0.9,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error(`LLM request failed: ${response.status}`)
            }

            // Read streaming response
            const text = await response.text()
            const lines = text.trim().split('\n')
            let fullResponse = ''

            for (const line of lines) {
                try {
                    const json = JSON.parse(line)
                    if (json.message && json.message.content) {
                        fullResponse += json.message.content
                    }
                } catch (e) {
                    // Skip invalid JSON lines
                }
            }

            return (
                fullResponse ||
                'I apologize, but I was unable to generate a response. Please try again.'
            )
        } catch (error) {
            console.error('LLM generation error:', error)
            throw error
        }
    }

    /**
     * Build messages array with system prompt and context
     */
    buildMessages(query, context, history, folderName) {
        const messages = []

        // System prompt
        messages.push({
            role: 'system',
            content: this.getSystemPrompt(folderName),
        })

        // Add conversation history if available
        if (history && history.length > 0) {
            messages.push(...history)
        }

        // Add context and current query
        messages.push({
            role: 'user',
            content: this.formatUserMessage(query, context),
        })

        return messages
    }

    /**
     * Get system prompt with folder context
     */
    getSystemPrompt(folderName) {
        return `You are a helpful assistant that answers questions based on the user's Apple Notes from the "${folderName}" folder.

Key instructions:
1. Only use information from the provided note excerpts
2. Be accurate and cite which notes you're referencing when possible
3. If you cannot find relevant information, say so clearly
4. Keep responses concise but informative
5. Use a friendly, conversational tone
6. Never make up or invent information not present in the notes

Remember: You're searching through personal notes, so be respectful of privacy and focus only on answering the specific question asked.`
    }

    /**
     * Format user message with context
     */
    formatUserMessage(query, context) {
        return `Here is the relevant context from your notes:

${context}

Question: ${query}

Please provide a helpful answer based on the note excerpts above. If the information isn't available in the provided context, let me know.`
    }

    /**
     * Generate a simple response without LLM (fallback)
     */
    generateFallbackResponse(query, context) {
        const lines = context.split('\n')
        const noteReferences = []

        for (const line of lines) {
            if (line.startsWith('From note "')) {
                const match = line.match(/From note "([^"]+)"/)
                if (match) {
                    noteReferences.push(match[1])
                }
            }
        }

        if (noteReferences.length > 0) {
            return `I found relevant information in these notes: ${noteReferences.join(', ')}. The notes contain information that might answer your question about "${query}".`
        }

        return `I found some potentially relevant information about "${query}" in your notes, but I'm unable to provide a detailed response at the moment.`
    }
}

export default LLMService
