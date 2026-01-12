/**
 * Marga AI - Chat Endpoint
 * Handles chat messages and executes AI actions
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

/**
 * Get AI config from Firebase
 */
async function getAIConfig(db) {
    const doc = await db.collection('marga_config').doc('settings').get();
    if (!doc.exists) {
        return {
            model: 'claude-sonnet-4-5-20250514',
            temperature: 0.7,
            maxTokens: 4000,
            systemPrompt: 'You are an SEO assistant for Marga Enterprises.',
            additionalInstructions: ''
        };
    }
    return doc.data().ai;
}

/**
 * Build system prompt with context
 */
function buildSystemPrompt(config, seoConfig) {
    let prompt = config.systemPrompt || '';
    
    if (config.additionalInstructions) {
        prompt += '\n\n' + config.additionalInstructions;
    }

    // Add context about competitors and keywords
    if (seoConfig) {
        if (seoConfig.competitors && seoConfig.competitors.length > 0) {
            prompt += '\n\nCurrent competitors being monitored:\n';
            seoConfig.competitors.forEach(c => {
                prompt += `- ${c.domain}: ${c.notes || 'No notes'}\n`;
            });
        }

        if (seoConfig.keywords) {
            if (seoConfig.keywords.primary && seoConfig.keywords.primary.length > 0) {
                prompt += '\n\nPrimary keywords to protect:\n';
                prompt += seoConfig.keywords.primary.map(k => `- "${k}"`).join('\n');
            }
            if (seoConfig.keywords.growth && seoConfig.keywords.growth.length > 0) {
                prompt += '\n\nGrowth keywords to improve:\n';
                prompt += seoConfig.keywords.growth.map(k => `- "${k}"`).join('\n');
            }
        }
    }

    // Add capabilities
    prompt += `

CAPABILITIES:
You can help the user with:
1. Finding and analyzing competitors (use web search)
2. Creating landing pages (will show preview for approval)
3. Updating website settings and config
4. Analyzing SEO performance
5. Suggesting content improvements

RESPONSE FORMAT:
- Be concise and actionable
- Use markdown for formatting (bold, lists)
- When suggesting actions, include action buttons in your response
- For competitor research, search the web and present findings clearly

When you need to perform actions, include them in this JSON format at the end of your response:
<!--ACTIONS:[{"type":"action_type","label":"Button Text","data":{}}]-->

Action types available:
- add_competitor: {domain, notes}
- add_keyword: {keyword, type: "primary"|"growth"}
- create_page: {slug, title, type}
- update_config: {path, value}`;

    return prompt;
}

/**
 * Call Claude API
 */
async function callClaude(messages, config, systemPrompt) {
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
            model: config.model || 'claude-sonnet-4-5-20250514',
            max_tokens: config.maxTokens || 4000,
            temperature: config.temperature || 0.7,
            system: systemPrompt,
            messages: messages
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
            
            // Check if already exists
            const exists = config.seo.competitors.some(c => c.domain === data.domain);
            if (exists) {
                return { success: false, message: 'Competitor already exists' };
            }

            config.seo.competitors.push({
                domain: data.domain,
                notes: data.notes || '',
                addedAt: new Date().toISOString()
            });

            await db.collection('marga_config').doc('settings').set(config);
            
            // Log to history
            await db.collection('marga_history').add({
                type: 'competitor_added',
                data: { domain: data.domain, notes: data.notes },
                source: 'ai-chat',
                timestamp: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

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
            
            // Log to history
            await db.collection('marga_history').add({
                type: 'keyword_added',
                data: { keyword, keywordType },
                source: 'ai-chat',
                timestamp: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: `Added "${keyword}" to ${keywordType} keywords` };
        }

        case 'update_config': {
            const configDoc = await db.collection('marga_config').doc('settings').get();
            const config = configDoc.data();
            
            // Navigate to nested path and update
            const keys = data.path.split('.');
            let current = config;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = data.value;

            await db.collection('marga_config').doc('settings').set(config);
            
            // Log to history
            await db.collection('marga_history').add({
                type: 'config_update',
                path: data.path,
                newValue: data.value,
                source: 'ai-chat',
                timestamp: new Date().toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: `Updated ${data.path}` };
        }

        case 'create_page': {
            // For now, just create a task - actual page creation in Phase 4.5
            await db.collection('marga_tasks').add({
                type: 'create_page',
                status: 'pending',
                data: data,
                source: 'ai-chat',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                message: `Page creation task queued. I'll prepare a preview for "${data.title || data.slug}".`
            };
        }

        default:
            return { success: false, message: `Unknown action type: ${type}` };
    }
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
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
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
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Message is required' })
            };
        }

        // Get config
        const configDoc = await db.collection('marga_config').doc('settings').get();
        const config = configDoc.exists ? configDoc.data() : {};
        const aiConfig = config.ai || {};
        const seoConfig = config.seo || {};

        // Build system prompt
        const systemPrompt = buildSystemPrompt(aiConfig, seoConfig);

        // Build messages array
        const messages = [];
        
        // Add history
        history.forEach(msg => {
            messages.push({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
            });
        });

        // Add current message
        messages.push({ role: 'user', content: message });

        // Call Claude
        const rawResponse = await callClaude(messages, aiConfig, systemPrompt);

        // Parse response and actions
        const { response, actions } = parseActions(rawResponse);

        // Log chat to history
        await db.collection('marga_chat_log').add({
            userMessage: message,
            assistantResponse: response,
            actions: actions,
            timestamp: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: { response, actions }
            })
        };

    } catch (error) {
        console.error('Chat error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: error.message 
            })
        };
    }
};
