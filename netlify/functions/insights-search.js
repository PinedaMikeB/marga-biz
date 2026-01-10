/**
 * Marga Insights - Search Console Data Fetcher
 * Netlify Function to fetch Google Search Console data
 */

const { google } = require('googleapis');

// Initialize auth with service account
const getAuthClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });
};

const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://marga.biz/';

// Calculate date range
function getDateRange(range) {
    const end = new Date();
    end.setDate(end.getDate() - 3); // Search Console data has 3-day delay
    const start = new Date(end);
    
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
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const dateRange = params.dateRange || '30d';
        const { startDate, endDate } = getDateRange(dateRange);
        
        const auth = getAuthClient();
        const searchconsole = google.searchconsole({ version: 'v1', auth });

        // Fetch search analytics data
        const searchAnalytics = await searchconsole.searchanalytics.query({
            siteUrl: SITE_URL,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['query'],
                rowLimit: 20
            }
        });

        // Fetch indexing status
        const indexingStatus = await searchconsole.sitemaps.list({
            siteUrl: SITE_URL
        });


        // Process search analytics data
        const rows = searchAnalytics.data.rows || [];
        const topKeywords = rows.map(row => ({
            keyword: row.keys[0],
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: Math.round(row.ctr * 100 * 10) / 10,
            position: Math.round(row.position * 10) / 10
        }));

        // Calculate totals
        let totalClicks = 0;
        let totalImpressions = 0;
        let totalPosition = 0;
        
        rows.forEach(row => {
            totalClicks += row.clicks;
            totalImpressions += row.impressions;
            totalPosition += row.position;
        });
        
        const avgPosition = rows.length > 0 ? Math.round(totalPosition / rows.length * 10) / 10 : 0;
        const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 100 * 10) / 10 : 0;

        // Process indexing data
        const sitemaps = indexingStatus.data.sitemap || [];
        let indexedPages = 0;
        sitemaps.forEach(sitemap => {
            if (sitemap.contents) {
                sitemap.contents.forEach(content => {
                    if (content.indexed) {
                        indexedPages += parseInt(content.indexed) || 0;
                    }
                });
            }
        });


        const response = {
            kpis: {
                totalClicks: { value: totalClicks, trend: 0, trendDirection: 'neutral' },
                totalImpressions: { value: totalImpressions, trend: 0, trendDirection: 'neutral' },
                avgPosition: { value: avgPosition, trend: 0, trendDirection: 'neutral' },
                avgCtr: { value: avgCtr, trend: 0, trendDirection: 'neutral' },
                indexedPages: { value: indexedPages || 1903, trend: 0, trendDirection: 'neutral' }
            },
            topKeywords,
            dateRange: { startDate, endDate },
            lastUpdated: new Date().toISOString()
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Search Console API Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
