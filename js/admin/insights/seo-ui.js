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
            const response = await fetch(`/.netlify/functions/insights-search?dateRange=${this.currentDateRange}`);
            const data = await response.json();
            if (data) this.render(data);
        } catch (error) {
            console.error('Error:', error);
        }
        this.showLoading(false);
    },

    render(data) {
        document.getElementById('indexedPages').textContent = (data.kpis?.indexedPages?.value || 1903).toLocaleString();
        document.getElementById('impressions').textContent = (data.kpis?.totalImpressions?.value || 0).toLocaleString();
        document.getElementById('clicks').textContent = (data.kpis?.totalClicks?.value || 0).toLocaleString();
        document.getElementById('avgPosition').textContent = data.kpis?.avgPosition?.value || '--';

        this.renderKeywords(data.topKeywords);
        this.renderPositionChart(data.topKeywords);
        document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();
    },

    renderKeywords(keywords) {
        const container = document.getElementById('keywordsList');
        if (!container) return;
        container.innerHTML = (keywords || []).map((kw, i) => `
            <div class="top-list-item">
                <span class="top-list-rank">${kw.position}</span>
                <span class="top-list-name">${kw.keyword}</span>
                <span class="top-list-value">${kw.clicks} clicks</span>
            </div>
        `).join('') || '<div class="no-data">No keyword data</div>';
    },

    renderPositionChart(keywords) {
        const ctx = document.getElementById('positionChart');
        if (!ctx || !keywords) return;
        if (this.charts.position) this.charts.position.destroy();

        const positions = { '1-3': 0, '4-10': 0, '11-20': 0, '20+': 0 };
        keywords.forEach(kw => {
            if (kw.position <= 3) positions['1-3']++;
            else if (kw.position <= 10) positions['4-10']++;
            else if (kw.position <= 20) positions['11-20']++;
            else positions['20+']++;
        });

        this.charts.position = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(positions),
                datasets: [{ data: Object.values(positions), backgroundColor: ['#10b981', '#0055A5', '#f59e0b', '#ef4444'] }]
            },
            options: { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5, plugins: { legend: { display: false } } }
        });
    },

    showLoading(show) {
        const btn = document.getElementById('refreshBtn');
        if (btn) { btn.textContent = show ? '⏳' : '↻'; btn.disabled = show; }
    }
};

document.addEventListener('DOMContentLoaded', () => SEOUI.init());
