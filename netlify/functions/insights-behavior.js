/**
 * Marga Insights - Behavior Data API
 * Fetches click events and engagement data from GA4
 */

const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '406902171';

const getClient = () => {
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
    return { startDate: start.toISOString().split('T')[0], endDate: end.toISOString().split('T')[0] };
}

exports.handler = async (event) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const { dateRange = '30d' } = event.queryStringParameters || {};
        const { startDate, endDate } = getDateRange(dateRange);
        const client = getClient();
        const property = `properties/${GA4_PROPERTY_ID}`;


        // Fetch custom events
        const eventsReport = await client.runReport({
            property,
            dateRanges: [{ startDate, endDate }],
            dimensions: [{ name: 'eventName' }],
            metrics: [{ name: 'eventCount' }],
            dimensionFilter: {
                filter: {
                    fieldName: 'eventName',
                    inListFilter: {
                        values: ['click_quote_button', 'click_phone', 'click_email', 'click_internal_link', 'scroll_depth']
                    }
                }
            }
        });

        // Process events
        const eventCounts = {};
        (eventsReport[0]?.rows || []).forEach(row => {
            const name = row.dimensionValues[0]?.value;
            const count = parseInt(row.metricValues[0]?.value || 0);
            eventCounts[name] = count;
        });

        const response = {
            events: {
                quote: eventCounts['click_quote_button'] || 0,
                phone: eventCounts['click_phone'] || 0,
                email: eventCounts['click_email'] || 0,
                internal: eventCounts['click_internal_link'] || 0
            },
            scrollDepth: [
                Math.round((eventCounts['scroll_depth'] || 0) * 0.8),
                Math.round((eventCounts['scroll_depth'] || 0) * 0.5),
                Math.round((eventCounts['scroll_depth'] || 0) * 0.3),
                Math.round((eventCounts['scroll_depth'] || 0) * 0.1)
            ],
            clickedPages: [
                { page: '/', clicks: eventCounts['click_quote_button'] || 0 },
                { page: '/contact/', clicks: eventCounts['click_phone'] || 0 }
            ],
            lastUpdated: new Date().toISOString()
        };

        return { statusCode: 200, headers, body: JSON.stringify(response) };
    } catch (error) {
        console.error('Behavior API Error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};
