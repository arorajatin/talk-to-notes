import * as lancedb from '@lancedb/lancedb'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Vector store service using LanceDB for semantic search
 */
class VectorStore {
    constructor() {
        this.dbPath = path.join(__dirname, '../../db/vectors.lance')
        this.db = null
        this.table = null
        this.tableName = 'note_chunks'
    }

    /**
     * Initialize the database and create table if needed
     */
    async initialize() {
        try {
            this.db = await lancedb.connect(this.dbPath)

            // Check if table exists
            const tableNames = await this.db.tableNames()

            if (!tableNames.includes(this.tableName)) {
                // Create table with schema
                await this.createTable()
            } else {
                this.table = await this.db.openTable(this.tableName)
            }

            console.log('Vector store initialized successfully')
            return true
        } catch (error) {
            console.error('Failed to initialize vector store:', error)
            throw error
        }
    }

    /**
     * Create the table with proper schema
     */
    async createTable() {
        // Sample data to define schema (will be deleted after table creation)
        const sampleData = [
            {
                id: 'sample',
                noteId: 'sample',
                noteTitle: 'Sample Note',
                text: 'Sample chunk text',
                vector: new Array(768).fill(0), // nomic-embed-text has 768 dimensions
                chunkIndex: 0,
                totalChunks: 1,
                folder: 'Sample Folder',
                creationDate: new Date().toISOString(),
                modificationDate: new Date().toISOString(),
                syncedAt: new Date().toISOString(),
            },
        ]

        this.table = await this.db.createTable(this.tableName, sampleData)

        // Delete the sample data
        await this.table.delete("id = 'sample'")

        console.log('Table created with schema')
    }

    /**
     * Add chunks to the vector store
     */
    async addChunks(chunks) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        // Filter out chunks with null embeddings
        const validChunks = chunks.filter(
            (chunk) => chunk.embedding && chunk.embedding.length > 0
        )

        if (validChunks.length === 0) {
            console.warn('No valid chunks to add')
            return
        }

        // Transform chunks to match table schema
        const data = validChunks.map((chunk) => ({
            id: `${chunk.noteId}_${chunk.chunkIndex}`,
            noteId: chunk.noteId,
            noteTitle: chunk.noteTitle,
            text: chunk.text,
            vector: chunk.embedding,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            folder: chunk.metadata.folder,
            creationDate: chunk.metadata.creationDate,
            modificationDate: chunk.metadata.modificationDate,
            syncedAt: new Date().toISOString(),
        }))

        try {
            await this.table.add(data)
            console.log(`Added ${data.length} chunks to vector store`)
        } catch (error) {
            console.error('Error adding chunks:', error)
            throw error
        }
    }

    /**
     * Search for similar chunks using vector similarity
     */
    async search(queryVector, folderName, limit = 10) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            const results = await this.table
                .search(queryVector)
                .where(`folder = '${folderName}'`)
                .limit(limit)
                .toArray()

            return results.map((result) => ({
                id: result.id,
                noteId: result.noteId,
                noteTitle: result.noteTitle,
                text: result.text,
                chunkIndex: result.chunkIndex,
                totalChunks: result.totalChunks,
                folder: result.folder,
                creationDate: result.creationDate,
                modificationDate: result.modificationDate,
                score: result._distance, // similarity score
                metadata: {
                    folder: result.folder,
                    creationDate: result.creationDate,
                    modificationDate: result.modificationDate,
                },
            }))
        } catch (error) {
            console.error('Error searching vectors:', error)
            throw error
        }
    }

    /**
     * Remove all chunks for a specific note
     */
    async removeNote(noteId) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            await this.table.delete(`noteId = '${noteId}'`)
            console.log(`Removed all chunks for note: ${noteId}`)
        } catch (error) {
            console.error('Error removing note:', error)
            throw error
        }
    }

    async folderExists(folderName) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            const res = await this.table
                .query()
                .select(['folder'])
                .where(`folder = '${folderName}'`)
                .limit(1)
                .toArray()
            return res.length > 0
        } catch (error) {
            console.error('Error checking folder existence:', error)
            return false
        }
    }

    /**
     * Remove all chunks for a specific folder
     */
    async removeFolder(folderName) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            await this.table.delete(`folder = '${folderName}'`)
            console.log(`Removed all chunks for folder: ${folderName}`)
        } catch (error) {
            console.error('Error removing folder:', error)
            throw error
        }
    }

    /**
     * Get statistics about the vector store
     */
    async getStats() {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            const count = await this.table.countRows()
            const folderStats = await this.table
                .select(['folder'])
                .groupBy('folder')
                .toArray()

            return {
                totalChunks: count,
                folders: folderStats.map((stat) => ({
                    name: stat.folder,
                    count: stat.count,
                })),
            }
        } catch (error) {
            console.error('Error getting stats:', error)
            throw error
        }
    }

    /**
     * Update existing chunks (used for re-syncing)
     */
    async updateChunks(chunks) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        // First remove existing chunks for these notes
        const noteIds = [...new Set(chunks.map((chunk) => chunk.noteId))]

        for (const noteId of noteIds) {
            await this.removeNote(noteId)
        }

        // Then add the new chunks
        await this.addChunks(chunks)
    }

    /**
     * Check if a note exists in the vector store
     */
    async noteExists(noteId) {
        if (!this.table) {
            throw new Error('Vector store not initialized')
        }

        try {
            const results = await this.table
                .search()
                .where(`noteId = '${noteId}'`)
                .limit(1)
                .toArray()

            return results.length > 0
        } catch (error) {
            console.error('Error checking note existence:', error)
            return false
        }
    }

    /**
     * Close the database connection
     */
    async close() {
        if (this.db) {
            await this.db.close()
            this.db = null
            this.table = null
        }
    }
}

export default VectorStore
