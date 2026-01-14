/**
 * API Usage Stats - Fetches REAL billing data from Anthropic Admin API
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
        const adminKey = process.env.ANTHROPIC_ADMIN_KEY;
        
        if (!adminKey) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'ANTHROPIC_ADMIN_KEY not configured. Add your Admin API key to Netlify environment variables.',
                    help: 'Get your Admin API key from console.anthropic.com → Settings → API Keys → Admin Keys'
                })
            };
        }

        const params = event.queryStringParameters || {};
        const days = parseInt(params.days) || 30;
        
        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        
        const startingAt = startDate.toISOString();
        const endingAt = endDate.toISOString();

        // Fetch usage data from Anthropic
        const usageUrl = `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${startingAt}&ending_at=${endingAt}&bucket_width=1d&limit=31`;
        
        const usageResponse = await fetch(usageUrl, {
            headers: {
                'anthropic-version': '2023-06-01',
                'x-api-key': adminKey
            }
        });

        if (!usageResponse.ok) {
            const errorText = await usageResponse.text();
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: `Anthropic API error: ${usageResponse.status}`,
                    details: errorText
                })
            };
        }

        const usageData = await usageResponse.json();

        // Fetch cost data from Anthropic
        const costUrl = `https://api.anthropic.com/v1/organizations/cost_report?starting_at=${startingAt}&ending_at=${endingAt}&bucket_width=1d&limit=31`;
        
        const costResponse = await fetch(costUrl, {
            headers: {
                'anthropic-version': '2023-06-01',
                'x-api-key': adminKey
            }
        });

        let costData = null;
        if (costResponse.ok) {
            costData = await costResponse.json();
        }

        // Process usage data
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCacheCreation = 0;
        let totalCacheReads = 0;
        const dailyUsage = [];

        if (usageData.data) {
            for (const bucket of usageData.data) {
                let dayInput = 0;
                let dayOutput = 0;
                
                for (const result of bucket.results || []) {
                    dayInput += result.uncached_input_tokens || 0;
                    dayOutput += result.output_tokens || 0;
                    totalCacheCreation += result.cache_creation_input_tokens || 0;
                    totalCacheReads += result.cache_read_input_tokens || 0;
                }
                
                totalInputTokens += dayInput;
                totalOutputTokens += dayOutput;
                
                dailyUsage.push({
                    date: bucket.starting_at?.split('T')[0],
                    inputTokens: dayInput,
                    outputTokens: dayOutput
                });
            }
        }

        // Process cost data
        let totalCost = 0;
        const dailyCosts = [];

        if (costData && costData.data) {
            for (const bucket of costData.data) {
                let dayCost = 0;
                
                for (const result of bucket.results || []) {
                    // Amount is in cents as a string like "123.45"
                    const amount = parseFloat(result.amount || 0) / 100;
                    dayCost += amount;
                }
                
                totalCost += dayCost;
                
                dailyCosts.push({
                    date: bucket.starting_at?.split('T')[0],
                    cost: dayCost
                });
            }
        }

        // Calculate projections
        const daysWithData = dailyUsage.length || 1;
        const avgCostPerDay = totalCost / daysWithData;
        const projectedMonthlyCost = avgCostPerDay * 30;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                source: 'anthropic_admin_api',
                data: {
                    period: {
                        days,
                        from: startDate.toISOString().split('T')[0],
                        to: endDate.toISOString().split('T')[0]
                    },
                    summary: {
                        totalInputTokens,
                        totalOutputTokens,
                        totalTokens: totalInputTokens + totalOutputTokens,
                        totalCacheCreation,
                        totalCacheReads,
                        totalCost: Math.round(totalCost * 10000) / 10000,
                        avgCostPerDay: Math.round(avgCostPerDay * 10000) / 10000,
                        projectedMonthlyCost: Math.round(projectedMonthlyCost * 100) / 100
                    },
                    daily: {
                        usage: dailyUsage,
                        costs: dailyCosts
                    }
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
// Redeploy trigger: Tue Jan 13 18:37:20 PST 2026
// Redeploy: Wed Jan 14 11:30:37 PST 2026
