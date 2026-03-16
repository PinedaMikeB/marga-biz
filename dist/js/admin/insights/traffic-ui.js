/**
 * Marga Insights - Traffic Tab UI
 */

const TrafficUI = {
    currentDateRange: '30d',
    charts: {},

    async init() {
        console.log('Initializing Traffic Analysis...');
        this.setupEventListeners();
        await this.loadData();
    },

    setupEventListeners() {
        const dateSelect = document.getElementById('dateRange');
        if (dateSelect) {
            dateSelect.addEventListener('change', (e) => {
                this.currentDateRange = e.target.value;
                this.loadData();
            });
        }

        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadData());
        }
    },

    async loadData() {
        this.showLoading(true);
        
        try {
            const response = await fetch(`/.netlify/functions/insights-traffic?dateRange=${this.currentDateRange}`);
            const data = await response.json();
            
            if (data) {
                this.renderKPIs(data);
                this.renderTrafficChart(data.trafficOverTime);
                this.renderSourcesChart(data.sources);
                this.renderDevicesChart(data.devices);
                this.renderCountries(data.countries);
                this.renderLandingPages(data.landingPages);
                this.updateLastUpdated(data.lastUpdated);
            }
        } catch (error) {
            console.error('Error loading traffic data:', error);
        }
        
        this.showLoading(false);
    },


    renderKPIs(data) {
        document.getElementById('totalUsers').textContent = this.formatNumber(data.kpis?.totalUsers || 0);
        document.getElementById('newUsers').textContent = this.formatNumber(data.kpis?.newUsers || 0);
        document.getElementById('sessions').textContent = this.formatNumber(data.kpis?.sessions || 0);
        document.getElementById('avgDuration').textContent = this.formatDuration(data.kpis?.avgDuration || 0);
    },

    renderTrafficChart(trafficData) {
        const ctx = document.getElementById('trafficTimeChart');
        if (!ctx || !trafficData) return;

        if (this.charts.traffic) this.charts.traffic.destroy();

        this.charts.traffic = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trafficData.labels || [],
                datasets: [{
                    label: 'Users',
                    data: trafficData.data || [],
                    borderColor: '#0055A5',
                    backgroundColor: 'rgba(0, 85, 165, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: { legend: { display: false } }
            }
        });
    },

    renderSourcesChart(sources) {
        const ctx = document.getElementById('sourcesChart');
        if (!ctx || !sources) return;

        if (this.charts.sources) this.charts.sources.destroy();

        this.charts.sources = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: sources.labels || [],
                datasets: [{
                    data: sources.data || [],
                    backgroundColor: ['#0055A5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5
            }
        });
    },


    renderDevicesChart(devices) {
        const ctx = document.getElementById('devicesChart');
        if (!ctx || !devices) return;

        if (this.charts.devices) this.charts.devices.destroy();

        this.charts.devices = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: devices.labels || [],
                datasets: [{
                    data: devices.data || [],
                    backgroundColor: ['#0055A5', '#10b981', '#f59e0b']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5
            }
        });
    },

    renderCountries(countries) {
        const container = document.getElementById('countriesList');
        if (!container || !countries) return;

        container.innerHTML = countries.slice(0, 10).map((country, i) => `
            <div class="top-list-item">
                <span class="top-list-rank">${i + 1}</span>
                <span class="top-list-name">${country.name}</span>
                <span class="top-list-value">${this.formatNumber(country.users)}</span>
            </div>
        `).join('') || '<div class="no-data">No data available</div>';
    },

    renderLandingPages(pages) {
        const container = document.getElementById('landingPagesList');
        if (!container || !pages) return;

        container.innerHTML = pages.slice(0, 10).map((page, i) => `
            <div class="top-list-item">
                <span class="top-list-rank">${i + 1}</span>
                <span class="top-list-name" title="${page.path}">${page.path}</span>
                <span class="top-list-value">${this.formatNumber(page.sessions)}</span>
            </div>
        `).join('') || '<div class="no-data">No data available</div>';
    },


    updateLastUpdated(timestamp) {
        const el = document.getElementById('lastUpdated');
        if (el && timestamp) {
            el.textContent = new Date(timestamp).toLocaleString();
        }
    },

    showLoading(show) {
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            btn.textContent = show ? '⏳' : '↻';
            btn.disabled = show;
        }
    },

    formatNumber(num) {
        return num?.toLocaleString() || '--';
    },

    formatDuration(seconds) {
        if (!seconds) return '--';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}m ${secs}s`;
    }
};

document.addEventListener('DOMContentLoaded', () => TrafficUI.init());
