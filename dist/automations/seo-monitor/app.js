const state = {
    days: 5,
    data: null
};

const elements = {
    daysSelect: document.getElementById('daysSelect'),
    refreshButton: document.getElementById('refreshButton'),
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

function renderSummary(data) {
    elements.trackedKeywords.textContent = data.meta?.keywordsTracked ?? '--';
    elements.latestSnapshot.textContent = data.meta?.latestSnapshotDate || 'No snapshot yet';
    elements.openTasks.textContent = data.meta?.openTaskCount ?? '--';
    elements.generatedAt.textContent = formatDateTime(data.generatedAt);

    elements.sourceCollections.innerHTML = (data.meta?.sourceCollections || [])
        .map(item => `<span class="chip">${escapeHtml(item)}</span>`)
        .join('');
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

function renderSimpleTable(table, headings, rows) {
    table.querySelector('thead').innerHTML = `
        <tr>${headings.map(item => `<th>${escapeHtml(item)}</th>`).join('')}</tr>
    `;

    if (!rows.length) {
        table.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">No entries yet.</td></tr>';
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

async function loadReport() {
    elements.statusText.textContent = 'Loading Firebase report data...';
    elements.refreshButton.disabled = true;
    elements.refreshButton.textContent = 'Refreshing...';

    try {
        const response = await fetch(`/.netlify/functions/seo-monitor-report?days=${encodeURIComponent(state.days)}`);
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
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
        elements.refreshButton.disabled = false;
        elements.refreshButton.textContent = 'Refresh Report';
    }
}

elements.daysSelect.addEventListener('change', () => {
    state.days = Number(elements.daysSelect.value || 5);
    loadReport();
});

elements.refreshButton.addEventListener('click', () => {
    loadReport();
});

loadReport();
