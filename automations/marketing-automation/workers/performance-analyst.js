#!/usr/bin/env node

const path = require('path');
const {
    average,
    compact,
    formatNumber,
    formatRank,
    getRepoRoot,
    getWorkspaceRoot,
    parseArgs,
    percent,
    readJson,
    resolvePath,
    slugToTitle,
    writeWorkerArtifacts
} = require('../lib/workspace');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function summarizeSerp(report) {
    const results = Array.isArray(report?.results) ? report.results : [];
    const rankingResults = results.filter((item) => Number.isFinite(item.ourRank));
    const missingResults = results.filter((item) => !Number.isFinite(item.ourRank));
    const nearWins = results
        .filter((item) => Number.isFinite(item.ourRank) && item.ourRank >= 4 && item.ourRank <= 10)
        .sort((a, b) => a.ourRank - b.ourRank);
    const bestRank = rankingResults.slice().sort((a, b) => a.ourRank - b.ourRank)[0] || null;
    const weakestRank = rankingResults.slice().sort((a, b) => b.ourRank - a.ourRank)[0] || null;

    return {
        generatedAt: report?.generatedAt || null,
        trackedKeywordCount: results.length,
        rankingKeywordCount: rankingResults.length,
        missingKeywordCount: missingResults.length,
        averageRank: average(rankingResults.map((item) => item.ourRank)),
        bestRank: bestRank
            ? {
                keyword: bestRank.keyword,
                area: bestRank.area || '',
                rank: bestRank.ourRank,
                url: bestRank.ourUrl || ''
            }
            : null,
        weakestRank: weakestRank
            ? {
                keyword: weakestRank.keyword,
                area: weakestRank.area || '',
                rank: weakestRank.ourRank,
                url: weakestRank.ourUrl || ''
            }
            : null,
        nearWins: nearWins.slice(0, 5).map((item) => ({
            keyword: item.keyword,
            area: item.area || '',
            rank: item.ourRank,
            url: item.ourUrl || '',
            topCompetitors: Array.isArray(item.competitors) ? item.competitors.slice(0, 3) : []
        })),
        missingCoverage: missingResults.slice(0, 5).map((item) => ({
            keyword: item.keyword,
            area: item.area || '',
            topCompetitors: Array.isArray(item.competitors) ? item.competitors.slice(0, 3) : []
        }))
    };
}

function summarizeFacebook(report) {
    if (!report || report.__readError) {
        return {
            available: false,
            error: report?.__readError || 'Facebook report not found'
        };
    }

    const message = compact(report.message || '');
    const hashtags = message.match(/#[A-Za-z0-9_]+/g) || [];

    return {
        available: true,
        mode: report.mode || 'unknown',
        generatedAt: report.generatedAt || null,
        title: compact(report.page?.title || ''),
        url: report.page?.url || '',
        file: report.page?.file || '',
        hashtags,
        hashtagCount: hashtags.length,
        messageLength: message.length
    };
}

function summarizeManualMetrics(metrics) {
    if (!metrics || metrics.__readError) {
        return {
            available: false,
            error: metrics?.__readError || 'Manual metrics not provided',
            platforms: [],
            topPlatform: null
        };
    }

    const platformNames = Object.keys(metrics.platforms || {});
    const platforms = platformNames.map((platformName) => {
        const posts = Array.isArray(metrics.platforms?.[platformName]?.posts)
            ? metrics.platforms[platformName].posts
            : [];

        const totals = posts.reduce((acc, post) => {
            acc.posts += 1;
            acc.impressions += Number(post.impressions || 0);
            acc.engagements += Number(post.engagements || 0);
            acc.clicks += Number(post.clicks || 0);
            acc.leads += Number(post.leads || 0);
            acc.spend += Number(post.spend || 0);
            return acc;
        }, {
            posts: 0,
            impressions: 0,
            engagements: 0,
            clicks: 0,
            leads: 0,
            spend: 0
        });

        return {
            platform: platformName,
            posts: totals.posts,
            impressions: totals.impressions,
            engagements: totals.engagements,
            clicks: totals.clicks,
            leads: totals.leads,
            spend: totals.spend,
            engagementRate: percent(totals.engagements, totals.impressions),
            ctr: percent(totals.clicks, totals.impressions),
            leadRate: percent(totals.leads, totals.clicks),
            costPerLead: totals.leads > 0 ? totals.spend / totals.leads : null
        };
    });

    const topPlatform = platforms
        .slice()
        .sort((a, b) => {
            const scoreA = (a.leads * 100) + a.clicks;
            const scoreB = (b.leads * 100) + b.clicks;
            return scoreB - scoreA;
        })[0] || null;

    return {
        available: true,
        generatedAt: metrics.generatedAt || null,
        platforms,
        topPlatform
    };
}

function deriveRecommendations({ serpSummary, facebookSummary, manualMetricsSummary }) {
    const priorities = [];
    const nextExperiments = [];
    const risks = [];

    if (serpSummary.nearWins.length) {
        const topNearWin = serpSummary.nearWins[0];
        priorities.push(
            `Push ${topNearWin.keyword} from ${formatRank(topNearWin.rank)} with a sharper location-specific page, stronger internal links, and a matching social campaign.`
        );
    }

    if (serpSummary.missingCoverage.length) {
        const missing = serpSummary.missingCoverage[0];
        priorities.push(
            `Create or strengthen dedicated coverage for ${missing.keyword}; Marga is currently ${formatRank(null)} while ${missing.topCompetitors.join(', ')} are visible.`
        );
    }

    if (facebookSummary.available && facebookSummary.title) {
        priorities.push(
            `Reuse the "${facebookSummary.title}" angle across additional channels only after tailoring the hook and CTA per platform.`
        );
    }

    if (manualMetricsSummary.available && manualMetricsSummary.topPlatform) {
        priorities.push(
            `Double down on ${slugToTitle(manualMetricsSummary.topPlatform.platform)} first; it currently leads this sample with ${manualMetricsSummary.topPlatform.leads} leads and ${manualMetricsSummary.topPlatform.clicks} clicks.`
        );
    } else {
        risks.push('No real post-level performance metrics were supplied, so channel recommendations are strategy-first rather than evidence-first.');
    }

    if (serpSummary.missingKeywordCount > 0) {
        nextExperiments.push('Test location-specific content for missing cities before increasing creative volume.');
    }

    if (manualMetricsSummary.available) {
        const weakestPlatform = manualMetricsSummary.platforms
            .slice()
            .sort((a, b) => {
                const scoreA = (a.leads * 100) + a.clicks;
                const scoreB = (b.leads * 100) + b.clicks;
                return scoreA - scoreB;
            })[0];

        if (weakestPlatform) {
            nextExperiments.push(
                `Rewrite hooks and CTA format for ${slugToTitle(weakestPlatform.platform)}; it is currently the weakest of the sampled channels.`
            );
        }
    } else {
        nextExperiments.push('Start collecting impressions, clicks, engagements, and leads per post so the analyst can rank channels with confidence.');
    }

    if (!facebookSummary.available) {
        risks.push('Latest Facebook distribution report was unavailable, so the analyst could not confirm current publish output.');
    }

    if (!serpSummary.trackedKeywordCount) {
        risks.push('No SERP tracking data was available, so SEO opportunity scoring is incomplete.');
    }

    return {
        priorities,
        nextExperiments,
        risks
    };
}

function buildSummary({ serpSummary, manualMetricsSummary, recommendations }) {
    const headlineParts = [];

    if (serpSummary.bestRank) {
        headlineParts.push(`best tracked rank is ${formatRank(serpSummary.bestRank.rank)} for ${serpSummary.bestRank.keyword}`);
    }

    if (serpSummary.missingKeywordCount > 0) {
        headlineParts.push(`${serpSummary.missingKeywordCount} tracked keywords have no current ranking`);
    }

    if (manualMetricsSummary.available && manualMetricsSummary.topPlatform) {
        headlineParts.push(`${slugToTitle(manualMetricsSummary.topPlatform.platform)} is the strongest sampled channel`);
    }

    return {
        executiveSummary: headlineParts.length
            ? `Performance snapshot: ${headlineParts.join('; ')}.`
            : 'Performance snapshot: data is limited, so this report focuses on structural next steps.',
        recommendations
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Performance Analyst Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Executive Summary',
        '',
        report.summary.executiveSummary,
        ''
    ];

    lines.push('## SEO Snapshot', '');
    lines.push(`- Tracked keywords: ${report.serp.trackedKeywordCount}`);
    lines.push(`- Ranking keywords: ${report.serp.rankingKeywordCount}`);
    lines.push(`- Missing keywords: ${report.serp.missingKeywordCount}`);
    lines.push(`- Average rank: ${formatNumber(report.serp.averageRank)}`);
    lines.push(`- Best rank: ${report.serp.bestRank ? `${report.serp.bestRank.keyword} (${formatRank(report.serp.bestRank.rank)})` : 'n/a'}`);
    lines.push(`- Weakest rank: ${report.serp.weakestRank ? `${report.serp.weakestRank.keyword} (${formatRank(report.serp.weakestRank.rank)})` : 'n/a'}`);
    lines.push('');

    if (report.serp.nearWins.length) {
        lines.push('### Near Wins', '');
        for (const item of report.serp.nearWins) {
            lines.push(`- ${item.keyword}: ${formatRank(item.rank)} | competitors: ${item.topCompetitors.join(', ') || 'n/a'}`);
        }
        lines.push('');
    }

    if (report.serp.missingCoverage.length) {
        lines.push('### Missing Coverage', '');
        for (const item of report.serp.missingCoverage) {
            lines.push(`- ${item.keyword}: competitors visible include ${item.topCompetitors.join(', ') || 'n/a'}`);
        }
        lines.push('');
    }

    lines.push('## Distribution Snapshot', '');
    if (report.facebook.available) {
        lines.push(`- Latest Facebook mode: ${report.facebook.mode}`);
        lines.push(`- Latest page: ${report.facebook.title || 'n/a'}`);
        lines.push(`- Message length: ${report.facebook.messageLength}`);
        lines.push(`- Hashtags: ${report.facebook.hashtags.join(', ') || 'none'}`);
    } else {
        lines.push(`- Facebook report unavailable: ${report.facebook.error}`);
    }
    lines.push('');

    lines.push('## Channel Metrics', '');
    if (report.manualMetrics.available && report.manualMetrics.platforms.length) {
        for (const platform of report.manualMetrics.platforms) {
            lines.push(`- ${slugToTitle(platform.platform)}: ${platform.posts} posts | ${platform.impressions} impressions | ${platform.clicks} clicks | ${platform.leads} leads | CTR ${formatNumber(platform.ctr)}% | ER ${formatNumber(platform.engagementRate)}%`);
        }
    } else {
        lines.push('- No manual platform metrics supplied.');
    }
    lines.push('');

    lines.push('## Recommended Priorities', '');
    for (const item of report.summary.recommendations.priorities) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    lines.push('## Next Experiments', '');
    for (const item of report.summary.recommendations.nextExperiments) {
        lines.push(`- ${item}`);
    }
    lines.push('');

    lines.push('## Risks And Gaps', '');
    if (report.summary.recommendations.risks.length) {
        for (const item of report.summary.recommendations.risks) {
            lines.push(`- ${item}`);
        }
    } else {
        lines.push('- No major data gaps detected in this run.');
    }
    lines.push('');

    return lines.join('\n');
}

function runPerformanceAnalyst(options = {}) {
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'performance-analyst');
    const serpPath = resolvePath(
        options.serpReportPath,
        path.join(REPO_ROOT, 'reports', 'serp-monitor', 'latest.json'),
        REPO_ROOT
    );
    const facebookPath = resolvePath(
        options.facebookReportPath,
        path.join(REPO_ROOT, 'reports', 'facebook', 'latest.json'),
        REPO_ROOT
    );
    const manualMetricsPath = options.manualMetricsPath
        ? resolvePath(options.manualMetricsPath, null, REPO_ROOT)
        : path.join(WORKSPACE_ROOT, 'data', 'manual-metrics.sample.json');

    const serpReport = readJson(serpPath, { results: [] });
    const facebookReport = readJson(facebookPath, null);
    const manualMetrics = readJson(manualMetricsPath, null);

    const serpSummary = summarizeSerp(serpReport);
    const facebookSummary = summarizeFacebook(facebookReport);
    const manualMetricsSummary = summarizeManualMetrics(manualMetrics);
    const recommendations = deriveRecommendations({
        serpSummary,
        facebookSummary,
        manualMetricsSummary
    });
    const summary = buildSummary({
        serpSummary,
        manualMetricsSummary,
        recommendations
    });

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'performance-analyst',
        inputs: {
            serpReport: serpPath,
            facebookReport: facebookPath,
            manualMetrics: manualMetricsPath || null
        },
        serp: serpSummary,
        facebook: facebookSummary,
        manualMetrics: manualMetricsSummary,
        summary
    };

    const markdown = buildMarkdown(report);
    writeWorkerArtifacts({ report, markdown, outputDir, latestDir });
    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runPerformanceAnalyst({
        serpReportPath: args['serp-report'],
        facebookReportPath: args['facebook-report'],
        manualMetricsPath: args['manual-metrics'],
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runPerformanceAnalyst };
