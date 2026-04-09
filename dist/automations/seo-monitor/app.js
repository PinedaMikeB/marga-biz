const state = {
    days: 5,
    data: null
};

const elements = {
    daysSelect: document.getElementById('daysSelect'),
    refreshButton: document.getElementById('refreshButton'),
    runTodayButton: document.getElementById('runTodayButton'),
    manualKeywordForm: document.getElementById('goalManualKeywordForm'),
    manualKeywordInput: document.getElementById('goalManualKeywordInput'),
    manualKeywordButton: document.getElementById('goalManualKeywordButton'),
    manualKeywordResult: document.getElementById('manualKeywordResult'),
    completionForm: document.getElementById('completionForm'),
    completionTaskSelect: document.getElementById('completionTaskSelect'),
    completionImplementationInput: document.getElementById('completionImplementationInput'),
    completionTargetInput: document.getElementById('completionTargetInput'),
    completionLinkInput: document.getElementById('completionLinkInput'),
    completionButton: document.getElementById('completionButton'),
    completionResult: document.getElementById('completionResult'),
    runTodayResult: document.getElementById('runTodayResult'),
    trackedKeywords: document.getElementById('trackedKeywords'),
    latestSnapshot: document.getElementById('latestSnapshot'),
    openTasks: document.getElementById('openTasks'),
    generatedAt: document.getElementById('generatedAt'),
    automationState: document.getElementById('automationState'),
    goalScore: document.getElementById('goalScore'),
    copierGoalScore: document.getElementById('copierGoalScore'),
    goalSummaryPill: document.getElementById('goalSummaryPill'),
    goalOverallScore: document.getElementById('goalOverallScore'),
    goalSummaryText: document.getElementById('goalSummaryText'),
    goalMetricGuidance: document.getElementById('goalMetricGuidance'),
    goalProgressLabel: document.getElementById('goalProgressLabel'),
    goalProgressBar: document.getElementById('goalProgressBar'),
    goalMetrics: document.getElementById('goalMetrics'),
    goalKeywordGrid: document.getElementById('goalKeywordGrid'),
    copierSummaryPill: document.getElementById('copierSummaryPill'),
    copierOverallScore: document.getElementById('copierOverallScore'),
    copierSummaryText: document.getElementById('copierSummaryText'),
    copierMetricGuidance: document.getElementById('copierMetricGuidance'),
    copierProgressLabel: document.getElementById('copierProgressLabel'),
    copierProgressBar: document.getElementById('copierProgressBar'),
    copierMetrics: document.getElementById('copierMetrics'),
    copierProtectedGrid: document.getElementById('copierProtectedGrid'),
    copierKeywordGrid: document.getElementById('copierKeywordGrid'),
    automationStatusPill: document.getElementById('automationStatusPill'),
    automationStep: document.getElementById('automationStep'),
    automationUpdatedAt: document.getElementById('automationUpdatedAt'),
    automationNextRun: document.getElementById('automationNextRun'),
    automationLastSuccess: document.getElementById('automationLastSuccess'),
    automationMessage: document.getElementById('automationMessage'),
    automationLogExcerpt: document.getElementById('automationLogExcerpt'),
    automationEventsTable: document.getElementById('automationEventsTable'),
    sourceCollections: document.getElementById('sourceCollections'),
    rankingsTable: document.getElementById('rankingsTable'),
    gapsTable: document.getElementById('gapsTable'),
    copierGapsTable: document.getElementById('copierGapsTable'),
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

function toAbsoluteUrl(value) {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `${window.location.origin}${value.startsWith('/') ? value : `/${value}`}`;
}

function setButtonState(button, busy, busyLabel, idleLabel) {
    button.disabled = busy;
    button.textContent = busy ? busyLabel : idleLabel;
}

function getStatusClass(value) {
    return String(value || 'scheduled').trim().toLowerCase().replace(/\s+/g, '-');
}

function renderSummary(data) {
    elements.trackedKeywords.textContent = data.meta?.keywordsTracked ?? '--';
    elements.latestSnapshot.textContent = data.meta?.latestSnapshotDate || 'No snapshot yet';
    elements.openTasks.textContent = data.meta?.openTaskCount ?? '--';
    elements.generatedAt.textContent = formatDateTime(data.generatedAt);
    elements.automationState.textContent = data.meta?.automationState || '--';
    elements.goalScore.textContent = `${data.meta?.goalScore ?? 0}%`;
    elements.copierGoalScore.textContent = `${data.meta?.copierGoalScore ?? 0}%`;

    elements.sourceCollections.innerHTML = (data.meta?.sourceCollections || [])
        .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
        .join('');

    renderTodayRun(data.todayRun || null);
    renderGoalProgress(data.goalProgress || null);
    renderCopierSection(data.copierProgress || null, data.copierProtected || [], data.meta?.metricGuidance || {});
    renderAutomationStatus(data.automationStatus || null, data.automationEvents || []);
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
            ${dates.map((item) => `<th>${escapeHtml(item.label)}</th>`).join('')}
        </tr>
    `;

    if (rankings.length === 0) {
        table.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">No keyword ranking data found yet.</td></tr>';
        return;
    }

    table.querySelector('tbody').innerHTML = rankings.map((item) => `
        <tr>
            <td class="rank-keyword">
                <strong>${escapeHtml(item.keyword)}</strong>
                <div class="keyword-meta">
                    <span class="chip">Latest: ${item.latestPosition ?? '--'}</span>
                    <span class="delta ${getDeltaClass(item.delta)}">${getDeltaLabel(item.delta)}</span>
                </div>
            </td>
            ${dates.map((date) => {
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
        <tr>${headings.map((item) => `<th>${escapeHtml(item)}</th>`).join('')}</tr>
    `;

    if (!rows.length) {
        table.querySelector('tbody').innerHTML = `<tr><td colspan="99" class="empty-row">${escapeHtml(emptyMessage)}</td></tr>`;
        return;
    }

    table.querySelector('tbody').innerHTML = rows.join('');
}

function renderLogs(data) {
    const rows = (data.logs || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.timestamp || '--')}</td>
            <td>${escapeHtml(item.task || '--')}</td>
            <td>${item.link ? `<a href="${escapeHtml(toAbsoluteUrl(item.link))}" target="_blank" rel="noopener">${escapeHtml(toAbsoluteUrl(item.link))}</a>` : '&ndash;'}</td>
            <td><span class="status-pill ${(item.status || '').toLowerCase()}">${escapeHtml(item.status || '--')}</span></td>
        </tr>
    `);

    renderSimpleTable(elements.logsTable, ['Date', 'Task', 'Link', 'Status'], rows);
}

function renderGoalProgress(goalProgress) {
    const safe = goalProgress || {};
    const overallScore = Number(safe.overallScore || 0);
    const focusKeywords = Array.isArray(safe.focusKeywords) ? safe.focusKeywords : [];
    const weakest = Array.isArray(safe.weakestKeywords) ? safe.weakestKeywords : [];

    elements.goalOverallScore.textContent = `${overallScore}%`;
    elements.goalProgressLabel.textContent = `${overallScore}%`;
    elements.goalProgressBar.style.width = `${Math.max(0, Math.min(overallScore, 100))}%`;
    elements.goalSummaryText.textContent = safe.summary || 'Waiting for goal progress data.';
    elements.goalScore.textContent = `${overallScore}%`;
    if (state.data?.meta?.metricGuidance?.keywordCards) {
        elements.goalMetricGuidance.textContent = state.data.meta.metricGuidance.keywordCards;
    }

    let pillLabel = 'Needs lift';
    if (overallScore >= 85) pillLabel = 'Close to target';
    else if (overallScore >= 60) pillLabel = 'Good momentum';
    else if (overallScore >= 35) pillLabel = 'Building';

    elements.goalSummaryPill.className = `status-pill ${getStatusClass(pillLabel)}`;
    elements.goalSummaryPill.textContent = pillLabel;

    elements.goalMetrics.innerHTML = `
        <span class="chip">Top 1: ${escapeHtml(String(safe.topOneCount ?? '--'))}</span>
        <span class="chip">Top 3: ${escapeHtml(String(safe.topThreeCount ?? '--'))}</span>
        <span class="chip">Top 5: ${escapeHtml(String(safe.topFiveCount ?? '--'))}</span>
        <span class="chip">Missing: ${escapeHtml(String(safe.missingCount ?? '--'))}</span>
    `;

    if (!focusKeywords.length) {
        elements.goalKeywordGrid.innerHTML = `
            <article class="goal-keyword-card">
                <span class="summary-label">No data yet</span>
                <strong>Waiting for keyword goal progress...</strong>
            </article>
        `;
        return;
    }

    elements.goalKeywordGrid.innerHTML = focusKeywords.map((item) => {
        const positionLabel = item.position == null ? 'Not in top 20' : `#${item.position}`;
        const deltaLabel = getDeltaLabel(item.delta);
        const gapLabel = item.position == null ? `Need top ${item.target}` : (item.gap === 0 ? 'Goal reached' : `${item.gap} spots to go`);
        const toneClass = item.position != null && item.position <= item.target ? 'done' : (weakest.some((entry) => entry.keyword === item.keyword) ? 'blocked' : 'active');
        const safeWidth = Math.max(0, Math.min(Number(item.score || 0), 100));

        return `
            <article class="goal-keyword-card">
                <div class="goal-keyword-head">
                    <div>
                        <span class="summary-label">Target ${escapeHtml(String(item.target))}</span>
                        <strong>${escapeHtml(item.keyword)}</strong>
                    </div>
                    <span class="status-pill ${toneClass}">${escapeHtml(item.status || '--')}</span>
                </div>
                <div class="goal-keyword-meta">
                    <span class="chip">Current: ${escapeHtml(positionLabel)}</span>
                    <span class="chip">${escapeHtml(deltaLabel)}</span>
                    <span class="chip">${escapeHtml(gapLabel)}</span>
                </div>
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${safeWidth}%;"></div>
                </div>
                <div class="trend-group">
                    <div class="trend-heading">
                        <span>7d Search Clicks</span>
                        <strong>${escapeHtml(String(item.weeklyClicks ?? 0))}</strong>
                    </div>
                    <div class="mini-bars">
                        ${(item.weeklyClickSeries || []).map((point) => {
                            const maxValue = Math.max(1, ...(item.weeklyClickSeries || []).map((entry) => Number(entry.value || 0)));
                            const height = Math.max(12, Math.round((Number(point.value || 0) / maxValue) * 46));
                            return `<span class="mini-bar" title="${escapeHtml(`${point.date}: ${point.value} clicks`)}"><span style="height:${height}px"></span></span>`;
                        }).join('')}
                    </div>
                </div>
                <div class="trend-group">
                    <div class="trend-heading">
                        <span>7d Avg CTR</span>
                        <strong>${escapeHtml(`${Math.round(Number(item.weeklyCtr || 0) * 10) / 10}%`)}</strong>
                    </div>
                    <div class="mini-bars mini-bars-ctr">
                        ${(item.weeklyCtrSeries || []).map((point) => {
                            const maxValue = Math.max(1, ...(item.weeklyCtrSeries || []).map((entry) => Number(entry.value || 0)));
                            const height = Math.max(12, Math.round((Number(point.value || 0) / maxValue) * 46));
                            return `<span class="mini-bar" title="${escapeHtml(`${point.date}: ${point.value}% CTR`)}"><span style="height:${height}px"></span></span>`;
                        }).join('')}
                    </div>
                </div>
                <a class="goal-link" href="${escapeHtml(toAbsoluteUrl(item.targetPath || '/printer-rental/'))}" target="_blank" rel="noopener">
                    ${escapeHtml(toAbsoluteUrl(item.targetPath || '/printer-rental/'))}
                </a>
            </article>
        `;
    }).join('');
}

function renderMetricBars(series = [], suffix = '', toneClass = '') {
    return `
        <div class="mini-bars ${toneClass}">
            ${series.map((point) => {
                const maxValue = Math.max(1, ...series.map((entry) => Number(entry.value || 0)));
                const height = Math.max(12, Math.round((Number(point.value || 0) / maxValue) * 46));
                return `<span class="mini-bar" title="${escapeHtml(`${point.date}: ${point.value}${suffix}`)}"><span style="height:${height}px"></span></span>`;
            }).join('')}
        </div>
    `;
}

function renderGoalCard(item, options = {}) {
    const positionLabel = item.position == null ? 'Not in top 20' : `#${item.position}`;
    const deltaLabel = getDeltaLabel(item.delta);
    const safeWidth = Math.max(0, Math.min(Number(item.score || 0), 100));
    const toneClass = options.protected
        ? 'info'
        : (item.position != null && item.position <= item.target ? 'done' : ((options.weakest || []).some((entry) => entry.keyword === item.keyword) ? 'blocked' : 'active'));
    const gapLabel = options.protected
        ? (item.latestUrl ? 'Winner monitored' : 'Waiting for winner')
        : (item.position == null ? `Need top ${item.target}` : (item.gap === 0 ? 'Goal reached' : `${item.gap} spots to go`));
    const linkValue = item.latestUrl || item.targetPath || '/';

    return `
        <article class="goal-keyword-card">
            <div class="goal-keyword-head">
                <div>
                    <span class="summary-label">${options.protected ? escapeHtml(item.mode || 'Monitor only') : `Target ${escapeHtml(String(item.target))}`}</span>
                    <strong>${escapeHtml(item.keyword)}</strong>
                </div>
                <span class="status-pill ${toneClass}">${escapeHtml(item.status || item.mode || '--')}</span>
            </div>
            <div class="goal-keyword-meta">
                <span class="chip">Current: ${escapeHtml(positionLabel)}</span>
                <span class="chip">${escapeHtml(deltaLabel)}</span>
                <span class="chip">${escapeHtml(gapLabel)}</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${safeWidth}%;"></div>
            </div>
            <div class="trend-group">
                <div class="trend-heading">
                    <span>7d Search Clicks</span>
                    <strong>${escapeHtml(String(item.weeklyClicks ?? 0))}</strong>
                </div>
                ${renderMetricBars(item.weeklyClickSeries || [], ' clicks')}
            </div>
            <div class="trend-group">
                <div class="trend-heading">
                    <span>7d Avg CTR</span>
                    <strong>${escapeHtml(`${Math.round(Number(item.weeklyCtr || 0) * 10) / 10}%`)}</strong>
                </div>
                ${renderMetricBars(item.weeklyCtrSeries || [], '% CTR', 'mini-bars-ctr')}
            </div>
            ${item.note ? `<p class="card-copy card-copy-tight">${escapeHtml(item.note)}</p>` : ''}
            <a class="goal-link" href="${escapeHtml(toAbsoluteUrl(linkValue))}" target="_blank" rel="noopener">
                ${escapeHtml(toAbsoluteUrl(linkValue))}
            </a>
        </article>
    `;
}

function renderCopierSection(progress, protectedItems, metricGuidance) {
    const safe = progress || {};
    const overallScore = Number(safe.overallScore || 0);
    const focusKeywords = Array.isArray(safe.focusKeywords) ? safe.focusKeywords : [];
    const weakest = Array.isArray(safe.weakestKeywords) ? safe.weakestKeywords : [];
    elements.copierOverallScore.textContent = `${overallScore}%`;
    elements.copierProgressLabel.textContent = `${overallScore}%`;
    elements.copierProgressBar.style.width = `${Math.max(0, Math.min(overallScore, 100))}%`;
    elements.copierSummaryText.textContent = safe.summary || 'Waiting for copier local progress data.';
    if (metricGuidance?.copierGuidance) {
        elements.copierMetricGuidance.textContent = metricGuidance.copierGuidance;
    }

    let pillLabel = 'Monitor protected winners';
    if (overallScore >= 75) pillLabel = 'Copier local momentum';
    else if (overallScore >= 40) pillLabel = 'Copier growth building';
    elements.copierSummaryPill.className = `status-pill ${getStatusClass(pillLabel)}`;
    elements.copierSummaryPill.textContent = pillLabel;

    elements.copierMetrics.innerHTML = `
        <span class="chip">Top 1: ${escapeHtml(String(safe.topOneCount ?? '--'))}</span>
        <span class="chip">Top 3: ${escapeHtml(String(safe.topThreeCount ?? '--'))}</span>
        <span class="chip">Top 5: ${escapeHtml(String(safe.topFiveCount ?? '--'))}</span>
        <span class="chip">Missing: ${escapeHtml(String(safe.missingCount ?? '--'))}</span>
    `;

    elements.copierProtectedGrid.innerHTML = (protectedItems || []).length
        ? protectedItems.map((item) => renderGoalCard(item, { protected: true })).join('')
        : `
            <article class="goal-keyword-card">
                <span class="summary-label">No data yet</span>
                <strong>Waiting for copier protected winners...</strong>
            </article>
        `;

    elements.copierKeywordGrid.innerHTML = focusKeywords.length
        ? focusKeywords.map((item) => renderGoalCard(item, { weakest })).join('')
        : `
            <article class="goal-keyword-card">
                <span class="summary-label">No data yet</span>
                <strong>Waiting for copier local targets...</strong>
            </article>
        `;
}

function renderGaps(data) {
    const rows = (data.gaps || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.type || '--')}</td>
            <td>${escapeHtml(item.title || '--')}</td>
            <td>${escapeHtml(item.detail || '--')}</td>
            <td>${item.link ? `<a href="${escapeHtml(toAbsoluteUrl(item.link))}" target="_blank" rel="noopener">${escapeHtml(toAbsoluteUrl(item.link))}</a>` : '&ndash;'}</td>
        </tr>
    `);

    renderSimpleTable(elements.gapsTable, ['Gap Type', 'Gap To Fix', 'Action Signal', 'Link'], rows, 'No gap signals yet.');
}

function renderCopierGaps(data) {
    const rows = (data.copierGaps || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.type || '--')}</td>
            <td>${escapeHtml(item.title || '--')}</td>
            <td>${escapeHtml(item.detail || '--')}</td>
            <td>${item.link ? `<a href="${escapeHtml(toAbsoluteUrl(item.link))}" target="_blank" rel="noopener">${escapeHtml(toAbsoluteUrl(item.link))}</a>` : '&ndash;'}</td>
        </tr>
    `);

    renderSimpleTable(elements.copierGapsTable, ['Gap Type', 'Gap To Fix', 'Action Signal', 'Link'], rows, 'No copier gap signals yet.');
}

function renderTasks(data) {
    const rows = (data.dailyTasks || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.task || '--')}</td>
            <td>${escapeHtml(item.implementation || '--')}</td>
            <td>${escapeHtml(item.targetPageKeyword || '--')}</td>
            <td><span class="status-pill ${(item.status || '').toLowerCase()}">${escapeHtml(item.status || '--')}</span></td>
            <td>${item.link ? `<a href="${escapeHtml(toAbsoluteUrl(item.link))}" target="_blank" rel="noopener">${escapeHtml(toAbsoluteUrl(item.link))}</a>` : '&ndash;'}</td>
        </tr>
    `);

    renderSimpleTable(elements.tasksTable, ['Daily Task', 'Implementation', 'Target Page Keyword', 'Status', 'Link'], rows);
}

function renderCompletionOptions(data) {
    const tasks = data.dailyTasks || [];
    const options = ['<option value="">Select a task</option>']
        .concat(tasks.map((item) => `
            <option value="${escapeHtml(item.taskKey || '')}">
                ${escapeHtml(item.task || '--')}
            </option>
        `));

    elements.completionTaskSelect.innerHTML = options.join('');
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
        ? `Top competitors: ${todayRun.competitors.topDomains.slice(0, 3).map((item) => `${item.domain} (#${item.position})`).join(', ')}`
        : 'Competitor snapshot not available yet.';

    elements.runTodayResult.className = 'result-card';
    elements.runTodayResult.innerHTML = `
        <strong>Last run: ${escapeHtml(formatDateTime(todayRun.ranAt))}</strong><br>
        Checked ${escapeHtml(String(rankingChecks))} printer keywords, scanned ${escapeHtml(String(pagesScanned))} printer pages, and ${todayRun.snapshot?.success ? 'saved' : 'attempted'} the daily analytics snapshot.<br>
        ${escapeHtml(competitorLabel)}
    `;
}

function renderAutomationStatus(status, events) {
    const safeStatus = status || {};
    const label = safeStatus.status || 'Scheduled';

    elements.automationStatusPill.className = `status-pill ${getStatusClass(label)}`;
    elements.automationStatusPill.textContent = label;
    elements.automationStep.textContent = safeStatus.currentStep || 'Waiting for a live automation status update.';
    elements.automationUpdatedAt.textContent = formatDateTime(safeStatus.updatedAtIso || safeStatus.updatedAt);
    elements.automationNextRun.textContent = formatDateTime(safeStatus.nextRunAt);
    elements.automationLastSuccess.textContent = formatDateTime(safeStatus.lastSuccessAt);
    elements.automationMessage.textContent = safeStatus.message || 'The local launcher will post its progress here while the SEO batch runs.';
    elements.automationLogExcerpt.textContent = safeStatus.liveLogExcerpt || safeStatus.lastMessageExcerpt || 'Waiting for automation output...';

    const rows = (events || []).map((item) => `
        <tr>
            <td>${escapeHtml(item.timestamp || '--')}</td>
            <td><span class="status-pill ${getStatusClass(item.status)}">${escapeHtml(item.status || '--')}</span></td>
            <td>${escapeHtml(item.step || '--')}</td>
            <td>${escapeHtml(item.message || '--')}</td>
        </tr>
    `);

    renderSimpleTable(elements.automationEventsTable, ['Time', 'Status', 'Step', 'Message'], rows, 'No automation activity yet.');
}

function renderManualKeywordResult(result, isError = false) {
    elements.manualKeywordResult.className = 'result-card';
    if (isError) {
        elements.manualKeywordResult.innerHTML = `<strong>Unable to check keyword.</strong><br>${escapeHtml(result)}`;
        return;
    }

    const competitors = (result.competitors || [])
        .slice(0, 3)
        .map((item) => `${item.domain} (#${item.position})`)
        .join(', ');

    elements.manualKeywordResult.innerHTML = `
        <strong>${escapeHtml(result.keyword)}</strong><br>
        ${result.notFound ? 'Not found in the top 20 results yet.' : `Marga is at position ${escapeHtml(String(result.ranking?.position ?? '--'))}.`}<br>
        ${result.ranking?.url ? `Ranking page: <a href="${escapeHtml(result.ranking.url)}" target="_blank" rel="noopener">${escapeHtml(result.ranking.url)}</a><br>` : ''}
        ${competitors ? `Top competitors: ${escapeHtml(competitors)}` : 'No competitor snapshot returned.'}
    `;
}

function renderCompletionResult(message) {
    elements.completionResult.className = 'result-card';
    elements.completionResult.innerHTML = message;
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
        renderGaps(data);
        renderCopierGaps(data);
        renderLogs(data);
        renderTasks(data);
        renderCompletionOptions(data);
        elements.statusText.textContent = `Report updated ${formatDateTime(data.generatedAt)}.`;
    } catch (error) {
        console.error(error);
        elements.statusText.textContent = `Unable to load report: ${error.message}`;
        elements.rankingsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load ranking report.</td></tr>';
        elements.gapsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load gap report.</td></tr>';
        elements.copierGapsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load copier gaps.</td></tr>';
        elements.logsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load logs.</td></tr>';
        elements.tasksTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load tasks.</td></tr>';
        elements.automationEventsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load automation activity.</td></tr>';
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

async function submitCompletion(event) {
    event.preventDefault();

    const taskKey = elements.completionTaskSelect.value.trim();
    const implementation = elements.completionImplementationInput.value.trim();
    const targetPageKeyword = elements.completionTargetInput.value.trim();
    const link = elements.completionLinkInput.value.trim();
    const task = (state.data?.dailyTasks || []).find((item) => item.taskKey === taskKey);

    if (!taskKey || !task) {
        renderCompletionResult('<strong>Pick a task first.</strong><br>Select the queue item you finished.');
        return;
    }

    if (!implementation || !link) {
        renderCompletionResult('<strong>Missing details.</strong><br>Add the implementation summary and live page URL.');
        return;
    }

    setButtonState(elements.completionButton, true, 'Saving...', 'Mark Done');
    elements.statusText.textContent = `Recording completed work for "${task.task}"...`;

    try {
        const payload = await fetchJson('/.netlify/functions/seo-monitor-actions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'complete_task',
                taskKey,
                task: task.task,
                implementation,
                targetPageKeyword: targetPageKeyword || task.targetPageKeyword || '',
                link,
                status: 'Done'
            })
        });

        renderCompletionResult(`
            <strong>Saved as Done.</strong><br>
            ${escapeHtml(task.task)}<br>
            <a href="${escapeHtml(payload.data.link)}" target="_blank" rel="noopener">${escapeHtml(payload.data.link)}</a>
        `);
        elements.completionForm.reset();
        elements.statusText.textContent = `Recorded completed work for "${task.task}".`;
        await loadReport();
    } catch (error) {
        console.error(error);
        renderCompletionResult(`<strong>Unable to save completion.</strong><br>${escapeHtml(error.message)}`);
        elements.statusText.textContent = `Unable to record completed work: ${error.message}`;
    } finally {
        setButtonState(elements.completionButton, false, 'Saving...', 'Mark Done');
    }
}

elements.completionTaskSelect.addEventListener('change', () => {
    const taskKey = elements.completionTaskSelect.value.trim();
    const task = (state.data?.dailyTasks || []).find((item) => item.taskKey === taskKey);
    if (!task) return;

    elements.completionTargetInput.value = task.targetPageKeyword || '';
    if (task.link) {
        elements.completionLinkInput.value = task.link.startsWith('http')
            ? task.link
            : `${window.location.origin}${task.link}`;
    }
});

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
elements.completionForm.addEventListener('submit', submitCompletion);

loadReport();
window.setInterval(() => {
    loadReport();
}, 15000);
