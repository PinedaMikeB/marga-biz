/**
 * Marga AI - Chat Endpoint (v2 - Full Knowledge)
 * Now includes:
 * - Complete site structure from Firebase
 * - Global memory across sessions
 * - No WordPress references (static Netlify site)
 */

const admin = require('firebase-admin');

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

async function getAIConfig(db) {
    const doc = await db.collection('marga_config').doc('settings').get();
    if (!doc.exists) {
        return { model: 'claude-sonnet-4-20250514', temperature: 0.7, maxTokens: 4000 };
    }
    return doc.data().ai;
}

async function getLatestAnalytics(db) {
    try {
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('date', 'desc').limit(1).get();
        if (snapshot.empty) return null;
        return snapshot.docs[0].data();
    } catch (e) { return null; }
}

async function getSiteStructure(db) {
    try {
        const summaryDoc = await db.collection('marga_site').doc('summary').get();
        const keyPagesDoc = await db.collection('marga_site').doc('key_pages').get();
        
        return {
            summary: summaryDoc.exists ? summaryDoc.data() : null,
            keyPages: keyPagesDoc.exists ? keyPagesDoc.data().pages : []
        };
    } catch (e) { return null; }
}

async function getGlobalMemory(db) {
    try {
        const doc = await db.collection('marga_ai_memory').doc('global').get();
        if (!doc.exists) return { facts: [], recentActions: [], improvements: [] };
        return doc.data();
    } catch (e) { return { facts: [], recentActions: [], improvements: [] }; }
}

async function updateGlobalMemory(db, update) {
    const memRef = db.collection('marga_ai_memory').doc('global');
    const doc = await memRef.get();
    const current = doc.exists ? doc.data() : { facts: [], recentActions: [], improvements: [] };
    
    if (update.fact) {
        current.facts = [...(current.facts || []).slice(-20), update.fact];
    }
    if (update.action) {
        current.recentActions = [...(current.recentActions || []).slice(-10), {
            ...update.action,
            timestamp: new Date().toISOString()
        }];
    }
    if (update.improvement) {
        current.improvements = [...(current.improvements || []).slice(-20), update.improvement];
    }
    
    current.lastUpdated = new Date().toISOString();
    await memRef.set(current);
}

function buildSystemPrompt(config, seoConfig, analytics, siteStructure, memory) {
    let prompt = `You are the AI SEO Manager for Marga Enterprises (marga.biz).

## CRITICAL PLATFORM INFO
⚠️ **This is a STATIC HTML site on Netlify** - NOT WordPress!
- Files stored on GitHub: github.com/PinedaMikeB/marga-biz
- You can create/edit pages via GitHub API
- **NEVER ask about WordPress, admin panels, or CMS**
- **NEVER ask for URLs you should already know**

## SITE STRUCTURE
`;

    if (siteStructure?.summary) {
        const s = siteStructure.summary;
        prompt += `- **Total Pages:** ${s.totalPages}
- **Categories:** ${Object.entries(s.categories || {}).map(([k,v]) => `${k}: ${v}`).join(', ')}
- **Last Scanned:** ${s.lastScanned || 'Never'}

`;
    }

    if (siteStructure?.keyPages?.length > 0) {
        prompt += `### Key Pages I Manage\n`;
        siteStructure.keyPages.slice(0, 20).forEach(p => {
            prompt += `- **${p.title}** (${p.path}) [${p.category}]\n`;
        });
        prompt += '\n';
    }

    // Analytics
    if (analytics) {
        prompt += `## CURRENT PERFORMANCE (Latest Snapshot)
- **Visitors:** ${analytics.summary?.visitors || analytics.ga4?.visitors || 'N/A'}
- **Page Views:** ${analytics.summary?.pageViews || analytics.ga4?.pageViews || 'N/A'}
- **Search Clicks:** ${analytics.summary?.clicks || analytics.searchConsole?.clicks || 'N/A'}
- **Avg Position:** ${analytics.summary?.avgPosition?.toFixed(1) || 'N/A'}

`;
        if (analytics.ga4?.topPages?.length > 0) {
            prompt += `### Top Pages by Traffic\n`;
            analytics.ga4.topPages.slice(0, 5).forEach((p, i) => {
                prompt += `${i+1}. ${p.path} - ${p.views} views\n`;
            });
            prompt += '\n';
        }
        if (analytics.searchConsole?.topKeywords?.length > 0) {
            prompt += `### Current Keyword Rankings\n`;
            analytics.searchConsole.topKeywords.slice(0, 10).forEach((k, i) => {
                prompt += `${i+1}. "${k.keyword}" - Position ${k.position?.toFixed(1)}, ${k.clicks} clicks\n`;
            });
            prompt += '\n';
        }
    }

    // SEO Config
    if (seoConfig?.competitors?.length > 0) {
        prompt += `## COMPETITORS MONITORED\n`;
        seoConfig.competitors.forEach(c => {
            prompt += `- **${c.domain}**: ${c.notes || 'No notes'}\n`;
        });
        prompt += '\n';
    }

    if (seoConfig?.keywords) {
        if (seoConfig.keywords.primary?.length > 0) {
            prompt += `## PRIMARY KEYWORDS (Protect)\n`;
            seoConfig.keywords.primary.forEach(k => prompt += `- "${k}"\n`);
            prompt += '\n';
        }
        if (seoConfig.keywords.growth?.length > 0) {
            prompt += `## GROWTH KEYWORDS (Target)\n`;
            seoConfig.keywords.growth.forEach(k => prompt += `- "${k}"\n`);
            prompt += '\n';
        }
    }

    // Global Memory
    if (memory?.facts?.length > 0) {
        prompt += `## THINGS I REMEMBER
${memory.facts.slice(-5).map(f => `- ${f}`).join('\n')}

`;
    }
    if (memory?.recentActions?.length > 0) {
        prompt += `## MY RECENT ACTIONS
${memory.recentActions.slice(-3).map(a => `- ${a.type}: ${a.description || JSON.stringify(a.data)}`).join('\n')}

`;
    }

    // Behavior rules
    prompt += `## MY BEHAVIOR RULES

### NEVER DO:
❌ Ask for website URLs (I know them all)
❌ Mention WordPress, admin panel, CMS
❌ Ask what services you offer (I know: printer rental, copier rental, print-all-you-can)
❌ Say "I don't have access to..." (I have full access via APIs)
❌ Be vague - give specific page names and data

### ALWAYS DO:
✅ Reference specific pages by path (e.g., "/copier-rental-manila/")
✅ Use actual data from analytics
✅ Suggest concrete improvements with reasons
✅ Offer action buttons when I can help execute

## CAPABILITIES
I can execute these actions (show as buttons):
- **add_competitor**: {domain, notes}
- **add_keyword**: {keyword, type}
- **create_page**: {slug, title, type, targetKeyword}
- **update_config**: {path, value}
- **remember**: {fact} - Store important info for future

Action format: <!--ACTIONS:[{"type":"...", "label":"...", "data":{}}]-->
`;

    if (config.additionalInstructions) {
        prompt += `\n## ADDITIONAL INSTRUCTIONS\n${config.additionalInstructions}\n`;
    }

    return prompt;
}

function normalizeModel(model) {
    const map = {
        'claude-opus-4-5-20250514': 'claude-opus-4-20250514',
        'claude-sonnet-4-5-20250514': 'claude-sonnet-4-20250514',
        'claude-haiku-4-5-20250514': 'claude-haiku-3-5-20241022',
    };
    return map[model] || model || 'claude-sonnet-4-20250514';
}

async function callClaude(messages, config, systemPrompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: normalizeModel(config.model),
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

    return (await response.json()).content[0].text;
}

function parseActions(response) {
    const match = response.match(/<!--ACTIONS:(\[.*?\])-->/s);
    let actions = [];
    let clean = response;

    if (match) {
        try {
            actions = JSON.parse(match[1]);
            clean = response.replace(match[0], '').trim();
        } catch (e) {}
    }
    return { response: clean, actions };
}

async function executeAction(db, action) {
    const { type, data } = action;

    switch (type) {
        case 'add_competitor': {
            const doc = await db.collection('marga_config').doc('settings').get();
            const config = doc.data();
            if (!config.seo) config.seo = {};
            if (!config.seo.competitors) config.seo.competitors = [];
            
            if (config.seo.competitors.some(c => c.domain === data.domain)) {
                return { success: false, message: 'Already exists' };
            }

            config.seo.competitors.push({ domain: data.domain, notes: data.notes || '', addedAt: new Date().toISOString() });
            await db.collection('marga_config').doc('settings').set(config);
            await updateGlobalMemory(db, { action: { type: 'add_competitor', description: `Added ${data.domain}` } });
            return { success: true, message: `Added ${data.domain}` };
        }

        case 'add_keyword': {
            const doc = await db.collection('marga_config').doc('settings').get();
            const config = doc.data();
            if (!config.seo?.keywords) config.seo = { ...config.seo, keywords: { primary: [], growth: [] } };
            
            const kwType = data.type || 'growth';
            const kw = data.keyword.toLowerCase();
            
            if (config.seo.keywords[kwType].includes(kw)) {
                return { success: false, message: 'Already exists' };
            }

            config.seo.keywords[kwType].push(kw);
            await db.collection('marga_config').doc('settings').set(config);
            await updateGlobalMemory(db, { action: { type: 'add_keyword', description: `Added "${kw}" to ${kwType}` } });
            return { success: true, message: `Added "${kw}"` };
        }

        case 'remember': {
            await updateGlobalMemory(db, { fact: data.fact });
            return { success: true, message: 'Remembered!' };
        }

        case 'create_page': {
            await db.collection('marga_tasks').add({
                type: 'create_page',
                status: 'pending',
                data,
                source: 'ai-chat',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await updateGlobalMemory(db, { action: { type: 'create_page', description: `Queued page: ${data.title || data.slug}` } });
            return { success: true, message: `Page creation queued` };
        }

        case 'update_config': {
            const doc = await db.collection('marga_config').doc('settings').get();
            const config = doc.data();
            const keys = data.path.split('.');
            let current = config;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = data.value;
            await db.collection('marga_config').doc('settings').set(config);
            return { success: true, message: `Updated ${data.path}` };
        }

        default:
            return { success: false, message: `Unknown action: ${type}` };
    }
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
    if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

    try {
        const app = getFirebaseApp();
        const db = admin.firestore(app);
        const body = JSON.parse(event.body || '{}');

        // Direct action execution
        if (body.action) {
            const result = await executeAction(db, { type: body.action, data: body.data });
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
        }

        const { message, history = [] } = body;
        if (!message) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };

        // Load ALL context
        const [configDoc, analytics, siteStructure, memory] = await Promise.all([
            db.collection('marga_config').doc('settings').get(),
            getLatestAnalytics(db),
            getSiteStructure(db),
            getGlobalMemory(db)
        ]);

        const config = configDoc.exists ? configDoc.data() : {};
        const systemPrompt = buildSystemPrompt(config.ai || {}, config.seo || {}, analytics, siteStructure, memory);

        // Build messages
        const messages = history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
        messages.push({ role: 'user', content: message });

        // Call Claude
        const rawResponse = await callClaude(messages, config.ai || {}, systemPrompt);
        const { response, actions } = parseActions(rawResponse);

        // Log chat
        await db.collection('marga_chat_log').add({
            userMessage: message,
            assistantResponse: response,
            actions,
            timestamp: new Date().toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: { response, actions } }) };

    } catch (error) {
        console.error('Chat error:', error);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, error: error.message }) };
    }
};
