/**
 * Marga Insights - API Module
 * Handles all data fetching from Netlify Functions
 */

const InsightsAPI = {
    baseUrl: '/.netlify/functions',
    
    /**
     * Fetch GA4 analytics data
     */
    async getAnalytics(dateRange = '30d') {
        try {
            const response = await fetch(`${this.baseUrl}/insights-ga4?dateRange=${dateRange}`);
            if (!response.ok) throw new Error('Failed to fetch analytics');
            return await response.json();
        } catch (error) {
            console.error('Analytics API Error:', error);
            return null;
        }
    },
    
    /**
     * Fetch Search Console data
     */
    async getSearchConsole(dateRange = '30d') {
        try {
            const response = await fetch(`${this.baseUrl}/insights-search?dateRange=${dateRange}`);
            if (!response.ok) throw new Error('Failed to fetch search data');
            return await response.json();
        } catch (error) {
            console.error('Search Console API Error:', error);
            return null;
        }
    },
    
    /**
     * Fetch combined dashboard data
     */
    async getDashboardData(dateRange = '30d') {
        try {
            const response = await fetch(`${this.baseUrl}/insights-combined?dateRange=${dateRange}`);
            if (!response.ok) throw new Error('Failed to fetch dashboard data');
            return await response.json();
        } catch (error) {
            console.error('Dashboard API Error:', error);
            return this.getMockData();
        }
    },
    
    /**
     * Fetch AI SEO Analysis
     * @param {boolean} forceRefresh - Force new analysis instead of cached
     */
    async getAIAnalysis(forceRefresh = false) {
        try {
            const url = forceRefresh 
                ? `${this.baseUrl}/insights-ai?refresh=true`
                : `${this.baseUrl}/insights-ai`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch AI analysis');
            return await response.json();
        } catch (error) {
            console.error('AI Analysis API Error:', error);
            return null;
        }
    },

    /**
     * Mock data for development/demo when API is not ready
     */
    getMockData() {
        return {
            kpis: {
                visitors: { value: 1234, trend: 12, trendDirection: 'up' },
                pageViews: { value: 5678, trend: 8, trendDirection: 'up' },
                clicks: { value: 89, trend: 23, trendDirection: 'up' },
                indexedPages: { value: 1903, trend: 0, trendDirection: 'neutral' }
            },
            trafficOverTime: {
                labels: ['Jan 4', 'Jan 5', 'Jan 6', 'Jan 7', 'Jan 8', 'Jan 9', 'Jan 10'],
                data: [145, 132, 178, 156, 189, 201, 167]
            },
            topPages: [
                { path: '/', views: 1245 },
                { path: '/contact/', views: 456 },
                { path: '/pricing-guide/', views: 389 },
                { path: '/copier-rental/copier-for-rent/', views: 267 },
                { path: '/printer-rental/', views: 234 },
                { path: '/blogs/', views: 198 },
                { path: '/about/', views: 156 },
                { path: '/printer-rental/print-all-you-can/', views: 134 }
            ],
            trafficSources: {
                labels: ['Organic Search', 'Direct', 'Referral', 'Social'],
                data: [65, 20, 10, 5]
            },
            topKeywords: [
                { keyword: 'copier rental philippines', position: 2, clicks: 234, impressions: 4500 },
                { keyword: 'printer rental manila', position: 3, clicks: 189, impressions: 3200 },
                { keyword: 'copier for rent', position: 4, clicks: 156, impressions: 2800 },
                { keyword: 'print all you can rental', position: 5, clicks: 98, impressions: 1900 },
                { keyword: 'office printer rental', position: 6, clicks: 87, impressions: 1700 }
            ],
            lastUpdated: new Date().toISOString()
        };
    },

    /**
     * Mock AI analysis for development
     */
    getMockAIAnalysis() {
        return {
            success: true,
            data: {
                date: new Date().toISOString().split('T')[0],
                cached: false,
                analysis: {
                    trafficAnalysis: "Traffic is stable with slight growth. Organic search remains the dominant source at 65%, indicating strong SEO foundation. The #2 ranking for 'printer rental philippines' continues to drive consistent traffic.",
                    alerts: [
                        { type: 'success', message: 'Maintained #2 position for "printer rental philippines"' },
                        { type: 'info', message: 'Traffic up 12% week-over-week' }
                    ],
                    contentGaps: [
                        { keyword: 'copier maintenance tips', reason: 'High search volume, no dedicated page' },
                        { keyword: 'printer rental rates manila', reason: 'Competitor content opportunity' }
                    ],
                    recommendations: [
                        { priority: 'high', action: 'Create FAQ page for common rental questions', impact: 'Capture long-tail keywords' },
                        { priority: 'medium', action: 'Add customer testimonials to homepage', impact: 'Improve trust signals' }
                    ],
                    summary: 'SEO performance is healthy with opportunities to expand content for long-tail keywords.'
                }
            }
        };
    },

    /**
     * Fetch API usage and billing data
     */
    async getAPIUsage(days = 30) {
        try {
            const response = await fetch(`${this.baseUrl}/api-usage?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch API usage');
            return await response.json();
        } catch (error) {
            console.error('API Usage Error:', error);
            return null;
        }
    }
};
