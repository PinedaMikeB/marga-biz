#!/usr/bin/env node

const path = require('path');
const {
    compact,
    getRepoRoot,
    getWorkspaceRoot,
    parseArgs,
    readJson,
    resolvePath,
    writeWorkerArtifacts
} = require('../lib/workspace');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function buildMarkdown(report) {
    const lines = [
        '# Distribution Agent Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Publish Manifest',
        ''
    ];

    for (const item of report.manifest.channels) {
        lines.push(`- ${item.channel}: ${item.status} | ${item.action}`);
    }

    lines.push('', '## Repo Commands', '');
    for (const item of report.manifest.repoCommands) {
        lines.push(`- ${item}`);
    }

    lines.push('', '## Approval Checklist', '');
    for (const item of report.manifest.approvalsRequired) {
        lines.push(`- ${item}`);
    }

    lines.push('', report.summary, '');
    return lines.join('\n');
}

function runDistributionAgent(options = {}) {
    const briefPath = resolvePath(
        options.briefPath,
        path.join(WORKSPACE_ROOT, 'data', 'campaign-brief.sample.json'),
        REPO_ROOT
    );
    const planPath = resolvePath(
        options.planPath,
        path.join(WORKSPACE_ROOT, 'reports', 'campaign-planner', 'latest.json'),
        REPO_ROOT
    );
    const copyPath = resolvePath(
        options.copyPath,
        path.join(WORKSPACE_ROOT, 'reports', 'copy-agent', 'latest.json'),
        REPO_ROOT
    );
    const creativePath = resolvePath(
        options.creativePath,
        path.join(WORKSPACE_ROOT, 'reports', 'creative-agent', 'latest.json'),
        REPO_ROOT
    );
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'distribution-agent');

    const brief = readJson(briefPath, {});
    const plan = readJson(planPath, {});
    const copy = readJson(copyPath, {});
    const creative = readJson(creativePath, {});

    const landingPage = plan.plan?.landingPage || brief.offer?.landingPagePreference || '/printer-rental/';
    const heroTitle = creative.creative?.instagramAd?.headline || 'Campaign creative';
    const facebookPageFile = `static-pages${landingPage.endsWith('/') ? landingPage : `${landingPage}/`}index.html`.replace(/\/+/g, '/');

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'distribution-agent',
        manifest: {
            campaignName: brief.campaignName || 'Untitled Campaign',
            landingPage,
            channels: [
                {
                    channel: 'facebook',
                    status: 'supported-in-repo',
                    action: `Use the existing Facebook publisher after approving copy and destination.`,
                    copyPreview: copy.copy?.facebook?.caption || '',
                    asset: heroTitle
                },
                {
                    channel: 'instagram',
                    status: 'planning-only',
                    action: 'Prepare caption and asset package; live publishing is not wired in this repo yet.',
                    copyPreview: copy.copy?.instagram?.caption || '',
                    asset: heroTitle
                },
                {
                    channel: 'threads',
                    status: 'planning-only',
                    action: 'Prepare the short post and hold for future API wiring or manual posting.',
                    copyPreview: copy.copy?.threads?.post || '',
                    asset: heroTitle
                },
                {
                    channel: 'youtube',
                    status: 'planning-only',
                    action: 'Prepare the title, description, and storyboard; hold until upload automation is added.',
                    copyPreview: copy.copy?.youtube?.title || '',
                    asset: 'Video storyboard'
                }
            ],
            repoCommands: [
                `node scripts/facebook-page-publisher.js preview --page=${facebookPageFile}`,
                `node scripts/facebook-page-publisher.js publish --page=${facebookPageFile}`
            ],
            approvalsRequired: [
                'Confirm the landing page is the right destination for this campaign.',
                'Review all platform copy for accuracy and tone.',
                'Keep Instagram, Threads, and YouTube in plan-only mode until their APIs are added in this repo.'
            ]
        },
        summary: compact(
            `The distribution agent converts campaign outputs into a publish manifest that matches current repo reality. Facebook can move through the existing publisher flow, while Instagram, Threads, and YouTube stay in planning mode so we do not pretend unsupported live automation already exists.`
        )
    };

    const markdown = buildMarkdown(report);
    writeWorkerArtifacts({ report, markdown, outputDir, latestDir });
    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runDistributionAgent({
        briefPath: args.brief,
        planPath: args.plan,
        copyPath: args.copy,
        creativePath: args.creative,
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runDistributionAgent };
