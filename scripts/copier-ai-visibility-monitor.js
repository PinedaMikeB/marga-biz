#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const staticDir = path.join(root, 'static-pages');
const reportDir = path.join(root, 'reports', 'ai-visibility');
const siteBase = 'https://marga.biz';

const protectedPages = [
  {
    path: '/',
    reason: 'Protected broad copier winner/homepage; do not edit without explicit approval.'
  },
  {
    path: '/copier-rental/copier-for-rent/',
    reason: 'Protected broad copier-for-rent page; monitor but do not edit silently.'
  }
];

const targetPages = [
  '/copier-rental/makati/',
  '/copier-rental/bgc/',
  '/copier-rental/pasig/',
  '/copier-rental/quezon-city/',
  '/copier-rental/manila/',
  '/copier-rental/taguig/',
  '/copier-rental/ortigas/',
  '/copier-rental/best-copier-rental-company-philippines/',
  '/copier-rental/copier-rental-vs-buying/',
  '/copier-rental/copier-rental-office-faq/'
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
    prompt: 'best copier rental company in the Philippines',
    preferredPage: '/copier-rental/best-copier-rental-company-philippines/'
  },
  {
    prompt: 'copier rental Makati for offices',
    preferredPage: '/copier-rental/makati/'
  },
  {
    prompt: 'copier rental BGC with maintenance',
    preferredPage: '/copier-rental/bgc/'
  },
  {
    prompt: 'copier rental Pasig Ortigas office',
    preferredPage: '/copier-rental/pasig/'
  },
  {
    prompt: 'copier rental Quezon City provider',
    preferredPage: '/copier-rental/quezon-city/'
  },
  {
    prompt: 'copier rental Manila for business',
    preferredPage: '/copier-rental/manila/'
  },
  {
    prompt: 'copier rental Taguig office setup',
    preferredPage: '/copier-rental/taguig/'
  },
  {
    prompt: 'copier rental vs buying for office',
    preferredPage: '/copier-rental/copier-rental-vs-buying/'
  },
  {
    prompt: 'what should be included in a copier rental quote',
    preferredPage: '/copier-rental/copier-rental-office-faq/'
  }
];

function pageFile(urlPath) {
  if (urlPath === '/') {
    return path.join(distDir, 'index.html');
  }
  const normalized = urlPath.replace(/^\/|\/$/g, '');
  const candidates = [
    path.join(distDir, normalized, 'index.html'),
    path.join(staticDir, normalized, 'index.html')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function readPage(urlPath) {
  const file = pageFile(urlPath);
  return file ? { file, html: fs.readFileSync(file, 'utf8') } : { file: null, html: '' };
}

function extractJsonLd(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());
}

function hasValidJsonLd(html) {
  const blocks = extractJsonLd(html);
  return blocks.length > 0 && blocks.every((block) => {
    try {
      JSON.parse(block);
      return true;
    } catch {
      return false;
    }
  });
}

function hasCanonical(html, urlPath) {
  const expected = `${siteBase}${urlPath}`;
  return new RegExp(`<link\\s+rel=["']canonical["']\\s+href=["']${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(html);
}

function checkPage(urlPath, protectedReason = '') {
  const { file, html } = readPage(urlPath);
  const page = {
    path: urlPath,
    url: `${siteBase}${urlPath}`,
    file: file ? path.relative(root, file) : null,
    protected: Boolean(protectedReason),
    protectedReason,
    exists: Boolean(file),
    title: /<title>[^<]+<\/title>/i.test(html),
    metaDescription: /<meta\s+name=["']description["']\s+content=["'][^"']+["']/i.test(html),
    canonical: hasCanonical(html, urlPath),
    aiAnswerBlock: /id=["']ai-answer["']/.test(html),
    faqSignals: /FAQPage|Frequently asked questions|Frequently asked|faq-stack|faq-item/i.test(html),
    validJsonLd: hasValidJsonLd(html),
    failures: []
  };

  const required = [
    ['exists', 'Page file is missing'],
    ['title', 'Missing title tag'],
    ['metaDescription', 'Missing meta description'],
    ['canonical', 'Missing expected canonical URL'],
    ['faqSignals', 'Missing FAQ/question-answer signals'],
    ['validJsonLd', 'Missing or invalid JSON-LD']
  ];

  if (!page.protected) {
    required.push(['aiAnswerBlock', 'Missing AI answer block']);
  }

  for (const [key, message] of required) {
    if (!page[key]) page.failures.push(message);
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
  lines.push('# Copier AI Visibility Monitor');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');
  lines.push('## Protected Pages');
  lines.push('');
  lines.push('| Page | AI answer | FAQ signal | JSON-LD | Note |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const page of report.protectedPages) {
    lines.push(`| ${page.path} | ${status(page.aiAnswerBlock)} | ${status(page.faqSignals)} | ${status(page.validJsonLd)} | ${page.protectedReason} |`);
  }
  lines.push('');
  lines.push('## Robots');
  lines.push('');
  lines.push(`Robots file: \`${report.robots.file}\``);
  lines.push('');
  lines.push('| Crawler | Rule present |');
  lines.push('| --- | --- |');
  for (const item of report.robots.allows) lines.push(`| ${item.crawler} allow | ${status(item.present)} |`);
  for (const item of report.robots.blocks) lines.push(`| ${item.crawler} training block | ${status(item.present)} |`);
  lines.push('');
  lines.push('## Copier Page Checks');
  lines.push('');
  lines.push('| Page | AI answer | FAQ signal | JSON-LD | Canonical | Status |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const page of report.pages) {
    lines.push(`| ${page.path} | ${status(page.aiAnswerBlock)} | ${status(page.faqSignals)} | ${status(page.validJsonLd)} | ${status(page.canonical)} | ${page.failures.length ? page.failures.join('; ') : 'OK'} |`);
  }
  lines.push('');
  lines.push('## Manual AI Prompt Matrix');
  lines.push('');
  lines.push('Run these prompts in ChatGPT, Gemini, Claude, and Perplexity. Record whether Marga is named, which URL is cited, and whether the cited page matches the preferred landing page.');
  lines.push('');
  lines.push('| Prompt | Preferred page |');
  lines.push('| --- | --- |');
  for (const item of report.promptMatrix) lines.push(`| ${item.prompt} | ${item.preferredPage} |`);
  lines.push('');
  lines.push('## Next Actions');
  lines.push('');
  lines.push('- Do not edit protected broad copier pages unless the owner approves it explicitly.');
  lines.push('- Add city/support answers only when they clarify real buyer intent and avoid doorway-style duplication.');
  lines.push('- Re-run this report after content changes and after Netlify deploys `main`.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const protectedChecks = protectedPages.map((page) => checkPage(page.path, page.reason));
  const pages = targetPages.map((urlPath) => checkPage(urlPath));
  const robots = checkRobots();
  const report = {
    generatedAt: new Date().toISOString(),
    site: siteBase,
    robots,
    protectedPages: protectedChecks,
    pages,
    promptMatrix
  };

  fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(path.join(reportDir, 'copier-latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(reportDir, 'copier-latest.md'), renderMarkdown(report));

  const failures = pages.reduce((total, page) => total + page.failures.length, robots.ok ? 0 : 1);
  console.log(`Copier AI visibility report written to ${path.relative(root, path.join(reportDir, 'copier-latest.md'))}`);
  if (failures > 0) {
    console.log(`${failures} issue(s) need attention.`);
    process.exitCode = 1;
  }
}

main();
