const state = {
    keyword: 'all',
    from: '',
    to: '',
    data: null
};

const KEYWORDS = [
    'Copier Rental',
    'Copier For Rent',
    'Printer Rental',
    'Printer For Rent'
];

const KEYWORD_DETAILS = {
    all: {
        targetPath: '/automations/seo-monitor/',
        improvement: 'Review all four money keywords daily. Lift the weakest score first, then add AI answer blocks, FAQs, proof, and third-party mentions for the selected keyword.',
        schedule: 'Daily: check AI engines. Monday: copier rental. Tuesday: copier for rent. Wednesday: printer rental. Thursday: printer for rent. Friday: cleanup and source proof.'
    },
    'Copier Rental': {
        targetPath: '/',
        improvement: 'Protect the winner. Add concise AI answer wording, FAQ proof, maintenance/setup details, and external review mentions without weakening the existing broad copier ranking.',
        schedule: 'Monday focus: verify SEO rank, test ChatGPT/Claude/Perplexity/Gemini/Copilot, then add one proof or FAQ improvement if a source misses Marga.'
    },
    'Copier For Rent': {
        targetPath: '/copier-rental/copier-for-rent/',
        improvement: 'Clarify rental intent: who should rent, what details affect quote, setup/maintenance inclusion, and city coverage. Make this page the preferred citation for “copier for rent.”',
        schedule: 'Tuesday focus: AI prompt checks, page answer block check, FAQ/schema update, and one outside mention or customer proof item.'
    },
    'Printer Rental': {
        targetPath: '/printer-rental/',
        improvement: 'Strengthen the printer rental hub as the answer page for offices comparing setup, maintenance, monthly volume, Print All You Can, and city support.',
        schedule: 'Wednesday focus: SEO rank, AI prompt checks, internal links from support pages, and one buyer-question section improvement.'
    },
    'Printer For Rent': {
        targetPath: '/printer-rental/printer-for-rent/',
        improvement: 'Make equipment-fit intent clear: printer type, users, volume, mono/color, scan/copy needs, and when rental is better than buying.',
        schedule: 'Thursday focus: AI prompt checks, quote-readiness copy, FAQ/schema, and proof linking back to the printer-for-rent page.'
    }
};

const AI_SOURCES = [
    'ChatGPT',
    'Claude',
    'Perplexity',
    'Gemini',
    'Copilot',
    'Google AI',
    'Google Search',
    'Bing'
];

const elements = {
    menuButton: document.getElementById('menuButton'),
    menuPanel: document.getElementById('monitorMenu'),
    keywordSelect: document.getElementById('keywordSelect'),
    fromDate: document.getElementById('fromDate'),
    toDate: document.getElementById('toDate'),
    refreshButton: document.getElementById('refreshButton'),
    runTodayButton: document.getElementById('runTodayButton'),
    circleGraph: document.getElementById('circleGraph'),
    selectedKeywordLabel: document.getElementById('selectedKeywordLabel'),
    scoreLabel: document.getElementById('scoreLabel'),
    progressBar: document.getElementById('progressBar'),
    equivalentRank: document.getElementById('equivalentRank'),
    rankingData: document.getElementById('rankingData'),
    aiSourceGrid: document.getElementById('aiSourceGrid'),
    improvementText: document.getElementById('improvementText'),
    scheduleText: document.getElementById('scheduleText'),
    statusText: document.getElementById('statusText')
};

function setMenuOpen(open) {
    elements.menuPanel.hidden = !open;
    elements.menuButton.setAttribute('aria-expanded', String(open));
}

function getManilaDate(offsetDays = 0) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

function daysBetween(from, to) {
    const start = new Date(`${from}T00:00:00+08:00`);
    const end = new Date(`${to}T00:00:00+08:00`);
    const diff = Math.round((end - start) / 86400000) + 1;
    return Math.max(1, Math.min(31, Number.isFinite(diff) ? diff : 5));
}

function normalizeKeyword(value) {
    return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function findRanking(keyword) {
    const normalized = normalizeKeyword(keyword);
    return (state.data?.rankings || []).find((item) => normalizeKeyword(item.keyword) === normalized) || null;
}

function scorePosition(position) {
    if (position == null) return 0;
    if (position <= 1) return 100;
    if (position <= 3) return 80;
    if (position <= 5) return 65;
    if (position <= 10) return 40;
    return 15;
}

function scoreEquivalentFromPosition(position) {
    if (position == null) return 'Not found = 0%';
    if (position <= 1) return '#1 = 100%';
    if (position <= 3) return '#2-3 = 80%';
    if (position <= 5) return '#4-5 = 65%';
    if (position <= 10) return '#6-10 = 40%';
    return 'Below top 10 = 15%';
}

function getSelectedRankings() {
    if (state.keyword !== 'all') {
        return [{ keyword: state.keyword, ranking: findRanking(state.keyword) }];
    }

    return KEYWORDS.map((keyword) => ({ keyword, ranking: findRanking(keyword) }));
}

function getScore() {
    if (state.keyword !== 'all') {
        const ranking = findRanking(state.keyword);
        return scorePosition(ranking?.latestPosition ?? ranking?.position ?? null);
    }

    const scores = KEYWORDS.map((keyword) => {
        const ranking = findRanking(keyword);
        return scorePosition(ranking?.latestPosition ?? ranking?.position ?? null);
    });

    return Math.round(scores.reduce((sum, item) => sum + item, 0) / scores.length);
}

function getAiStatus(source, ranking) {
    if (source === 'Google Search') {
        const position = ranking?.latestPosition ?? ranking?.position;
        return position == null ? 'Not found' : `#${position}`;
    }

    if (source === 'Bing') {
        return 'Needs check';
    }

    return 'Needs check';
}

function renderDetails(score) {
    const selected = state.keyword === 'all' ? 'all' : state.keyword;
    const config = KEYWORD_DETAILS[selected] || KEYWORD_DETAILS.all;
    const selectedRankings = getSelectedRankings();
    const primaryRanking = selectedRankings[0]?.ranking || null;
    const primaryPosition = primaryRanking?.latestPosition ?? primaryRanking?.position ?? null;

    elements.equivalentRank.textContent = state.keyword === 'all'
        ? `Average of money keywords = ${score}%`
        : scoreEquivalentFromPosition(primaryPosition);

    if (state.keyword === 'all') {
        elements.rankingData.textContent = selectedRankings
            .map((item) => {
                const position = item.ranking?.latestPosition ?? item.ranking?.position;
                return `${item.keyword}: ${position == null ? 'not found' : `#${position}`}`;
            })
            .join(' | ');
    } else {
        const url = primaryRanking?.latestUrl || primaryRanking?.url || config.targetPath;
        elements.rankingData.textContent = `${state.keyword}: ${primaryPosition == null ? 'not found' : `#${primaryPosition}`} | Target: ${url}`;
    }

    elements.aiSourceGrid.innerHTML = AI_SOURCES.map((source) => `
        <div class="ai-source">
            <span>${source}</span>
            <strong>${getAiStatus(source, primaryRanking)}</strong>
        </div>
    `).join('');

    elements.improvementText.textContent = config.improvement;
    elements.scheduleText.textContent = config.schedule;
}

function renderCircle(score) {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;
    elements.circleGraph.innerHTML = `
        <svg viewBox="0 0 150 150" role="img" aria-label="${score}% progress">
            <circle class="circle-bg" cx="75" cy="75" r="${radius}"></circle>
            <circle class="circle-value" cx="75" cy="75" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
            <text x="75" y="82" text-anchor="middle">${score}%</text>
        </svg>
    `;
}

function render() {
    const score = getScore();
    elements.selectedKeywordLabel.textContent = state.keyword === 'all' ? 'All keywords' : state.keyword;
    elements.scoreLabel.textContent = `${score}%`;
    elements.progressBar.style.width = `${score}%`;
    renderCircle(score);
    renderDetails(score);
}

function setBusy(button, busy, idleLabel) {
    button.disabled = busy;
    button.textContent = busy ? '...' : idleLabel;
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || payload.message || `Request failed: ${response.status}`);
    }
    return payload;
}

async function loadReport() {
    setBusy(elements.refreshButton, true, 'Refresh');
    elements.statusText.textContent = 'Loading...';

    try {
        const days = daysBetween(state.from, state.to);
        state.data = await fetchJson(`/.netlify/functions/seo-monitor-report?days=${encodeURIComponent(days)}`);
        render();
        elements.statusText.textContent = `Updated ${new Date(state.data.generatedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}`;
    } catch (error) {
        console.error(error);
        state.data = { rankings: [] };
        render();
        elements.statusText.textContent = error.message;
    } finally {
        setBusy(elements.refreshButton, false, 'Refresh');
    }
}

async function runToday() {
    setBusy(elements.runTodayButton, true, 'Run');
    elements.statusText.textContent = 'Running...';

    try {
        await fetchJson('/.netlify/functions/seo-monitor-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'run_today' })
        });
        await loadReport();
    } catch (error) {
        console.error(error);
        elements.statusText.textContent = error.message;
    } finally {
        setBusy(elements.runTodayButton, false, 'Run');
    }
}

function syncStateFromControls() {
    state.keyword = elements.keywordSelect.value;
    state.from = elements.fromDate.value || getManilaDate(-4);
    state.to = elements.toDate.value || getManilaDate(0);
}

function initializeControls() {
    elements.fromDate.value = getManilaDate(-4);
    elements.toDate.value = getManilaDate(0);
    syncStateFromControls();
}

elements.keywordSelect.addEventListener('change', () => {
    syncStateFromControls();
    render();
});

elements.fromDate.addEventListener('change', () => {
    syncStateFromControls();
    loadReport();
});

elements.toDate.addEventListener('change', () => {
    syncStateFromControls();
    loadReport();
});

elements.refreshButton.addEventListener('click', () => {
    syncStateFromControls();
    loadReport();
});

elements.runTodayButton.addEventListener('click', runToday);
elements.menuButton.addEventListener('click', () => setMenuOpen(elements.menuPanel.hidden));

initializeControls();
render();
loadReport();
