/**
 * Marga AI - Agent Dashboard API
 * Returns all agent statuses, recommendations, issues, and activity
 */

const {
    getDb,
    getAllAgentsStatus,
    getPendingRecommendations,
    getOpenIssues,
    getRecentActivity,
    getSharedData,
    updateRecommendation
} = require('./lib/agent-utils');

/**
 * Get dashboard data
 */
async function getDashboardData() {
    const [agents, recommendations, issues, activity, siteSummary, analytics] = await Promise.all([
        getAllAgentsStatus(),
        getPendingRecommendations(),
        getOpenIssues(20),
        getRecentActivity(20),
        getSharedData('site_summary'),
        getSharedData('latest_analytics')
    ]);

    return {
        agents,
        recommendations,
        issues,
        activity,
        siteSummary,
        analytics,
        timestamp: new Date().toISOString()
    };
}

/**
 * Main handler
 */
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const params = event.queryStringParameters || {};
    const action = params.action || 'dashboard';

    try {
        switch (action) {
            case 'dashboard': {
                const data = await getDashboardData();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
            }

            case 'approve': {
                const recId = params.recId;
                if (!recId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'recId required' }) };
                }
                await updateRecommendation(recId, { 
                    status: 'approved',
                    approvedAt: new Date().toISOString()
                });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Approved' }) };
            }

            case 'dismiss': {
                const recId = params.recId;
                if (!recId) {
                    return { statusCode: 400, headers, body: JSON.stringify({ error: 'recId required' }) };
                }
                await updateRecommendation(recId, { 
                    status: 'dismissed',
                    dismissedAt: new Date().toISOString()
                });
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'Dismissed' }) };
            }

            case 'agents': {
                const agents = await getAllAgentsStatus();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: agents }) };
            }

            case 'recommendations': {
                const recommendations = await getPendingRecommendations();
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: recommendations }) };
            }

            case 'issues': {
                const issues = await getOpenIssues(50);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: issues }) };
            }

            case 'activity': {
                const limit = parseInt(params.limit) || 20;
                const activity = await getRecentActivity(limit);
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: activity }) };
            }

            default:
                return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
