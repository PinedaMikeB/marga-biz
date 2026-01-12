/**
 * Marga AI - SEO Manager Agent (Orchestrator)
 * 
 * The ONLY agent the user talks to.
 * Uses tools directly (MCP-style) for immediate results.
 * Aggregates data, makes recommendations, executes actions.
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

// Direct tool functions (MCP-style)
const {
    scanPage,
    checkRanking,
    findCompetitors,
    getCachedPage,
    getSearchConsoleData,
    getSiteOverview,
    editPageSEO
} = require('./lib/agent-tools');

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Available tools for Claude to use
 */
const TOOLS = [
    {
        name: "scan_page",
        description: "Scan a page for SEO issues. Returns actual title, meta, headings, word count, SEO score, and specific issues. Use this to get REAL data about a page.",
        input_schema: {
            type: "object",
            properties: {
                page_path: {
                    type: "string",
                    description: "The page path to scan, e.g., '/printer-rental/' or full URL"
                }
            },
            required: ["page_path"]
        }
    },
    {
        name: "edit_page_seo",
        description: "Edit a page's SEO elements (title tag, meta description). This ACTUALLY updates the live website via GitHub. Use when user approves SEO changes. The page_path should be a URL path like '/printer-rental/' or just 'printer-rental'.",
        input_schema: {
            type: "object",
            properties: {
                page_path: {
                    type: "string",
                    description: "URL path like '/printer-rental/' or 'printer-rental' (NOT the full file path)"
                },
                title: {
                    type: "string",
                    description: "New title tag content (optional)"
                },
                meta_description: {
                    type: "string",
                    description: "New meta description content (optional)"
                }
            },
            required: ["page_path"]
        }
    },
    {
        name: "check_ranking",
        description: "Check live Google SERP ranking for a keyword. Returns your position and top 10 competitors. Use this for real-time ranking data.",
        input_schema: {
            type: "object",
            properties: {
                keyword: {
                    type: "string",
                    description: "The keyword to check rankings for"
                }
            },
            required: ["keyword"]
        }
    },
    {
        name: "find_competitors",
        description: "Find and analyze competitors ranking for a keyword. Returns competitor list with positions and opportunities.",
        input_schema: {
            type: "object",
            properties: {
                keyword: {
                    type: "string",
                    description: "The keyword to find competitors for"
                }
            },
            required: ["keyword"]
        }
    },
    {
        name: "get_search_console",
        description: "Get Search Console data for keyword performance. Returns historical clicks, impressions, and positions.",
        input_schema: {
            type: "object",
            properties: {
                keyword: {
                    type: "string",
                    description: "The keyword to get Search Console data for"
                }
            },
            required: ["keyword"]
        }
    },
    {
        name: "get_site_overview",
        description: "Get overview of the site including total pages, recent scans, and SEO scores.",
        input_schema: {
            type: "object",
            properties: {}
        }
    }
];

/**
 * Execute a tool call
 */
async function executeTool(toolName, toolInput) {
    switch (toolName) {
        case 'scan_page':
            return await scanPage(toolInput.page_path);
        case 'edit_page_seo':
            return await editPageSEO(toolInput.page_path, {
                title: toolInput.title,
                metaDescription: toolInput.meta_description
            });
        case 'check_ranking':
            return await checkRanking(toolInput.keyword);
        case 'find_competitors':
            return await findCompetitors(toolInput.keyword);
        case 'get_search_console':
            return await getSearchConsoleData(toolInput.keyword);
        case 'get_site_overview':
            return await getSiteOverview();
        default:
            return { error: `Unknown tool: ${toolName}` };
    }
}

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
    
    // Get latest analytics snapshot
    let analytics = null;
    try {
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('timestamp', 'desc')
            .limit(1)
            .get();
        if (!snapshot.empty) {
            analytics = snapshot.docs[0].data();
        }
    } catch (e) {
        // Ignore if no snapshots
    }
    
    // Get Search Console keyword data
    let searchConsoleData = null;
    try {
        const gscDoc = await db.collection('marga_analytics').doc('search_console').get();
        if (gscDoc.exists) {
            searchConsoleData = gscDoc.data();
        }
    } catch (e) {}
    
    // Get scanned pages summary
    let pagesData = null;
    try {
        const indexDoc = await db.collection('marga_pages').doc('_index').get();
        if (indexDoc.exists) {
            pagesData = indexDoc.data();
        }
    } catch (e) {}
    
    return {
        agents,
        recommendations,
        issues,
        activity,
        siteSummary,
        analytics,
        searchConsoleData,
        pagesData
    };
}

/**
 * Call Search Agent to check rankings
 */
async function callSearchAgent(action, params = {}) {
    try {
        const queryString = new URLSearchParams({ action, ...params }).toString();
        const response = await fetch(`https://marga.biz/.netlify/functions/agent-search?${queryString}`);
        const result = await response.json();
        return result.success ? result.data : { error: result.error };
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Call Page Scanner to analyze a page
 */
async function callPageScanner(pagePath) {
    try {
        // Page scanner uses query params, not POST body
        const queryString = new URLSearchParams({ 
            action: 'get', 
            path: pagePath,
            maxAge: '3600000' // 1 hour cache
        }).toString();
        const response = await fetch(`https://marga.biz/.netlify/functions/page-scanner?${queryString}`);
        const result = await response.json();
        
        if (!result.success) {
            return { error: result.error || 'Scanner returned error' };
        }
        
        // result.data can be null if page not yet scanned
        if (!result.data) {
            return { error: 'Page not yet scanned. Try scanning the site first.' };
        }
        
        return result.data;
    } catch (e) {
        return { error: e.message };
    }
}

/**
 * Detect if user wants page analysis and scan the page
 */
async function enrichContextWithPageScan(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Check if user said yes to analyzing or wants to scan
    const analyzeKeywords = ['yes', 'analyze', 'scan', 'check page', 'check my page', 'optimize', 'improvement'];
    const wantsAnalysis = analyzeKeywords.some(k => lowerMessage.includes(k));
    
    if (wantsAnalysis) {
        // Determine which page to scan (use PATH not full URL)
        let pagePath = '/printer-rental/'; // Default - main printer rental page
        
        if (lowerMessage.includes('copier')) {
            pagePath = '/copier-rental/';
        } else if (lowerMessage.includes('home') || lowerMessage.includes('homepage')) {
            pagePath = '/';
        } else if (lowerMessage.includes('pricing') || lowerMessage.includes('price')) {
            pagePath = '/pricing-guide/';
        } else if (lowerMessage.includes('contact')) {
            pagePath = '/contact/';
        } else if (lowerMessage.includes('about')) {
            pagePath = '/about/';
        } else if (lowerMessage.includes('quote')) {
            pagePath = '/quote/';
        }
        
        // Extract path if full URL provided
        const urlMatch = lowerMessage.match(/marga\.biz(\/[^\s]*)/);
        if (urlMatch) {
            pagePath = urlMatch[1];
        }
        
        // Call Page Scanner
        const scanResult = await callPageScanner(pagePath);
        
        if (scanResult && !scanResult.error) {
            if (scanResult.data) {
                // Nested structure: { fresh: true, data: {...} }
                context.pageScanResult = scanResult.data;
            } else if (scanResult.path) {
                // Flat structure: { path: '/', title: '...', ...}
                context.pageScanResult = scanResult;
            } else {
                context.pageScanError = 'Page not found or not yet scanned';
            }
        } else {
            context.pageScanError = scanResult?.error || 'Unknown scanner error';
        }
    }
    
    return context;
}

/**
 * Detect if user is asking about rankings and get live data
 */
async function enrichContextWithSearchData(message, context) {
    const lowerMessage = message.toLowerCase();
    
    // Check if asking about rankings
    const rankingKeywords = ['ranking', 'rank', 'position', 'serp', 'search result', 'where do i rank', 'check my'];
    const isAskingRanking = rankingKeywords.some(k => lowerMessage.includes(k));
    
    if (isAskingRanking) {
        // Extract keyword from message or use default
        let keyword = 'printer rental philippines';
        
        // Try to extract specific keyword
        const keywordPatterns = [
            /for ['"]?([^'"]+)['"]?/i,
            /keyword ['"]?([^'"]+)['"]?/i,
            /['"]([^'"]+)['"]/
        ];
        
        for (const pattern of keywordPatterns) {
            const match = lowerMessage.match(pattern);
            if (match) {
                keyword = match[1];
                break;
            }
        }
        
        // Call Search Agent
        const rankingData = await callSearchAgent('quick_check', { keyword });
        
        if (!rankingData.error) {
            context.liveRankingData = rankingData;
        } else {
            context.searchAgentError = rankingData.error;
        }
    }
    
    return context;
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
2. **Search Agent** - Checks LIVE SERP rankings, finds competitors (NOT YET BUILT - be honest about this)
3. **Google Agent** - GA4 traffic, Search Console data, index status
4. **Content Agent** - Writes landing pages, blog posts, meta descriptions
5. **Tracker Agent** - Logs issues, tracks solutions, schedules follow-ups
6. **AI Search Agent** - Monitors Perplexity, ChatGPT, Gemini presence (NOT YET BUILT)

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
    } else {
        prompt += `- Total Pages: ~1,903 (from sitemap)\n`;
    }
    
    // Pages scan data
    if (context.pagesData) {
        prompt += `- Pages Scanned: ${context.pagesData.totalScanned || 'some'}\n`;
        prompt += `- Last Scan: ${context.pagesData.lastFullScan || 'recent'}\n`;
    }

    // LIVE RANKING DATA (from Search Agent)
    if (context.liveRankingData && context.liveRankingData.top10) {
        const rd = context.liveRankingData;
        prompt += `\n### 🔴 LIVE SERP RANKING (Just Checked)\n`;
        prompt += `**Keyword:** "${rd.keyword}"\n`;
        prompt += `**Your Position:** ${rd.margaPosition === 'Not in top 20' ? '❌ Not in top 20' : `#${rd.margaPosition}`}\n`;
        prompt += `**Checked:** Just now\n\n`;
        prompt += `**Top 10 Results:**\n`;
        rd.top10.forEach(r => {
            const isMarga = r.domain.includes('marga.biz');
            prompt += `${r.position}. ${isMarga ? '👉 ' : ''}${r.domain}${isMarga ? ' (YOU)' : ''}\n`;
        });
        prompt += `\n**USE THIS DATA** - This is real-time, not historical!\n`;
    }
    
    if (context.searchAgentError) {
        prompt += `\n### ⚠️ Search Agent Status\n`;
        prompt += `Cannot check live rankings: ${context.searchAgentError}\n`;
        prompt += `To enable live SERP checking:\n`;
        prompt += `1. Get free API key at serper.dev\n`;
        prompt += `2. Add SERPER_API_KEY to Netlify environment variables\n`;
        prompt += `3. Redeploy the site\n`;
    }

    // PAGE SCAN RESULTS (from Page Scanner)
    if (context.pageScanResult) {
        const scan = context.pageScanResult;
        prompt += `\n### 📄 PAGE SCAN RESULTS (Just Scanned)\n`;
        prompt += `**URL:** ${scan.url}\n`;
        prompt += `**SEO Score:** ${scan.seoScore}/100 (Grade: ${scan.grade})\n\n`;
        
        if (scan.title) {
            prompt += `**Title:** "${scan.title}" (${scan.title.length} chars)\n`;
        }
        if (scan.metaDescription) {
            prompt += `**Meta Description:** "${scan.metaDescription.substring(0, 100)}..." (${scan.metaDescription.length} chars)\n`;
        }
        
        prompt += `\n**Content Stats:**\n`;
        prompt += `- Word Count: ${scan.wordCount || 'N/A'}\n`;
        prompt += `- H1: ${scan.h1 || 'Missing!'}\n`;
        prompt += `- H2 Count: ${scan.headings?.h2 || 0}\n`;
        prompt += `- Internal Links: ${scan.internalLinks || 0}\n`;
        prompt += `- Images: ${scan.images?.total || 0} (${scan.images?.withAlt || 0} with alt)\n`;
        
        if (scan.issues && scan.issues.length > 0) {
            prompt += `\n**Issues Found (${scan.issues.length}):**\n`;
            scan.issues.slice(0, 10).forEach(issue => {
                prompt += `- [${issue.severity?.toUpperCase() || 'ISSUE'}] ${issue.message} (${issue.points ? `-${issue.points} pts` : ''})\n`;
            });
        }
        
        if (scan.passed && scan.passed.length > 0) {
            prompt += `\n**Passed Checks (${scan.passed.length}):**\n`;
            scan.passed.slice(0, 5).forEach(p => {
                prompt += `- ✅ ${p.message}\n`;
            });
        }
        
        prompt += `\n**USE THIS DATA** - Give specific recommendations based on these actual issues!\n`;
    }
    
    if (context.pageScanError) {
        prompt += `\n### ⚠️ Page Scan Error\n`;
        prompt += `Could not scan page: ${context.pageScanError}\n`;
    }

    // Analytics if available
    if (context.analytics) {
        prompt += `\n### Latest Analytics Snapshot\n`;
        if (context.analytics.traffic) {
            prompt += `- Sessions: ${context.analytics.traffic.sessions || 'N/A'}\n`;
            prompt += `- Users: ${context.analytics.traffic.users || 'N/A'}\n`;
            prompt += `- Page Views: ${context.analytics.traffic.pageViews || 'N/A'}\n`;
        }
        if (context.analytics.seo) {
            prompt += `- Impressions: ${context.analytics.seo.impressions || 'N/A'}\n`;
            prompt += `- Clicks: ${context.analytics.seo.clicks || 'N/A'}\n`;
            prompt += `- Avg Position: ${context.analytics.seo.avgPosition || 'N/A'}\n`;
        }
        if (context.analytics.seo?.topKeywords && Array.isArray(context.analytics.seo.topKeywords)) {
            prompt += `\n### Top Keywords (from Search Console)\n`;
            context.analytics.seo.topKeywords.slice(0, 10).forEach(kw => {
                prompt += `- "${kw.query || 'unknown'}": position ${kw.position?.toFixed(1) || 'N/A'}, ${kw.clicks || 0} clicks\n`;
            });
        }
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

### When User Asks About Rankings:
- Show the Search Console data you have (if available in context)
- Be honest that Search Agent isn't built yet for live SERP
- DON'T ask "would you like me to check X?" - just check everything relevant

### When User Mentions Competitors:
- DON'T just read from stored settings
- Be honest that you need Search Agent to verify current competitors
- DON'T trust stored competitor lists blindly

### When Proposing Actions:
1. State what you know
2. Identify the issue/opportunity  
3. Propose specific solution
4. Ask for approval ONLY for actions that make changes

## TOOLS AVAILABLE

You have access to these tools. USE THEM to get real data:

1. **scan_page** - Scan any page for SEO issues (REAL data, not guesses)
2. **check_ranking** - Check live SERP ranking for a keyword
3. **find_competitors** - Find competitors for a keyword
4. **get_search_console** - Get historical Search Console data
5. **get_site_overview** - Get site stats and recent scans

**CRITICAL:** USE MULTIPLE TOOLS IN ONE RESPONSE. Don't ask if user wants more - JUST DO IT.

## SMART BEHAVIOR

When user asks "check my ranking for X":
1. Use check_ranking tool → Get position
2. Use scan_page tool → Analyze the relevant page (e.g., /printer-rental/)
3. Cross-reference: Is the page optimized for that keyword?
4. Give COMPLETE analysis with actionable fixes
5. DO NOT ask "would you like me to scan the page?" - JUST SCAN IT

When user asks "analyze my page":
1. Use scan_page tool → Get real SEO data
2. Use check_ranking tool → See how it's ranking for its target keywords
3. Compare with competitors
4. Give prioritized action plan

## RESPONSE RULES

### DON'T:
- Don't GUESS page content - use scan_page tool
- Don't ASSUME rankings - use check_ranking tool
- Don't ask "would you like me to...?" - JUST DO IT
- Don't ask basic questions about the business
- Don't ask user to "check if page loads" - YOU check it
- Don't ask user to "confirm" anything - YOU verify
- Don't end responses with questions - end with ACTION PLAN
- Don't blame "technical issues" without trying to fix them
- Don't do partial analysis - be COMPREHENSIVE

### DO:
- Use MULTIPLE tools in one response
- Show actual results from ALL relevant tools
- Be specific with real numbers
- Give COMPLETE prioritized action plan
- If a tool fails, try a different approach
- Cross-reference data between tools
- End with concrete next steps YOU can take

### CRITICAL RULES
❌ WRONG: "Would you like me to analyze your page next?"
❌ WRONG: "Let me know if you want more details"
❌ WRONG: "Should I check Search Console too?"
✅ RIGHT: Use all relevant tools, give complete analysis, end with action plan

## EXAMPLE RESPONSE STRUCTURE

When asked "check my ranking for printer rental philippines":

1. **RANKING DATA** (from check_ranking)
   - Your position: #X
   - Top 5 competitors with domains

2. **PAGE ANALYSIS** (from scan_page on /printer-rental/)
   - Current title, meta, SEO score
   - Specific issues found

3. **GAP ANALYSIS**
   - Why competitors rank higher
   - What's missing from your page

4. **ACTION PLAN** (prioritized)
   - Week 1: Quick wins
   - Week 2: Content fixes
   - Week 3: Technical SEO

DO NOT ask if user wants this analysis - JUST PROVIDE IT ALL.
`;

    return prompt;
}

/**
 * Call Claude API with tools
 */
async function callClaudeWithTools(messages, systemPrompt) {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) throw new Error('CLAUDE_API_KEY not configured');

    let currentMessages = [...messages];
    let finalResponse = '';
    let iterations = 0;
    const maxIterations = 5; // Prevent infinite loops

    while (iterations < maxIterations) {
        iterations++;
        
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
                tools: TOOLS,
                messages: currentMessages
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Claude API error: ${response.status} - ${error}`);
        }

        const result = await response.json();
        
        // Check if Claude wants to use tools
        if (result.stop_reason === 'tool_use') {
            // Find tool use blocks
            const toolUseBlocks = result.content.filter(b => b.type === 'tool_use');
            const textBlocks = result.content.filter(b => b.type === 'text');
            
            // Collect any text before tool calls
            if (textBlocks.length > 0) {
                finalResponse += textBlocks.map(b => b.text).join('\n');
            }
            
            // Add assistant message with tool use
            currentMessages.push({
                role: 'assistant',
                content: result.content
            });
            
            // Execute each tool and collect results
            const toolResults = [];
            for (const toolUse of toolUseBlocks) {
                console.log(`Executing tool: ${toolUse.name}`, toolUse.input);
                const toolResult = await executeTool(toolUse.name, toolUse.input);
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: JSON.stringify(toolResult)
                });
            }
            
            // Add tool results
            currentMessages.push({
                role: 'user',
                content: toolResults
            });
            
        } else {
            // No more tool calls, get final response
            const textContent = result.content.filter(b => b.type === 'text');
            finalResponse += textContent.map(b => b.text).join('\n');
            break;
        }
    }

    return finalResponse;
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

        // Get basic context (tools will fetch specific data as needed)
        let context = await getManagerContext(db);
        
        // Build system prompt
        const systemPrompt = buildManagerPrompt(context);

        // Build messages
        const messages = history.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
        }));
        messages.push({ role: 'user', content: message });

        // Call Claude with tools (MCP-style)
        let rawResponse = await callClaudeWithTools(messages, systemPrompt);
        
        // Parse delegations and approvals (for backwards compatibility)
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
