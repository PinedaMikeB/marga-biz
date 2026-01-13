/**
 * API Usage Stats - Returns Claude API usage and costs
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const getFirebaseApp = () => {
    if (admin.apps.length === 0) {
        const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: 'sah-spiritual-journal'
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
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        const params = event.queryStringParameters || {};
        const days = parseInt(params.days) || 30;
        
        // Get usage for the last N days
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        
        const snapshot = await db.collection('api_usage')
            .where('date', '>=', startDateStr)
            .orderBy('date', 'desc')
            .get();
        
        const dailyUsage = [];
        let totalRequests = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCost = 0;
        
        snapshot.forEach(doc => {
            const data = doc.data();
            dailyUsage.push(data);
            totalRequests += data.requests || 0;
            totalInputTokens += data.inputTokens || 0;
            totalOutputTokens += data.outputTokens || 0;
            totalCost += data.totalCost || 0;
        });
        
        // Calculate averages
        const daysWithData = dailyUsage.length || 1;
        const avgRequestsPerDay = Math.round(totalRequests / daysWithData);
        const avgCostPerDay = totalCost / daysWithData;
        
        // Projected monthly cost
        const projectedMonthlyCost = avgCostPerDay * 30;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    period: {
                        days,
                        from: startDateStr,
                        to: new Date().toISOString().split('T')[0]
                    },
                    summary: {
                        totalRequests,
                        totalInputTokens,
                        totalOutputTokens,
                        totalTokens: totalInputTokens + totalOutputTokens,
                        totalCost: Math.round(totalCost * 10000) / 10000, // 4 decimal places
                        avgRequestsPerDay,
                        avgCostPerDay: Math.round(avgCostPerDay * 10000) / 10000,
                        projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100
                    },
                    daily: dailyUsage
                }
            })
        };
        
    } catch (error) {
        console.error('Usage API error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
