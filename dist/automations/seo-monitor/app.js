const state = {
    days: 5,
    data: null
};

const elements = {
    daysSelect: document.getElementById('daysSelect'),
    refreshButton: document.getElementById('refreshButton'),
    runTodayButton: document.getElementById('runTodayButton'),
    manualKeywordForm: document.getElementById('manualKeywordForm'),
    manualKeywordInput: document.getElementById('manualKeywordInput'),
    manualKeywordButton: document.getElementById('manualKeywordButton'),
    manualKeywordResult: document.getElementById('manualKeywordResult'),
    runTodayResult: document.getElementById('runTodayResult'),
    trackedKeywords: document.getElementById('trackedKeywords'),
    latestSnapshot: document.getElementById('latestSnapshot'),
    openTasks: document.getElementById('openTasks'),
    generatedAt: document.getElementById('generatedAt'),
    sourceCollections: document.getElementById('sourceCollections'),
    rankingsTable: document.getElementById('rankingsTable'),
    logsTable: document.getElementById('logsTable'),
    tasksTable: document.getElementById('tasksTable'),
    statusText: document.getElementById('statusText')
};

function formatDateTime(value) {
    if (!value) return '--';
    return new Date(value).toLocaleString('en-US', {
        timeZone: 'Asia/Manila',
        month: 'numeric',
        day: 'numeric',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit'
    });
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function setButtonState(button, busy, busyLabel, idleLabel) {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
}

function renderSummary(data) {
    elements.trackedKeywords.textContent = data.meta?.keywordsTracked ?? '--';
    elements.latestSnapshot.textContent = data.meta?.latestSnapshotDate || 'No snapshot yet';
    elements.openTasks.textContent = data.meta?.openTaskCount ?? '--';
    elements.generatedAt.textContent = formatDateTime(data.generatedAt);

    elements.sourceCollections.innerHTML = (data.meta?.sourceCollections || [])
        .map(item => `<span class="chip">${escapeHtml(item)}</span>`)
        .join('');

    renderTodayRun(data.todayRun || null);
}

function getDeltaClass(delta) {
    if (delta == null) return 'flat';
    if (delta > 0) return 'up';
    if (delta < 0) return 'down';
    return 'flat';
}

function getDeltaLabel(delta) {
    if (delta == null) return 'No change yet';
    if (delta > 0) return `Up ${delta}`;
    if (delta < 0) return `Down ${Math.abs(delta)}`;
    return 'Flat';
}

function renderRankings(data) {
    const table = elements.rankingsTable;
    const dates = data.reportDates || [];
    const rankings = data.rankings || [];

    table.querySelector('thead').innerHTML = `
        <tr>
            <th class="rank-keyword">Keyword</th>
            ${dates.map(item => `<th>${escapeHtml(item.label)}</th>`).join('')}
        </tr>
    `;

    if (rankings.length === 0) {
        table.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">No keyword ranking data found yet.</td></tr>';
        return;
    }

    table.querySelector('tbody').innerHTML = rankings.map(item => `
        <tr>
            <td class="rank-keyword">
                <strong>${escapeHtml(item.keyword)}</strong>
                <div class="keyword-meta">
                    <span class="chip">Latest: ${item.latestPosition ?? '--'}</span>
                    <span class="delta ${getDeltaClass(item.delta)}">${getDeltaLabel(item.delta)}</span>
                </div>
            </td>
            ${dates.map(date => {
                const value = item.positionsByDate?.[date.key];
                return `
                    <td class="position-cell">
                        <span class="position-value ${value == null ? 'empty' : ''}">
                            ${value == null ? '&ndash;' : escapeHtml(value)}
                        </span>
                    </td>
                `;
            }).join('')}
        </tr>
    `).join('');
}

function renderSimpleTable(table, headings, rows, emptyMessage = 'No entries yet.') {
    table.querySelector('thead').innerHTML = `
        <tr>${headings.map(item => `<th>${escapeHtml(item)}</th>`).join('')}</tr>
    `;

    if (!rows.length) {
        table.querySelector('tbody').innerHTML = `<tr><td colspan="99" class="empty-row">${escapeHtml(emptyMessage)}</td></tr>`;
        return;
    }

    table.querySelector('tbody').innerHTML = rows.join('');
}

function renderLogs(data) {
    const rows = (data.logs || []).map(item => `
        <tr>
            <td>${escapeHtml(item.timestamp || '--')}</td>
            <td>${escapeHtml(item.task || '--')}</td>
            <td>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Open</a>` : '&ndash;'}</td>
            <td><span class="status-pill ${(item.status || '').toLowerCase()}">${escapeHtml(item.status || '--')}</span></td>
        </tr>
    `);

    renderSimpleTable(elements.logsTable, ['Date', 'Task', 'Link', 'Status'], rows);
}

function renderTasks(data) {
    const rows = (data.dailyTasks || []).map(item => `
        <tr>
            <td>${escapeHtml(item.task || '--')}</td>
            <td>${escapeHtml(item.implementation || '--')}</td>
            <td><span class="status-pill ${(item.status || '').toLowerCase()}">${escapeHtml(item.status || '--')}</span></td>
            <td>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">Open</a>` : '&ndash;'}</td>
        </tr>
    `);

    renderSimpleTable(elements.tasksTable, ['Daily Task', 'Implementation', 'Status', 'Link'], rows);
}

function renderTodayRun(todayRun) {
    if (!todayRun?.ranAt) {
        elements.runTodayResult.className = 'result-card result-muted';
        elements.runTodayResult.innerHTML = 'Waiting to run today’s printer task pack.';
        return;
    }

    const rankingChecks = todayRun.rankings?.length ?? 0;
    const pagesScanned = todayRun.pageScans?.length ?? 0;
    const competitorLabel = todayRun.competitors?.topDomains?.length
        ? `Top competitors: ${todayRun.competitors.topDomains.slice(0, 3).map(item => `${item.domain} (#${item.position})`).join(', ')}`
        : 'Competitor snapshot not available yet.';

    elements.runTodayResult.className = 'result-card';
    elements.runTodayResult.innerHTML = `
        <strong>Last run: ${escapeHtml(formatDateTime(todayRun.ranAt))}</strong><br>
        Checked ${escapeHtml(String(rankingChecks))} printer keywords, scanned ${escapeHtml(String(pagesScanned))} printer pages, and ${todayRun.snapshot?.success ? 'saved' : 'attempted'} the daily analytics snapshot.<br>
        ${escapeHtml(competitorLabel)}
    `;
}

function renderManualKeywordResult(result, isError = false) {
    elements.manualKeywordResult.className = `result-card${isError ? '' : ''}`;
    if (isError) {
        elements.manualKeywordResult.innerHTML = `<strong>Unable to check keyword.</strong><br>${escapeHtml(result)}`;
        return;
    }

    const competitors = (result.competitors || [])
        .slice(0, 3)
        .map(item => `${item.domain} (#${item.position})`)
        .join(', ');

    elements.manualKeywordResult.innerHTML = `
        <strong>${escapeHtml(result.keyword)}</strong><br>
        ${result.notFound ? 'Not found in the top 20 results yet.' : `Marga is at position ${escapeHtml(String(result.ranking?.position ?? '--'))}.`}<br>
        ${result.ranking?.url ? `Ranking page: <a href="${escapeHtml(result.ranking.url)}" target="_blank" rel="noopener">${escapeHtml(result.ranking.url)}</a><br>` : ''}
        ${competitors ? `Top competitors: ${escapeHtml(competitors)}` : 'No competitor snapshot returned.'}
    `;
}

async function fetchJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || payload.message || `Request failed with status ${response.status}`);
    }

    return payload;
}

async function loadReport() {
    elements.statusText.textContent = 'Loading Firebase report data...';
    setButtonState(elements.refreshButton, true, 'Refreshing...', 'Refresh');

    try {
        const data = await fetchJson(`/.netlify/functions/seo-monitor-report?days=${encodeURIComponent(state.days)}`);
        state.data = data;

        renderSummary(data);
        renderRankings(data);
        renderLogs(data);
        renderTasks(data);
        elements.statusText.textContent = `Report updated ${formatDateTime(data.generatedAt)}.`;
    } catch (error) {
        console.error(error);
        elements.statusText.textContent = `Unable to load report: ${error.message}`;
        elements.rankingsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load ranking report.</td></tr>';
        elements.logsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load logs.</td></tr>';
        elements.tasksTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load tasks.</td></tr>';
    } finally {
        setButtonState(elements.refreshButton, false, 'Refreshing...', 'Refresh');
    }
}

async function runToday() {
    elements.statusText.textContent = 'Running today’s printer SEO task pack...';
    setButtonState(elements.runTodayButton, true, 'Running...', 'Run Today');

    try {
        const payload = await fetchJson('/.netlify/functions/seo-monitor-actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action: 'run_today' })
        });

        renderTodayRun(payload.data);
        elements.statusText.textContent = `Today’s printer SEO task pack finished at ${formatDateTime(payload.data.ranAt)}.`;
        await loadReport();
    } catch (error) {
        console.error(error);
        elements.runTodayResult.className = 'result-card';
        elements.runTodayResult.innerHTML = `<strong>Run failed.</strong><br>${escapeHtml(error.message)}`;
        elements.statusText.textContent = `Unable to run today’s printer tasks: ${error.message}`;
    } finally {
        setButtonState(elements.runTodayButton, false, 'Running...', 'Run Today');
    }
}

async function submitManualKeyword(event) {
    event.preventDefault();

    const keyword = elements.manualKeywordInput.value.trim();
    if (!keyword) {
        renderManualKeywordResult('Enter a keyword to check and save.', true);
        return;
    }

    setButtonState(elements.manualKeywordButton, true, 'Checking...', 'Check And Save');
    elements.statusText.textContent = `Checking ranking for "${keyword}"...`;

    try {
        const payload = await fetchJson('/.netlify/functions/seo-monitor-actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'track_keyword',
                keyword
            })
        });

        renderManualKeywordResult(payload.data);
        elements.manualKeywordInput.value = '';
        elements.statusText.textContent = `Tracked keyword "${keyword}" saved at ${formatDateTime(payload.data.checkedAt)}.`;
        await loadReport();
    } catch (error) {
        console.error(error);
        renderManualKeywordResult(error.message, true);
        elements.statusText.textContent = `Unable to check keyword: ${error.message}`;
    } finally {
        setButtonState(elements.manualKeywordButton, false, 'Checking...', 'Check And Save');
    }
}

elements.daysSelect.addEventListener('change', () => {
    state.days = Number(elements.daysSelect.value || 5);
    loadReport();
});

elements.refreshButton.addEventListener('click', () => {
    loadReport();
});

elements.runTodayButton.addEventListener('click', () => {
    runToday();
});

elements.manualKeywordForm.addEventListener('submit', submitManualKeyword);

loadReport();
