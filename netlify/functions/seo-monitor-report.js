const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { google } = require('googleapis');

const TIMEZONE = 'Asia/Manila';
const DEFAULT_DAYS = 5;
const SITE_URL = process.env.SEARCH_CONSOLE_SITE_URL || 'https://marga.biz/';
const DEFAULT_PRIORITY_KEYWORDS = [
    'Printer Rental',
    'Printer For Rent',
    'Print All You Can',
    'Printer Rental BGC',
    'Printer Rental Makati',
    'Printer Rental Manila',
    'Printer Rental Philippines',
    'Printer Rental Taguig',
    'Copier Rental',
    'Copier For Rent',
    'Copier Rental BGC',
    'Copier Rental Makati',
    'Copier Rental Manila',
    'Copier Rental Taguig',
    'Copier Rental Quezon City',
    'Copier Rental Pasig',
    'Copier Rental Ortigas',
    'Copier Rental Philippines'
];
const PRINTER_GOAL_KEYWORDS = [
    'Printer Rental',
    'Printer For Rent',
    'Print All You Can',
    'Printer Rental BGC',
    'Printer Rental Makati',
    'Printer Rental Manila',
    'Printer Rental Philippines',
    'Printer Rental Taguig'
];
const COPIER_PROTECTED_KEYWORDS = [
    'Copier Rental',
    'Copier For Rent',
    'Copier Rental Philippines'
];
const COPIER_LOCAL_GOAL_KEYWORDS = [
    'Copier Rental BGC',
    'Copier Rental Makati',
    'Copier Rental Manila',
    'Copier Rental Taguig',
    'Copier Rental Quezon City',
    'Copier Rental Pasig',
    'Copier Rental Ortigas'
];
const EXISTING_MONEY_PAGES = [
    '/printer-rental/',
    '/printer-rental/printer-for-rent/',
    '/printer-rental/print-all-you-can/',
    '/printer-rental/philippines/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/',
    '/printer-rental/manila/',
    '/printer-rental/pasig/'
];
const EXISTING_CITY_SUPPORT_PAGES = [
    '/printer-rental/quezon-city/',
    '/printer-rental/ortigas/',
    '/printer-rental/best-printer-rental-setup-bgc/',
    '/printer-rental/best-printer-rental-setup-manila/',
    '/printer-rental/best-printer-rental-setup-ortigas/'
];
const EXISTING_SUPPORT_REFRESH_PAGES = [
    '/printer-rental/how-to-choose-printer-rental-makati/',
    '/printer-rental/how-to-choose-printer-rental-pasig/',
    '/printer-rental/how-to-choose-printer-rental-quezon-city/',
    '/printer-rental/bgc/',
    '/printer-rental/makati/'
];
const EXISTING_BLOG_SUPPORT_PAGES = [
    '/printer-rental/how-much-does-printer-rental-cost/',
    '/printer-rental/how-is-printer-maintenance-handled-in-rentals/',
    '/printer-rental/how-do-i-choose-the-right-printer-rental-company/',
    '/printer-rental/comparing-printer-rentals/',
    '/printer-rental/cost-savings-printer-rental/',
    '/printer-rental/printer-rental-manila-office-setup-checklist/',
    '/printer-rental/printer-rental-philippines-service-coverage-checklist/',
    '/printer-rental/print-all-you-can-volume-planning-guide/'
];
const COPIER_LOCATION_GROWTH_PAGES = [
    '/copier-rental/bgc/',
    '/copier-rental/makati/',
    '/copier-rental/manila/',
    '/copier-rental/taguig/',
    '/copier-rental/quezon-city/',
    '/copier-rental/pasig/',
    '/copier-rental/ortigas/'
];
const COPIER_LOCATION_SUPPORT_PAGES = [
    '/copier-rental/how-to-choose-copier-rental-bgc/',
    '/copier-rental/how-to-choose-copier-rental-makati/',
    '/copier-rental/manila/copier-rental-manila-setup-checklist/',
    '/copier-rental/taguig/copier-rental-taguig-office-readiness-checklist/',
    '/copier-rental/how-to-choose-copier-rental-manila/',
    '/copier-rental/how-to-choose-copier-rental-taguig/',
    '/copier-rental/how-to-choose-copier-rental-quezon-city/'
];
const COPIER_LOCATION_BLOG_PAGES = [
    '/copier-rental/copier-rental-pricing-guide/',
    '/copier-rental/copier-rental-vs-buying/',
    '/copier-rental/copier-rental-maintenance-guide/',
    '/copier-rental/copier-rental-for-offices/',
    '/copier-rental/copier-rental-checklist/',
    '/copier-rental/manila/copier-rental-manila-setup-checklist/',
    '/copier-rental/taguig/copier-rental-taguig-office-readiness-checklist/'
];
const TASK_STATUS_DONE = 'Done';
const DEFAULT_TASK_STATUS = 'Active';

function getManilaDateKey(input = new Date()) {
    const date = input instanceof Date ? input : new Date(input);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function getServiceAccount() {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    }

    const localPath = path.join(__dirname, '..', '..', 'service-account-key.json');
    if (fs.existsSync(localPath)) {
        return JSON.parse(fs.readFileSync(localPath, 'utf8'));
    }

    throw new Error('Google service account is not configured');
}

function getFirebaseApp() {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(getServiceAccount()),
            projectId: 'sah-spiritual-journal'
        });
    }

    return admin.app();
}

function getSearchConsoleAuth() {
    const credentials = getServiceAccount();
    return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/webmasters.readonly']
    });
}

function normalizeKeyword(keyword = '') {
    return keyword.toLowerCase().trim().replace(/\s+/g, ' ');
}

function keywordToDocId(keyword = '') {
    return normalizeKeyword(keyword).replace(/\s+/g, '_');
}

function displayKeyword(keyword = '') {
    return keyword
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

function isPrinterKeyword(keyword = '') {
    const normalized = normalizeKeyword(keyword);
    return normalized.includes('printer') || normalized === 'print all you can';
}

function isCopierKeyword(keyword = '') {
    const normalized = normalizeKeyword(keyword);
    return normalized.includes('copier') || normalized.includes('photocopier') || normalized.includes('copy machine');
}

function isTrackedSeoKeyword(keyword = '') {
    return isPrinterKeyword(keyword) || isCopierKeyword(keyword);
}

function formatDateKey(input) {
    const value = typeof input === 'string' ? input : input?.toISOString?.();
    if (!value) return '';
    return value.slice(0, 10);
}

function formatDateLabel(dateKey) {
    if (!dateKey) return '--';
    const date = new Date(`${dateKey}T12:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'numeric',
        day: 'numeric',
        year: '2-digit'
    }).format(date);
}

function formatDateTime(value) {
    if (!value) return '--';
    const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
    return new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit'
    }).format(date);
}

function formatCtr(value) {
    if (value == null || Number.isNaN(Number(value))) return '--';
    return `${Math.round(Number(value) * 10) / 10}%`;
}

function dedupeKeywords(priorityKeywords, configuredKeywords) {
    const ordered = [];
    const seen = new Set();

    for (const keyword of [...priorityKeywords, ...configuredKeywords]) {
        const clean = keyword?.trim();
        if (!clean) continue;
        const normalized = normalizeKeyword(clean);
        if (!isTrackedSeoKeyword(normalized)) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        ordered.push({
            label: clean,
            normalized
        });
    }

    return ordered;
}

function getRankingOpportunityValue(item) {
    return item?.latestPosition == null ? 999 : Number(item.latestPosition);
}

function pickWorstKeyword(rankings = [], matcher, fallback) {
    const pool = rankings
        .filter(item => !matcher || matcher(item))
        .sort((left, right) => getRankingOpportunityValue(right) - getRankingOpportunityValue(left));

    return pool[0]?.keyword || fallback;
}

function pickLowestScorePage(todayRun = {}, fallback = '/printer-rental/') {
    const pageScans = Array.isArray(todayRun.pageScans) ? todayRun.pageScans : [];
    const sorted = [...pageScans].sort((left, right) => {
        const leftScore = left.seoScore ?? 999;
        const rightScore = right.seoScore ?? 999;
        if (leftScore !== rightScore) return leftScore - rightScore;
        return (right.issueCount || 0) - (left.issueCount || 0);
    });

    return sorted[0]?.path || fallback;
}

function getKeywordTargetPath(keyword = '') {
    const normalized = normalizeKeyword(keyword);
    const exactPrinterTargets = {
        'printer rental': '/printer-rental/',
        'printer for rent': '/printer-rental/printer-for-rent/',
        'print all you can': '/printer-rental/print-all-you-can/',
        'printer rental philippines': '/printer-rental/philippines/'
    };

    if (exactPrinterTargets[normalized]) return exactPrinterTargets[normalized];

    if (normalized.includes('copier')) {
        if (normalized.includes('bgc')) return '/copier-rental/bgc/';
        if (normalized.includes('makati')) return '/copier-rental/makati/';
        if (normalized.includes('manila')) return '/copier-rental/manila/';
        if (normalized.includes('pasig')) return '/copier-rental/pasig/';
        if (normalized.includes('quezon')) return '/copier-rental/quezon-city/';
        if (normalized.includes('ortigas')) return '/copier-rental/ortigas/';
        if (normalized.includes('taguig')) return '/copier-rental/taguig/';
        return '/copier-rental/';
    }
    if (normalized.includes('bgc')) return '/printer-rental/bgc/';
    if (normalized.includes('makati')) return '/printer-rental/makati/';
    if (normalized.includes('manila')) return '/printer-rental/manila/';
    if (normalized.includes('pasig')) return '/printer-rental/pasig/';
    if (normalized.includes('quezon')) return '/printer-rental/quezon-city/';
    if (normalized.includes('taguig')) return '/printer-rental/taguig/';
    return '/printer-rental/';
}

function getOpportunityPositionValue(position) {
    return position == null ? 21 : Number(position);
}

function getKeywordGoalTarget(keyword = '') {
    const normalized = normalizeKeyword(keyword);
    if (normalized === 'printer rental' || normalized === 'printer for rent' || normalized === 'print all you can') {
        return 1;
    }
    if (normalized === 'copier rental' || normalized === 'copier for rent') {
        return 2;
    }
    if (normalized.includes('philippines')) {
        return 3;
    }
    return 3;
}

function getGoalCompletionScore(position, target) {
    if (position == null) return 0;
    if (position <= target) return 100;
    const cappedGap = Math.min(Math.max(position - target, 0), 19);
    return Math.max(0, Math.round(((19 - cappedGap) / 19) * 100));
}

function getWeeklyDateKeys() {
    const keys = [];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() - 3);

    for (let offset = 6; offset >= 0; offset -= 1) {
        const value = new Date(endDate);
        value.setDate(endDate.getDate() - offset);
        keys.push(getManilaDateKey(value));
    }

    return keys;
}

async function getWeeklyKeywordSearchMetrics(keywords = []) {
    const normalizedKeywords = [...new Set(
        keywords
            .map((item) => normalizeKeyword(item))
            .filter(Boolean)
    )];

    const emptyResult = {
        seriesDates: getWeeklyDateKeys(),
        metricsByKeyword: {}
    };

    if (!normalizedKeywords.length) return emptyResult;

    try {
        const auth = getSearchConsoleAuth();
        const searchconsole = google.searchconsole({ version: 'v1', auth });
        const seriesDates = getWeeklyDateKeys();
        const startDate = seriesDates[0];
        const endDate = seriesDates[seriesDates.length - 1];

        const response = await searchconsole.searchanalytics.query({
            siteUrl: SITE_URL,
            requestBody: {
                startDate,
                endDate,
                dimensions: ['date', 'query'],
                rowLimit: 500
            }
        });

        const rows = response.data.rows || [];
        const metricsByKeyword = {};

        normalizedKeywords.forEach((keyword) => {
            metricsByKeyword[keyword] = {
                totalClicks: 0,
                totalImpressions: 0,
                avgCtr: 0,
                clickSeries: seriesDates.map((dateKey) => ({ date: dateKey, value: 0 })),
                ctrSeries: seriesDates.map((dateKey) => ({ date: dateKey, value: 0 }))
            };
        });

        rows.forEach((row) => {
            const dateKey = row.keys?.[0];
            const query = normalizeKeyword(row.keys?.[1] || '');
            if (!metricsByKeyword[query]) return;
            const dateIndex = seriesDates.indexOf(dateKey);
            if (dateIndex === -1) return;

            const clicks = Number(row.clicks || 0);
            const impressions = Number(row.impressions || 0);
            const ctr = Number(row.ctr || 0) * 100;

            metricsByKeyword[query].totalClicks += clicks;
            metricsByKeyword[query].totalImpressions += impressions;
            metricsByKeyword[query].clickSeries[dateIndex].value = clicks;
            metricsByKeyword[query].ctrSeries[dateIndex].value = Math.round(ctr * 10) / 10;
        });

        Object.values(metricsByKeyword).forEach((item) => {
            item.avgCtr = item.totalImpressions > 0
                ? Math.round(((item.totalClicks / item.totalImpressions) * 100) * 10) / 10
                : 0;
        });

        return {
            seriesDates,
            metricsByKeyword
        };
    } catch (error) {
        console.warn('Unable to load weekly keyword search metrics:', error.message);
        return emptyResult;
    }
}

function buildGoalProgressForKeywords(keywords = [], rankings = [], weeklyMetrics = null) {
    const focusKeywords = keywords.map((keyword) => {
        const match = rankings.find((item) => normalizeKeyword(item.keyword) === normalizeKeyword(keyword));
        const normalized = normalizeKeyword(keyword);
        const metric = weeklyMetrics?.metricsByKeyword?.[normalized] || null;
        const position = match?.latestPosition ?? null;
        const target = getKeywordGoalTarget(keyword);
        const score = getGoalCompletionScore(position, target);
        return {
            keyword,
            target,
            position,
            score,
            gap: position == null ? null : Math.max(position - target, 0),
            delta: match?.delta ?? null,
            targetPath: getKeywordTargetPath(keyword),
            status: position == null ? 'Needs coverage' : (position <= target ? 'On target' : 'Needs lift'),
            weeklyClicks: metric?.totalClicks ?? 0,
            weeklyCtr: metric?.avgCtr ?? 0,
            weeklyClickSeries: metric?.clickSeries || [],
            weeklyCtrSeries: metric?.ctrSeries || []
        };
    });

    const totalScore = focusKeywords.reduce((sum, item) => sum + item.score, 0);
    const overallScore = focusKeywords.length ? Math.round(totalScore / focusKeywords.length) : 0;
    const topOneCount = focusKeywords.filter((item) => item.position === 1).length;
    const topThreeCount = focusKeywords.filter((item) => item.position != null && item.position <= 3).length;
    const topFiveCount = focusKeywords.filter((item) => item.position != null && item.position <= 5).length;
    const missingCount = focusKeywords.filter((item) => item.position == null).length;
    const weakestKeywords = [...focusKeywords]
        .sort((left, right) => {
            if (left.score !== right.score) return left.score - right.score;
            return getOpportunityPositionValue(right.position) - getOpportunityPositionValue(left.position);
        })
        .slice(0, 4);

    return {
        overallScore,
        topOneCount,
        topThreeCount,
        topFiveCount,
        missingCount,
        focusKeywords,
        weakestKeywords,
        summary: `${topThreeCount}/${focusKeywords.length} target keywords are in the top 3. ${missingCount} still need stronger local or commercial coverage.`
    };
}

function buildGoalProgress(rankings = [], weeklyMetrics = null) {
    return buildGoalProgressForKeywords(PRINTER_GOAL_KEYWORDS, rankings, weeklyMetrics);
}

function describeProtectedWinner(url = '') {
    if (!url) return 'Waiting for ranking page match.';
    if (url === 'https://marga.biz/' || url === 'https://marga.biz') return 'Home page is currently carrying this protected keyword.';
    if (url.includes('/copier-rental/')) return 'Copier core page is currently carrying this protected keyword.';
    return 'A different Marga page is currently carrying this protected keyword.';
}

function buildProtectedWinnerCards(rankings = [], weeklyMetrics = null) {
    return COPIER_PROTECTED_KEYWORDS.map((keyword) => {
        const normalized = normalizeKeyword(keyword);
        const ranking = rankings.find((item) => normalizeKeyword(item.keyword) === normalized) || {};
        const metric = weeklyMetrics?.metricsByKeyword?.[normalized] || null;
        const position = ranking.latestPosition ?? null;
        const target = getKeywordGoalTarget(keyword);
        return {
            keyword,
            target,
            position,
            score: getGoalCompletionScore(position, target),
            gap: position == null ? null : Math.max(position - target, 0),
            latestUrl: ranking.latestUrl || null,
            delta: ranking.delta ?? null,
            weeklyClicks: metric?.totalClicks ?? 0,
            weeklyCtr: metric?.avgCtr ?? 0,
            weeklyClickSeries: metric?.clickSeries || [],
            weeklyCtrSeries: metric?.ctrSeries || [],
            note: describeProtectedWinner(ranking.latestUrl || ''),
            mode: 'Monitor only',
            status: position != null && position <= target ? 'On target' : 'Watch closely'
        };
    });
}

function buildCopierProgress(rankings = [], weeklyMetrics = null) {
    const progress = buildGoalProgressForKeywords(COPIER_LOCAL_GOAL_KEYWORDS, rankings, weeklyMetrics);
    return {
        ...progress,
        summary: `${progress.topThreeCount}/${progress.focusKeywords.length} copier local targets are in the top 3. Protect copier core winners, but only build or improve local copier pages and support assets.`
    };
}

function buildCopierGaps(rankings = [], copierProgress = null, copierProtected = [], todayRun = null) {
    const gaps = [];
    const weakestKeywords = copierProgress?.weakestKeywords || [];

    weakestKeywords.slice(0, 3).forEach((item) => {
        const current = item.position == null ? 'Not in top 20' : `#${item.position}`;
        gaps.push({
            type: 'Copier ranking gap',
            title: `${item.keyword} is at ${current}`,
            detail: 'Create or strengthen copier location pages, child support pages, and supporting internal links for this local copier term, while leaving the copier root pages untouched.',
            link: getKeywordTargetPath(item.keyword)
        });
    });

    copierProtected.forEach((item) => {
        if (item.position != null && item.position <= item.target) return;
        gaps.push({
            type: 'Protected winner watch',
            title: `${item.keyword} needs monitoring at #${item.position ?? '--'}`,
            detail: 'Do not edit the protected copier core or home page automatically. Watch the winning URL, CTR, and competitors so any drop is detected early.',
            link: item.latestUrl || '/copier-rental/'
        });
    });

    const copierCompetitorLabel = todayRun?.copierCompetitors?.topDomains?.length
        ? todayRun.copierCompetitors.topDomains.slice(0, 3).map((item) => item.domain).join(', ')
        : null;
    if (copierCompetitorLabel) {
        gaps.push({
            type: 'Copier competitor gap',
            title: 'Copier location competitors still communicate stronger local relevance',
            detail: `Review ${copierCompetitorLabel} daily and mirror the useful trust signals, service details, local proof, and support-content angles they use without touching the protected copier root pages.`,
            link: getKeywordTargetPath(weakestKeywords[0]?.keyword || 'Copier Rental BGC')
        });
    }

    return gaps.slice(0, 5);
}

function buildGapList(rankings = [], todayRun = null, goalProgress = null) {
    const gaps = [];
    const weakestKeywords = goalProgress?.weakestKeywords || [];
    const goalKeywords = goalProgress?.focusKeywords || [];
    const competitorDomains = todayRun?.competitors?.topDomains || [];
    const lowestScorePage = pickLowestScorePage(todayRun, '/printer-rental/');

    weakestKeywords.slice(0, 3).forEach((item) => {
        const current = item.position == null ? 'Not in top 20' : `#${item.position}`;
        const target = item.target === 1 ? '#1' : `top ${item.target}`;
        gaps.push({
            type: 'Ranking gap',
            title: `${item.keyword} is at ${current}`,
            detail: `Target is ${target}. Improve the mapped landing page and supporting internal links until this keyword moves into the goal range.`,
            link: item.targetPath
        });
    });

    const mismatch = rankings.find((item) => {
        const normalized = normalizeKeyword(item.keyword);
        const targetPath = getKeywordTargetPath(item.keyword);
        if (!item.latestPosition || !targetPath) return false;
        if (!/printer rental|printer for rent|print all you can/i.test(normalized)) return false;
        const latestUrl = String(item.latestUrl || item.latestTargetUrl || item.url || '');
        return latestUrl && !latestUrl.includes(targetPath.replace(/\/$/, ''));
    });

    if (mismatch) {
        gaps.push({
            type: 'Page-match gap',
            title: `${mismatch.keyword} is ranking with the wrong page`,
            detail: `The domain is visible, but not with the intended landing page. Strengthen page targeting, canonicals, and internal links so the right printer page wins.`,
            link: getKeywordTargetPath(mismatch.keyword)
        });
    }

    if (competitorDomains.length) {
        gaps.push({
            type: 'Competitor gap',
            title: `Higher-ranking competitors still lead on ${todayRun?.competitors?.keyword || 'printer rental'}`,
            detail: `Review ${competitorDomains.slice(0, 3).map((item) => item.domain).join(', ')} daily and close the trust, service-inclusion, comparison, and proof gaps they communicate better.`,
            link: getKeywordTargetPath(todayRun?.competitors?.keyword || 'Printer Rental')
        });
    }

    if (lowestScorePage) {
        gaps.push({
            type: 'On-page gap',
            title: `${lowestScorePage} has the weakest scan score`,
            detail: 'Use the page scan as a repair queue for titles, meta, schema, headings, canonicals, FAQs, and conversion content before weaker pages drag the cluster down.',
            link: lowestScorePage
        });
    }

    const missingLocals = goalKeywords.filter((item) => item.position == null && /\b(BGC|Makati|Manila|Philippines|Taguig)\b/i.test(item.keyword));
    if (missingLocals.length) {
        gaps.push({
            type: 'Coverage gap',
            title: `${missingLocals.length} local targets still need stronger coverage`,
            detail: `Prioritize new or improved local pages for ${missingLocals.map((item) => item.keyword).join(', ')} only when the pages add real business value and distinct local intent.`,
            link: missingLocals[0].targetPath
        });
    }

    return gaps.slice(0, 6);
}

function buildRecommendedDailyTasks(rankings = [], todayRun = null, goalProgress = null) {
    const goalKeywords = goalProgress?.focusKeywords || [];
    const weakestMoneyKeyword = pickWorstKeyword(
        rankings,
        item => /^printer rental$|^printer for rent$|^print all you can$/i.test(item.keyword),
        'Printer Rental'
    );
    const weakestCityKeyword = pickWorstKeyword(
        rankings,
        item => /\b(BGC|Makati|Manila|Taguig)\b/i.test(item.keyword),
        'Printer Rental BGC'
    );
    const weakestCopierKeyword = pickWorstKeyword(
        rankings,
        item => /^copier rental (bgc|makati|manila|taguig|quezon city|pasig|ortigas|philippines)$/i.test(item.keyword),
        'Copier Rental BGC'
    );
    const weakestOverallKeywords = goalProgress?.weakestKeywords?.map((item) => item.keyword) || [];
    const weakestOverallLabel = weakestOverallKeywords.join(', ') || 'Printer Rental, Printer For Rent';
    const missingLocalKeywords = goalKeywords
        .filter((item) => item.position == null && /\b(BGC|Makati|Manila|Philippines|Taguig)\b/i.test(item.keyword))
        .map((item) => item.keyword);
    const localExpansionTargets = missingLocalKeywords.length
        ? missingLocalKeywords.join(', ')
        : 'Printer Rental Taguig, Printer Rental Quezon City';
    const lowestScorePage = pickLowestScorePage(todayRun, '/printer-rental/');
    const primaryCompetitorKeyword = todayRun?.competitors?.keyword || 'Printer Rental Philippines';
    const weakestCityPath = getKeywordTargetPath(weakestCityKeyword);
    const weakestMoneyPath = getKeywordTargetPath(weakestMoneyKeyword);
    const weakestCopierPath = getKeywordTargetPath(weakestCopierKeyword);
    const moneyPageTargets = EXISTING_MONEY_PAGES.join(', ');
    const cityPageTargets = EXISTING_CITY_SUPPORT_PAGES.join(', ');
    const supportRefreshTargets = EXISTING_SUPPORT_REFRESH_PAGES.join(', ');
    const blogSupportTargets = EXISTING_BLOG_SUPPORT_PAGES.join(', ');
    const copierGrowthTargets = COPIER_LOCATION_GROWTH_PAGES.join(', ');
    const copierSupportTargets = COPIER_LOCATION_SUPPORT_PAGES.join(', ');
    const copierBlogTargets = COPIER_LOCATION_BLOG_PAGES.join(', ');

    return [
        {
            taskKey: 'improve_money_pages',
            task: 'Improve the highest-opportunity money pages today',
            implementation: `Goal target: move the main commercial keywords closer to #1 by improving the strongest printer money pages first. Tighten titles, meta descriptions, H1/H2 flow, buyer-comparison copy, CTA strength, and internal links around ${weakestMoneyKeyword} and ${weakestOverallLabel}. Scale the page count up or down based on today’s ranking pressure.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${moneyPageTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestMoneyPath || lowestScorePage
        },
        {
            taskKey: 'strengthen_city_service_pages',
            task: 'Strengthen the weakest city or service pages today',
            implementation: `Goal target: lift local-intent keywords into the top 3 by improving the weakest printer city/service pages for ${weakestCityKeyword} and the copier-location growth pages for ${weakestCopierKeyword}. Add clearer location fit, service coverage, trust signals, quote-first CTAs, and local proof instead of leaving these pages as passive inventory. The number of pages can expand when local gaps widen.`,
            targetPageKeyword: `${weakestCityKeyword}, ${weakestCopierKeyword} -> ${cityPageTargets}, ${copierGrowthTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || weakestCityPath
        },
        {
            taskKey: 'refresh_support_pages',
            task: 'Refresh the support pages that can lift rankings today',
            implementation: `Goal target: refresh the support assets that can pass relevance and links into the priority money pages. Start with the weakest support pages already in the printer cluster, then refresh copier-location support pages around ${weakestCopierKeyword} so both clusters start lifting rankings instead of occupying space for nothing.`,
            targetPageKeyword: `${supportRefreshTargets}, ${copierSupportTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || weakestCityPath
        },
        {
            taskKey: 'create_new_support_pages',
            task: 'Create up to 2 new support pages today',
            implementation: `Goal target: add new local support pages only when the current rankings show a real gap. Prioritize missing or non-ranking printer terms such as ${localExpansionTargets}, plus copier-location opportunities around ${weakestCopierKeyword}. Only publish pages that add supported business value beyond the existing clusters.`,
            targetPageKeyword: `${localExpansionTargets}, ${weakestCopierKeyword}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || getKeywordTargetPath(missingLocalKeywords[0] || 'Printer Rental Taguig')
        },
        {
            taskKey: 'publish_supporting_blogs',
            task: 'Publish 5 supporting blogs today',
            implementation: `Goal target: publish or refresh 5 buyer-intent blog assets that remove hesitation around ${weakestOverallLabel} and the copier-location pages tied to ${weakestCopierKeyword}. Focus on pricing, maintenance, provider comparison, local use cases, and each post must support a target landing page with direct internal links.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${blogSupportTargets}; ${weakestCopierKeyword} -> ${copierBlogTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || '/printer-rental/'
        },
        {
            taskKey: 'add_internal_links',
            task: 'Add the internal links needed to move target pages today',
            implementation: `Goal target: add contextual internal links into the pages closest to breaking through. Feed link equity into ${weakestMoneyKeyword}, ${weakestCityKeyword}, ${weakestCopierKeyword}, and the weakest goal terms that are still outside the top 3. Increase link volume when the gap analysis shows more supporting pages are available.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${moneyPageTargets}; ${weakestCopierKeyword} -> ${copierGrowthTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || lowestScorePage
        },
        {
            taskKey: 'fix_on_page_issues',
            task: 'Fix the highest-impact on-page issues today',
            implementation: `Goal target: resolve the most limiting on-page issues on live printer pages and copier-location pages, starting with the pages tied to ${weakestOverallLabel} and ${weakestCopierKeyword}. Fix title/meta mismatches, heading flow, canonicals, thin sections, image alt text, or missing schema where they are suppressing rankings, without touching the copier core winners.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${moneyPageTargets}; ${weakestCopierKeyword} -> ${copierGrowthTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || lowestScorePage
        },
        {
            taskKey: 'refresh_faq_schema',
            task: 'Add or refresh FAQ and schema where the gap calls for it today',
            implementation: `Goal target: expand commercial-intent FAQ coverage and valid schema on the pages supporting ${weakestOverallLabel} and the copier-location pages around ${weakestCopierKeyword}. Use buyer objections and service-area concerns pulled from the current ranking gaps, not generic filler.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${supportRefreshTargets}; ${weakestCopierKeyword} -> ${copierSupportTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || lowestScorePage
        },
        {
            taskKey: 'improve_conversion_sections',
            task: 'Improve conversion sections on the pages closest to revenue today',
            implementation: `Goal target: strengthen conversion sections on the live pages that already rank but are not yet winning. Improve quote CTAs, talk-to-sales prompts, proof blocks, and lead framing so ${weakestOverallLabel} traffic and the copier-location traffic around ${weakestCopierKeyword} turn into inquiries.`,
            targetPageKeyword: `${weakestOverallLabel} -> ${moneyPageTargets}; ${weakestCopierKeyword} -> ${copierGrowthTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || lowestScorePage
        },
        {
            taskKey: 'close_competitor_gaps',
            task: 'Close the competitor gaps exposed today',
            implementation: `Goal target: use today’s printer and copier competitor findings to close the missing relevance gaps on the pages supporting ${weakestOverallLabel} and ${weakestCopierKeyword}. Add the specific trust signals, inclusions, comparisons, local proof, and buyer-proof sections that the higher-ranking pages communicate better. Keep this as a daily non-stop research-and-fix loop.`,
            targetPageKeyword: `${primaryCompetitorKeyword}, ${weakestCopierKeyword} -> ${moneyPageTargets}, ${copierGrowthTargets}`,
            status: DEFAULT_TASK_STATUS,
            link: weakestCopierPath || weakestMoneyPath
        }
    ];
}

async function getTaskCompletions(db, dateKey) {
    try {
        const snapshot = await db.collection('seo_monitor_task_completions')
            .where('date', '==', dateKey)
            .get();

        const map = new Map();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.taskKey) {
                map.set(data.taskKey, { id: doc.id, ...data });
            }
        });
        return map;
    } catch (error) {
        console.warn('Unable to load SEO monitor task completions:', error.message);
        return new Map();
    }
}

function mergeDailyTasks(tasks, completionMap) {
    return tasks.map(task => {
        const completion = completionMap.get(task.taskKey);
        if (!completion) return task;

        return {
            ...task,
            implementation: completion.implementation || task.implementation,
            targetPageKeyword: completion.targetPageKeyword || task.targetPageKeyword,
            status: completion.status || TASK_STATUS_DONE,
            link: completion.link || task.link,
            completedAt: completion.completedAt || null
        };
    });
}

function getDateKeyFromIso(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return getManilaDateKey(date);
}

function normalizeTaskText(value = '') {
    return String(value || '').trim().toLowerCase();
}

function isAutomationQueueDone(automationStatus = null) {
    if (!automationStatus) return false;
    const queueStatus = normalizeTaskText(automationStatus.queueStatus);
    const status = normalizeTaskText(automationStatus.status);
    const reportDate = getDateKeyFromIso(automationStatus.latestReportGeneratedAt || automationStatus.finishedAt || automationStatus.updatedAtIso);
    return queueStatus === 'done' && status === 'done' && reportDate === getManilaDateKey();
}

function findCompletedTaskMatch(task, completedTasks = []) {
    return completedTasks.find((item) => {
        const label = normalizeTaskText(item.task);
        if (!label) return false;

        if (task.taskKey === 'publish_supporting_blogs') return label.includes('supporting blog') || label.includes('support article');
        if (task.taskKey === 'create_new_support_pages') return label.includes('new copier-local service pages') || label.includes('new support page');
        if (task.taskKey === 'improve_money_pages') return label.includes('improve scheduled printer-rental pages');
        if (task.taskKey === 'strengthen_city_service_pages') return label.includes('copier location growth pages') || label.includes('new copier-local service pages');
        if (task.taskKey === 'refresh_support_pages') return label.includes('support article') || label.includes('supporting blog');
        if (task.taskKey === 'add_internal_links') return label.includes('internal link');
        if (task.taskKey === 'fix_on_page_issues') return label.includes('improve scheduled printer-rental pages') || label.includes('copier location growth pages');
        if (task.taskKey === 'refresh_faq_schema') return label.includes('faq') || label.includes('schema');
        if (task.taskKey === 'improve_conversion_sections') return label.includes('conversion') || label.includes('quote-prep');
        if (task.taskKey === 'close_competitor_gaps') return label.includes('re-check printer and protected copier rankings live') || label.includes('competitor');

        return false;
    }) || null;
}

function mergeAutomationCompletedTasks(tasks, automationStatus) {
    if (!isAutomationQueueDone(automationStatus)) return tasks;

    const completedTasks = Array.isArray(automationStatus.completedTasks) ? automationStatus.completedTasks : [];

    return tasks.map((task) => {
        const matched = findCompletedTaskMatch(task, completedTasks);
        return {
            ...task,
            implementation: matched?.implementation || matched?.notes || task.implementation,
            link: matched?.link || task.link,
            status: TASK_STATUS_DONE,
            completedAt: automationStatus.latestReportGeneratedAt || automationStatus.finishedAt || task.completedAt || null
        };
    });
}

function summarizeTask(task) {
    const payload = task.data || {};
    const title = payload.title || payload.slug || payload.keyword || task.title || task.type || 'SEO task';
    const taskName = task.type === 'create_page'
        ? `Create page: ${title}`
        : title;
    const link = payload.link
        || payload.path
        || (payload.slug ? `https://marga.biz/${String(payload.slug).replace(/^\/+|\/+$/g, '')}/` : null);

    return {
        timestamp: formatDateTime(task.completedAt || task.updatedAt || task.createdAt),
        task: taskName,
        link,
        status: (task.status || 'pending').toUpperCase()
    };
}

function summarizeActivity(item) {
    const details = item.details || {};
    const taskLabel = details.keyword
        ? `${item.action.replace(/_/g, ' ')}: ${details.keyword}`
        : item.action.replace(/_/g, ' ');

    return {
        timestamp: formatDateTime(item.timestamp),
        task: displayKeyword(taskLabel),
        link: details.url || details.path || null,
        status: 'LOG'
    };
}

async function getRecentTasks(db) {
    try {
        const snapshot = await db.collection('marga_tasks')
            .orderBy('createdAt', 'desc')
            .limit(8)
            .get();

        return snapshot.docs.map(doc => summarizeTask(doc.data()));
    } catch (error) {
        console.warn('Unable to load recent tasks:', error.message);
        return [];
    }
}

async function getRecentActivity(db) {
    try {
        const snapshot = await db.collection('marga_activity_log')
            .orderBy('timestamp', 'desc')
            .limit(8)
            .get();

        return snapshot.docs.map(doc => summarizeActivity(doc.data()));
    } catch (error) {
        console.warn('Unable to load recent activity:', error.message);
        return [];
    }
}

async function getConfig(db) {
    const doc = await db.collection('marga_config').doc('settings').get();
    return doc.exists ? doc.data() : {};
}

async function getSnapshotFallback(db, days) {
    try {
        const snapshot = await db.collection('insights_snapshots')
            .orderBy('date', 'desc')
            .limit(days)
            .get();

        return snapshot.docs.map(doc => doc.data());
    } catch (error) {
        console.warn('Unable to load insights snapshots:', error.message);
        return [];
    }
}

async function getLatestDailyRun(db) {
    try {
        const doc = await db.collection('marga_shared').doc('seo_monitor_daily_run').get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.warn('Unable to load latest SEO monitor run:', error.message);
        return null;
    }
}

async function getAutomationStatus(db) {
    try {
        const doc = await db.collection('marga_shared').doc('seo_monitor_automation_status').get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.warn('Unable to load SEO monitor automation status:', error.message);
        return null;
    }
}

async function getAutomationEvents(db) {
    try {
        const snapshot = await db.collection('seo_monitor_automation_events')
            .orderBy('createdAt', 'desc')
            .limit(8)
            .get();

        return snapshot.docs.map(doc => {
            const item = doc.data();
            return {
                timestamp: formatDateTime(item.createdAt || item.updatedAtIso),
                status: item.status || 'LOG',
                step: item.currentStep || '--',
                message: item.message || '--'
            };
        });
    } catch (error) {
        console.warn('Unable to load SEO monitor automation events:', error.message);
        return [];
    }
}

async function getKeywordHistory(db, keywordLabel, days, snapshotFallbackMap) {
    const docId = keywordToDocId(keywordLabel);
    const ref = db.collection('marga_rankings').doc(docId);
    const doc = await ref.get();
    const positionsByDate = {};
    let latestPosition = null;
    let latestUrl = null;

    if (doc.exists) {
        const data = doc.data();
        latestPosition = data.latestPosition ?? null;
        latestUrl = data.latestUrl ?? null;

        try {
            const history = await ref.collection('history')
                .orderBy('checkedAt', 'desc')
                .limit(Math.max(days * 2, 10))
                .get();

            history.forEach(item => {
                const entry = item.data();
                const dateKey = formatDateKey(entry.checkedAt);
                if (!dateKey || positionsByDate[dateKey] !== undefined) return;
                positionsByDate[dateKey] = entry.position ?? null;
            });
        } catch (error) {
            console.warn(`Unable to load ranking history for ${keywordLabel}:`, error.message);
        }
    }

    const snapshotFallback = snapshotFallbackMap[normalizeKeyword(keywordLabel)] || {};
    for (const [dateKey, position] of Object.entries(snapshotFallback)) {
        if (positionsByDate[dateKey] === undefined) {
            positionsByDate[dateKey] = position;
        }
    }

    const trendDates = Object.keys(positionsByDate).sort().slice(-2);
    const previousPosition = trendDates.length > 1 ? positionsByDate[trendDates[trendDates.length - 2]] : null;
    const delta = latestPosition != null && previousPosition != null
        ? previousPosition - latestPosition
        : null;

    return {
        keyword: keywordLabel,
        latestPosition,
        latestUrl,
        previousPosition,
        delta,
        positionsByDate
    };
}

function buildSnapshotFallbackMap(snapshots) {
    const map = {};

    for (const item of snapshots) {
        const dateKey = item.date;
        for (const keyword of item.searchConsole?.topKeywords || []) {
            const normalized = normalizeKeyword(keyword.keyword);
            if (!map[normalized]) map[normalized] = {};
            if (map[normalized][dateKey] === undefined) {
                map[normalized][dateKey] = keyword.position ?? null;
            }
        }
    }

    return map;
}

exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const params = event.queryStringParameters || {};
        const days = Math.min(Math.max(parseInt(params.days, 10) || DEFAULT_DAYS, 2), 14);

        const db = admin.firestore(getFirebaseApp());
        const config = await getConfig(db);
        const configuredKeywords = [
            ...(config.seo?.keywords?.primary || []),
            ...(config.seo?.keywords?.growth || []),
            ...(config.seo?.keywords?.manual || [])
        ];
        const trackedKeywords = dedupeKeywords(DEFAULT_PRIORITY_KEYWORDS, configuredKeywords);
        const snapshots = await getSnapshotFallback(db, days);
        const snapshotFallbackMap = buildSnapshotFallbackMap(snapshots);

        const rankings = await Promise.all(
            trackedKeywords.map(item => getKeywordHistory(db, item.label, days, snapshotFallbackMap))
        );

        const allDateKeys = new Set();
        rankings.forEach(item => {
            Object.keys(item.positionsByDate || {}).forEach(dateKey => allDateKeys.add(dateKey));
        });
        snapshots.forEach(item => {
            if (item.date) allDateKeys.add(item.date);
        });

        const reportDates = Array.from(allDateKeys)
            .sort((a, b) => b.localeCompare(a))
            .slice(0, days)
            .map(dateKey => ({
                key: dateKey,
                label: formatDateLabel(dateKey)
            }));

        const recentTasks = await getRecentTasks(db);
        const recentActivity = recentTasks.length > 0 ? recentTasks : await getRecentActivity(db);
        const latestSnapshot = snapshots[0] || null;
        const latestDailyRun = await getLatestDailyRun(db);
        const automationStatus = await getAutomationStatus(db);
        const automationEvents = await getAutomationEvents(db);
        const weeklyKeywordMetrics = await getWeeklyKeywordSearchMetrics(trackedKeywords.map((item) => item.label));
        const goalProgress = buildGoalProgress(rankings, weeklyKeywordMetrics);
        const copierProgress = buildCopierProgress(rankings, weeklyKeywordMetrics);
        const copierProtected = buildProtectedWinnerCards(rankings, weeklyKeywordMetrics);
        const gaps = buildGapList(rankings, latestDailyRun, goalProgress);
        const copierGaps = buildCopierGaps(rankings, copierProgress, copierProtected, latestDailyRun);
        const completionMap = await getTaskCompletions(db, getManilaDateKey());
        const activeAutomations = mergeAutomationCompletedTasks(
            mergeDailyTasks(
                buildRecommendedDailyTasks(rankings, latestDailyRun, goalProgress),
                completionMap
            ),
            automationStatus
        );

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                generatedAt: new Date().toISOString(),
                timezone: TIMEZONE,
                reportDates,
                rankings,
                logs: recentActivity,
                dailyTasks: activeAutomations,
                todayRun: latestDailyRun,
                goalProgress,
                copierProgress,
                copierProtected,
                gaps,
                copierGaps,
                automationStatus,
                automationEvents,
                meta: {
                    keywordsTracked: trackedKeywords.length,
                    latestSnapshotDate: latestSnapshot?.date || null,
                    openTaskCount: activeAutomations.filter(item => String(item.status).toLowerCase() !== 'done').length,
                    automationState: automationStatus?.status || 'Scheduled',
                    goalScore: goalProgress.overallScore,
                    copierGoalScore: copierProgress.overallScore,
                    metricGuidance: {
                        keywordCards: 'Use weekly Search Console clicks and CTR for keyword cards. Track page visits separately at the landing-page level.',
                        recommendedCadence: 'Daily for rankings and gap detection, weekly for clicks and CTR, monthly for page traffic and conversions.',
                        copierGuidance: 'Treat home and copier core winners as monitor-only. Use automation only for copier location growth pages, supporting content, and internal links.'
                    },
                    sourceCollections: [
                        'marga_config',
                        'marga_rankings',
                        'insights_snapshots',
                        'marga_tasks',
                        'marga_activity_log',
                        'marga_shared',
                        'seo_monitor_task_completions',
                        'seo_monitor_automation_events'
                    ]
                }
            })
        };
    } catch (error) {
        console.error('SEO monitor report error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
