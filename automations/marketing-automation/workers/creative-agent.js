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

function buildPreviewHtml(report) {
    const ad = report.creative.instagramAd;
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ad.headline}</title>
  <style>
    :root {
      --ink: #143642;
      --accent: #e4572e;
      --paper: #f7f3e9;
      --panel: #ffffff;
    }
    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      background: linear-gradient(135deg, var(--paper), #ece7da);
      min-height: 100vh;
      display: grid;
      place-items: center;
      color: var(--ink);
    }
    .frame {
      width: 1080px;
      height: 1080px;
      background: radial-gradient(circle at top right, rgba(228, 87, 46, 0.15), transparent 35%), var(--panel);
      box-sizing: border-box;
      padding: 96px 88px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 4px solid rgba(20, 54, 66, 0.08);
    }
    .eyebrow {
      letter-spacing: 0.14em;
      text-transform: uppercase;
      font-size: 28px;
      color: var(--accent);
    }
    h1 {
      font-size: 96px;
      line-height: 0.95;
      margin: 0;
      max-width: 820px;
    }
    p {
      font-size: 38px;
      line-height: 1.35;
      max-width: 760px;
      margin: 0;
    }
    .cta {
      display: inline-block;
      padding: 24px 32px;
      background: var(--accent);
      color: white;
      font-size: 34px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 26px;
      border-top: 2px solid rgba(20, 54, 66, 0.12);
      padding-top: 28px;
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="eyebrow">${ad.eyebrow}</div>
    <div>
      <h1>${ad.headline}</h1>
      <p>${ad.body}</p>
    </div>
    <div>
      <div class="cta">${ad.cta}</div>
      <div class="footer">
        <span>${report.brand}</span>
        <span>${report.creative.visualDirection}</span>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildMarkdown(report) {
    const lines = [
        '# Creative Agent Report',
        '',
        `Generated: ${report.generatedAt}`,
        '',
        '## Visual Direction',
        '',
        `- Direction: ${report.creative.visualDirection}`,
        `- Color story: ${report.creative.colorStory}`,
        `- Typography mood: ${report.creative.typographyMood}`,
        '',
        '## Instagram Ad',
        '',
        `- Eyebrow: ${report.creative.instagramAd.eyebrow}`,
        `- Headline: ${report.creative.instagramAd.headline}`,
        `- Body: ${report.creative.instagramAd.body}`,
        `- CTA: ${report.creative.instagramAd.cta}`,
        '',
        '## Video Storyboard',
        ''
    ];

    for (const scene of report.creative.videoStoryboard) {
        lines.push(`- Scene ${scene.scene}: ${scene.copy}`);
    }

    lines.push('', report.summary, '');
    return lines.join('\n');
}

function runCreativeAgent(options = {}) {
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
    const outputDir = options.outputDir || null;
    const latestDir = options.latestDir || path.join(WORKSPACE_ROOT, 'reports', 'creative-agent');

    const brief = readJson(briefPath, {});
    const plan = readJson(planPath, {});
    const targetArea = plan.plan?.targetArea || brief.targetAreas?.[0] || 'Metro Manila';
    const cta = plan.plan?.primaryCta || brief.offer?.cta || 'Contact sales';

    const report = {
        generatedAt: new Date().toISOString(),
        worker: 'creative-agent',
        brand: brief.brand || 'Marga Enterprises',
        creative: {
            visualDirection: `${slugToTitle(targetArea)} business district confidence`,
            colorStory: 'Warm paper neutrals with dark teal type and a burnt orange CTA',
            typographyMood: 'Editorial serif headlines with clean supporting copy',
            instagramAd: {
                eyebrow: `${slugToTitle(targetArea)} office teams`,
                headline: `Printer rental that keeps ${targetArea} offices moving.`,
                body: 'Predictable monthly setup, clear support messaging, and a more credible local offer for decision-makers.',
                cta
            },
            videoStoryboard: [
                { scene: 1, copy: `Open with the common office issue: printing problems slow down ${targetArea} teams.` },
                { scene: 2, copy: 'Show the rental model as a simpler operations decision, not just a hardware purchase.' },
                { scene: 3, copy: 'Highlight dependable support, uptime, and easy monthly planning.' },
                { scene: 4, copy: `Ground the message in ${targetArea} office use cases and buyer reality.` },
                { scene: 5, copy: `End with the CTA: ${cta}.` }
            ]
        },
        summary: compact(
            `The creative agent packages the campaign into one coherent visual direction, a ready-to-review Instagram ad concept, and a five-scene video outline. This keeps later copy and distribution work aligned to the same offer.`
        )
    };

    const markdown = buildMarkdown(report);
    const previewHtml = buildPreviewHtml(report);
    writeWorkerArtifacts({
        report,
        markdown,
        outputDir,
        latestDir,
        extraFiles: [
            {
                name: 'instagram-ad-preview.html',
                content: previewHtml
            }
        ]
    });

    return report;
}

if (require.main === module) {
    const args = parseArgs(process.argv);
    runCreativeAgent({
        briefPath: args.brief,
        planPath: args.plan,
        outputDir: args['output-dir'],
        latestDir: args['latest-dir']
    });
}

module.exports = { runCreativeAgent };
