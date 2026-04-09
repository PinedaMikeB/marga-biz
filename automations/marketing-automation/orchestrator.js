#!/usr/bin/env node

const path = require('path');
const {
    compact,
    ensureDir,
    getRepoRoot,
    getWorkspaceRoot,
    makeRunId,
    parseArgs,
    readJson,
    resolvePath,
    writeJson,
    writeText
} = require('./lib/workspace');
const { runResearchAgent } = require('./workers/research-agent');
const { runCampaignPlanner } = require('./workers/campaign-planner');
const { runCreativeAgent } = require('./workers/creative-agent');
const { runCopyAgent } = require('./workers/copy-agent');
const { runDistributionAgent } = require('./workers/distribution-agent');
const { runPerformanceAnalyst } = require('./workers/performance-analyst');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function buildMarkdown(summary) {
    const lines = [
        '# Marketing Automation Run',
        '',
        `Run ID: ${summary.runId}`,
        `Generated: ${summary.generatedAt}`,
        '',
        '## Campaign',
        '',
        `- Name: ${summary.brief.campaignName}`,
        `- Objective: ${summary.brief.objective}`,
        `- Primary keyword: ${summary.brief.primaryKeyword}`,
        '',
        '## Worker Outputs',
        ''
    ];

    for (const item of summary.outputs) {
        lines.push(`- ${item.worker}: ${item.path}`);
    }

    lines.push('', '## What The System Recommends Next', '');
    for (const item of summary.nextActions) {
        lines.push(`- ${item}`);
    }

    lines.push('', compact(summary.summary), '');
    return lines.join('\n');
}

function main() {
    const args = parseArgs(process.argv);
    const briefPath = resolvePath(
        args.brief,
        path.join(WORKSPACE_ROOT, 'data', 'campaign-brief.sample.json'),
        REPO_ROOT
    );
    const runId = args['run-id'] || makeRunId();
    const runsDir = path.join(WORKSPACE_ROOT, 'runs');
    const runDir = path.join(runsDir, runId);
    ensureDir(runDir);

    const researchDir = path.join(runDir, 'research-agent');
    const plannerDir = path.join(runDir, 'campaign-planner');
    const creativeDir = path.join(runDir, 'creative-agent');
    const copyDir = path.join(runDir, 'copy-agent');
    const distributionDir = path.join(runDir, 'distribution-agent');
    const analystDir = path.join(runDir, 'performance-analyst');

    const research = runResearchAgent({
        briefPath,
        outputDir: researchDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'research-agent')
    });

    const plan = runCampaignPlanner({
        briefPath,
        researchPath: path.join(researchDir, 'latest.json'),
        outputDir: plannerDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'campaign-planner')
    });

    const creative = runCreativeAgent({
        briefPath,
        planPath: path.join(plannerDir, 'latest.json'),
        outputDir: creativeDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'creative-agent')
    });

    const copy = runCopyAgent({
        briefPath,
        planPath: path.join(plannerDir, 'latest.json'),
        creativePath: path.join(creativeDir, 'latest.json'),
        outputDir: copyDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'copy-agent')
    });

    const distribution = runDistributionAgent({
        briefPath,
        planPath: path.join(plannerDir, 'latest.json'),
        creativePath: path.join(creativeDir, 'latest.json'),
        copyPath: path.join(copyDir, 'latest.json'),
        outputDir: distributionDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'distribution-agent')
    });

    const analyst = runPerformanceAnalyst({
        outputDir: analystDir,
        latestDir: path.join(WORKSPACE_ROOT, 'reports', 'performance-analyst'),
        manualMetricsPath: args['manual-metrics']
            ? resolvePath(args['manual-metrics'], null, REPO_ROOT)
            : path.join(WORKSPACE_ROOT, 'data', 'manual-metrics.sample.json')
    });

    const brief = readJson(briefPath, {});
    const summary = {
        runId,
        generatedAt: new Date().toISOString(),
        brief: {
            campaignName: brief.campaignName || 'Untitled Campaign',
            objective: brief.objective || '',
            primaryKeyword: brief.primaryKeyword || ''
        },
        outputs: [
            { worker: 'research-agent', path: path.relative(REPO_ROOT, researchDir) },
            { worker: 'campaign-planner', path: path.relative(REPO_ROOT, plannerDir) },
            { worker: 'creative-agent', path: path.relative(REPO_ROOT, creativeDir) },
            { worker: 'copy-agent', path: path.relative(REPO_ROOT, copyDir) },
            { worker: 'distribution-agent', path: path.relative(REPO_ROOT, distributionDir) },
            { worker: 'performance-analyst', path: path.relative(REPO_ROOT, analystDir) }
        ],
        nextActions: [
            ...(analyst.summary?.recommendations?.priorities || []).slice(0, 3),
            distribution.manifest?.approvalsRequired?.[0] || 'Review the publish manifest.'
        ].filter(Boolean),
        summary: `This orchestrated run built the campaign from research through distribution planning, then closed the loop with the performance analyst. The workflow is intentionally safe for the current repo: it creates real planning artifacts, keeps Facebook aligned with existing tooling, and leaves unsupported channels in planning mode instead of faking live automation.`
    };

    const reportsDir = path.join(WORKSPACE_ROOT, 'reports', 'orchestrator');
    ensureDir(reportsDir);
    writeJson(path.join(reportsDir, 'latest.json'), summary);
    writeText(path.join(reportsDir, 'latest.md'), buildMarkdown(summary));

    process.stdout.write(`Marketing automation run completed: ${runDir}\n`);
}

main();
