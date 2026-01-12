/**
 * Marga Insights - AI Analysis UI Component
 * Displays AI-powered SEO recommendations
 */

const AIInsightsUI = {
    container: null,
    isLoading: false,

    /**
     * Initialize the AI Insights section
     */
    init(containerId = 'aiInsightsSection') {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn('AI Insights container not found');
            return;
        }
        this.load();
    },

    /**
     * Load AI analysis data
     */
    async load(forceRefresh = false) {
        if (this.isLoading) return;
        this.isLoading = true;
        this.showLoading();

        try {
            const result = await InsightsAPI.getAIAnalysis(forceRefresh);
            
            if (result && result.success && result.data) {
                this.render(result.data);
            } else if (result && result.error) {
                this.showError(result.error);
            } else {
                // Use mock data for demo
                const mock = InsightsAPI.getMockAIAnalysis();
                this.render(mock.data);
            }
        } catch (error) {
            console.error('AI Insights Error:', error);
            this.showError('Failed to load AI analysis');
        }

        this.isLoading = false;
    },

    /**
     * Render the AI analysis
     */
    render(data) {
        if (!this.container) return;
        const analysis = data.analysis;
        const cached = data.cached;
        const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'Unknown';

        this.container.innerHTML = `
            <div class="ai-insights-card">
                <div class="ai-header">
                    <h3>🤖 AI SEO Analysis</h3>
                    <div class="ai-meta">
                        ${cached ? '<span class="cache-badge">Cached</span>' : ''}
                        <button class="btn-refresh-ai" onclick="AIInsightsUI.load(true)" title="Refresh Analysis">↻</button>
                    </div>
                </div>

                <div class="ai-summary">
                    <p>${analysis.summary || 'No summary available'}</p>
                </div>

                ${this.renderAlerts(analysis.alerts)}
                
                <div class="ai-analysis-text">
                    <h4>📊 Traffic Analysis</h4>
                    <p>${analysis.trafficAnalysis || 'No traffic analysis available'}</p>
                </div>

                ${this.renderContentGaps(analysis.contentGaps)}
                ${this.renderRecommendations(analysis.recommendations)}

                <div class="ai-footer">
                    <small>Last analyzed: ${timestamp}</small>
                </div>
            </div>
        `;
    },

    /**
     * Render alerts section
     */
    renderAlerts(alerts) {
        if (!alerts || alerts.length === 0) return '';
        
        return `
            <div class="ai-alerts">
                ${alerts.map(alert => `
                    <div class="alert alert-${alert.type}">
                        <span class="alert-icon">${this.getAlertIcon(alert.type)}</span>
                        <span class="alert-message">${alert.message}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Get icon for alert type
     */
    getAlertIcon(type) {
        const icons = {
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️',
            error: '❌'
        };
        return icons[type] || 'ℹ️';
    },

    /**
     * Render content gaps section
     */
    renderContentGaps(gaps) {
        if (!gaps || gaps.length === 0) return '';

        return `
            <div class="ai-section">
                <h4>🎯 Content Opportunities</h4>
                <div class="content-gaps-list">
                    ${gaps.map(gap => `
                        <div class="content-gap-item">
                            <span class="gap-keyword">"${gap.keyword}"</span>
                            <span class="gap-reason">${gap.reason}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },


    /**
     * Render recommendations section
     */
    renderRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) return '';

        const priorityColors = {
            high: '#ef4444',
            medium: '#f59e0b',
            low: '#10b981'
        };

        return `
            <div class="ai-section">
                <h4>💡 Recommendations</h4>
                <div class="recommendations-list">
                    ${recommendations.map(rec => `
                        <div class="recommendation-item">
                            <span class="priority-badge" style="background:${priorityColors[rec.priority] || '#6b7280'}">${rec.priority}</span>
                            <div class="rec-content">
                                <span class="rec-action">${rec.action}</span>
                                <span class="rec-impact">Impact: ${rec.impact}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    /**
     * Show loading state
     */
    showLoading() {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="ai-insights-card loading">
                <div class="ai-header">
                    <h3>🤖 AI SEO Analysis</h3>
                </div>
                <div class="ai-loading">
                    <div class="spinner"></div>
                    <p>Analyzing your SEO data with Claude AI...</p>
                    <small>This may take 10-15 seconds</small>
                </div>
            </div>
        `;
    },

    /**
     * Show error state
     */
    showError(message) {
        if (!this.container) return;
        this.container.innerHTML = `
            <div class="ai-insights-card error">
                <div class="ai-header">
                    <h3>🤖 AI SEO Analysis</h3>
                    <button class="btn-refresh-ai" onclick="AIInsightsUI.load(true)">↻ Retry</button>
                </div>
                <div class="ai-error">
                    <p>❌ ${message}</p>
                    <small>Click retry to try again, or check back later.</small>
                </div>
            </div>
        `;
    }
};
