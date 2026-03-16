/**
 * Marga Insights - Conversions Tab UI
 */
const ConversionsUI = {
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
            const response = await fetch(`/.netlify/functions/insights-behavior?dateRange=${this.currentDateRange}`);
            const data = await response.json();
            if (data) this.render(data);
        } catch (error) {
            console.error('Error:', error);
        }
        this.showLoading(false);
    },

    render(data) {
        const quote = data.events?.quote || 0;
        const phone = data.events?.phone || 0;
        const email = data.events?.email || 0;
        const total = quote + phone + email;

        document.getElementById('totalLeads').textContent = total;
        document.getElementById('quoteRequests').textContent = quote;
        document.getElementById('phoneCalls').textContent = phone;
        document.getElementById('emailLeads').textContent = email;

        this.renderConversionsChart([quote, phone, email]);
        this.renderSourcesChart(data.events);
        this.renderConvertingPages();
        document.getElementById('lastUpdated').textContent = new Date(data.lastUpdated).toLocaleString();
    },

    renderConversionsChart(data) {
        const ctx = document.getElementById('conversionsChart');
        if (!ctx) return;
        if (this.charts.conversions) this.charts.conversions.destroy();

        this.charts.conversions = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Quote Requests', 'Phone Clicks', 'Email Clicks'],
                datasets: [{ data, backgroundColor: ['#0055A5', '#10b981', '#f59e0b'] }]
            },
            options: { responsive: true, maintainAspectRatio: true, aspectRatio: 2, plugins: { legend: { display: false } } }
        });
    },

    renderSourcesChart(events) {
        const ctx = document.getElementById('sourcesChart');
        if (!ctx) return;
        if (this.charts.sources) this.charts.sources.destroy();

        this.charts.sources = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Quote Button', 'Phone', 'Email'],
                datasets: [{ data: [events?.quote || 0, events?.phone || 0, events?.email || 0], backgroundColor: ['#0055A5', '#10b981', '#f59e0b'] }]
            },
            options: { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5 }
        });
    },

    renderConvertingPages() {
        const container = document.getElementById('convertingPagesList');
        if (!container) return;
        container.innerHTML = `
            <div class="top-list-item"><span class="top-list-rank">1</span><span class="top-list-name">/</span><span class="top-list-value">Homepage</span></div>
            <div class="top-list-item"><span class="top-list-rank">2</span><span class="top-list-name">/contact/</span><span class="top-list-value">Contact</span></div>
            <div class="top-list-item"><span class="top-list-rank">3</span><span class="top-list-name">/pricing-guide/</span><span class="top-list-value">Pricing</span></div>
        `;
    },

    showLoading(show) {
        const btn = document.getElementById('refreshBtn');
        if (btn) { btn.textContent = show ? '⏳' : '↻'; btn.disabled = show; }
    }
};

document.addEventListener('DOMContentLoaded', () => ConversionsUI.init());
