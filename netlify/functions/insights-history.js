/**
 * Marga Insights - Historical Data Retrieval
 * Fetches stored snapshots from Firebase for trend analysis
 */

const admin = require('firebase-admin');

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
        const days = parseInt(params.days) || 30;
        
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Fetch snapshots
        const snapshot = await db.collection('insights_snapshots')
            .where('date', '>=', startDate.toISOString().split('T')[0])
            .where('date', '<=', endDate.toISOString().split('T')[0])
            .orderBy('date', 'asc')
            .get();

        const snapshots = [];
        snapshot.forEach(doc => snapshots.push(doc.data()));

        // Calculate trends
        const trends = calculateTrends(snapshots);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                snapshots,
                trends,
                period: { start: startDate.toISOString(), end: endDate.toISOString(), days }
            })
        };

    } catch (error) {
        console.error('History Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};


// Calculate trends from historical data
function calculateTrends(snapshots) {
    if (snapshots.length < 2) {
        return { visitors: 0, pageViews: 0, clicks: 0, position: 0 };
    }

    const recent = snapshots.slice(-7); // Last 7 days
    const previous = snapshots.slice(-14, -7); // Previous 7 days

    const sumRecent = recent.reduce((acc, s) => ({
        visitors: acc.visitors + (s.summary?.visitors || 0),
        pageViews: acc.pageViews + (s.summary?.pageViews || 0),
        clicks: acc.clicks + (s.summary?.clicks || 0),
        position: acc.position + (s.summary?.avgPosition || 0)
    }), { visitors: 0, pageViews: 0, clicks: 0, position: 0 });

    const sumPrevious = previous.reduce((acc, s) => ({
        visitors: acc.visitors + (s.summary?.visitors || 0),
        pageViews: acc.pageViews + (s.summary?.pageViews || 0),
        clicks: acc.clicks + (s.summary?.clicks || 0),
        position: acc.position + (s.summary?.avgPosition || 0)
    }), { visitors: 0, pageViews: 0, clicks: 0, position: 0 });

    const calcChange = (recent, previous) => {
        if (previous === 0) return recent > 0 ? 100 : 0;
        return Math.round(((recent - previous) / previous) * 100);
    };

    return {
        visitors: {
            current: sumRecent.visitors,
            previous: sumPrevious.visitors,
            change: calcChange(sumRecent.visitors, sumPrevious.visitors),
            direction: sumRecent.visitors >= sumPrevious.visitors ? 'up' : 'down'
        },
        pageViews: {
            current: sumRecent.pageViews,
            previous: sumPrevious.pageViews,
            change: calcChange(sumRecent.pageViews, sumPrevious.pageViews),
            direction: sumRecent.pageViews >= sumPrevious.pageViews ? 'up' : 'down'
        },
        clicks: {
            current: sumRecent.clicks,
            previous: sumPrevious.clicks,
            change: calcChange(sumRecent.clicks, sumPrevious.clicks),
            direction: sumRecent.clicks >= sumPrevious.clicks ? 'up' : 'down'
        },
        avgPosition: {
            current: recent.length > 0 ? Math.round(sumRecent.position / recent.length * 10) / 10 : 0,
            previous: previous.length > 0 ? Math.round(sumPrevious.position / previous.length * 10) / 10 : 0,
            // For position, lower is better
            direction: sumRecent.position <= sumPrevious.position ? 'up' : 'down'
        }
    };
}
