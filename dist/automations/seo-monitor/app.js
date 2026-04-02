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
    automationStatusPill: document.getElementById('automationStatusPill'),
    automationStep: document.getElementById('automationStep'),
    automationUpdatedAt: document.getElementById('automationUpdatedAt'),
    automationNextRun: document.getElementById('automationNextRun'),
    automationLastSuccess: document.getElementById('automationLastSuccess'),
    automationProgressLabel: document.getElementById('automationProgressLabel'),
    automationProgressBar: document.getElementById('automationProgressBar'),
    taskProgressLabel: document.getElementById('taskProgressLabel'),
    taskProgressBar: document.getElementById('taskProgressBar'),
    automationMessage: document.getElementById('automationMessage'),
    heartbeatHint: document.getElementById('heartbeatHint'),
    automationLogExcerpt: document.getElementById('automationLogExcerpt'),
    automationEventsTable: document.getElementById('automationEventsTable'),
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

function getRelativeTime(value) {
    if (!value) return '';
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(diffMs)) return '';
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes <= 0) return 'just now';
    if (diffMinutes === 1) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
}

function clampPercent(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}

function estimateAutomationProgress(status, step) {
    const label = String(status || 'Scheduled').toLowerCase();
    const stepText = String(step || '').toLowerCase();

    if (label === 'done') {
        return { percent: 100, label: 'Completed' };
    }

    if (label === 'failed' || label === 'blocked') {
        return { percent: 100, label: 'Stopped before completion' };
    }

    if (label === 'scheduled') {
        return { percent: 0, label: 'Waiting for run window' };
    }

    if (label !== 'running') {
        return { percent: 12, label: 'Preparing automation' };
    }

    const stages = [
        { match: /(launch|spawn|starting)/, percent: 8, label: 'Launching runner' },
        { match: /(preflight|sync|fetch|origin)/, percent: 18, label: 'Preflight and sync' },
        { match: /(rank|scan|audit|check|snapshot)/, percent: 34, label: 'Gathering SEO signals' },
        { match: /(improve|edit|refresh|create|publish|internal link|schema|faq|conversion|competitor)/, percent: 58, label: 'Implementing SEO work' },
        { match: /(build|generate)/, percent: 76, label: 'Building site output' },
        { match: /(commit|push|github)/, percent: 84, label: 'Pushing code' },
        { match: /(deploy|netlify)/, percent: 91, label: 'Deploying production' },
        { match: /(verify|live|url)/, percent: 96, label: 'Verifying live URLs' },
        { match: /(email|telegram|report|handoff)/, percent: 98, label: 'Sending turnover' }
    ];

    return stages.find((item) => item.match.test(stepText)) || { percent: 42, label: 'Automation running' };
}

function summarizeTaskProgress(tasks) {
    const total = tasks.length;
    const done = tasks.filter((item) => String(item.status || '').toLowerCase() === 'done').length;
    const blocked = tasks.filter((item) => String(item.status || '').toLowerCase() === 'blocked').length;
    return {
        total,
        done,
        blocked,
        percent: total ? clampPercent((done / total) * 100) : 0
    };
}

function renderSummary(data) {
    elements.trackedKeywords.textContent = data.meta?.keywordsTracked ?? '--';
    elements.latestSnapshot.textContent = data.meta?.latestSnapshotDate || 'No snapshot yet';
    elements.openTasks.textContent = data.meta?.openTaskCount ?? '--';
    elements.generatedAt.textContent = formatDateTime(data.generatedAt);
    elements.automationState.textContent = data.meta?.automationState || '--';

    elements.sourceCollections.innerHTML = (data.meta?.sourceCollections || [])
        .map((item) => `<span class="chip">${escapeHtml(item)}</span>`)
        .join('');

    renderTodayRun(data.todayRun || null);
    renderAutomationStatus(data.automationStatus || null, data.automationEvents || [], data.dailyTasks || []);
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

function renderAutomationStatus(status, events, tasks) {
    const safeStatus = status || {};
    const label = safeStatus.status || 'Scheduled';
    const progress = estimateAutomationProgress(label, safeStatus.currentStep);
    const taskProgress = summarizeTaskProgress(tasks || []);
    const updatedAt = safeStatus.updatedAtIso || safeStatus.updatedAt;
    const relative = getRelativeTime(updatedAt);

    elements.automationStatusPill.className = `status-pill ${getStatusClass(label)}`;
    elements.automationStatusPill.textContent = label;
    elements.automationStep.textContent = safeStatus.currentStep || 'Waiting for a live automation status update.';
    elements.automationUpdatedAt.textContent = formatDateTime(updatedAt);
    elements.automationNextRun.textContent = formatDateTime(safeStatus.nextRunAt);
    elements.automationLastSuccess.textContent = formatDateTime(safeStatus.lastSuccessAt);
    elements.automationMessage.textContent = safeStatus.message || 'The local launcher will post its progress here while the SEO batch runs.';
    elements.automationLogExcerpt.textContent = safeStatus.liveLogExcerpt || safeStatus.lastMessageExcerpt || (label === 'Scheduled'
        ? 'No live output yet because the runner is waiting for the next scheduled attempt.'
        : 'Waiting for automation output...');
    elements.automationProgressLabel.textContent = `${progress.label} · ${progress.percent}%`;
    elements.automationProgressBar.style.width = `${progress.percent}%`;
    elements.automationProgressBar.className = `progress-fill ${getStatusClass(label)} ${label.toLowerCase() === 'running' ? 'is-running' : ''}`;
    elements.taskProgressLabel.textContent = `${taskProgress.done} of ${taskProgress.total} done${taskProgress.blocked ? ` · ${taskProgress.blocked} blocked` : ''}`;
    elements.taskProgressBar.style.width = `${taskProgress.percent}%`;

    if (label.toLowerCase() === 'running') {
        elements.heartbeatHint.textContent = relative
            ? `Heartbeat live. Last movement ${relative}.`
            : 'Heartbeat live now.';
    } else if (label.toLowerCase() === 'scheduled') {
        elements.heartbeatHint.textContent = safeStatus.nextRunAt
            ? `Not running right now. Next attempt is scheduled for ${formatDateTime(safeStatus.nextRunAt)}.`
            : 'Not running right now. Waiting for the next scheduled attempt.';
    } else if (label.toLowerCase() === 'done') {
        elements.heartbeatHint.textContent = safeStatus.lastSuccessAt
            ? `Last successful run finished ${getRelativeTime(safeStatus.lastSuccessAt)}.`
            : 'Daily automation completed.';
    } else {
        elements.heartbeatHint.textContent = relative
            ? `Last automation update was ${relative}.`
            : 'Waiting for the next automation update.';
    }

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
        renderLogs(data);
        renderTasks(data);
        renderCompletionOptions(data);
        elements.statusText.textContent = `Report updated ${formatDateTime(data.generatedAt)}.`;
    } catch (error) {
        console.error(error);
        elements.statusText.textContent = `Unable to load report: ${error.message}`;
        elements.rankingsTable.querySelector('tbody').innerHTML = '<tr><td colspan="99" class="empty-row">Unable to load ranking report.</td></tr>';
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
