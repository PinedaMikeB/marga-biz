/**
 * Marga AI - Chat Widget v3
 * With persistent chat history sidebar (synced via Firebase)
 */

const AIChatWidget = {
    isOpen: false,
    isMinimized: false,
    isSidebarOpen: false,
    messages: [],
    sessions: [],
    currentSessionId: null,
    isLoading: false,
    abortController: null,
    statusInterval: null,
    pendingAttachments: [],
    saveTimeout: null,

    init() {
        this.injectHTML();
        this.bindEvents();
        this.loadSessions();
    },

    injectHTML() {
        const widget = document.createElement('div');
        widget.id = 'aiChatWidget';
        widget.className = 'chat-widget';
        widget.innerHTML = `
            <button id="chatToggle" class="chat-toggle" title="AI Assistant">
                <span class="chat-toggle-icon">💬</span>
            </button>

            <div id="chatWindow" class="chat-window hidden">
                <!-- Sidebar -->
                <div id="chatSidebar" class="chat-sidebar">
                    <div class="sidebar-header">
                        <span>Chat History</span>
                        <button id="newChatBtn" class="new-chat-btn" title="New Chat">+ New</button>
                    </div>
                    <div id="sessionsList" class="sessions-list">
                        <div class="loading-sessions">Loading...</div>
                    </div>
                </div>

                <!-- Main Chat Area -->
                <div class="chat-main">
                    <div class="chat-header">
                        <div class="chat-header-left">
                            <button id="toggleSidebar" class="sidebar-toggle-btn" title="Chat History">☰</button>
                            <span class="chat-avatar">🤖</span>
                            <div class="chat-header-info">
                                <span class="chat-title">AI Assistant</span>
                                <span class="chat-status" id="chatStatus">Ready</span>
                            </div>
                        </div>
                        <div class="chat-header-actions">
                            <button id="chatStop" class="chat-stop-btn hidden" title="Stop">⬜</button>
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

                    <div id="chatAttachments" class="chat-attachments hidden"></div>
                    
                    <div class="chat-input-area">
                        <input type="file" id="chatFileInput" class="chat-file-input" accept="image/*,.csv,.txt,.pdf" multiple>
                        <button id="chatAttach" class="chat-attach-btn" title="Attach file">📎</button>
                        <textarea id="chatInput" class="chat-input" placeholder="Ask me anything..." rows="1"></textarea>
                        <button id="chatSend" class="chat-send-btn" title="Send">➤</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(widget);
    },

    bindEvents() {
        document.getElementById('chatToggle').addEventListener('click', () => this.toggle());
        document.getElementById('chatClose').addEventListener('click', () => this.close());
        document.getElementById('chatMinimize').addEventListener('click', () => this.minimize());
        document.getElementById('chatStop').addEventListener('click', () => this.stopRequest());
        document.getElementById('chatSend').addEventListener('click', () => this.sendMessage());
        document.getElementById('toggleSidebar').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('newChatBtn').addEventListener('click', () => this.newChat());
        
        document.getElementById('chatInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('chatInput').addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        });

        document.getElementById('chatAttach').addEventListener('click', () => {
            document.getElementById('chatFileInput').click();
        });

        document.getElementById('chatFileInput').addEventListener('change', (e) => {
            this.handleFileSelect(e.target.files);
        });

        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleQuickAction(e.target.dataset.action));
        });

        // Close sidebar when clicking outside on mobile
        document.getElementById('chatWindow').addEventListener('click', (e) => {
            if (this.isSidebarOpen && window.innerWidth <= 600) {
                const sidebar = document.getElementById('chatSidebar');
                if (!sidebar.contains(e.target) && e.target.id !== 'toggleSidebar') {
                    this.toggleSidebar();
                }
            }
        });
    },

    // === Sidebar & Sessions ===
    
    toggleSidebar() {
        this.isSidebarOpen = !this.isSidebarOpen;
        document.getElementById('chatSidebar').classList.toggle('open', this.isSidebarOpen);
        document.getElementById('chatWindow').classList.toggle('sidebar-open', this.isSidebarOpen);
    },

    async loadSessions() {
        try {
            const response = await fetch('/.netlify/functions/chat-sessions');
            const result = await response.json();
            
            if (result.success) {
                this.sessions = result.sessions;
                this.renderSessions();
                
                // Load most recent session if exists
                if (this.sessions.length > 0) {
                    this.loadSession(this.sessions[0].id);
                }
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
            document.getElementById('sessionsList').innerHTML = '<div class="no-sessions">No chat history</div>';
        }
    },

    renderSessions() {
        const container = document.getElementById('sessionsList');
        
        if (this.sessions.length === 0) {
            container.innerHTML = '<div class="no-sessions">No chat history yet</div>';
            return;
        }

        container.innerHTML = this.sessions.map(session => {
            const date = new Date(session.updatedAt);
            const isToday = date.toDateString() === new Date().toDateString();
            const isYesterday = date.toDateString() === new Date(Date.now() - 86400000).toDateString();
            
            let dateLabel;
            if (isToday) dateLabel = 'Today';
            else if (isYesterday) dateLabel = 'Yesterday';
            else dateLabel = date.toLocaleDateString();
            
            const isActive = session.id === this.currentSessionId;
            
            return `
                <div class="session-item ${isActive ? 'active' : ''}" data-session-id="${session.id}">
                    <div class="session-title">${this.escapeHtml(session.title)}</div>
                    <div class="session-meta">
                        <span class="session-date">${dateLabel}</span>
                        <span class="session-count">${session.messageCount} msgs</span>
                    </div>
                    <button class="session-delete" data-session-id="${session.id}" title="Delete">×</button>
                </div>
            `;
        }).join('');

        // Bind click events
        container.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('session-delete')) {
                    this.loadSession(item.dataset.sessionId);
                }
            });
        });

        container.querySelectorAll('.session-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteSession(btn.dataset.sessionId);
            });
        });
    },

    async loadSession(sessionId) {
        try {
            const response = await fetch(`/.netlify/functions/chat-sessions?sessionId=${sessionId}`);
            const result = await response.json();
            
            if (result.success && result.session) {
                this.currentSessionId = sessionId;
                this.messages = result.session.messages || [];
                this.renderMessages();
                this.renderSessions(); // Update active state
                
                // Close sidebar on mobile after selection
                if (window.innerWidth <= 600 && this.isSidebarOpen) {
                    this.toggleSidebar();
                }
            }
        } catch (error) {
            console.error('Failed to load session:', error);
        }
    },

    async saveSession() {
        // Debounce saves
        if (this.saveTimeout) clearTimeout(this.saveTimeout);
        
        this.saveTimeout = setTimeout(async () => {
            if (this.messages.length === 0) return;
            
            try {
                const response = await fetch('/.netlify/functions/chat-sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sessionId: this.currentSessionId,
                        messages: this.messages
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    if (!this.currentSessionId) {
                        this.currentSessionId = result.sessionId;
                    }
                    // Refresh sessions list
                    this.loadSessions();
                }
            } catch (error) {
                console.error('Failed to save session:', error);
            }
        }, 1000);
    },

    async deleteSession(sessionId) {
        if (!confirm('Delete this chat?')) return;
        
        try {
            await fetch(`/.netlify/functions/chat-sessions?sessionId=${sessionId}`, {
                method: 'DELETE'
            });
            
            // If deleting current session, start new chat
            if (sessionId === this.currentSessionId) {
                this.newChat();
            }
            
            // Refresh list
            this.loadSessions();
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    },

    newChat() {
        this.currentSessionId = null;
        this.messages = [];
        this.renderMessages();
        this.renderSessions();
        
        // Close sidebar on mobile
        if (window.innerWidth <= 600 && this.isSidebarOpen) {
            this.toggleSidebar();
        }
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        
        if (this.messages.length === 0) {
            container.innerHTML = `
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
            `;
            // Rebind quick actions
            container.querySelectorAll('.quick-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => this.handleQuickAction(e.target.dataset.action));
            });
            return;
        }

        container.innerHTML = this.messages.map(msg => `
            <div class="chat-message ${msg.role}">
                <div class="message-avatar">${msg.role === 'user' ? '👤' : '🤖'}</div>
                <div class="message-content">
                    <div class="message-text">${this.formatMessage(msg.content)}</div>
                </div>
            </div>
        `).join('');

        container.scrollTop = container.scrollHeight;
    },

    // === Chat Functions ===
    
    toggle() {
        this.isOpen = !this.isOpen;
        const chatWindow = document.getElementById('chatWindow');
        chatWindow.classList.toggle('hidden', !this.isOpen);
        
        if (this.isOpen) {
            this.isMinimized = false;
            chatWindow.classList.remove('minimized');
            document.getElementById('chatInput').focus();
        }
    },

    close() {
        this.isOpen = false;
        document.getElementById('chatWindow').classList.add('hidden');
    },

    minimize() {
        this.isMinimized = !this.isMinimized;
        document.getElementById('chatWindow').classList.toggle('minimized', this.isMinimized);
    },

    stopRequest() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.setLoading(false);
        this.addMessage('assistant', '⏹️ Request stopped. You can edit your message and try again.');
    },

    setLoading(loading) {
        this.isLoading = loading;
        const sendBtn = document.getElementById('chatSend');
        const stopBtn = document.getElementById('chatStop');
        const statusEl = document.getElementById('chatStatus');
        
        sendBtn.disabled = loading;
        stopBtn.classList.toggle('hidden', !loading);
        
        if (loading) {
            let seconds = 0;
            const stages = ['Thinking', 'Analyzing', 'Processing', 'Working'];
            
            this.statusInterval = setInterval(() => {
                seconds++;
                const stage = stages[Math.min(Math.floor(seconds / 3), stages.length - 1)];
                statusEl.textContent = `${stage}... (${seconds}s)`;
            }, 1000);
            statusEl.textContent = 'Thinking...';
        } else {
            if (this.statusInterval) {
                clearInterval(this.statusInterval);
                this.statusInterval = null;
            }
            statusEl.textContent = 'Ready';
        }
    },

    handleQuickAction(action) {
        const prompts = {
            'find-competitors': 'Find my top competitors for "printer rental philippines"',
            'create-page': 'Help me create a landing page for copier rental services',
            'analyze-seo': 'Analyze my SEO performance and give me recommendations'
        };
        
        const input = document.getElementById('chatInput');
        input.value = prompts[action] || '';
        input.focus();
    },

    async sendMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message || this.isLoading) return;
        
        input.value = '';
        input.style.height = 'auto';
        
        // Handle attachments
        const attachments = [];
        for (const att of this.pendingAttachments) {
            const base64 = await this.fileToBase64(att);
            attachments.push({ name: att.name, type: att.type, size: att.size, data: base64 });
        }
        this.pendingAttachments = [];
        document.getElementById('chatAttachments').innerHTML = '';
        document.getElementById('chatAttachments').classList.add('hidden');

        // Add user message
        let displayMessage = message;
        if (attachments.length > 0) {
            displayMessage += `\n📎 ${attachments.map(a => a.name).join(', ')}`;
        }
        this.addMessage('user', displayMessage);
        this.setLoading(true);
        this.abortController = new AbortController();

        try {
            const cleanHistory = this.messages
                .filter(m => m.content && m.content.trim().length > 0)
                .slice(-10);
            
            const response = await fetch('/.netlify/functions/agent-manager', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: this.abortController.signal,
                body: JSON.stringify({ message, attachments, history: cleanHistory })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', response.status, errorText);
                this.addMessage('assistant', `Server error (${response.status}). Try a simpler question.`);
                this.setLoading(false);
                return;
            }

            const result = await response.json();
            
            if (result.success) {
                this.addMessage('assistant', result.response);
            } else {
                this.addMessage('assistant', `Error: ${result.error || 'Unknown error'}`);
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request aborted by user');
            } else {
                console.error('Chat error:', error);
                this.addMessage('assistant', 'Connection error. Please try again.');
            }
        }
        
        this.setLoading(false);
    },

    addMessage(role, content) {
        const container = document.getElementById('chatMessages');
        
        // Remove welcome if present
        const welcome = container.querySelector('.chat-welcome');
        if (welcome) welcome.remove();

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;
        msgDiv.innerHTML = `
            <div class="message-avatar">${role === 'user' ? '👤' : '🤖'}</div>
            <div class="message-content">
                <div class="message-text">${this.formatMessage(content)}</div>
            </div>
        `;
        container.appendChild(msgDiv);
        
        // Scroll
        if (role === 'assistant') {
            const msgTop = msgDiv.offsetTop;
            container.scrollTop = msgTop - 20;
        } else {
            container.scrollTop = container.scrollHeight;
        }

        this.messages.push({ role, content });
        this.saveSession();
    },

    formatMessage(content) {
        if (!content) return '';
        
        let formatted = content;
        
        // Convert markdown tables to HTML
        if (/\|.*\|.*\|/m.test(content)) {
            formatted = this.convertMarkdownTable(formatted);
            setTimeout(() => {
                document.getElementById('chatWindow').classList.add('expanded');
            }, 100);
        }
        
        return formatted
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    },

    convertMarkdownTable(content) {
        const lines = content.split('\n');
        let inTable = false;
        let tableHtml = '';
        let result = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.startsWith('|') && line.endsWith('|')) {
                if (/^\|[\s\-:]+\|/.test(line) && line.includes('-')) continue;
                
                if (!inTable) {
                    inTable = true;
                    tableHtml = '<div class="table-wrapper"><table>';
                }
                
                const cells = line.split('|').filter(c => c.trim() !== '');
                const isHeader = !tableHtml.includes('<tbody>');
                
                if (isHeader && !tableHtml.includes('<thead>')) {
                    tableHtml += '<thead><tr>';
                    cells.forEach(cell => { tableHtml += `<th>${cell.trim()}</th>`; });
                    tableHtml += '</tr></thead><tbody>';
                } else {
                    tableHtml += '<tr>';
                    cells.forEach(cell => {
                        let cellContent = cell.trim();
                        if (cellContent.includes('✅') || (cellContent.includes('YOU') && !cellContent.includes('❌'))) {
                            cellContent = `<span class="winner">${cellContent}</span>`;
                        } else if (cellContent.includes('❌') || cellContent.includes('THEM')) {
                            cellContent = `<span class="loser">${cellContent}</span>`;
                        }
                        tableHtml += `<td>${cellContent}</td>`;
                    });
                    tableHtml += '</tr>';
                }
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += '</tbody></table></div>';
                    result.push(tableHtml);
                    tableHtml = '';
                }
                result.push(line);
            }
        }
        
        if (inTable) {
            tableHtml += '</tbody></table></div>';
            result.push(tableHtml);
        }
        
        return result.join('\n');
    },

    // === File Handling ===
    
    handleFileSelect(files) {
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                alert(`File ${file.name} is too large (max 5MB)`);
                continue;
            }
            this.pendingAttachments.push(file);
            this.renderAttachmentPreview(file);
        }
    },

    renderAttachmentPreview(file) {
        const container = document.getElementById('chatAttachments');
        container.classList.remove('hidden');
        
        const preview = document.createElement('div');
        preview.className = 'attachment-preview';
        preview.innerHTML = `
            <span class="attachment-icon">${file.type.startsWith('image/') ? '🖼️' : '📄'}</span>
            <span class="attachment-name">${file.name}</span>
            <button class="remove-attachment" data-name="${file.name}">×</button>
        `;
        
        preview.querySelector('.remove-attachment').addEventListener('click', () => {
            this.pendingAttachments = this.pendingAttachments.filter(f => f.name !== file.name);
            preview.remove();
            if (this.pendingAttachments.length === 0) {
                container.classList.add('hidden');
            }
        });
        
        container.appendChild(preview);
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => AIChatWidget.init());
