/**
 * Marga Insights - AI SEO Analysis (Phase 3.3)
 * Uses Claude API to analyze SEO data and provide recommendations
 * 
 * Features:
 * - Traffic trend analysis
 * - Content gap detection
 * - Ranking change alerts
 * - Actionable recommendations
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

// Claude API configuration
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Call Claude API for analysis
 */
async function callClaudeAPI(prompt, systemPrompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
        throw new Error('CLAUDE_API_KEY not configured');
    }

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 2000,
            system: systemPrompt,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

/**
 * Build analysis prompt from SEO data
 */
function buildAnalysisPrompt(data) {
    const { current, previous, keywords, topPages, trends } = data;
    
    return `
Analyze this SEO data for marga.biz (a printer/copier rental business in the Philippines):

## CURRENT PERIOD (Last 7 Days)
- Visitors: ${current.visitors}
- Page Views: ${current.pageViews}
- Search Clicks: ${current.clicks}
- Average Position: ${current.avgPosition}

## PREVIOUS PERIOD (7 Days Before)
- Visitors: ${previous.visitors}
- Page Views: ${previous.pageViews}
- Search Clicks: ${previous.clicks}
- Average Position: ${previous.avgPosition}

## TRENDS
- Visitors: ${trends.visitors.change}% ${trends.visitors.direction}
- Page Views: ${trends.pageViews.change}% ${trends.pageViews.direction}
- Clicks: ${trends.clicks.change}% ${trends.clicks.direction}

## TOP KEYWORDS (with positions)
${keywords.slice(0, 10).map((k, i) => `${i + 1}. "${k.keyword}" - Position: ${k.position}, Clicks: ${k.clicks}`).join('\n')}

## TOP PAGES
${topPages.slice(0, 8).map((p, i) => `${i + 1}. ${p.path} - ${p.views} views`).join('\n')}

Provide analysis in JSON format with these sections:
1. trafficAnalysis: Brief summary of traffic trends (2-3 sentences)
2. alerts: Array of {type: "warning"|"success"|"info", message: string} for important changes
3. contentGaps: Array of {keyword: string, reason: string} for content opportunities
4. recommendations: Array of {priority: "high"|"medium"|"low", action: string, impact: string}
5. summary: One-line executive summary

Return ONLY valid JSON, no markdown or explanation.
`;
}

const SYSTEM_PROMPT = `You are an SEO analyst for marga.biz, a B2B printer and copier rental company serving Metro Manila, Philippines. 

Their key services: printer rental, copier rental, print-all-you-can plans.
Target keywords: "printer rental philippines", "copier rental manila", "copier for rent".
They rank #2 for "printer rental philippines" - this is critical to maintain.

Provide practical, actionable SEO insights. Focus on:
- Ranking changes that need attention
- Content gaps (keywords they should target)
- Traffic trends and their causes
- Quick wins they can implement

Be concise and business-focused. Return only valid JSON.`;

/**
 * Get historical data from Firebase
 */
async function getHistoricalData(db, days = 14) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const snapshot = await db.collection('insights_snapshots')
        .where('date', '>=', startDate.toISOString().split('T')[0])
        .orderBy('date', 'asc')
        .get();

    const snapshots = [];
    snapshot.forEach(doc => snapshots.push(doc.data()));
    return snapshots;
}

/**
 * Process snapshots into analysis-ready format
 */
function processSnapshots(snapshots) {
    if (snapshots.length < 2) {
        return null;
    }

    const recent = snapshots.slice(-7);
    const previous = snapshots.slice(-14, -7);

    const sumData = (arr) => arr.reduce((acc, s) => ({
        visitors: acc.visitors + (s.summary?.visitors || s.ga4?.visitors || 0),
        pageViews: acc.pageViews + (s.summary?.pageViews || s.ga4?.pageViews || 0),
        clicks: acc.clicks + (s.summary?.clicks || s.searchConsole?.clicks || 0),
        avgPosition: acc.avgPosition + (s.summary?.avgPosition || s.searchConsole?.avgPosition || 0)
    }), { visitors: 0, pageViews: 0, clicks: 0, avgPosition: 0 });

    const recentSum = sumData(recent);
    const previousSum = sumData(previous);

    const calcChange = (curr, prev) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
    };

    // Get latest keywords and pages
    const latest = snapshots[snapshots.length - 1];
    const keywords = latest.searchConsole?.topKeywords || [];
    const topPages = latest.ga4?.topPages || [];

    return {
        current: {
            visitors: recentSum.visitors,
            pageViews: recentSum.pageViews,
            clicks: recentSum.clicks,
            avgPosition: recent.length > 0 ? Math.round(recentSum.avgPosition / recent.length * 10) / 10 : 0
        },
        previous: {
            visitors: previousSum.visitors,
            pageViews: previousSum.pageViews,
            clicks: previousSum.clicks,
            avgPosition: previous.length > 0 ? Math.round(previousSum.avgPosition / previous.length * 10) / 10 : 0
        },
        trends: {
            visitors: { change: calcChange(recentSum.visitors, previousSum.visitors), direction: recentSum.visitors >= previousSum.visitors ? 'up' : 'down' },
            pageViews: { change: calcChange(recentSum.pageViews, previousSum.pageViews), direction: recentSum.pageViews >= previousSum.pageViews ? 'up' : 'down' },
            clicks: { change: calcChange(recentSum.clicks, previousSum.clicks), direction: recentSum.clicks >= previousSum.clicks ? 'up' : 'down' }
        },
        keywords,
        topPages
    };
}

/**
 * Store AI analysis in Firebase
 */
async function storeAnalysis(db, analysis) {
    const today = new Date().toISOString().split('T')[0];
    
    await db.collection('insights_ai').doc(today).set({
        date: today,
        timestamp: new Date().toISOString(),
        analysis
    });

    // Also update latest for quick access
    await db.collection('insights_meta').doc('latest_ai').set({
        date: today,
        timestamp: new Date().toISOString(),
        analysis,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Get cached analysis if recent enough
 */
async function getCachedAnalysis(db) {
    const doc = await db.collection('insights_meta').doc('latest_ai').get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    const cacheAge = Date.now() - new Date(data.timestamp).getTime();
    const maxAge = 12 * 60 * 60 * 1000; // 12 hours
    
    if (cacheAge < maxAge) {
        return { ...data, cached: true };
    }
    return null;
}

/**
 * Main handler
 */
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
        const forceRefresh = params.refresh === 'true';

        const app = getFirebaseApp();
        const db = admin.firestore(app);

        // Check for cached analysis first (unless force refresh)
        if (!forceRefresh) {
            const cached = await getCachedAnalysis(db);
            if (cached) {
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, data: cached })
                };
            }
        }

        // Get historical data from Firebase
        const snapshots = await getHistoricalData(db, 14);
        
        if (snapshots.length < 2) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Not enough historical data for analysis. Need at least 2 days of snapshots.',
                    snapshotsFound: snapshots.length
                })
            };
        }

        // Process data for analysis
        const analysisData = processSnapshots(snapshots);
        
        if (!analysisData) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Could not process snapshot data'
                })
            };
        }

        // Build prompt and call Claude
        const prompt = buildAnalysisPrompt(analysisData);
        const aiResponse = await callClaudeAPI(prompt, SYSTEM_PROMPT);
        
        // Parse JSON response
        let analysis;
        try {
            // Handle potential markdown code blocks
            const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanResponse);
        } catch (parseError) {
            console.error('Failed to parse AI response:', aiResponse);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Failed to parse AI analysis', raw: aiResponse })
            };
        }

        // Store analysis in Firebase
        await storeAnalysis(db, analysis);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    date: new Date().toISOString().split('T')[0],
                    timestamp: new Date().toISOString(),
                    analysis,
                    cached: false
                }
            })
        };

    } catch (error) {
        console.error('AI Analysis Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
