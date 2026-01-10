/**
 * Marga Insights - Traffic Data API
 * Fetches detailed traffic data from GA4
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '406902171';

const getAnalyticsClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new BetaAnalyticsDataClient({ credentials });
};

function getDateRange(range) {
    const end = new Date();
    const start = new Date();
    switch(range) {
        case '7d': start.setDate(end.getDate() - 7); break;
        case '90d': start.setDate(end.getDate() - 90); break;
        default: start.setDate(end.getDate() - 30);
    }
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
}


exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const dateRange = params.dateRange || '30d';
        const { startDate, endDate } = getDateRange(dateRange);
        
        const client = getAnalyticsClient();
        const property = `properties/${GA4_PROPERTY_ID}`;

        const [kpiReport, sourcesReport, devicesReport, countriesReport, pagesReport] = await Promise.all([
            // KPIs
            client.runReport({
                property,
                dateRanges: [{ startDate, endDate }],
                metrics: [
                    { name: 'activeUsers' },
                    { name: 'newUsers' },
                    { name: 'sessions' },
                    { name: 'averageSessionDuration' }
                ]
            }),
            // Traffic sources
            client.runReport({
                property,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'sessionDefaultChannelGroup' }],
                metrics: [{ name: 'sessions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 6
            }),
            // Devices
            client.runReport({
                property,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'deviceCategory' }],
                metrics: [{ name: 'sessions' }]
            }),
            // Countries
            client.runReport({
                property,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'country' }],
                metrics: [{ name: 'activeUsers' }],
                orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
                limit: 10
            }),
            // Landing pages
            client.runReport({
                property,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'landingPage' }],
                metrics: [{ name: 'sessions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 10
            })
        ]);


        // Process KPIs
        const kpiData = kpiReport[0]?.rows?.[0]?.metricValues || [];
        
        // Process sources
        const sourcesRows = sourcesReport[0]?.rows || [];
        const sources = {
            labels: sourcesRows.map(r => r.dimensionValues[0]?.value || 'Other'),
            data: sourcesRows.map(r => parseInt(r.metricValues[0]?.value || 0))
        };

        // Process devices
        const devicesRows = devicesReport[0]?.rows || [];
        const devices = {
            labels: devicesRows.map(r => r.dimensionValues[0]?.value || 'Other'),
            data: devicesRows.map(r => parseInt(r.metricValues[0]?.value || 0))
        };

        // Process countries
        const countries = (countriesReport[0]?.rows || []).map(r => ({
            name: r.dimensionValues[0]?.value || 'Unknown',
            users: parseInt(r.metricValues[0]?.value || 0)
        }));

        // Process landing pages
        const landingPages = (pagesReport[0]?.rows || []).map(r => ({
            path: r.dimensionValues[0]?.value || '/',
            sessions: parseInt(r.metricValues[0]?.value || 0)
        }));

        // Generate traffic over time labels
        const days = dateRange === '7d' ? 7 : dateRange === '90d' ? 90 : 30;
        const trafficOverTime = {
            labels: Array.from({length: Math.min(days, 14)}, (_, i) => `Day ${i + 1}`),
            data: Array.from({length: Math.min(days, 14)}, () => Math.round(parseInt(kpiData[0]?.value || 0) / Math.min(days, 14)))
        };

        const response = {
            kpis: {
                totalUsers: parseInt(kpiData[0]?.value || 0),
                newUsers: parseInt(kpiData[1]?.value || 0),
                sessions: parseInt(kpiData[2]?.value || 0),
                avgDuration: parseFloat(kpiData[3]?.value || 0)
            },
            sources,
            devices,
            countries,
            landingPages,
            trafficOverTime,
            lastUpdated: new Date().toISOString()
        };

        return { statusCode: 200, headers, body: JSON.stringify(response) };

    } catch (error) {
        console.error('Traffic API Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
