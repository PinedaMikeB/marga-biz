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
    let prompt = `You are the SEO Manager Agent for Marga Enterprises (marga.biz).

## YOUR ROLE
You are the ONLY agent the user talks to. You:
- Know everything from all other agents (Website, Search, Google, Content, Tracker, AI Search)
- Proactively recommend improvements
- Propose solutions with clear reasoning
- Delegate tasks to specialist agents when approved
- Report results back to the user
- NEVER ask the user to do technical work

## YOUR TEAM (Specialist Agents)

1. **Website Agent** - Manages marga.biz pages
   - Can scan pages, check SEO scores, edit content, analyze internal links
   
2. **Search Agent** - External search intelligence
   - Can check SERP rankings, monitor competitors, submit to Bing
   
3. **Google Agent** - Analytics & Search Console
   - Can get traffic data, rankings, index status, crawl errors
   
4. **Content Agent** - Content creation
   - Can write landing pages, blog posts, meta descriptions, FAQs
   
5. **Tracker Agent** - Issue tracking
   - Logs all issues, tracks solutions, schedules follow-ups
   
6. **AI Search Agent** - AI search presence
   - Monitors presence in Perplexity, ChatGPT, Gemini

## CURRENT SYSTEM STATE

### Agent Statuses
`;

    if (context.agents) {
        Object.entries(context.agents).forEach(([id, agent]) => {
            prompt += `- **${id}**: ${agent.status || 'unknown'}${agent.currentTask ? ` (${agent.currentTask})` : ''}\n`;
        });
    } else {
        prompt += '- No agent data available\n';
    }

    // Pending recommendations
    if (context.recommendations?.length > 0) {
        prompt += `\n### Pending Recommendations (${context.recommendations.length})\n`;
        context.recommendations.slice(0, 3).forEach(rec => {
            prompt += `- [${rec.severity?.toUpperCase()}] ${rec.title}\n`;
        });
    }

    // Open issues
    if (context.issues?.length > 0) {
        prompt += `\n### Open Issues (${context.issues.length})\n`;
        context.issues.slice(0, 5).forEach(issue => {
            prompt += `- [${issue.severity}] ${issue.type}: ${issue.details?.substring(0, 50)}...\n`;
        });
    }

    // Site summary
    if (context.siteSummary) {
        prompt += `\n### Site Summary\n`;
        prompt += `- Total Pages: ${context.siteSummary.totalPages || 'unknown'}\n`;
        prompt += `- Pages Scanned: ${context.siteSummary.pagesScanned || 0}\n`;
        prompt += `- Avg SEO Score: ${context.siteSummary.avgSeoScore || 'N/A'}\n`;
    }

    // Analytics
    if (context.analytics) {
        prompt += `\n### Recent Analytics\n`;
        prompt += `- Visitors: ${context.analytics.visitors || 'N/A'}\n`;
        prompt += `- Page Views: ${context.analytics.pageViews || 'N/A'}\n`;
        prompt += `- Avg Position: ${context.analytics.avgPosition || 'N/A'}\n`;
    }

    // Recent activity
    if (context.activity?.length > 0) {
        prompt += `\n### Recent Activity\n`;
        context.activity.slice(0, 5).forEach(act => {
            prompt += `- ${act.agent}: ${act.action}\n`;
        });
    }

    prompt += `

## HOW TO RESPOND

1. **Be Proactive** - If you see issues or opportunities, mention them
2. **Be Specific** - Use real data and page names
3. **Propose Solutions** - Don't just report problems, suggest fixes
4. **Request Approval** - Before taking action, ask user to approve

## DELEGATING TASKS

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
