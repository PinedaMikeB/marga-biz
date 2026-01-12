/**
 * Marga AI - Chat Endpoint (Enhanced)
 * Includes full website knowledge context
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

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Get AI config from Firebase
 */
async function getAIConfig(db) {
    const doc = await db.collection('marga_config').doc('settings').get();
    if (!doc.exists) {
        return {
            model: 'claude-sonnet-4-20250514',
            temperature: 0.7,
            maxTokens: 4000,
            systemPrompt: '',
            additionalInstructions: ''
        };
    }
    return doc.data().ai;
}

/**
 * Get latest analytics snapshot from Firebase
 */
async function getLatestAnalytics(db) {
    try {
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('date', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) return null;
        return snapshot.docs[0].data();
    } catch (e) {
        console.error('Error getting analytics:', e);
        return null;
    }
}

/**
 * Build comprehensive system prompt with full website knowledge
 */
function buildSystemPrompt(config, seoConfig, analytics) {
    let prompt = `You are the AI SEO Manager for Marga Enterprises (marga.biz), a B2B printer and copier rental company serving Metro Manila, Philippines.

## YOUR WEBSITE KNOWLEDGE

### Site Overview
- **Domain:** marga.biz
- **Total Pages:** 1,903 (896 service pages + 1,007 blog posts)
- **Primary Business:** Printer & copier rental for businesses
- **Service Areas:** Metro Manila, Cavite, Laguna, Bulacan, Batangas
- **Key Offering:** Print-all-you-can plans, same-day delivery

### Key Pages You Manage
| Page | URL | Purpose |
|------|-----|---------|
| Homepage | marga.biz | Main landing, hero CTA |
| Copier Rental | /copier-rental-manila/ | High-traffic service page |
| Printer Rental | /printer-rental-philippines/ | Top SEO page (#2 ranking) |
| Pricing | /pricing/ | Rental rates |
| Contact | /contact/ | Lead capture |
| Blog | /blog/ | 1,007 articles for SEO |
| Quote Page | /quote/ | Main conversion point |

### Current SEO Status
- **Primary Keyword:** "printer rental philippines" - Ranking #2 (PROTECT THIS!)
- **Main Competitor:** jmti.com.ph - Ranking #1
- **Indexed Pages:** 1,903 in Google

`;

    // Add live analytics if available
    if (analytics) {
        prompt += `### Recent Performance (Last 7 Days)
- **Visitors:** ${analytics.summary?.visitors || analytics.ga4?.visitors || 'N/A'}
- **Page Views:** ${analytics.summary?.pageViews || analytics.ga4?.pageViews || 'N/A'}
- **Search Clicks:** ${analytics.summary?.clicks || analytics.searchConsole?.clicks || 'N/A'}
- **Avg Position:** ${analytics.summary?.avgPosition || analytics.searchConsole?.avgPosition || 'N/A'}

`;
        // Add top pages if available
        if (analytics.ga4?.topPages && analytics.ga4.topPages.length > 0) {
            prompt += `### Top Performing Pages\n`;
            analytics.ga4.topPages.slice(0, 5).forEach((page, i) => {
                prompt += `${i + 1}. ${page.path} - ${page.views} views\n`;
            });
            prompt += '\n';
        }

        // Add top keywords if available
        if (analytics.searchConsole?.topKeywords && analytics.searchConsole.topKeywords.length > 0) {
            prompt += `### Current Keyword Rankings\n`;
            analytics.searchConsole.topKeywords.slice(0, 10).forEach((kw, i) => {
                prompt += `${i + 1}. "${kw.keyword}" - Position ${kw.position}, ${kw.clicks} clicks\n`;
            });
            prompt += '\n';
        }
    }

    // Add monitored competitors
    if (seoConfig?.competitors && seoConfig.competitors.length > 0) {
        prompt += `### Competitors Being Monitored\n`;
        seoConfig.competitors.forEach(c => {
            prompt += `- **${c.domain}**: ${c.notes || 'No notes'}\n`;
        });
        prompt += '\n';
    }

    // Add target keywords
    if (seoConfig?.keywords) {
        if (seoConfig.keywords.primary?.length > 0) {
            prompt += `### Primary Keywords (PROTECT - Already Ranking)\n`;
            seoConfig.keywords.primary.forEach(k => prompt += `- "${k}"\n`);
            prompt += '\n';
        }
        if (seoConfig.keywords.growth?.length > 0) {
            prompt += `### Growth Keywords (IMPROVE - Target These)\n`;
            seoConfig.keywords.growth.forEach(k => prompt += `- "${k}"\n`);
            prompt += '\n';
        }
    }

    // Add any custom instructions
    if (config.additionalInstructions) {
        prompt += `### Additional Instructions\n${config.additionalInstructions}\n\n`;
    }

    // Add behavior instructions
    prompt += `## YOUR BEHAVIOR

### How to Respond
1. **Be proactive** - Don't ask for information you already have
2. **Be specific** - Reference actual pages, keywords, and data
3. **Be actionable** - Give concrete recommendations with steps
4. **Be concise** - No fluff, just useful insights

### Example Good Response
User: "How can I improve my SEO?"
You: "Based on your current data, here are 3 quick wins:

1. **Your /copier-rental-manila/ page** gets 245 views but has no FAQ section. Adding 5 FAQs could boost time-on-page and rankings.

2. **'printer rental bgc'** is in your growth keywords but you have NO dedicated page for it. I can create a landing page targeting BGC businesses.

3. **Your competitor jmti.com.ph** ranks above you for 'printer rental philippines'. Their page has 2,100 words vs your 890. Consider expanding your content."

### Example BAD Response (Never Do This)
"Can you provide me with the URL of your website?" ❌
"What services do you offer?" ❌
"I'd need to see your analytics first." ❌

You ALREADY KNOW this information. Use it.

## CAPABILITIES

You can execute these actions (will show confirmation buttons):
1. **add_competitor** - Add domain to monitoring list
2. **add_keyword** - Add keyword to primary/growth list
3. **create_page** - Create new landing page (shows preview)
4. **update_config** - Update site settings

When suggesting actions, include them as:
<!--ACTIONS:[{"type":"action_type","label":"Button Text","data":{}}]-->
`;

    return prompt;
}

/**
 * Normalize model name to valid API model
 */
function normalizeModel(model) {
    const modelMap = {
        'claude-opus-4-5-20250514': 'claude-opus-4-20250514',
        'claude-sonnet-4-5-20250514': 'claude-sonnet-4-20250514',
        'claude-haiku-4-5-20250514': 'claude-haiku-3-5-20241022',
    };
    return modelMap[model] || model || 'claude-sonnet-4-20250514';
}

/**
 * Call Claude API
 */
async function callClaude(messages, config, systemPrompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

    const model = normalizeModel(config.model);

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model,
            max_tokens: config.maxTokens || 4000,
            temperature: config.temperature || 0.7,
            system: systemPrompt,
            messages
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
 * Parse actions from response
 */
function parseActions(response) {
    const actionMatch = response.match(/<!--ACTIONS:(\[.*?\])-->/s);
    let actions = [];
    let cleanResponse = response;

    if (actionMatch) {
        try {
            actions = JSON.parse(actionMatch[1]);
            cleanResponse = response.replace(actionMatch[0], '').trim();
        } catch (e) {
            console.error('Failed to parse actions:', e);
        }
    }

    return { response: cleanResponse, actions };
}

/**
 * Execute action
 */
async function executeAction(db, action) {
    const { type, data } = action;

    switch (type) {
        case 'add_competitor': {
            const configDoc = await db.collection('marga_config').doc('settings').get();
            const config = configDoc.data();
            
            if (!config.seo) config.seo = {};
            if (!config.seo.competitors) config.seo.competitors = [];
            
            const exists = config.seo.competitors.some(c => c.domain === data.domain);
            if (exists) return { success: false, message: 'Competitor already exists' };

            config.seo.competitors.push({
                domain: data.domain,
                notes: data.notes || '',
                addedAt: new Date().toISOString()
            });

            await db.collection('marga_config').doc('settings').set(config);
            await logHistory(db, 'competitor_added', { domain: data.domain, notes: data.notes });

            return { success: true, message: `Added ${data.domain} to competitors` };
        }

        case 'add_keyword': {
            const configDoc = await db.collection('marga_config').doc('settings').get();
            const config = configDoc.data();
            
            if (!config.seo) config.seo = {};
            if (!config.seo.keywords) config.seo.keywords = { primary: [], growth: [] };
            
            const keywordType = data.type || 'growth';
            const keyword = data.keyword.toLowerCase();
            
            if (config.seo.keywords[keywordType].includes(keyword)) {
                return { success: false, message: 'Keyword already exists' };
            }

            config.seo.keywords[keywordType].push(keyword);
            await db.collection('marga_config').doc('settings').set(config);
            await logHistory(db, 'keyword_added', { keyword, keywordType });

            return { success: true, message: `Added "${keyword}" to ${keywordType} keywords` };
        }

        case 'update_config': {
            const configDoc = await db.collection('marga_config').doc('settings').get();
            const config = configDoc.data();
            
            const keys = data.path.split('.');
            let current = config;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = data.value;

            await db.collection('marga_config').doc('settings').set(config);
            await logHistory(db, 'config_update', { path: data.path, value: data.value });

            return { success: true, message: `Updated ${data.path}` };
        }

        case 'create_page': {
            await db.collection('marga_tasks').add({
                type: 'create_page',
                status: 'pending',
                data: data,
                source: 'ai-chat',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                message: `Page creation task queued for "${data.title || data.slug}".`
            };
        }

        default:
            return { success: false, message: `Unknown action type: ${type}` };
    }
}

/**
 * Log to history
 */
async function logHistory(db, type, data) {
    await db.collection('marga_history').add({
        type,
        data,
        source: 'ai-chat',
        timestamp: new Date().toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        
        const body = JSON.parse(event.body || '{}');

        // Handle direct action execution
        if (body.action) {
            const result = await executeAction(db, { type: body.action, data: body.data });
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ success: true, data: result })
            };
        }

        // Handle chat message
        const { message, history = [] } = body;
        if (!message) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message is required' }) };
        }

        // Load all context
        const configDoc = await db.collection('marga_config').doc('settings').get();
        const config = configDoc.exists ? configDoc.data() : {};
        const aiConfig = config.ai || {};
        const seoConfig = config.seo || {};
        
        // Get latest analytics snapshot
        const analytics = await getLatestAnalytics(db);

        // Build system prompt with full website knowledge
        const systemPrompt = buildSystemPrompt(aiConfig, seoConfig, analytics);

        // Build messages
        const messages = [];
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        });
        messages.push({ role: 'user', content: message });

        // Call Claude
        const rawResponse = await callClaude(messages, aiConfig, systemPrompt);
        const { response, actions } = parseActions(rawResponse);

        // Log chat
        await db.collection('marga_chat_log').add({
            userMessage: message,
            assistantResponse: response,
            actions,
            timestamp: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, data: { response, actions } })
        };

    } catch (error) {
        console.error('Chat error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
