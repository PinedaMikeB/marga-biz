#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const staticDir = path.join(root, 'static-pages');
const reportDir = path.join(root, 'reports', 'ai-visibility');
const siteBase = 'https://marga.biz';

const targetPages = [
  '/printer-rental/',
  '/printer-rental/makati/',
  '/printer-rental/bgc/',
  '/printer-rental/pasig/',
  '/printer-rental/quezon-city/',
  '/printer-rental/print-all-you-can/',
  '/printer-rental/best-printer-rental-company-philippines/',
  '/printer-rental/printer-rental-office-faq/'
];

const allowedCrawlers = [
  'Googlebot',
  'Bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Claude-SearchBot',
  'Claude-User'
];

const blockedTrainingCrawlers = [
  'GPTBot',
  'Google-Extended',
  'ClaudeBot'
];

const promptMatrix = [
  {
    prompt: 'best printer rental company in the Philippines',
    preferredPage: '/printer-rental/best-printer-rental-company-philippines/'
  },
  {
    prompt: 'best printer rental company in Manila',
    preferredPage: '/printer-rental/philippines/'
  },
  {
    prompt: 'where can I rent a printer in Makati',
    preferredPage: '/printer-rental/makati/'
  },
  {
    prompt: 'printer rental BGC with maintenance',
    preferredPage: '/printer-rental/bgc/'
  },
  {
    prompt: 'printer rental Pasig for offices',
    preferredPage: '/printer-rental/pasig/'
  },
  {
    prompt: 'printer rental Quezon City for offices',
    preferredPage: '/printer-rental/quezon-city/'
  },
  {
    prompt: 'Print All You Can printer rental Philippines',
    preferredPage: '/printer-rental/print-all-you-can/'
  },
  {
    prompt: 'printer rental vs buying for office',
    preferredPage: '/printer-rental/printer-rental-vs-buying-for-business/'
  },
  {
    prompt: 'what should be included in a printer rental quote',
    preferredPage: '/printer-rental/printer-rental-office-faq/'
  }
];

function readPage(urlPath) {
  const normalized = urlPath.replace(/^\/|\/$/g, '');
  const candidates = [
    path.join(distDir, normalized, 'index.html'),
    path.join(staticDir, normalized, 'index.html')
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  return file ? { file, html: fs.readFileSync(file, 'utf8') } : { file: null, html: '' };
}

function extractJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  return blocks.map((match) => match[1].trim());
}

function parseJsonLd(blocks) {
  const results = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      results.push({ ok: true, type: Array.isArray(parsed) ? 'array' : parsed['@type'] || 'object' });
    } catch (error) {
      results.push({ ok: false, error: error.message });
    }
  }
  return results;
}

function checkPage(urlPath) {
  const { file, html } = readPage(urlPath);
  const jsonLd = extractJsonLd(html);
  const jsonLdResults = parseJsonLd(jsonLd);
  const hasValidJsonLd = jsonLd.length > 0 && jsonLdResults.every((result) => result.ok);

  return {
    path: urlPath,
    url: `${siteBase}${urlPath}`,
    file: file ? path.relative(root, file) : null,
    exists: Boolean(file),
    title: /<title>[^<]+<\/title>/i.test(html),
    metaDescription: /<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html),
    canonical: new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${siteBase.replace('.', '\\.')}${urlPath.replace(/\//g, '\\/')}["']`, 'i').test(html),
    aiAnswerBlock: /id=["']ai-answer["']/.test(html),
    faqSignals: /FAQPage|Frequently asked questions|faq-stack|faq-item/i.test(html),
    jsonLdBlocks: jsonLd.length,
    validJsonLd: hasValidJsonLd,
    failures: []
  };
}

function addFailures(page) {
  const checks = [
    ['exists', 'Page file is missing'],
    ['title', 'Missing title tag'],
    ['metaDescription', 'Missing meta description'],
    ['canonical', 'Missing expected canonical URL'],
    ['aiAnswerBlock', 'Missing AI answer block'],
    ['faqSignals', 'Missing FAQ/question-answer signals'],
    ['validJsonLd', 'Missing or invalid JSON-LD']
  ];

  for (const [key, message] of checks) {
    if (!page[key]) {
      page.failures.push(message);
    }
  }
  return page;
}

function checkRobots() {
  const robotsPath = fs.existsSync(path.join(distDir, 'robots.txt'))
    ? path.join(distDir, 'robots.txt')
    : path.join(root, 'robots.txt');
  const robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, 'utf8') : '';

  const allows = allowedCrawlers.map((crawler) => ({
    crawler,
    present: new RegExp(`User-agent:\\s*${crawler}[\\s\\S]*?Allow:\\s*/`, 'i').test(robots)
  }));
  const blocks = blockedTrainingCrawlers.map((crawler) => ({
    crawler,
    present: new RegExp(`User-agent:\\s*${crawler}[\\s\\S]*?Disallow:\\s*/`, 'i').test(robots)
  }));

  return {
    file: path.relative(root, robotsPath),
    allows,
    blocks,
    ok: allows.every((item) => item.present) && blocks.every((item) => item.present)
  };
}

function status(value) {
  return value ? 'OK' : 'FIX';
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# AI Visibility Monitor');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Robots');
  lines.push('');
  lines.push(`Robots file: \`${report.robots.file}\``);
  lines.push('');
  lines.push('| Crawler | Rule present |');
  lines.push('| --- | --- |');
  for (const item of report.robots.allows) {
    lines.push(`| ${item.crawler} allow | ${status(item.present)} |`);
  }
  for (const item of report.robots.blocks) {
    lines.push(`| ${item.crawler} training block | ${status(item.present)} |`);
  }
  lines.push('');
  lines.push('## Money Page Checks');
  lines.push('');
  lines.push('| Page | AI answer | FAQ signal | JSON-LD | Canonical | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const page of report.pages) {
    const state = page.failures.length ? page.failures.join('; ') : 'OK';
    lines.push(`| ${page.path} | ${status(page.aiAnswerBlock)} | ${status(page.faqSignals)} | ${status(page.validJsonLd)} | ${status(page.canonical)} | ${state} |`);
  }
  lines.push('');
  lines.push('## Manual AI Prompt Matrix');
  lines.push('');
  lines.push('Run these prompts in ChatGPT, Gemini, Claude, and Perplexity. Record whether Marga is named, which URL is cited, and whether the cited page matches the preferred landing page.');
  lines.push('');
  lines.push('| Prompt | Preferred page |');
  lines.push('| --- | --- |');
  for (const item of report.promptMatrix) {
    lines.push(`| ${item.prompt} | ${item.preferredPage} |`);
  }
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  lines.push('- Keep answer blocks concise and factual on money pages.');
  lines.push('- Add buyer-question pages when Search Console or sales calls reveal repeat questions.');
  lines.push('- Re-run this report after content changes and after Netlify deploys `main`.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const pages = targetPages.map((urlPath) => addFailures(checkPage(urlPath)));
  const robots = checkRobots();
  const report = {
    generatedAt: new Date().toISOString(),
    site: siteBase,
    robots,
    pages,
    promptMatrix
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, 'latest.md'), renderMarkdown(report));

  const failures = pages.reduce((total, page) => total + page.failures.length, robots.ok ? 0 : 1);
  console.log(`AI visibility report written to ${path.relative(root, path.join(reportDir, 'latest.md'))}`);
  if (failures > 0) {
    console.log(`${failures} issue(s) need attention.`);
    process.exitCode = 1;
  }
}

main();
