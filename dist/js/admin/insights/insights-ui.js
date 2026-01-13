/**
 * Marga Insights - UI Module
 * Handles dashboard UI interactions and rendering
 */

const InsightsUI = {
    currentDateRange: '30d',
    
    /**
     * Initialize the dashboard
     */
    async init() {
        console.log('Initializing Marga Insights Dashboard...');
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Load initial data
        await this.loadDashboard();
        
        console.log('Dashboard initialized');
    },
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Date range selector
        const dateSelect = document.getElementById('dateRange');
        if (dateSelect) {
            dateSelect.addEventListener('change', (e) => {
                this.currentDateRange = e.target.value;
                this.loadDashboard();
            });
        }
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadDashboard();
            });
        }
    },
    

    /**
     * Load all dashboard data
     */
    async loadDashboard() {
        this.showLoading(true);
        
        try {
            const data = await InsightsAPI.getDashboardData(this.currentDateRange);
            
            if (data) {
                this.renderKPIs(data.kpis);
                this.renderTopPages(data.topPages);
                this.renderTopKeywords(data.topKeywords);
                InsightsCharts.initTrafficChart(data.trafficOverTime.labels, data.trafficOverTime.data);
                InsightsCharts.initSourcesChart(data.trafficSources.labels, data.trafficSources.data);
                this.updateLastUpdated(data.lastUpdated);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
        
        this.showLoading(false);
    },
    
    /**
     * Render KPI cards
     */
    renderKPIs(kpis) {
        if (!kpis) return;
        
        // Visitors
        this.updateKPI('totalVisitors', kpis.visitors.value, kpis.visitors.trend, kpis.visitors.trendDirection);
        
        // Page Views
        this.updateKPI('pageViews', kpis.pageViews.value, kpis.pageViews.trend, kpis.pageViews.trendDirection);
        
        // Clicks
        this.updateKPI('totalClicks', kpis.clicks.value, kpis.clicks.trend, kpis.clicks.trendDirection);
        
        // Indexed Pages
        this.updateKPI('indexedPages', kpis.indexedPages.value, kpis.indexedPages.trend, kpis.indexedPages.trendDirection);
    },
    
    /**
     * Update a single KPI card
     */
    updateKPI(id, value, trend, direction) {
        const valueEl = document.getElementById(id);
        const trendEl = document.getElementById(id.replace('total', '').replace('pageViews', 'pageViews') + 'Trend') 
                        || document.getElementById(id + 'Trend');
        
        if (valueEl) {
            valueEl.textContent = this.formatNumber(value);
        }
        

        // Find the correct trend element
        const parentCard = valueEl?.closest('.kpi-card');
        const actualTrendEl = parentCard?.querySelector('.kpi-trend');
        
        if (actualTrendEl && trend !== undefined) {
            const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '';
            actualTrendEl.textContent = `${arrow} ${Math.abs(trend)}%`;
            actualTrendEl.className = `kpi-trend ${direction}`;
        }
    },
    
    /**
     * Render top pages list
     */
    renderTopPages(pages) {
        const container = document.getElementById('topPagesList');
        if (!container || !pages) return;
        
        container.innerHTML = pages.map((page, index) => `
            <div class="top-list-item">
                <span class="top-list-rank">${index + 1}</span>
                <span class="top-list-name" title="${page.path}">${page.path}</span>
                <span class="top-list-value">${this.formatNumber(page.views)}</span>
            </div>
        `).join('');
    },
    
    /**
     * Render top keywords list
     */
    renderTopKeywords(keywords) {
        const container = document.getElementById('topKeywordsList');
        if (!container || !keywords) return;
        
        container.innerHTML = keywords.map((kw, index) => `
            <div class="top-list-item">
                <span class="top-list-rank">${kw.position}</span>
                <span class="top-list-name" title="${kw.keyword}">${kw.keyword}</span>
                <span class="top-list-value">${this.formatNumber(kw.clicks)} clicks</span>
            </div>
        `).join('');
    },
    

    /**
     * Update last updated timestamp
     */
    updateLastUpdated(timestamp) {
        const el = document.getElementById('lastUpdated');
        if (el) {
            const date = new Date(timestamp);
            el.textContent = date.toLocaleString();
        }
    },
    
    /**
     * Show/hide loading state
     */
    showLoading(show) {
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.textContent = show ? '⏳' : '↻';
            refreshBtn.disabled = show;
        }
    },
    
    /**
     * Format large numbers with commas
     */
    formatNumber(num) {
        if (num === null || num === undefined) return '--';
        return num.toLocaleString();
    },

    /**
     * Load and render API usage data
     */
    async loadAPIUsage() {
        try {
            const result = await InsightsAPI.getAPIUsage(30);
            
            if (result && result.success) {
                const { summary, period } = result.data;
                
                // Update usage cards
                document.getElementById('totalRequests').textContent = this.formatNumber(summary.totalRequests);
                document.getElementById('totalTokens').textContent = this.formatTokens(summary.totalTokens);
                document.getElementById('totalCost').textContent = '$' + summary.totalCost.toFixed(4);
                document.getElementById('projectedCost').textContent = '$' + summary.projectedMonthlyCost.toFixed(2);
                
                // Update period text
                document.getElementById('usagePeriod').textContent = 
                    `Last ${period.days} days (${period.from} to ${period.to})`;
            } else {
                document.getElementById('usagePeriod').textContent = 'No usage data yet. Start using the AI Assistant!';
            }
        } catch (error) {
            console.error('Error loading API usage:', error);
            document.getElementById('usagePeriod').textContent = 'Unable to load usage data';
        }
    },

    /**
     * Format token numbers (e.g., 1.2M, 500K)
     */
    formatTokens(num) {
        if (!num) return '0';
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    InsightsUI.init();
    InsightsUI.loadAPIUsage();
});
