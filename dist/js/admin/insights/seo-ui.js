/**
 * Marga Insights - SEO Tab UI
 */
const SEOUI = {
    currentDateRange: '30d',
    charts: {},

    async init() {
        this.setupEventListeners();
        await this.loadData();
    },

    setupEventListeners() {
        document.getElementById('dateRange')?.addEventListener('change', (e) => {
            this.currentDateRange = e.target.value;
            this.loadData();
        });
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.loadData());
    },

    async loadData() {
        this.showLoading(true);
        try {
            // Load Search Console data
            const searchResponse = await fetch(`/.netlify/functions/insights-search?dateRange=${this.currentDateRange}`);
            const searchData = await searchResponse.json();
            
            // Load GA4 data for top pages
            const ga4Response = await fetch(`/.netlify/functions/insights-ga4?dateRange=${this.currentDateRange}`);
            const ga4Data = await ga4Response.json();
            
            if (searchData) this.renderSearchData(searchData);
            if (ga4Data) this.renderTopPages(ga4Data.topPages || []);
            
        } catch (error) {
            console.error('Error loading SEO data:', error);
            this.showError('Failed to load data');
        }
        this.showLoading(false);
    },

    renderSearchData(data) {
        // KPIs
        document.getElementById('indexedPages').textContent = (data.kpis?.indexedPages?.value || 1903).toLocaleString();
        document.getElementById('impressions').textContent = (data.kpis?.totalImpressions?.value || 0).toLocaleString();
        document.getElementById('clicks').textContent = (data.kpis?.totalClicks?.value || 0).toLocaleString();
        document.getElementById('avgPosition').textContent = data.kpis?.avgPosition?.value?.toFixed(1) || '--';

        // Keywords
        this.renderKeywords(data.topKeywords);
        this.renderPositionChart(data.topKeywords);
        
        // Last updated
        if (data.lastUpdated) {
            document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();
        }
    },

    renderKeywords(keywords) {
        const container = document.getElementById('keywordsList');
        if (!container) return;
        
        if (!keywords || keywords.length === 0) {
            container.innerHTML = '<div class="no-data">No keyword data available</div>';
            return;
        }
        
        container.innerHTML = keywords.slice(0, 10).map(kw => `
            <div class="top-list-item">
                <span class="top-list-rank">${kw.position?.toFixed(1) || '--'}</span>
                <span class="top-list-name">${kw.keyword}</span>
                <span class="top-list-value">${kw.clicks} clicks</span>
            </div>
        `).join('');
    },

    renderTopPages(pages) {
        const container = document.getElementById('topPagesList');
        if (!container) return;
        
        if (!pages || pages.length === 0) {
            container.innerHTML = '<div class="no-data">No page data available</div>';
            return;
        }
        
        container.innerHTML = pages.slice(0, 10).map((page, i) => `
            <div class="top-list-item">
                <span class="top-list-rank">${i + 1}</span>
                <span class="top-list-name">${page.path || page.page || 'Unknown'}</span>
                <span class="top-list-value">${page.views || page.sessions || 0} views</span>
            </div>
        `).join('');
    },

    renderPositionChart(keywords) {
        const ctx = document.getElementById('positionChart');
        if (!ctx) return;
        
        if (this.charts.position) {
            this.charts.position.destroy();
        }

        if (!keywords || keywords.length === 0) {
            return;
        }

        const positions = { '1-3': 0, '4-10': 0, '11-20': 0, '20+': 0 };
        keywords.forEach(kw => {
            const pos = kw.position || 100;
            if (pos <= 3) positions['1-3']++;
            else if (pos <= 10) positions['4-10']++;
            else if (pos <= 20) positions['11-20']++;
            else positions['20+']++;
        });

        this.charts.position = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(positions),
                datasets: [{
                    data: Object.values(positions),
                    backgroundColor: ['#10b981', '#0055A5', '#f59e0b', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    },

    showLoading(show) {
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            btn.textContent = show ? '⏳' : '↻';
            btn.disabled = show;
        }
        
        // Show loading in lists
        if (show) {
            const keywordsList = document.getElementById('keywordsList');
            const topPagesList = document.getElementById('topPagesList');
            if (keywordsList) keywordsList.innerHTML = '<div class="loading">Loading...</div>';
            if (topPagesList) topPagesList.innerHTML = '<div class="loading">Loading...</div>';
        }
    },

    showError(message) {
        const keywordsList = document.getElementById('keywordsList');
        const topPagesList = document.getElementById('topPagesList');
        if (keywordsList) keywordsList.innerHTML = `<div class="error">${message}</div>`;
        if (topPagesList) topPagesList.innerHTML = `<div class="error">${message}</div>`;
    }
};

document.addEventListener('DOMContentLoaded', () => SEOUI.init());
