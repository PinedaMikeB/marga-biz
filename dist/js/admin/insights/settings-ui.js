/**
 * Marga Insights - Settings UI
 * Manages AI configuration interface
 */

const SettingsUI = {
    config: null,
    history: [],
    historyOffset: 0,
    unsavedChanges: false,

    /**
     * Initialize settings page
     */
    async init() {
        this.showStatus('Loading settings...', 'info');
        
        try {
            await this.loadConfig();
            await this.loadHistory();
            await this.loadScannerStats();
            this.bindEvents();
            this.hideStatus();
        } catch (error) {
            console.error('Settings init error:', error);
            this.showStatus('Failed to load settings: ' + error.message, 'error');
        }
    },

    /**
     * Load config from API
     */
    async loadConfig() {
        const response = await fetch('/.netlify/functions/config-manager?action=get');
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.error || 'Failed to load config');
        }
        
        this.config = result.data;
        this.renderAll();
    },

    /**
     * Load change history
     */
    async loadHistory(append = false) {
        const limit = 20;
        const response = await fetch(`/.netlify/functions/config-manager?action=history&limit=${limit}`);
        const result = await response.json();
        
        if (result.success) {
            if (append) {
                this.history = [...this.history, ...result.data];
            } else {
                this.history = result.data;
            }
            this.renderHistory();
        }
    },

    /**
     * Render all UI components
     */
    renderAll() {
        this.renderModelOptions();
        this.renderToggles();
        this.renderInputs();
        this.renderCompetitors();
        this.renderKeywords();
        this.renderSchedules();
    },

    /**
     * Render model selection options
     */
    renderModelOptions() {
        const container = document.getElementById('modelOptions');
        const models = this.config.ai.availableModels || [];
        const currentModel = this.config.ai.model;

        container.innerHTML = models.map(model => `
            <label class="model-option ${model.id === currentModel ? 'selected' : ''}">
                <input type="radio" name="aiModel" value="${model.id}" 
                    ${model.id === currentModel ? 'checked' : ''}>
                <div class="model-option-content">
                    <span class="model-option-name">${model.name}</span>
                    <span class="model-option-cost ${model.costTier}">${model.costTier}</span>
                    <div class="model-option-desc">${model.description}</div>
                </div>
            </label>
        `).join('');

        // Add click handlers
        container.querySelectorAll('.model-option').forEach(option => {
            option.addEventListener('click', () => {
                container.querySelectorAll('.model-option').forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
                option.querySelector('input').checked = true;
                this.markUnsaved();
            });
        });
    },

    /**
     * Render toggle switches
     */
    renderToggles() {
        const toggles = {
            'smartRouting': this.config.ai.smartRouting,
            'autoApproveMinor': this.config.ai.behaviors?.autoApproveMinor,
            'notifyOnRankDrop': this.config.ai.behaviors?.notifyOnRankDrop,
            'suggestContentWeekly': this.config.ai.behaviors?.suggestContentWeekly,
            'autoMonthlyReport': this.config.ai.behaviors?.autoMonthlyReport
        };

        Object.entries(toggles).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) {
                el.checked = value || false;
                el.addEventListener('change', () => this.markUnsaved());
            }
        });
    },

    /**
     * Render input fields
     */
    renderInputs() {
        // Temperature
        const tempSlider = document.getElementById('temperature');
        const tempValue = document.getElementById('tempValue');
        tempSlider.value = this.config.ai.temperature || 0.7;
        tempValue.textContent = tempSlider.value;
        tempSlider.addEventListener('input', () => {
            tempValue.textContent = tempSlider.value;
            this.markUnsaved();
        });

        // Max Tokens
        const maxTokens = document.getElementById('maxTokens');
        maxTokens.value = this.config.ai.maxTokens || 4000;
        maxTokens.addEventListener('change', () => this.markUnsaved());

        // System Prompt
        const systemPrompt = document.getElementById('systemPrompt');
        systemPrompt.value = this.config.ai.systemPrompt || '';
        systemPrompt.addEventListener('input', () => this.markUnsaved());

        // Additional Instructions
        const additionalInstructions = document.getElementById('additionalInstructions');
        additionalInstructions.value = this.config.ai.additionalInstructions || '';
        additionalInstructions.addEventListener('input', () => this.markUnsaved());
    },

    /**
     * Render competitors list
     */
    renderCompetitors() {
        const container = document.getElementById('competitorsList');
        const competitors = this.config.seo?.competitors || [];

        if (competitors.length === 0) {
            container.innerHTML = '<p class="empty-message">No competitors added yet</p>';
            return;
        }

        container.innerHTML = competitors.map((comp, index) => `
            <div class="list-item" data-index="${index}">
                <div class="list-item-content">
                    <div class="list-item-domain">${comp.domain}</div>
                    <div class="list-item-notes">${comp.notes || ''}</div>
                </div>
                <button class="btn-remove" onclick="SettingsUI.removeCompetitor(${index})">×</button>
            </div>
        `).join('');
    },

    /**
     * Add competitor
     */
    addCompetitor() {
        const domain = document.getElementById('newCompetitorDomain').value.trim();
        const notes = document.getElementById('newCompetitorNotes').value.trim();

        if (!domain) {
            this.showStatus('Please enter a domain', 'error');
            return;
        }

        if (!this.config.seo.competitors) {
            this.config.seo.competitors = [];
        }

        this.config.seo.competitors.push({
            domain,
            notes,
            addedAt: new Date().toISOString()
        });

        document.getElementById('newCompetitorDomain').value = '';
        document.getElementById('newCompetitorNotes').value = '';
        
        this.renderCompetitors();
        this.markUnsaved();
    },

    /**
     * Remove competitor
     */
    removeCompetitor(index) {
        this.config.seo.competitors.splice(index, 1);
        this.renderCompetitors();
        this.markUnsaved();
    },

    /**
     * Render keywords
     */
    renderKeywords() {
        const primaryContainer = document.getElementById('primaryKeywords');
        const growthContainer = document.getElementById('growthKeywords');
        
        const primaryKeywords = this.config.seo?.keywords?.primary || [];
        const growthKeywords = this.config.seo?.keywords?.growth || [];

        primaryContainer.innerHTML = primaryKeywords.map((kw, i) => `
            <span class="tag">
                ${kw}
                <button class="btn-remove" onclick="SettingsUI.removeKeyword('primary', ${i})">×</button>
            </span>
        `).join('') || '<span class="empty-message">No keywords</span>';

        growthContainer.innerHTML = growthKeywords.map((kw, i) => `
            <span class="tag">
                ${kw}
                <button class="btn-remove" onclick="SettingsUI.removeKeyword('growth', ${i})">×</button>
            </span>
        `).join('') || '<span class="empty-message">No keywords</span>';
    },

    /**
     * Add keyword
     */
    addKeyword(type) {
        const inputId = type === 'primary' ? 'newPrimaryKeyword' : 'newGrowthKeyword';
        const input = document.getElementById(inputId);
        const keyword = input.value.trim().toLowerCase();

        if (!keyword) {
            this.showStatus('Please enter a keyword', 'error');
            return;
        }

        if (!this.config.seo.keywords) {
            this.config.seo.keywords = { primary: [], growth: [] };
        }

        if (this.config.seo.keywords[type].includes(keyword)) {
            this.showStatus('Keyword already exists', 'error');
            return;
        }

        this.config.seo.keywords[type].push(keyword);
        input.value = '';
        
        this.renderKeywords();
        this.markUnsaved();
    },

    /**
     * Remove keyword
     */
    removeKeyword(type, index) {
        this.config.seo.keywords[type].splice(index, 1);
        this.renderKeywords();
        this.markUnsaved();
    },

    /**
     * Render schedules
     */
    renderSchedules() {
        const container = document.getElementById('schedulesList');
        const schedules = this.config.seo?.schedules || {};

        const scheduleItems = [
            { key: 'dailySnapshot', name: '📊 Daily Analytics Snapshot', time: schedules.dailySnapshot?.time || '06:00' },
            { key: 'competitorCheck', name: '🔍 Competitor Rank Check', time: `${schedules.competitorCheck?.day || 'monday'} ${schedules.competitorCheck?.time || '08:00'}` },
            { key: 'weeklyReport', name: '📈 Weekly SEO Report', time: `${schedules.weeklyReport?.day || 'sunday'} ${schedules.weeklyReport?.time || '21:00'}` },
            { key: 'keywordAlerts', name: '🎯 Keyword Position Alerts', time: schedules.keywordAlerts?.time || '07:00' },
            { key: 'contentGapAnalysis', name: '📝 Content Gap Analysis', time: `Day ${schedules.contentGapAnalysis?.day || 1} of month` }
        ];

        container.innerHTML = scheduleItems.map(item => {
            const enabled = schedules[item.key]?.enabled || false;
            return `
                <div class="schedule-item">
                    <div class="schedule-info">
                        <div class="schedule-name">${item.name}</div>
                        <div class="schedule-time">${item.time}</div>
                    </div>
                    <span class="schedule-status ${enabled ? 'on' : 'off'}">${enabled ? 'On' : 'Off'}</span>
                    <label class="toggle-label" style="margin:0">
                        <input type="checkbox" class="toggle-input schedule-toggle" 
                            data-key="${item.key}" ${enabled ? 'checked' : ''}>
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            `;
        }).join('');

        // Add event listeners
        container.querySelectorAll('.schedule-toggle').forEach(toggle => {
            toggle.addEventListener('change', (e) => {
                const key = e.target.dataset.key;
                if (!this.config.seo.schedules[key]) {
                    this.config.seo.schedules[key] = {};
                }
                this.config.seo.schedules[key].enabled = e.target.checked;
                this.renderSchedules();
                this.markUnsaved();
            });
        });
    },

    /**
     * Render change history
     */
    renderHistory() {
        const container = document.getElementById('historyContainer');
        
        if (this.history.length === 0) {
            container.innerHTML = '<p class="empty-message">No changes recorded yet</p>';
            return;
        }

        container.innerHTML = this.history.map(item => {
            const icon = this.getHistoryIcon(item.type);
            const time = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Unknown';
            const action = this.formatHistoryAction(item);
            
            return `
                <div class="history-item">
                    <span class="history-icon">${icon}</span>
                    <div class="history-content">
                        <div class="history-action">${action}</div>
                        <div class="history-details">${item.path || ''}</div>
                    </div>
                    <span class="history-time">${time}</span>
                </div>
            `;
        }).join('');
    },

    /**
     * Get icon for history item
     */
    getHistoryIcon(type) {
        const icons = {
            'config_update': '⚙️',
            'config_reset': '↺',
            'page_created': '📄',
            'page_updated': '✏️',
            'page_deleted': '🗑️',
            'competitor_added': '🎯',
            'keyword_added': '🔑'
        };
        return icons[type] || '📝';
    },

    /**
     * Format history action text
     */
    formatHistoryAction(item) {
        if (item.type === 'config_update') {
            return `Updated: ${item.path}`;
        }
        if (item.type === 'config_reset') {
            return 'Reset to defaults';
        }
        return item.type.replace(/_/g, ' ');
    },

    /**
     * Bind event handlers
     */
    bindEvents() {
        // Save All button
        document.getElementById('saveAllBtn').addEventListener('click', () => this.saveAll());
        
        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => this.resetConfig());
        
        // Add competitor
        document.getElementById('addCompetitorBtn').addEventListener('click', () => this.addCompetitor());
        
        // Add keywords
        document.getElementById('addPrimaryKeywordBtn').addEventListener('click', () => this.addKeyword('primary'));
        document.getElementById('addGrowthKeywordBtn').addEventListener('click', () => this.addKeyword('growth'));
        
        // Load more history
        document.getElementById('loadMoreHistory').addEventListener('click', () => this.loadHistory(true));

        // Scanner buttons
        document.getElementById('runInitialScan')?.addEventListener('click', () => this.runInitialScan());
        document.getElementById('viewIssues')?.addEventListener('click', () => this.viewIssues());

        // Enter key handlers
        document.getElementById('newCompetitorDomain').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addCompetitor();
        });
        document.getElementById('newPrimaryKeyword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addKeyword('primary');
        });
        document.getElementById('newGrowthKeyword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addKeyword('growth');
        });

        // Warn before leaving with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.unsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    },

    /**
     * Mark as having unsaved changes
     */
    markUnsaved() {
        this.unsavedChanges = true;
        document.getElementById('saveAllBtn').textContent = '💾 Save All *';
    },

    /**
     * Save all settings
     */
    async saveAll() {
        this.showStatus('Saving...', 'info');

        try {
            // Collect all values from form
            const selectedModel = document.querySelector('input[name="aiModel"]:checked')?.value;
            
            const updates = [
                { path: 'ai.model', value: selectedModel },
                { path: 'ai.smartRouting', value: document.getElementById('smartRouting').checked },
                { path: 'ai.temperature', value: parseFloat(document.getElementById('temperature').value) },
                { path: 'ai.maxTokens', value: parseInt(document.getElementById('maxTokens').value) },
                { path: 'ai.systemPrompt', value: document.getElementById('systemPrompt').value },
                { path: 'ai.additionalInstructions', value: document.getElementById('additionalInstructions').value },
                { path: 'ai.behaviors', value: {
                    autoApproveMinor: document.getElementById('autoApproveMinor').checked,
                    notifyOnRankDrop: document.getElementById('notifyOnRankDrop').checked,
                    suggestContentWeekly: document.getElementById('suggestContentWeekly').checked,
                    autoMonthlyReport: document.getElementById('autoMonthlyReport').checked
                }},
                { path: 'seo.competitors', value: this.config.seo.competitors },
                { path: 'seo.keywords', value: this.config.seo.keywords },
                { path: 'seo.schedules', value: this.config.seo.schedules }
            ];

            // Save each update
            for (const update of updates) {
                await fetch(`/.netlify/functions/config-manager?action=set&path=${update.path}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: update.value, source: 'settings-ui' })
                });
            }

            this.unsavedChanges = false;
            document.getElementById('saveAllBtn').textContent = '💾 Save All';
            this.showStatus('Settings saved!', 'success');
            
            // Reload history
            await this.loadHistory();

        } catch (error) {
            console.error('Save error:', error);
            this.showStatus('Failed to save: ' + error.message, 'error');
        }
    },

    /**
     * Reset config to defaults
     */
    async resetConfig() {
        if (!confirm('Are you sure you want to reset all settings to defaults?')) {
            return;
        }

        this.showStatus('Resetting...', 'info');

        try {
            const response = await fetch('/.netlify/functions/config-manager?action=reset', {
                method: 'POST'
            });
            const result = await response.json();

            if (result.success) {
                this.config = result.data;
                this.renderAll();
                this.unsavedChanges = false;
                document.getElementById('saveAllBtn').textContent = '💾 Save All';
                this.showStatus('Settings reset to defaults', 'success');
                await this.loadHistory();
            }
        } catch (error) {
            this.showStatus('Failed to reset: ' + error.message, 'error');
        }
    },

    /**
     * Show status message
     */
    showStatus(message, type = 'info') {
        const bar = document.getElementById('statusBar');
        const msg = document.getElementById('statusMessage');
        
        bar.className = `status-bar ${type}`;
        msg.textContent = message;
        
        if (type === 'success') {
            setTimeout(() => this.hideStatus(), 3000);
        }
    },

    /**
     * Hide status message
     */
    hideStatus() {
        document.getElementById('statusBar').classList.add('hidden');
    },

    /**
     * Load scanner stats
     */
    async loadScannerStats() {
        try {
            // Get pages index
            const response = await fetch('/.netlify/functions/page-scanner?action=issues&limit=50');
            const result = await response.json();
            
            if (result.success && result.data) {
                const pages = result.data.pages || [];
                const totalScanned = pages.length;
                const avgScore = totalScanned > 0 
                    ? Math.round(pages.reduce((sum, p) => sum + (p.seoScore || 0), 0) / totalScanned)
                    : 0;
                const issuesCount = pages.filter(p => p.seoScore < 80).length;

                document.getElementById('scannerPagesScanned').textContent = totalScanned;
                document.getElementById('scannerIssues').textContent = issuesCount;
                document.getElementById('scannerAvgScore').textContent = avgScore + '/100';
                document.getElementById('scannerLastScan').textContent = 'Ready';
            }
        } catch (e) {
            console.error('Error loading scanner stats:', e);
        }
    },

    /**
     * Run initial scan with progress
     */
    async runInitialScan() {
        const btn = document.getElementById('runInitialScan');
        const resultsContainer = document.getElementById('scannerResults');
        
        btn.disabled = true;
        btn.textContent = '⏳ Scanning 0/50...';
        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '<div class="scan-progress"><p>🔍 Starting scan...</p><div class="progress-bar"><div class="progress-fill" id="scanProgress" style="width: 0%"></div></div><div id="scanLog" class="scan-log"></div></div>';
        
        const scanLog = document.getElementById('scanLog');
        const progressBar = document.getElementById('scanProgress');
        
        try {
            // Scan in batches of 10 to show progress
            const batchSize = 10;
            const totalBatches = 5; // 50 pages total
            let totalScanned = 0;
            let totalSuccess = 0;
            let allPages = [];

            for (let batch = 0; batch < totalBatches; batch++) {
                const progress = Math.round((batch / totalBatches) * 100);
                progressBar.style.width = progress + '%';
                btn.textContent = `⏳ Scanning ${batch * batchSize}/${totalBatches * batchSize}...`;
                
                scanLog.innerHTML += `<p>📄 Scanning batch ${batch + 1}/${totalBatches}...</p>`;
                scanLog.scrollTop = scanLog.scrollHeight;

                const response = await fetch(`/.netlify/functions/page-scanner?action=initial&limit=${batchSize}`);
                const result = await response.json();

                if (result.success && result.data) {
                    const data = result.data;
                    totalScanned += data.scanned || 0;
                    totalSuccess += data.success || 0;
                    
                    if (data.pages) {
                        allPages = [...allPages, ...data.pages];
                    }

                    if (data.skipped > 0 && data.scanned === 0) {
                        scanLog.innerHTML += `<p>✅ All pages in batch already scanned (${data.skipped} skipped)</p>`;
                    } else {
                        scanLog.innerHTML += `<p>✅ Batch ${batch + 1}: ${data.success} scanned, ${data.skipped || 0} skipped</p>`;
                    }
                    
                    // If all pages are already scanned, stop
                    if (data.message && data.message.includes('already scanned')) {
                        scanLog.innerHTML += `<p>🎉 All key pages already scanned!</p>`;
                        break;
                    }
                } else {
                    scanLog.innerHTML += `<p>⚠️ Batch ${batch + 1} failed</p>`;
                }
                
                scanLog.scrollTop = scanLog.scrollHeight;
                
                // Small delay between batches
                await new Promise(r => setTimeout(r, 500));
            }

            progressBar.style.width = '100%';
            
            // Show results
            document.getElementById('scannerPagesScanned').textContent = totalSuccess;
            document.getElementById('scannerLastScan').textContent = 'Just now';
            
            // Show scanned pages in paginated view
            this.showScanResults(allPages);
            
            this.showStatus(`Scanned ${totalSuccess} pages!`, 'success');
            await this.loadScannerStats();
            
        } catch (error) {
            scanLog.innerHTML += `<p>❌ Error: ${error.message}</p>`;
            this.showStatus('Scan failed: ' + error.message, 'error');
        }

        btn.disabled = false;
        btn.textContent = '📊 Scan Key Pages (50)';
    },

    /**
     * Show scan results in paginated view
     */
    showScanResults(pages) {
        const resultsContainer = document.getElementById('scannerResults');
        
        if (!pages || pages.length === 0) {
            resultsContainer.innerHTML += '<p class="scan-complete">No new pages scanned. All pages are up to date!</p>';
            return;
        }

        // Store pages for pagination
        this.scanResultPages = pages.sort((a, b) => (a.score || 0) - (b.score || 0));
        this.scanResultPage = 1;
        this.scanResultsPerPage = 10;
        
        this.renderScanResultsPage();
    },

    /**
     * Render current page of scan results
     */
    renderScanResultsPage() {
        const pages = this.scanResultPages || [];
        const currentPage = this.scanResultPage || 1;
        const perPage = this.scanResultsPerPage || 10;
        const totalPages = Math.ceil(pages.length / perPage);
        
        const start = (currentPage - 1) * perPage;
        const end = start + perPage;
        const pageItems = pages.slice(start, end);
        
        let html = `<h4>📋 Scan Results (${pages.length} pages)</h4>`;
        html += '<div class="scan-results-list paginated">';
        
        pageItems.forEach((page, idx) => {
            const scoreClass = page.score < 50 ? 'low' : page.score < 80 ? 'medium' : 'high';
            const grade = page.score >= 90 ? 'A' : page.score >= 80 ? 'B' : page.score >= 70 ? 'C' : page.score >= 60 ? 'D' : 'F';
            html += `
                <div class="scan-result-item">
                    <span class="result-rank">${start + idx + 1}</span>
                    <span class="result-score ${scoreClass}">${page.score || 0}<small>${grade}</small></span>
                    <span class="result-path" title="${page.path}">${this.truncatePath(page.path, 60)}</span>
                </div>
            `;
        });
        
        html += '</div>';
        
        // Pagination
        if (totalPages > 1) {
            html += '<div class="pagination">';
            html += `<button class="page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="SettingsUI.goToScanPage(${currentPage - 1})">← Prev</button>`;
            html += `<span class="page-info">Page ${currentPage} of ${totalPages}</span>`;
            html += `<button class="page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="SettingsUI.goToScanPage(${currentPage + 1})">Next →</button>`;
            html += '</div>';
        }
        
        // Find existing results section or append
        const existingResults = document.querySelector('.scan-results-list.paginated')?.parentElement;
        if (existingResults) {
            existingResults.outerHTML = `<div class="scan-results-wrapper">${html}</div>`;
        } else {
            document.getElementById('scannerResults').innerHTML += `<div class="scan-results-wrapper">${html}</div>`;
        }
    },

    /**
     * Go to specific scan results page
     */
    goToScanPage(page) {
        this.scanResultPage = page;
        this.renderScanResultsPage();
    },

    /**
     * Truncate long paths for display
     */
    truncatePath(path, maxLen) {
        if (path.length <= maxLen) return path;
        const start = path.substring(0, 20);
        const end = path.substring(path.length - (maxLen - 23));
        return `${start}...${end}`;
    },

    /**
     * View pages with issues
     */
    async viewIssues() {
        const resultsContainer = document.getElementById('scannerResults');
        resultsContainer.classList.remove('hidden');
        resultsContainer.innerHTML = '<p>Loading issues...</p>';

        try {
            const response = await fetch('/.netlify/functions/page-scanner?action=issues&limit=50');
            const result = await response.json();

            if (result.success && result.data.pages) {
                const pages = result.data.pages;
                
                if (pages.length === 0) {
                    resultsContainer.innerHTML = '<p>✅ No issues found! All scanned pages look good.</p>';
                    return;
                }

                resultsContainer.innerHTML = pages.map(page => {
                    const scoreClass = page.seoScore < 50 ? 'low' : page.seoScore < 80 ? 'medium' : 'high';
                    const itemClass = page.seoScore < 50 ? '' : page.seoScore < 80 ? 'warning' : 'minor';
                    
                    return `
                        <div class="issue-item ${itemClass}">
                            <span class="issue-score ${scoreClass}">${page.seoScore}</span>
                            <div class="issue-content">
                                <div class="issue-path">${page.path}</div>
                                <div class="issue-details">${page.title || 'No title'}</div>
                                <div class="issue-list">
                                    ${(page.issues || []).map(i => `<span class="issue-tag">${i.type}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        } catch (error) {
            resultsContainer.innerHTML = `<p class="error">Error: ${error.message}</p>`;
        }
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => SettingsUI.init());
