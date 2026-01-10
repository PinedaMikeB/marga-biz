/**
 * Marga Insights - GA4 Data Fetcher
 * Netlify Function to fetch Google Analytics 4 data
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');

// Initialize the client with service account credentials
const getAnalyticsClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new BetaAnalyticsDataClient({ credentials });
};

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '406902171';

// Calculate date range
function getDateRange(range) {
    const end = new Date();
    const start = new Date();
    
    switch(range) {
        case '7d':
            start.setDate(end.getDate() - 7);
            break;
        case '90d':
            start.setDate(end.getDate() - 90);
            break;
        case '30d':
        default:
            start.setDate(end.getDate() - 30);
    }
    
    return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0]
    };
}


exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const dateRange = params.dateRange || '30d';
        const { startDate, endDate } = getDateRange(dateRange);
        
        const analyticsClient = getAnalyticsClient();
        const propertyId = `properties/${GA4_PROPERTY_ID}`;

        // Fetch multiple reports in parallel
        const [trafficReport, eventReport, pagesReport, sourcesReport] = await Promise.all([
            // Traffic overview
            analyticsClient.runReport({
                property: propertyId,
                dateRanges: [{ startDate, endDate }],
                metrics: [
                    { name: 'activeUsers' },
                    { name: 'screenPageViews' },
                    { name: 'sessions' },
                    { name: 'averageSessionDuration' },
                    { name: 'bounceRate' }
                ]
            }),
            
            // Event counts (our custom events)
            analyticsClient.runReport({
                property: propertyId,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'eventName' }],
                metrics: [{ name: 'eventCount' }],
                dimensionFilter: {
                    filter: {
                        fieldName: 'eventName',
                        inListFilter: {
                            values: ['click_quote_button', 'click_phone', 'click_email', 'form_submit', 'click_internal_link']
                        }
                    }
                }
            }),


            // Top pages
            analyticsClient.runReport({
                property: propertyId,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'pagePath' }],
                metrics: [{ name: 'screenPageViews' }],
                orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
                limit: 10
            }),
            
            // Traffic sources
            analyticsClient.runReport({
                property: propertyId,
                dateRanges: [{ startDate, endDate }],
                dimensions: [{ name: 'sessionDefaultChannelGroup' }],
                metrics: [{ name: 'sessions' }],
                orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                limit: 5
            })
        ]);

        // Process traffic data
        const trafficData = trafficReport[0]?.rows?.[0]?.metricValues || [];
        const visitors = parseInt(trafficData[0]?.value || 0);
        const pageViews = parseInt(trafficData[1]?.value || 0);
        const sessions = parseInt(trafficData[2]?.value || 0);
        const avgDuration = parseFloat(trafficData[3]?.value || 0);
        const bounceRate = parseFloat(trafficData[4]?.value || 0);

        // Process event data
        let totalClicks = 0;
        const eventRows = eventReport[0]?.rows || [];
        eventRows.forEach(row => {
            totalClicks += parseInt(row.metricValues[0]?.value || 0);
        });


        // Process top pages
        const topPages = (pagesReport[0]?.rows || []).map(row => ({
            path: row.dimensionValues[0]?.value || '/',
            views: parseInt(row.metricValues[0]?.value || 0)
        }));

        // Process traffic sources
        const sourcesData = sourcesReport[0]?.rows || [];
        const trafficSources = {
            labels: sourcesData.map(row => row.dimensionValues[0]?.value || 'Other'),
            data: sourcesData.map(row => parseInt(row.metricValues[0]?.value || 0))
        };

        // Build response
        const response = {
            kpis: {
                visitors: { value: visitors, trend: 0, trendDirection: 'neutral' },
                pageViews: { value: pageViews, trend: 0, trendDirection: 'neutral' },
                clicks: { value: totalClicks, trend: 0, trendDirection: 'neutral' },
                sessions: { value: sessions, trend: 0, trendDirection: 'neutral' },
                avgDuration: { value: Math.round(avgDuration), trend: 0, trendDirection: 'neutral' },
                bounceRate: { value: Math.round(bounceRate * 100), trend: 0, trendDirection: 'neutral' }
            },
            topPages,
            trafficSources,
            dateRange: { startDate, endDate },
            lastUpdated: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('GA4 API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
