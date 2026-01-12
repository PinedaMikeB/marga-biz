/**
 * Marga AI - Search Agent
 * 
 * Handles external search intelligence:
 * - Live SERP rankings
 * - Competitor discovery
 * - Keyword opportunities
 * - Bing Webmaster submissions
 */

const {
    getDb,
    AGENTS,
    AGENT_STATUS,
    updateAgentStatus,
    createIssue,
    createRecommendation,
    logActivity,
    setSharedData,
    getSharedData
} = require('./lib/agent-utils');

// Serper.dev API (free tier: 2,500 searches/month)
const SERPER_API_URL = 'https://google.serper.dev/search';

/**
 * Search Google via Serper API
 */
async function searchGoogle(query, options = {}) {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
        return { error: 'SERPER_API_KEY not configured. Get free API key at serper.dev' };
    }

    try {
        const response = await fetch(SERPER_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': apiKey
            },
            body: JSON.stringify({
                q: query,
                gl: options.country || 'ph', // Philippines
                hl: options.language || 'en',
                num: options.num || 20 // Get top 20 results
            })
        });

        if (!response.ok) {
            const error = await response.text();
            return { error: `Serper API error: ${response.status} - ${error}` };
        }

        return await response.json();
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Check ranking for a specific keyword
 */
async function checkRanking(keyword, targetDomain = 'marga.biz') {
    const results = await searchGoogle(keyword);
    
    if (results.error) {
        return { error: results.error };
    }

    const organic = results.organic || [];
    let ranking = null;
    let position = 0;
    const competitors = [];

    for (let i = 0; i < organic.length; i++) {
        const result = organic[i];
        position = result.position || (i + 1);
        
        const domain = extractDomain(result.link);
        
        if (domain.includes(targetDomain)) {
            ranking = {
                position,
                url: result.link,
                title: result.title,
                snippet: result.snippet
            };
        } else {
            // Track competitor
            competitors.push({
                position,
                domain,
                url: result.link,
                title: result.title,
                snippet: result.snippet
            });
        }
    }

    return {
        keyword,
        targetDomain,
        ranking,
        notFound: !ranking,
        competitors: competitors.slice(0, 10), // Top 10 competitors
        totalResults: organic.length,
        searchedAt: new Date().toISOString(),
        relatedSearches: results.relatedSearches || [],
        peopleAlsoAsk: results.peopleAlsoAsk || []
    };
}

/**
 * Extract domain from URL
 */
function extractDomain(url) {
    try {
        const u = new URL(url);
        return u.hostname.replace('www.', '');
    } catch {
        return url;
    }
}

/**
 * Monitor multiple keywords
 */
async function monitorKeywords(keywords, targetDomain = 'marga.biz') {
    const results = [];
    
    for (const keyword of keywords) {
        const result = await checkRanking(keyword, targetDomain);
        results.push(result);
        
        // Rate limiting - 1 second between requests
        await new Promise(r => setTimeout(r, 1000));
    }

    return results;
}

/**
 * Find competitors for a keyword
 */
async function findCompetitors(keyword) {
    const result = await checkRanking(keyword);
    
    if (result.error) return result;

    // Analyze competitors
    const competitorAnalysis = result.competitors.map(comp => ({
        domain: comp.domain,
        position: comp.position,
        title: comp.title,
        isDirectCompetitor: isDirectCompetitor(comp.domain, comp.title)
    }));

    // Filter to likely direct competitors
    const directCompetitors = competitorAnalysis.filter(c => c.isDirectCompetitor);

    return {
        keyword,
        yourRanking: result.ranking,
        allCompetitors: competitorAnalysis,
        directCompetitors,
        opportunities: analyzeOpportunities(result)
    };
}

/**
 * Check if domain is likely a direct competitor (not a directory or info site)
 */
function isDirectCompetitor(domain, title) {
    const excludePatterns = [
        'facebook.com', 'youtube.com', 'wikipedia.org',
        'linkedin.com', 'twitter.com', 'instagram.com',
        'yelp.com', 'yellowpages', 'businesslist',
        'indeed.com', 'jobstreet', 'glassdoor'
    ];
    
    const lowerDomain = domain.toLowerCase();
    const lowerTitle = (title || '').toLowerCase();
    
    // Exclude social/directory sites
    for (const pattern of excludePatterns) {
        if (lowerDomain.includes(pattern)) return false;
    }
    
    // Look for rental/service indicators
    const serviceIndicators = ['rental', 'rent', 'lease', 'printer', 'copier', 'service'];
    for (const indicator of serviceIndicators) {
        if (lowerDomain.includes(indicator) || lowerTitle.includes(indicator)) {
            return true;
        }
    }
    
    return false;
}

/**
 * Analyze opportunities from search results
 */
function analyzeOpportunities(result) {
    const opportunities = [];

    // Check "People Also Ask" for content ideas
    if (result.peopleAlsoAsk?.length > 0) {
        opportunities.push({
            type: 'faq_content',
            message: 'Add FAQ section answering these questions',
            questions: result.peopleAlsoAsk.map(p => p.question).slice(0, 5)
        });
    }

    // Check related searches for keyword expansion
    if (result.relatedSearches?.length > 0) {
        opportunities.push({
            type: 'keyword_expansion',
            message: 'Target these related keywords',
            keywords: result.relatedSearches.map(r => r.query).slice(0, 5)
        });
    }

    // Position improvement opportunities
    if (result.ranking && result.ranking.position > 3) {
        opportunities.push({
            type: 'ranking_improvement',
            message: `Currently at position ${result.ranking.position}. Opportunity to reach top 3.`,
            currentPosition: result.ranking.position
        });
    }

    if (!result.ranking) {
        opportunities.push({
            type: 'not_ranking',
            message: 'Not found in top 20 results. Need dedicated page or better optimization.',
            priority: 'high'
        });
    }

    return opportunities;
}

/**
 * Store ranking history
 */
async function storeRankingHistory(db, keyword, result) {
    const docId = keyword.replace(/\s+/g, '_').toLowerCase();
    
    await db.collection('marga_rankings').doc(docId).set({
        keyword,
        latestPosition: result.ranking?.position || null,
        latestCheck: new Date().toISOString(),
        notRanking: !result.ranking
    }, { merge: true });

    // Store history entry
    await db.collection('marga_rankings').doc(docId)
        .collection('history').add({
            position: result.ranking?.position || null,
            competitors: result.competitors.slice(0, 5).map(c => ({
                domain: c.domain,
                position: c.position
            })),
            checkedAt: new Date().toISOString()
        });
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
    const action = params.action || 'status';

    try {
        const db = getDb();
        
        // Update agent status
        await updateAgentStatus(AGENTS.SEARCH, AGENT_STATUS.RUNNING, {
            currentTask: action
        });

        let result;

        switch (action) {
            case 'status': {
                // Check if API key is configured
                const hasApiKey = !!process.env.SERPER_API_KEY;
                result = {
                    agent: 'search',
                    status: hasApiKey ? 'ready' : 'needs_api_key',
                    message: hasApiKey 
                        ? 'Search Agent is ready to check rankings'
                        : 'SERPER_API_KEY not configured. Get free key at serper.dev'
                };
                break;
            }

            case 'check_ranking': {
                const keyword = params.keyword || 'printer rental philippines';
                result = await checkRanking(keyword);
                
                if (!result.error) {
                    await storeRankingHistory(db, keyword, result);
                    await logActivity(AGENTS.SEARCH, 'check_ranking', { keyword, position: result.ranking?.position });
                }
                break;
            }

            case 'find_competitors': {
                const keyword = params.keyword || 'printer rental philippines';
                result = await findCompetitors(keyword);
                
                if (!result.error) {
                    await logActivity(AGENTS.SEARCH, 'find_competitors', { 
                        keyword, 
                        found: result.directCompetitors.length 
                    });
                }
                break;
            }

            case 'monitor': {
                // Monitor default keywords
                const keywords = [
                    'printer rental philippines',
                    'copier rental manila',
                    'printer rental manila',
                    'copier for rent philippines'
                ];
                
                result = await monitorKeywords(keywords);
                
                // Store results
                await setSharedData('latest_rankings', {
                    rankings: result,
                    checkedAt: new Date().toISOString()
                });
                
                await logActivity(AGENTS.SEARCH, 'monitor_keywords', { 
                    keywords: keywords.length,
                    results: result.length 
                });
                break;
            }

            case 'quick_check': {
                // Quick check without storing - for Manager to use
                const keyword = params.keyword || 'printer rental philippines';
                const searchResult = await searchGoogle(keyword);
                
                if (searchResult.error) {
                    result = { error: searchResult.error };
                } else {
                    const organic = searchResult.organic || [];
                    result = {
                        keyword,
                        top10: organic.slice(0, 10).map((r, i) => ({
                            position: r.position || (i + 1),
                            domain: extractDomain(r.link),
                            title: r.title
                        })),
                        margaPosition: organic.findIndex(r => 
                            extractDomain(r.link).includes('marga.biz')
                        ) + 1 || 'Not in top 20',
                        checkedAt: new Date().toISOString()
                    };
                }
                break;
            }

            default:
                result = { error: 'Invalid action. Use: status, check_ranking, find_competitors, monitor, quick_check' };
        }

        await updateAgentStatus(AGENTS.SEARCH, AGENT_STATUS.IDLE);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: !result.error, data: result })
        };

    } catch (error) {
        console.error('Search Agent error:', error);
        await updateAgentStatus(AGENTS.SEARCH, AGENT_STATUS.ERROR, {
            lastError: error.message
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
