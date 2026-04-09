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
    writeWorkerArtifacts
} = require('../lib/workspace');

const WORKSPACE_ROOT = getWorkspaceRoot(__dirname);
const REPO_ROOT = getRepoRoot(WORKSPACE_ROOT);

function buildMarkdown(report) {
    const lines = [
        '# Copy Agent Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Channel Copy',
        '',
        `### Facebook`,
        '',
        report.copy.facebook.caption,
        '',
        `### Instagram`,
        '',
        report.copy.instagram.caption,
        '',
        `### Threads`,
        '',
        report.copy.threads.post,
        '',
        `### YouTube`,
        '',
        `Title: ${report.copy.youtube.title}`,
        '',
        report.copy.youtube.description,
        '',
        '## CTA Variants',
        ''
    ];

    for (const item of report.copy.ctaVariants) {
        lines.push(`- ${item}`);
    }

    lines.push('', report.summary, '');
    return lines.join('\n');
}

function runCopyAgent(options = {}) {
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
    const creativePath = resolvePath(
        options.creativePath,
        path.join(WORKSPACE_ROOT, 'reports', 'creative-agent', 'latest.json'),
        REPO_ROOT
    );
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'copy-agent');

    const brief = readJson(briefPath, {});
    const plan = readJson(planPath, {});
    const creative = readJson(creativePath, {});

    const targetArea = plan.plan?.targetArea || brief.targetAreas?.[0] || 'Metro Manila';
    const landingPage = plan.plan?.landingPage || brief.offer?.landingPagePreference || '/printer-rental/';
    const cta = plan.plan?.primaryCta || brief.offer?.cta || 'Contact sales';
    const instagramHeadline = creative.creative?.instagramAd?.headline || `Printer rental for ${targetArea}`;

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'copy-agent',
        copy: {
            facebook: {
                caption: `Looking for printer rental in ${targetArea}?\n\n${instagramHeadline} We are focusing this campaign on office teams that need a cleaner monthly setup and a clearer support story.\n\nSee the offer here: ${landingPage}\n\n#MargaEnterprises #PrinterRental #${slugToTitle(targetArea).replace(/\s+/g, '')}`
            },
            instagram: {
                caption: `${instagramHeadline}\n\nA more practical rental option for office admins and procurement teams who want predictable monthly setup and faster decision-making.\n\n${cta}\n\n#PrinterRental #OfficeTeams #${slugToTitle(targetArea).replace(/\s+/g, '')}`
            },
            threads: {
                post: `Printer rental is not just a hardware decision. For ${targetArea} office teams, it is an uptime and response-time decision. ${cta}: ${landingPage}`
            },
            youtube: {
                title: `${slugToTitle(targetArea)} Printer Rental: A Better Setup For Office Teams`,
                description: `This short campaign video explains why printer rental can be a practical fit for ${targetArea} office teams that want predictable monthly setup and clearer support expectations.\n\nLearn more: ${landingPage}\n\nCTA: ${cta}`
            },
            ctaVariants: [
                cta,
                'Get a quick rental recommendation',
                'Talk to Marga about your office setup'
            ]
        },
        summary: compact(
            `The copy agent turns the campaign plan into channel-specific language while keeping one consistent offer. The copy varies by platform length and tone, but the message remains anchored to ${slugToTitle(targetArea)} office teams and the same landing-page CTA.`
        )
    };

    const markdown = buildMarkdown(report);
    writeWorkerArtifacts({ report, markdown, outputDir, latestDir });
    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runCopyAgent({
        briefPath: args.brief,
        planPath: args.plan,
        creativePath: args.creative,
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runCopyAgent };
