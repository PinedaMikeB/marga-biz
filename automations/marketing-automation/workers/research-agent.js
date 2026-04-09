#!/usr/bin/env node

const path = require('path');
const {
    compact,
    formatRank,
    getRepoRoot,
    getWorkspaceRoot,
    listFilesRecursively,
    parseArgs,
    readJson,
    resolvePath,
    slugToTitle,
    writeWorkerArtifacts
} = require('../lib/workspace');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function findRelevantPages(targetAreas) {
    const printerRentalRoot = path.join(REPO_ROOT, 'static-pages', 'printer-rental');
    const files = listFilesRecursively(printerRentalRoot, (filePath) => filePath.endsWith('index.html'));

    return files
        .map((filePath) => {
            const relativePath = path.relative(REPO_ROOT, filePath).split(path.sep).join('/');
            const publicPath = `/${relativePath.replace(/^static-pages\//, '').replace(/index\.html$/, '')}`;
            const normalizedAreas = targetAreas.map((area) => String(area || '').toLowerCase());
            const score = normalizedAreas.reduce((sum, area) => sum + (relativePath.toLowerCase().includes(area) ? 1 : 0), 0);

            return {
                file: relativePath,
                url: publicPath.endsWith('/') ? publicPath : `${publicPath}`,
                score
            };
        })
        .filter((item) => item.score > 0 || item.file.includes('/printer-rental/index.html'))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
}

function buildAngles(brief, serpResults) {
    const primaryKeyword = brief.primaryKeyword || 'printer rental';
    const targetArea = brief.targetAreas?.[0] || 'Metro Manila';
    const missingResult = serpResults.find((item) => item.keyword === primaryKeyword || item.area === targetArea) || serpResults[0];

    return [
        {
            title: `${slugToTitle(targetArea)} office uptime angle`,
            hook: `Help ${targetArea} office teams avoid downtime with a rental setup that includes support and predictable response expectations.`,
            targetKeyword: primaryKeyword,
            whyItMatters: missingResult && !Number.isFinite(missingResult.ourRank)
                ? `${primaryKeyword} is currently not ranking, so a location-specific angle can close the visibility gap.`
                : `${primaryKeyword} is within reach at ${formatRank(missingResult?.ourRank)}, so sharper positioning can move it up.`
        },
        {
            title: 'Budget clarity angle',
            hook: 'Show buyers how monthly printer rental can reduce surprise maintenance and procurement friction.',
            targetKeyword: 'printer rental cost comparison',
            whyItMatters: 'This supports decision-stage buyers who need a simple justification before contacting sales.'
        },
        {
            title: 'Local trust angle',
            hook: `Use local context for ${targetArea} teams, such as common office use cases and service expectations, instead of generic rental copy.`,
            targetKeyword: `${primaryKeyword} office teams`,
            whyItMatters: 'Local specificity makes both SEO content and social creative feel more credible.'
        }
    ];
}

function buildMarkdown(report) {
    const lines = [
        '# Research Agent Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Campaign Focus',
        '',
        `- Campaign: ${report.brief.campaignName}`,
        `- Objective: ${report.brief.objective}`,
        `- Primary keyword: ${report.brief.primaryKeyword}`,
        `- Target areas: ${report.brief.targetAreas.join(', ')}`,
        '',
        '## SERP Opportunities',
        ''
    ];

    for (const item of report.keywordOpportunities) {
        lines.push(`- ${item.keyword}: ${formatRank(item.currentRank)} | area: ${item.area || 'n/a'} | opportunity: ${item.opportunity}`);
    }

    lines.push('', '## Relevant Existing Pages', '');
    for (const page of report.relevantPages) {
        lines.push(`- ${page.file}`);
    }

    lines.push('', '## Recommended Angles', '');
    for (const angle of report.contentAngles) {
        lines.push(`- ${angle.title}: ${angle.hook} ${angle.whyItMatters}`);
    }

    lines.push('', '## Research Summary', '', report.summary, '');
    return lines.join('\n');
}

function runResearchAgent(options = {}) {
    const briefPath = resolvePath(
        options.briefPath,
        path.join(WORKSPACE_ROOT, 'data', 'campaign-brief.sample.json'),
        REPO_ROOT
    );
    const serpPath = resolvePath(
        options.serpReportPath,
        path.join(REPO_ROOT, 'reports', 'serp-monitor', 'latest.json'),
        REPO_ROOT
    );
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'research-agent');

    const brief = readJson(briefPath, {});
    const serpReport = readJson(serpPath, { results: [] });
    const serpResults = Array.isArray(serpReport.results) ? serpReport.results : [];
    const targetAreas = Array.isArray(brief.targetAreas) ? brief.targetAreas : [];
    const relevantPages = findRelevantPages(targetAreas);
    const contentAngles = buildAngles(brief, serpResults);
    const keywordOpportunities = serpResults
        .filter((item) => targetAreas.some((area) => String(item.area || '').toLowerCase() === String(area).toLowerCase()) || item.keyword === brief.primaryKeyword)
        .slice(0, 5)
        .map((item) => ({
            keyword: item.keyword,
            area: item.area || '',
            currentRank: item.ourRank,
            opportunity: Number.isFinite(item.ourRank)
                ? `Improve from ${formatRank(item.ourRank)} with location-matched content and support posts.`
                : 'No current ranking. This is a gap worth addressing first.'
        }));

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'research-agent',
        brief: {
            campaignName: brief.campaignName || 'Untitled Campaign',
            objective: brief.objective || '',
            primaryKeyword: brief.primaryKeyword || '',
            targetAreas
        },
        keywordOpportunities,
        relevantPages,
        contentAngles,
        summary: compact(
            `Research points to ${brief.primaryKeyword || 'the target keyword'} as the lead opportunity, with ${targetAreas.join(', ') || 'the selected areas'} as the strongest geography focus. Existing printer-rental pages give us supporting material, but the biggest lift will come from location-specific messaging tied to office uptime and simple buyer justification.`
        )
    };

    const markdown = buildMarkdown(report);
    writeWorkerArtifacts({ report, markdown, outputDir, latestDir });
    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runResearchAgent({
        briefPath: args.brief,
        serpReportPath: args['serp-report'],
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runResearchAgent };
