/**
 * Marga AI - Chat Widget
 * Floating chat interface for AI assistant
 * Works on all Insights pages
 */

const AIChatWidget = {
    isOpen: false,
    isMinimized: false,
    messages: [],
    isLoading: false,
    abortController: null, // For cancelling requests
    statusInterval: null, // For animated status

    /**
     * Initialize chat widget
     */
    init() {
        this.injectHTML();
        this.bindEvents();
        this.loadHistory();
    },

    /**
     * Inject chat widget HTML into page
     */
    injectHTML() {
        const widget = document.createElement('div');
        widget.id = 'aiChatWidget';
        widget.className = 'chat-widget';
        widget.innerHTML = `
            <!-- Chat Toggle Button -->
            <button id="chatToggle" class="chat-toggle" title="AI Assistant">
                <span class="chat-toggle-icon">💬</span>
                <span class="chat-toggle-badge" id="chatBadge"></span>
            </button>

            <!-- Chat Window -->
            <div id="chatWindow" class="chat-window hidden">
                <div class="chat-header">
                    <div class="chat-header-left">
                        <span class="chat-avatar">🤖</span>
                        <div class="chat-header-info">
                            <span class="chat-title">AI Assistant</span>
                            <span class="chat-status" id="chatStatus">Ready</span>
                        </div>
                    </div>
                    <div class="chat-header-actions">
                        <button id="chatStop" class="chat-stop-btn hidden" title="Stop">⬜ Stop</button>
                        <button id="chatMinimize" class="chat-action-btn" title="Minimize">−</button>
                        <button id="chatClose" class="chat-action-btn" title="Close">×</button>
                    </div>
                </div>

                <div class="chat-messages" id="chatMessages">
                    <div class="chat-welcome">
                        <p>👋 Hi! I'm your AI SEO assistant.</p>
                        <p>I can help you:</p>
                        <ul>
                            <li>Create landing pages</li>
                            <li>Find & analyze competitors</li>
                            <li>Update website settings</li>
                            <li>Analyze your SEO performance</li>
                        </ul>
                        <div class="quick-actions">
                            <button class="quick-action-btn" data-action="find-competitors">🔍 Find competitors</button>
                            <button class="quick-action-btn" data-action="create-page">📄 Create landing page</button>
                            <button class="quick-action-btn" data-action="analyze-seo">📊 Analyze my SEO</button>
                        </div>
                    </div>
                </div>

                <div class="chat-input-area">
                    <input type="file" id="chatFileInput" class="chat-file-input" accept="image/*,.csv,.txt,.pdf" multiple>
                    <button id="chatAttach" class="chat-attach-btn" title="Attach file">📎</button>
                    <textarea id="chatInput" class="chat-input" placeholder="Ask me anything..." rows="1"></textarea>
                    <button id="chatSend" class="chat-send-btn" title="Send">
                        <span>➤</span>
                    </button>
                </div>
                <div id="chatAttachments" class="chat-attachments hidden"></div>
            </div>
        `;
        document.body.appendChild(widget);
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Toggle chat
        document.getElementById('chatToggle').addEventListener('click', () => this.toggle());
        
        // Close/minimize
        document.getElementById('chatClose').addEventListener('click', () => this.close());
        document.getElementById('chatMinimize').addEventListener('click', () => this.minimize());
        
        // Stop button
        document.getElementById('chatStop').addEventListener('click', () => this.stopRequest());
        
        // Send message
        document.getElementById('chatSend').addEventListener('click', () => this.sendMessage());
        
        // Enter to send (Shift+Enter for new line)
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        document.getElementById('chatInput').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });

        // File attachment
        document.getElementById('chatAttach').addEventListener('click', () => {
            document.getElementById('chatFileInput').click();
        });

        document.getElementById('chatFileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        // Drag and drop
        const chatWindow = document.getElementById('chatWindow');
        chatWindow.addEventListener('dragover', (e) => {
            e.preventDefault();
            chatWindow.classList.add('drag-over');
        });
        chatWindow.addEventListener('dragleave', () => {
            chatWindow.classList.remove('drag-over');
        });
        chatWindow.addEventListener('drop', (e) => {
            e.preventDefault();
            chatWindow.classList.remove('drag-over');
            this.handleFileSelect(e.dataTransfer.files);
        });

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });
    },

    /**
     * Handle file selection
     */
    handleFileSelect(files) {
        if (!files || files.length === 0) return;

        const container = document.getElementById('chatAttachments');
        container.classList.remove('hidden');

        for (const file of files) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                alert('File too large. Max 10MB.');
                continue;
            }

            const attachment = {
                name: file.name,
                type: file.type,
                size: file.size,
                file: file
            };

            this.pendingAttachments = this.pendingAttachments || [];
            this.pendingAttachments.push(attachment);

            // Show preview
            const preview = document.createElement('div');
            preview.className = 'attachment-preview';
            
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                preview.appendChild(img);
            } else {
                preview.innerHTML = `<span class="file-icon">📄</span>`;
            }
            
            preview.innerHTML += `
                <span class="file-name">${file.name}</span>
                <button class="remove-attachment" data-name="${file.name}">×</button>
            `;
            
            preview.querySelector('.remove-attachment').addEventListener('click', (e) => {
                const name = e.target.dataset.name;
                this.pendingAttachments = this.pendingAttachments.filter(a => a.name !== name);
                preview.remove();
                if (this.pendingAttachments.length === 0) {
                    container.classList.add('hidden');
                }
            });

            container.appendChild(preview);
        }

        // Clear the input
        document.getElementById('chatFileInput').value = '';
    },

    /**
     * Convert file to base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Toggle chat window
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    /**
     * Open chat window
     */
    open() {
        this.isOpen = true;
        this.isMinimized = false;
        document.getElementById('chatWindow').classList.remove('hidden', 'minimized');
        document.getElementById('chatToggle').classList.add('active');
        document.getElementById('chatInput').focus();
        this.hideBadge();
    },

    /**
     * Close chat window
     */
    close() {
        this.isOpen = false;
        document.getElementById('chatWindow').classList.add('hidden');
        document.getElementById('chatToggle').classList.remove('active');
    },

    /**
     * Minimize chat window
     */
    minimize() {
        this.isMinimized = !this.isMinimized;
        document.getElementById('chatWindow').classList.toggle('minimized', this.isMinimized);
    },

    /**
     * Handle quick action buttons
     */
    handleQuickAction(action) {
        const prompts = {
            'find-competitors': 'Find competitors for printer rental in Manila and show me their rankings',
            'create-page': 'Create a landing page for printer rental BGC',
            'analyze-seo': 'Analyze my current SEO performance and give me recommendations'
        };
        
        const prompt = prompts[action];
        if (prompt) {
            document.getElementById('chatInput').value = prompt;
            this.sendMessage();
        }
    },

    /**
     * Stop the current request
     */
    stopRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.setLoading(false);
        this.addMessage('assistant', '🛑 Request stopped. You can edit your message and try again.');
    },

    /**
     * Send message to AI
     */
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if ((!message && (!this.pendingAttachments || this.pendingAttachments.length === 0)) || this.isLoading) return;

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Process attachments
        let attachments = [];
        if (this.pendingAttachments && this.pendingAttachments.length > 0) {
            for (const att of this.pendingAttachments) {
                const base64 = await this.fileToBase64(att.file);
                attachments.push({
                    name: att.name,
                    type: att.type,
                    size: att.size,
                    data: base64
                });
            }
            // Clear attachments UI
            this.pendingAttachments = [];
            const container = document.getElementById('chatAttachments');
            container.innerHTML = '';
            container.classList.add('hidden');
        }

        // Build display message
        let displayMessage = message;
        if (attachments.length > 0) {
            displayMessage += `\n📎 ${attachments.map(a => a.name).join(', ')}`;
        }

        // Add user message to chat
        this.addMessage('user', displayMessage);

        // Show loading with animated status
        this.setLoading(true);

        // Create abort controller for this request
        this.abortController = new AbortController();

        try {
            // Send to Manager Agent (new orchestrator)
            const response = await fetch('/.netlify/functions/agent-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this.abortController.signal,
                body: JSON.stringify({ 
                    message,
                    attachments,
                    history: this.messages.slice(-10) // Last 10 messages for context
                })
            });

            // Check if response is OK
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', response.status, errorText);
                this.addMessage('assistant', `Server error (${response.status}). The request may have timed out - try a simpler question or try again.`);
                this.setLoading(false);
                return;
            }

            // Try to parse JSON
            const responseText = await response.text();
            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON parse error:', parseError, 'Response:', responseText.substring(0, 500));
                this.addMessage('assistant', 'Sorry, received an invalid response from the server. This usually means the request timed out. Try asking a simpler question.');
                this.setLoading(false);
                return;
            }

            if (result.success) {
                // Show response with any approval buttons
                this.addMessage('assistant', result.data.response, result.data.actions, result.data.approvals);
                
                // Show context badge if there are pending items
                if (result.data.context) {
                    const { pendingRecommendations, openIssues } = result.data.context;
                    if (pendingRecommendations > 0 || openIssues > 0) {
                        this.showContextBadge(pendingRecommendations, openIssues);
                    }
                }
            } else {
                this.addMessage('assistant', `Sorry, I encountered an error: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            // Check if it was aborted by user
            if (error.name === 'AbortError') {
                // Already handled by stopRequest()
                return;
            }
            console.error('Chat error:', error);
            this.addMessage('assistant', `Sorry, I couldn't connect to the server: ${error.message}. Please try again.`);
        }

        this.abortController = null;
        this.setLoading(false);
    },

    /**
     * Add message to chat
     */
    addMessage(role, content, actions = null) {
        const messagesContainer = document.getElementById('chatMessages');
        
        // Remove welcome message if exists
        const welcome = messagesContainer.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;
        
        let html = `
            <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessage(content)}</div>
        `;

        // Add action buttons if provided
        if (actions && actions.length > 0) {
            html += '<div class="message-actions">';
            actions.forEach(action => {
                html += `<button class="action-btn" data-action-type="${action.type}" data-action-data='${JSON.stringify(action.data)}'>${action.label}</button>`;
            });
            html += '</div>';
        }

        html += '</div>';
        messageEl.innerHTML = html;

        // Bind action button events
        messageEl.querySelectorAll('.action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.actionType;
                const data = JSON.parse(e.target.dataset.actionData || '{}');
                this.handleAction(type, data, e.target);
            });
        });

        messagesContainer.appendChild(messageEl);
        
        // Scroll to show the START of this message (not bottom)
        // This lets user read from the beginning of the reply
        if (role === 'assistant') {
            // Calculate position to scroll the message to the top of the container
            // Use setTimeout to ensure DOM has updated
            setTimeout(() => {
                const messageTop = messageEl.offsetTop;
                messagesContainer.scrollTop = messageTop - 10; // 10px padding from top
            }, 50);
        } else {
            // For user messages, scroll to bottom as usual
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Store message
        this.messages.push({ role, content });
        this.saveHistory();
    },

    /**
     * Format message content (basic markdown)
     */
    formatMessage(content) {
        if (!content) return '';
        
        return content
            // Bold
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Line breaks
            .replace(/\n/g, '<br>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    },

    /**
     * Handle action button clicks
     */
    async handleAction(type, data, button) {
        button.disabled = true;
        button.textContent = 'Processing...';

        try {
            const response = await fetch('/.netlify/functions/insights-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    action: type,
                    data: data
                })
            });

            const result = await response.json();

            if (result.success) {
                button.textContent = '✓ Done';
                button.classList.add('success');
                
                if (result.data.response) {
                    this.addMessage('assistant', result.data.response);
                }
            } else {
                button.textContent = '✗ Failed';
                button.classList.add('error');
            }
        } catch (error) {
            button.textContent = '✗ Error';
            button.classList.add('error');
        }
    },

    /**
     * Set loading state
     */
    setLoading(loading, toolName = null) {
        this.isLoading = loading;
        const stopBtn = document.getElementById('chatStop');
        const sendBtn = document.getElementById('chatSend');
        const statusEl = document.getElementById('chatStatus');
        
        if (loading) {
            // Show stop button, hide send button styling
            stopBtn.classList.remove('hidden');
            sendBtn.disabled = true;
            
            // Start animated status
            this.startAnimatedStatus();
            
            // Add loading indicator
            this.addLoadingIndicator(toolName);
        } else {
            // Hide stop button
            stopBtn.classList.add('hidden');
            sendBtn.disabled = false;
            
            // Stop animated status
            this.stopAnimatedStatus();
            statusEl.textContent = 'Ready';
            
            // Remove loading indicator
            this.removeLoadingIndicator();
        }
    },

    /**
     * Start animated status (cycles through different messages)
     */
    startAnimatedStatus() {
        const statusEl = document.getElementById('chatStatus');
        const loadingEl = document.querySelector('.tool-status');
        const stages = [
            'Thinking...',
            'Analyzing request...',
            'Calling AI...',
            'Processing...',
            'Working on it...',
            'Almost there...'
        ];
        let index = 0;
        let seconds = 0;
        
        this.statusInterval = setInterval(() => {
            seconds++;
            const stage = stages[Math.min(index, stages.length - 1)];
            const timeText = seconds > 3 ? ` (${seconds}s)` : '';
            statusEl.textContent = stage + timeText;
            if (loadingEl) {
                loadingEl.textContent = stage + timeText;
            }
            // Progress through stages every 2 seconds
            if (seconds % 2 === 0 && index < stages.length - 1) {
                index++;
            }
        }, 1000);
    },

    /**
     * Stop animated status
     */
    stopAnimatedStatus() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
            this.statusInterval = null;
        }
    },

    /**
     * Update loading indicator with tool name
     */
    updateLoadingTool(toolName) {
        const loadingEl = document.querySelector('.loading-message');
        if (loadingEl) {
            const toolText = loadingEl.querySelector('.tool-status');
            if (toolText) {
                toolText.textContent = `Using ${toolName}...`;
            }
            document.getElementById('chatStatus').textContent = `Using ${toolName}...`;
        }
    },

    /**
     * Add loading indicator
     */
    addLoadingIndicator(toolName = null) {
        // Remove existing loading indicator first
        this.removeLoadingIndicator();
        
        const messagesContainer = document.getElementById('chatMessages');
        const loadingEl = document.createElement('div');
        loadingEl.className = 'chat-message assistant loading-message';
        loadingEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
                <div class="tool-status" style="font-size: 11px; color: #666; margin-top: 4px;">
                    ${toolName ? `Using ${toolName}...` : 'Thinking...'}
                </div>
            </div>
        `;
        messagesContainer.appendChild(loadingEl);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    },

    /**
     * Remove loading indicator
     */
    removeLoadingIndicator() {
        const loading = document.querySelector('.loading-message');
        if (loading) loading.remove();
    },

    /**
     * Show notification badge
     */
    showBadge(count = 1) {
        const badge = document.getElementById('chatBadge');
        badge.textContent = count;
        badge.classList.add('visible');
    },

    /**
     * Hide notification badge
     */
    hideBadge() {
        document.getElementById('chatBadge').classList.remove('visible');
    },

    /**
     * Show context badge for pending items
     */
    showContextBadge(recommendations, issues) {
        // Could add a small indicator showing pending work
        console.log(`Pending: ${recommendations} recommendations, ${issues} issues`);
    },

    /**
     * Handle approval action
     */
    async handleApproval(recId, approved) {
        this.setLoading(true);
        try {
            const response = await fetch('/.netlify/functions/agent-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: approved ? 'approve' : 'dismiss',
                    recId
                })
            });
            const result = await response.json();
            if (result.success) {
                this.addMessage('assistant', approved ? 
                    '✅ Action approved! The agents are working on it...' : 
                    '❌ Action dismissed.');
            }
        } catch (e) {
            this.addMessage('assistant', 'Error processing approval.');
        }
        this.setLoading(false);
    },

    /**
     * Save chat history to localStorage
     */
    saveHistory() {
        try {
            const history = this.messages.slice(-50); // Keep last 50 messages
            localStorage.setItem('marga_chat_history', JSON.stringify(history));
        } catch (e) {
            // localStorage might be full or disabled
        }
    },

    /**
     * Load chat history from localStorage
     */
    loadHistory() {
        try {
            const history = localStorage.getItem('marga_chat_history');
            if (history) {
                const messages = JSON.parse(history);
                messages.forEach(msg => {
                    this.addMessage(msg.role, msg.content);
                });
            }
        } catch (e) {
            // Ignore errors
        }
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => AIChatWidget.init());
