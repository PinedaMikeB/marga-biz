/**
 * Marga Insights - Behavior Tab UI
 */

const BehaviorUI = {
    currentDateRange: '30d',
    charts: {},

    async init() {
        console.log('Initializing Behavior Analysis...');
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
            const response = await fetch(`/.netlify/functions/insights-behavior?dateRange=${this.currentDateRange}`);
            const data = await response.json();
            if (data) this.render(data);
        } catch (error) {
            console.error('Error:', error);
        }
        this.showLoading(false);
    },

    render(data) {
        // KPIs
        document.getElementById('quoteClicks').textContent = data.events?.quote || 0;
        document.getElementById('phoneClicks').textContent = data.events?.phone || 0;
        document.getElementById('emailClicks').textContent = data.events?.email || 0;
        document.getElementById('internalClicks').textContent = data.events?.internal || 0;

        // Scroll depth chart
        this.renderScrollChart(data.scrollDepth);
        
        // Events breakdown
        this.renderEventsChart(data.events);
        
        // Clicked pages
        this.renderClickedPages(data.clickedPages);
        
        document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();
    },


    renderScrollChart(scrollData) {
        const ctx = document.getElementById('scrollChart');
        if (!ctx) return;
        if (this.charts.scroll) this.charts.scroll.destroy();

        this.charts.scroll = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['25%', '50%', '75%', '100%'],
                datasets: [{
                    label: 'Users',
                    data: scrollData || [0, 0, 0, 0],
                    backgroundColor: ['#10b981', '#0055A5', '#f59e0b', '#ef4444']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: { legend: { display: false } }
            }
        });
    },

    renderEventsChart(events) {
        const ctx = document.getElementById('eventsChart');
        if (!ctx || !events) return;
        if (this.charts.events) this.charts.events.destroy();

        this.charts.events = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Quote Clicks', 'Phone Clicks', 'Email Clicks', 'Internal Links'],
                datasets: [{
                    data: [events.quote || 0, events.phone || 0, events.email || 0, events.internal || 0],
                    backgroundColor: ['#0055A5', '#10b981', '#f59e0b', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5 }
        });
    },

    renderClickedPages(pages) {
        const container = document.getElementById('clickedPagesList');
        if (!container) return;
        container.innerHTML = (pages || []).slice(0, 10).map((p, i) => `
            <div class="top-list-item">
                <span class="top-list-rank">${i + 1}</span>
                <span class="top-list-name">${p.page}</span>
                <span class="top-list-value">${p.clicks}</span>
            </div>
        `).join('') || '<div class="no-data">No click data yet</div>';
    },

    showLoading(show) {
        const btn = document.getElementById('refreshBtn');
        if (btn) { btn.textContent = show ? '⏳' : '↻'; btn.disabled = show; }
    }
};

document.addEventListener('DOMContentLoaded', () => BehaviorUI.init());
