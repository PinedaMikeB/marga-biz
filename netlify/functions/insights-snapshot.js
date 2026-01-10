/**
 * Marga Insights - Daily Snapshot Storage
 * Stores analytics data in Firebase for historical tracking
 * 
 * Run daily via Netlify Scheduled Function or manually
 */

const admin = require('firebase-admin');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');
const { google } = require('googleapis');

// Initialize Firebase Admin (singleton pattern)
const getFirebaseApp = () => {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
    return admin.app();
};

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID || '406902171';
const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://marga.biz/';

// Get GA4 client
const getAnalyticsClient = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new BetaAnalyticsDataClient({ credentials });
};

// Get Search Console client
const getSearchConsoleAuth = () => {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });
};


// Fetch today's data from GA4
async function fetchGA4Data() {
    const client = getAnalyticsClient();
    const property = `properties/${GA4_PROPERTY_ID}`;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const [report] = await client.runReport({
        property,
        dateRanges: [{ startDate: yesterday, endDate: today }],
        metrics: [
            { name: 'activeUsers' },
            { name: 'newUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' },
            { name: 'bounceRate' }
        ]
    });

    const metrics = report?.rows?.[0]?.metricValues || [];
    return {
        visitors: parseInt(metrics[0]?.value || 0),
        newUsers: parseInt(metrics[1]?.value || 0),
        sessions: parseInt(metrics[2]?.value || 0),
        pageViews: parseInt(metrics[3]?.value || 0),
        avgDuration: parseFloat(metrics[4]?.value || 0),
        bounceRate: parseFloat(metrics[5]?.value || 0)
    };
}

// Fetch today's data from Search Console
async function fetchSearchConsoleData() {
    const auth = getSearchConsoleAuth();
    const searchconsole = google.searchconsole({ version: 'v1', auth });
    
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3); // 3-day delay
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1);

    const response = await searchconsole.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dimensions: ['query'],
            rowLimit: 100
        }
    });

    const rows = response.data.rows || [];
    let totalClicks = 0, totalImpressions = 0, totalPosition = 0;
    
    rows.forEach(row => {
        totalClicks += row.clicks;
        totalImpressions += row.impressions;
        totalPosition += row.position;
    });

    return {
        clicks: totalClicks,
        impressions: totalImpressions,
        avgPosition: rows.length > 0 ? Math.round(totalPosition / rows.length * 10) / 10 : 0,
        topKeywords: rows.slice(0, 10).map(r => ({
            keyword: r.keys[0],
            clicks: r.clicks,
            position: Math.round(r.position * 10) / 10
        }))
    };
}


// Main handler
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch data from both sources
        const [ga4Data, searchData] = await Promise.all([
            fetchGA4Data(),
            fetchSearchConsoleData()
        ]);

        // Combine into snapshot
        const snapshot = {
            date: today,
            timestamp: new Date().toISOString(),
            ga4: ga4Data,
            searchConsole: searchData,
            summary: {
                visitors: ga4Data.visitors,
                pageViews: ga4Data.pageViews,
                clicks: searchData.clicks,
                avgPosition: searchData.avgPosition
            }
        };

        // Store in Firebase
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        // Store daily snapshot
        await db.collection('insights_snapshots').doc(today).set(snapshot);
        
        // Also update latest snapshot for quick access
        await db.collection('insights_meta').doc('latest').set({
            ...snapshot,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Snapshot saved for ${today}`,
                data: snapshot
            })
        };

    } catch (error) {
        console.error('Snapshot Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
