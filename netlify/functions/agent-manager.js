/**
 * Marga AI - SEO Manager Agent (Orchestrator)
 * 
 * The ONLY agent the user talks to.
 * Aggregates data from all agents, makes recommendations,
 * delegates tasks, and reports results.
 */

const {
    getDb,
    AGENTS,
    AGENT_STATUS,
    updateAgentStatus,
    getAllAgentsStatus,
    createTask,
    getPendingRecommendations,
    updateRecommendation,
    getRecommendation,
    getOpenIssues,
    getRecentActivity,
    logActivity,
    getSharedData
} = require('./lib/agent-utils');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Get comprehensive context for the Manager
 */
async function getManagerContext(db) {
    // Get all agent statuses
    const agents = await getAllAgentsStatus();
    
    // Get pending recommendations
    const recommendations = await getPendingRecommendations();
    
    // Get open issues
    const issues = await getOpenIssues(10);
    
    // Get recent activity
    const activity = await getRecentActivity(10);
    
    // Get site summary
    const siteSummary = await getSharedData('site_summary');
    
    // Get latest analytics
    const analytics = await getSharedData('latest_analytics');
    
    // Get tracked keywords
    const keywords = await getSharedData('tracked_keywords');
    
    return {
        agents,
        recommendations,
        issues,
        activity,
        siteSummary,
        analytics,
        keywords
    };
}

/**
 * Build the Manager's system prompt
 */
function buildManagerPrompt(context) {
    let prompt = `You are the SEO Manager Agent for Marga Enterprises (marga.biz), a printer and copier rental business in Metro Manila, Philippines.

## YOUR IDENTITY
- You are an EXPERT SEO strategist with independent thinking
- You have a team of specialist agents you can delegate to
- You KNOW the business already - don't ask basic questions
- You PROACTIVELY identify opportunities and issues
- You VERIFY information before trusting it

## CRITICAL RULES - READ CAREFULLY

### 1. NEVER ASK THE USER BASIC QUESTIONS
❌ WRONG: "Do you have a /printer-rental/ page?"
❌ WRONG: "Is printer rental a major service for you?"
❌ WRONG: "Can you tell me about your business?"
✅ RIGHT: State what you know and propose actions

### 2. THINK INDEPENDENTLY
- Don't be limited by stored settings or competitor lists
- If you see opportunities, SUGGEST them
- If stored data seems wrong, SAY SO and propose verification
- Discover NEW keywords and competitors proactively

### 3. VERIFY, DON'T BLINDLY TRUST
- Stored competitor lists may be outdated or wrong
- Always verify by delegating to Search Agent
- Real rankings change - check current data

### 4. YOU ALREADY KNOW THE BUSINESS
- Marga Enterprises = printer/copier rental in Metro Manila
- Target keywords: printer rental, copier rental, Philippines, Manila
- Main services: monthly rentals, maintenance, supplies
- You can access ALL page data via Website Agent

## YOUR TEAM (Delegate Tasks To Them)

1. **Website Agent** - Scans marga.biz pages, checks SEO, edits content
2. **Search Agent** - Checks LIVE SERP rankings, finds competitors (NOT YET BUILT - say "I'll check once Search Agent is ready")
3. **Google Agent** - GA4 traffic, Search Console data, index status
4. **Content Agent** - Writes landing pages, blog posts, meta descriptions
5. **Tracker Agent** - Logs issues, tracks solutions, schedules follow-ups
6. **AI Search Agent** - Monitors Perplexity, ChatGPT, Gemini presence

## CURRENT KNOWLEDGE

### Business Facts (You Know This)
- Company: Marga Enterprises
- Website: marga.biz (static site on Netlify)
- Services: Printer rental, Copier rental, Maintenance
- Location: Metro Manila, Philippines
- Target Areas: Manila, Makati, BGC, Quezon City, and provinces

### Site Data
`;

    // Site summary
    if (context.siteSummary) {
        prompt += `- Total Pages: ${context.siteSummary.totalPages || '1,903'}\n`;
        prompt += `- Pages Scanned: ${context.siteSummary.pagesScanned || 0}\n`;
    } else {
        prompt += `- Total Pages: ~1,903 (from sitemap)\n`;
    }

    // Agent statuses
    prompt += `\n### Agent Status\n`;
    if (context.agents && Object.keys(context.agents).length > 0) {
        Object.entries(context.agents).forEach(([id, agent]) => {
            prompt += `- ${id}: ${agent.status || 'idle'}\n`;
        });
    } else {
        prompt += `- All agents idle (ready to work)\n`;
    }

    // Analytics if available
    if (context.analytics) {
        prompt += `\n### Recent Analytics\n`;
        prompt += `- Visitors: ${context.analytics.visitors || 'N/A'}\n`;
        prompt += `- Avg Position: ${context.analytics.avgPosition || 'N/A'}\n`;
    }

    // Open issues
    if (context.issues?.length > 0) {
        prompt += `\n### Open Issues (${context.issues.length})\n`;
        context.issues.slice(0, 5).forEach(issue => {
            prompt += `- [${issue.severity}] ${issue.type}: ${issue.details?.substring(0, 50)}...\n`;
        });
    }

    // Pending recommendations
    if (context.recommendations?.length > 0) {
        prompt += `\n### Pending Recommendations (${context.recommendations.length})\n`;
        context.recommendations.slice(0, 3).forEach(rec => {
            prompt += `- [${rec.severity?.toUpperCase()}] ${rec.title}\n`;
        });
    }

    prompt += `

## HOW TO RESPOND

### When User Asks About Rankings:
Say: "I'll check your current rankings. Note: The Search Agent is being built - once ready, I can check live SERP data automatically. For now, I can see your Search Console data which shows your average positions."

### When User Mentions Competitors:
- DON'T just read from stored settings
- Say: "Let me verify the current competitive landscape..."
- Note any discrepancies between stored and actual data

### When Proposing Actions:
1. State what you know
2. Identify the issue/opportunity
3. Propose specific solution
4. Ask for approval
5. Delegate to appropriate agent

## RESPONSE FORMAT

Be conversational but professional. Structure complex responses with:
- Brief summary of the situation
- Your analysis
- Proposed action(s)
- Request for approval if needed

## IMPORTANT LIMITATIONS (Be Honest)

- Search Agent not yet built - can't check live SERP rankings yet
- Can see Search Console data (historical rankings)
- Can scan your pages for SEO issues
- Can propose content improvements
- Cannot make changes without your approval
`;

    return prompt;
}

When user approves an action, include this in your response:
<!--DELEGATE:{"agent":"agent_id","action":"action_name","data":{...}}-->

Available delegations:
- Website: scan_page, edit_page, check_links, analyze_page
- Search: check_ranking, find_competitors, submit_to_bing
- Google: get_analytics, check_index, request_indexing
- Content: write_page, expand_content, write_meta, write_faq
- Tracker: create_issue, create_followup, check_followups
- AI_Search: check_perplexity, check_chatgpt, analyze_ai_presence

## APPROVAL WORKFLOW

When proposing a fix, include approval buttons:
<!--APPROVAL:{"id":"rec_id","title":"Short title","actions":[...]}-->

## IMPORTANT RULES

- NEVER say "I cannot browse the web" - delegate to Search Agent instead
- NEVER ask user to check things manually - use your agents
- NEVER say you don't have access - you have full access via agents
- ALWAYS be helpful and proactive
- When user asks about rankings, delegate to Search Agent
- When user asks about traffic, delegate to Google Agent
`;

    return prompt;
}

/**
 * Call Claude API
 */
async function callClaude(messages, systemPrompt) {
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
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            temperature: 0.7,
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

/**
 * Parse delegations from response
 */
function parseDelegations(response) {
    const delegations = [];
    const matches = response.matchAll(/<!--DELEGATE:({.*?})-->/gs);
    
    for (const match of matches) {
        try {
            delegations.push(JSON.parse(match[1]));
        } catch (e) {}
    }
    
    // Clean response
    let clean = response.replace(/<!--DELEGATE:.*?-->/gs, '').trim();
    
    return { response: clean, delegations };
}

/**
 * Parse approval requests from response
 */
function parseApprovals(response) {
    const approvals = [];
    const matches = response.matchAll(/<!--APPROVAL:({.*?})-->/gs);
    
    for (const match of matches) {
        try {
            approvals.push(JSON.parse(match[1]));
        } catch (e) {}
    }
    
    let clean = response.replace(/<!--APPROVAL:.*?-->/gs, '').trim();
    
    return { response: clean, approvals };
}

/**
 * Execute delegated tasks
 */
async function executeDelegations(delegations) {
    const results = [];
    
    for (const del of delegations) {
        try {
            const taskId = await createTask({
                agent: del.agent,
                action: del.action,
                data: del.data,
                assignedBy: AGENTS.MANAGER
            });
            
            await logActivity(AGENTS.MANAGER, 'delegated_task', {
                taskId,
                agent: del.agent,
                action: del.action
            });
            
            results.push({ success: true, taskId, agent: del.agent, action: del.action });
        } catch (e) {
            results.push({ success: false, error: e.message, agent: del.agent });
        }
    }
    
    return results;
}

/**
 * Handle approval action
 */
async function handleApproval(recId, approved) {
    const rec = await getRecommendation(recId);
    if (!rec) return { success: false, error: 'Recommendation not found' };
    
    if (approved) {
        // Execute the recommended actions
        if (rec.actions && rec.actions.length > 0) {
            const results = await executeDelegations(rec.actions);
            await updateRecommendation(recId, { 
                status: 'approved',
                approvedAt: new Date().toISOString(),
                executionResults: results
            });
            return { success: true, message: 'Actions executed', results };
        }
    } else {
        await updateRecommendation(recId, { 
            status: 'dismissed',
            dismissedAt: new Date().toISOString()
        });
    }
    
    return { success: true };
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
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    }

    try {
        const db = getDb();
        const body = JSON.parse(event.body || '{}');
        
        // Update manager status
        await updateAgentStatus(AGENTS.MANAGER, AGENT_STATUS.RUNNING, {
            currentTask: 'processing_chat'
        });

        // Handle approval action
        if (body.action === 'approve' || body.action === 'dismiss') {
            const result = await handleApproval(body.recId, body.action === 'approve');
            await updateAgentStatus(AGENTS.MANAGER, AGENT_STATUS.IDLE);
            return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: result }) };
        }

        // Handle chat message
        const { message, history = [] } = body;
        if (!message) {
            await updateAgentStatus(AGENTS.MANAGER, AGENT_STATUS.IDLE);
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message required' }) };
        }

        // Get comprehensive context
        const context = await getManagerContext(db);
        
        // Build system prompt
        const systemPrompt = buildManagerPrompt(context);

        // Build messages
        const messages = history.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));
        messages.push({ role: 'user', content: message });

        // Call Claude
        let rawResponse = await callClaude(messages, systemPrompt);
        
        // Parse delegations and approvals
        const { response: cleanResponse, delegations } = parseDelegations(rawResponse);
        const { response: finalResponse, approvals } = parseApprovals(cleanResponse);
        
        // Execute any delegations
        let delegationResults = [];
        if (delegations.length > 0) {
            delegationResults = await executeDelegations(delegations);
        }

        // Log the chat
        await logActivity(AGENTS.MANAGER, 'chat_response', {
            userMessage: message.substring(0, 100),
            delegations: delegations.length,
            approvals: approvals.length
        });

        await updateAgentStatus(AGENTS.MANAGER, AGENT_STATUS.IDLE);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: {
                    response: finalResponse,
                    delegations: delegationResults,
                    approvals,
                    context: {
                        pendingRecommendations: context.recommendations?.length || 0,
                        openIssues: context.issues?.length || 0
                    }
                }
            })
        };

    } catch (error) {
        console.error('Manager error:', error);
        await updateAgentStatus(AGENTS.MANAGER, AGENT_STATUS.ERROR, {
            lastError: error.message
        });
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};
