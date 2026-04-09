#!/usr/bin/env node

const path = require('path');
const {
    compact,
    getRepoRoot,
    getWorkspaceRoot,
    parseArgs,
    readJson,
    resolvePath,
    slugToTitle,
    titleToSlug,
    writeWorkerArtifacts
} = require('../lib/workspace');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function buildMarkdown(report) {
    const lines = [
        '# Campaign Planner Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Campaign Plan',
        '',
        `- Campaign name: ${report.plan.campaignName}`,
        `- Objective: ${report.plan.objective}`,
        `- Hero angle: ${report.plan.heroAngle}`,
        `- Primary CTA: ${report.plan.primaryCta}`,
        `- Landing page: ${report.plan.landingPage}`,
        '',
        '## Content Pillars',
        ''
    ];

    for (const pillar of report.plan.contentPillars) {
        lines.push(`- ${pillar}`);
    }

    lines.push('', '## Deliverables', '');
    for (const item of report.plan.deliverables) {
        lines.push(`- ${item.channel}: ${item.asset} | purpose: ${item.purpose}`);
    }

    lines.push('', '## Weekly Sequence', '');
    for (const item of report.plan.weeklySequence) {
        lines.push(`- ${item.day}: ${item.channel} | ${item.action}`);
    }

    lines.push('', '## Approval Gates', '');
    for (const item of report.plan.approvalGates) {
        lines.push(`- ${item}`);
    }

    lines.push('', report.summary, '');
    return lines.join('\n');
}

function runCampaignPlanner(options = {}) {
    const briefPath = resolvePath(
        options.briefPath,
        path.join(WORKSPACE_ROOT, 'data', 'campaign-brief.sample.json'),
        REPO_ROOT
    );
    const researchPath = resolvePath(
        options.researchPath,
        path.join(WORKSPACE_ROOT, 'reports', 'research-agent', 'latest.json'),
        REPO_ROOT
    );
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'campaign-planner');

    const brief = readJson(briefPath, {});
    const research = readJson(researchPath, {});
    const heroAngle = research.contentAngles?.[0]?.hook || brief.offer?.headline || 'Highlight reliable printer rental support.';
    const landingPage = brief.offer?.landingPagePreference || research.relevantPages?.[0]?.url || '/printer-rental/';
    const campaignSlug = titleToSlug(brief.campaignName || 'campaign');
    const targetArea = brief.targetAreas?.[0] || 'Metro Manila';

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'campaign-planner',
        plan: {
            campaignName: brief.campaignName || 'Untitled Campaign',
            campaignSlug,
            objective: brief.objective || '',
            audience: brief.audience || {},
            heroAngle,
            primaryCta: brief.offer?.cta || 'Contact sales',
            landingPage,
            targetArea,
            contentPillars: [
                `${slugToTitle(targetArea)} office uptime and support response`,
                'Simple monthly cost positioning without overclaiming savings',
                'Local-business relevance for admins and procurement teams'
            ],
            deliverables: [
                {
                    channel: 'facebook',
                    asset: 'Square image post + caption',
                    purpose: 'Drive early traffic to the landing page and test hook strength'
                },
                {
                    channel: 'instagram',
                    asset: 'Square ad concept + shorter caption',
                    purpose: 'Package the offer into a visually direct format'
                },
                {
                    channel: 'threads',
                    asset: 'Short opinionated post',
                    purpose: 'Test concise hooks and conversation-starting copy'
                },
                {
                    channel: 'youtube',
                    asset: 'Short explainer video outline',
                    purpose: 'Support authority and reuse the campaign angle in video form'
                }
            ],
            weeklySequence: [
                { day: 'Day 1', channel: 'facebook', action: `Launch the hero post for ${targetArea} with the strongest office-uptime hook.` },
                { day: 'Day 2', channel: 'instagram', action: 'Publish the static ad variant with a shorter CTA-driven caption.' },
                { day: 'Day 3', channel: 'threads', action: 'Run a shorter hook that reframes printer rental as an operations decision.' },
                { day: 'Day 4', channel: 'youtube', action: 'Publish or prepare the video explainer version of the same offer.' },
                { day: 'Day 5', channel: 'facebook', action: 'Review early results and repost only with updated copy if the first hook underperforms.' }
            ],
            approvalGates: [
                'Approve landing page destination before publishing.',
                'Approve channel copy before any live posting.',
                'Keep unsupported channels in planning mode until APIs are wired.'
            ]
        },
        summary: compact(
            `The campaign planner turns the research into one focused weekly sequence around ${slugToTitle(targetArea)} office uptime. The plan keeps one clear CTA, one landing page, and one hero angle so the later workers can generate assets and copy without drifting off-message.`
        )
    };

    const markdown = buildMarkdown(report);
    writeWorkerArtifacts({ report, markdown, outputDir, latestDir });
    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runCampaignPlanner({
        briefPath: args.brief,
        researchPath: args.research,
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runCampaignPlanner };
