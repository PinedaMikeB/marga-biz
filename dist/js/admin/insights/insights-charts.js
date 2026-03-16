/**
 * Marga Insights - Charts Module
 * Handles Chart.js visualizations
 */

const InsightsCharts = {
    charts: {},
    
    /**
     * Initialize traffic over time line chart
     */
    initTrafficChart(labels, data) {
        const ctx = document.getElementById('trafficChart');
        if (!ctx) return;
        
        // Destroy existing chart if any
        if (this.charts.traffic) {
            this.charts.traffic.destroy();
        }
        
        this.charts.traffic = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Visitors',
                    data: data,
                    borderColor: '#0055A5',
                    backgroundColor: 'rgba(0, 85, 165, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: '#f3f4f6' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    },
    

    /**
     * Initialize traffic sources pie chart
     */
    initSourcesChart(labels, data) {
        const ctx = document.getElementById('sourcesChart');
        if (!ctx) return;
        
        if (this.charts.sources) {
            this.charts.sources.destroy();
        }
        
        this.charts.sources = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#0055A5',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                }
            }
        });
    },
    
    /**
     * Destroy all charts (for cleanup)
     */
    destroyAll() {
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};
    }
};
