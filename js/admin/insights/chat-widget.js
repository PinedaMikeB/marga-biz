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
                    <textarea id="chatInput" class="chat-input" placeholder="Ask me anything..." rows="1"></textarea>
                    <button id="chatSend" class="chat-send-btn" title="Send">
                        <span>➤</span>
                    </button>
                </div>
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

        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
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
     * Send message to AI
     */
    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || this.isLoading) return;

        // Clear input
        input.value = '';
        input.style.height = 'auto';

        // Add user message to chat
        this.addMessage('user', message);

        // Show loading
        this.setLoading(true);

        try {
            // Send to AI chat endpoint
            const response = await fetch('/.netlify/functions/insights-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message,
                    history: this.messages.slice(-10) // Last 10 messages for context
                })
            });

            const result = await response.json();

            if (result.success) {
                this.addMessage('assistant', result.data.response, result.data.actions);
            } else {
                this.addMessage('assistant', `Sorry, I encountered an error: ${result.error}`);
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.addMessage('assistant', 'Sorry, I couldn\'t connect to the server. Please try again.');
        }

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
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

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
    setLoading(loading) {
        this.isLoading = loading;
        document.getElementById('chatStatus').textContent = loading ? 'Thinking...' : 'Ready';
        document.getElementById('chatSend').disabled = loading;
        
        if (loading) {
            this.addLoadingIndicator();
        } else {
            this.removeLoadingIndicator();
        }
    },

    /**
     * Add loading indicator
     */
    addLoadingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        const loadingEl = document.createElement('div');
        loadingEl.className = 'chat-message assistant loading-message';
        loadingEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
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
