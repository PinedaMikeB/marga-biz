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
