class NotesSync {
    constructor() {
        this.folders = []
        this.selectedFolder = null
        this.isLoading = false
        this.init()
    }

    init() {
        this.bindEvents()
        this.loadFolders()
    }

    bindEvents() {
        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadFolders()
        })

        // Retry button
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadFolders()
        })

        // Modal buttons
        document.getElementById('cancel-btn').addEventListener('click', () => {
            this.hideModal('progress-modal')
        })

        document.getElementById('success-ok-btn').addEventListener('click', () => {
            this.hideModal('success-modal')
        })

        document.getElementById('start-chat-btn').addEventListener('click', () => {
            this.hideModal('success-modal')
            this.showChatInterface()
        })

        // Chat interface events
        document.getElementById('chat-back-btn').addEventListener('click', () => {
            this.hideChatInterface()
        })

        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage()
        })

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage()
            }
        })

        // Progress updates
        window.electronAPI.onSyncProgress((message) => {
            this.updateProgress(message)
        })
    }

    async loadFolders() {
        this.setLoading(true)
        this.showState('loading-state')

        try {
            const result = await window.electronAPI.getFolders()
            
            if (result.success) {
                this.folders = result.folders.sort((a, b) => a.count - b.count)
                this.renderFolders()
                this.showState('folder-list')
            } else {
                this.showError(result.error)
            }
        } catch (error) {
            this.showError(error.message)
        } finally {
            this.setLoading(false)
        }
    }

    renderFolders() {
        const folderList = document.getElementById('folder-list')
        folderList.innerHTML = ''

        if (this.folders.length === 0) {
            this.showState('empty-state')
            return
        }

        this.folders.forEach(folder => {
            const folderItem = this.createFolderItem(folder)
            folderList.appendChild(folderItem)
        })
    }

    createFolderItem(folder) {
        const item = document.createElement('div')
        item.className = 'folder-item'
        item.dataset.folderId = folder.id

        const statusIcon = this.getStatusIcon(folder.count)
        const sizeLabel = this.getSizeLabel(folder.count)

        item.innerHTML = `
            <div class="folder-status">${statusIcon}</div>
            <div class="folder-icon">📁</div>
            <div class="folder-info">
                <div class="folder-name">${folder.name}</div>
                <div class="folder-details">
                    <span class="folder-count">${folder.count} notes</span>
                    ${sizeLabel ? `<span class="folder-size ${sizeLabel.class}">${sizeLabel.text}</span>` : ''}
                </div>
            </div>
            <button class="sync-btn" data-folder-name="${folder.name}">
                <span>📥</span>
                Sync
            </button>
        `

        // Add click handlers
        item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('sync-btn')) {
                this.selectFolder(folder)
            }
        })

        const syncBtn = item.querySelector('.sync-btn')
        syncBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this.syncFolder(folder)
        })

        return item
    }

    getStatusIcon(count) {
        if (count > 100) return '⚠️'
        if (count > 50) return '⚡'
        return '✅'
    }

    getSizeLabel(count) {
        if (count > 100) return { text: '• Large folder', class: 'large' }
        if (count > 50) return { text: '• Medium folder', class: 'medium' }
        return null
    }

    selectFolder(folder) {
        // Remove previous selection
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('selected')
        })

        // Add selection to current folder
        const folderItem = document.querySelector(`[data-folder-id="${folder.id}"]`)
        if (folderItem) {
            folderItem.classList.add('selected')
        }

        this.selectedFolder = folder
    }

    async syncFolder(folder) {
        this.selectFolder(folder)
        this.showModal('progress-modal')
        this.updateProgress(`Preparing to sync "${folder.name}"...`)

        try {
            const result = await window.electronAPI.syncFolder(folder.name)
            
            if (result.success) {
                this.hideModal('progress-modal')
                this.showSuccess(`Successfully synced ${result.count} notes from "${folder.name}"`)
            } else {
                this.hideModal('progress-modal')
                this.showError(result.error)
            }
        } catch (error) {
            this.hideModal('progress-modal')
            this.showError(error.message)
        }
    }

    updateProgress(message) {
        const progressText = document.getElementById('progress-text')
        if (progressText) {
            progressText.textContent = message
        }
    }

    showSuccess(message) {
        document.getElementById('success-text').textContent = message
        this.showModal('success-modal')
    }

    showError(message) {
        document.getElementById('error-message').textContent = message
        this.showState('error-state')
    }

    showState(stateId) {
        const states = ['loading-state', 'empty-state', 'error-state', 'folder-list']
        states.forEach(state => {
            document.getElementById(state).style.display = state === stateId ? 'flex' : 'none'
        })
    }

    showModal(modalId) {
        document.getElementById(modalId).style.display = 'flex'
    }

    hideModal(modalId) {
        document.getElementById(modalId).style.display = 'none'
    }

    setLoading(loading) {
        this.isLoading = loading
        const refreshBtn = document.getElementById('refresh-btn')
        refreshBtn.disabled = loading
    }

    // Chat Interface Methods
    showChatInterface() {
        document.getElementById('chat-interface').style.display = 'flex'
        document.getElementById('chat-input').focus()
    }

    hideChatInterface() {
        document.getElementById('chat-interface').style.display = 'none'
    }

    async sendMessage() {
        const input = document.getElementById('chat-input')
        const message = input.value.trim()
        
        if (!message) return
        
        // Add user message
        this.addMessage(message, 'user')
        input.value = ''
        
        // Add loading indicator
        const loadingId = this.addMessage('Thinking...', 'assistant', true)
        
        try {
            // Send message to main process
            const response = await window.electronAPI.sendChatMessage(message)
            
            // Remove loading indicator
            this.removeMessage(loadingId)
            
            // Add assistant response
            this.addMessage(response, 'assistant')
            
        } catch (error) {
            // Remove loading indicator
            this.removeMessage(loadingId)
            
            // Add error message
            this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant')
            console.error('Chat error:', error)
        }
    }

    addMessage(text, sender, isLoading = false) {
        const messagesContainer = document.getElementById('chat-messages')
        const messageId = `msg-${Date.now()}`
        
        const messageDiv = document.createElement('div')
        messageDiv.className = `chat-message ${sender}`
        messageDiv.id = messageId
        
        const contentDiv = document.createElement('div')
        contentDiv.className = `message-content ${isLoading ? 'loading' : ''}`
        
        const textP = document.createElement('p')
        textP.textContent = text
        
        contentDiv.appendChild(textP)
        messageDiv.appendChild(contentDiv)
        messagesContainer.appendChild(messageDiv)
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight
        
        return messageId
    }

    removeMessage(messageId) {
        const messageElement = document.getElementById(messageId)
        if (messageElement) {
            messageElement.remove()
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new NotesSync()
})