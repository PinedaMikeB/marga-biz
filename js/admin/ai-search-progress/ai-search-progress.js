/**
 * Marga AI Search Progress Dashboard
 * Checklist + keyword analytics; state in localStorage.
 */
(function () {
    const STORAGE_KEY = 'marga-ai-search-progress-v1';
    const PLAN_URL = 'data/plan.json';

    let plan = null;
    let state = loadState();

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {
            console.warn('Could not load saved state', e);
        }
        return { done: {}, keywordNotes: {}, keywordManualPosition: {}, customLinks: {} };
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function taskDone(task) {
        if (state.done[task.id] !== undefined) return Boolean(state.done[task.id]);
        return Boolean(task.done);
    }

    function setTaskDone(id, value) {
        state.done[id] = value;
        saveState();
        renderProgress();
        renderTasks();
    }

    async function loadPlan() {
        const res = await fetch(PLAN_URL);
        if (!res.ok) throw new Error(`Failed to load plan (${res.status})`);
        plan = await res.json();
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function absUrl(path) {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        if (path.startsWith('/')) return `https://marga.biz${path}`;
        return path;
    }

    function renderGuardrails() {
        const el = document.getElementById('guardrails');
        if (!el || !plan.guardrails) return;
        el.innerHTML = plan.guardrails
            .map((g) => `<span class="guardrail-pill">${escapeHtml(g)}</span>`)
            .join('');
    }

    function renderProgress() {
        const tasks = plan.tasks || [];
        const doneCount = tasks.filter((t) => taskDone(t)).length;
        const total = tasks.length;
        const pct = total ? Math.round((doneCount / total) * 100) : 0;

        document.getElementById('progressPercent').textContent = `${pct}%`;
        document.getElementById('progressFill').style.width = `${pct}%`;
        document.getElementById('progressCounts').textContent = `${doneCount} of ${total} tasks done`;
        const wrap = document.getElementById('progressBarWrap');
        if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
    }

    function populatePhaseFilter() {
        const select = document.getElementById('phaseFilter');
        if (!select) return;
        const phases = [...new Set((plan.tasks || []).map((t) => t.phase))];
        phases.forEach((p) => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.textContent = p;
            select.appendChild(opt);
        });
    }

    function renderTasks() {
        const tbody = document.getElementById('tasksBody');
        if (!tbody) return;

        const phaseFilter = document.getElementById('phaseFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        const filtered = (plan.tasks || []).filter((task) => {
            if (phaseFilter && task.phase !== phaseFilter) return false;
            const done = taskDone(task);
            if (statusFilter === 'open' && done) return false;
            if (statusFilter === 'done' && !done) return false;
            return true;
        });

        tbody.innerHTML = filtered
            .map((task) => {
                const done = taskDone(task);
                const phaseClass = task.phase === 'Guardrail' ? 'guardrail' : '';
                return `
          <tr class="${done ? 'done-row' : ''}" data-task-id="${escapeHtml(task.id)}">
            <td>
              <input type="checkbox" class="task-check" data-id="${escapeHtml(task.id)}" ${done ? 'checked' : ''} aria-label="Mark done">
            </td>
            <td><span class="task-title">${escapeHtml(task.title)}</span></td>
            <td><span class="phase-badge ${phaseClass}">${escapeHtml(task.phase)}</span></td>
            <td>
              <div class="action-btns">
                <button type="button" class="btn btn-primary btn-implement" data-id="${escapeHtml(task.id)}">Implement</button>
                <button type="button" class="btn btn-details" data-id="${escapeHtml(task.id)}">Details</button>
              </div>
            </td>
          </tr>`;
            })
            .join('');

        tbody.querySelectorAll('.task-check').forEach((cb) => {
            cb.addEventListener('change', () => setTaskDone(cb.dataset.id, cb.checked));
        });
        tbody.querySelectorAll('.btn-implement').forEach((btn) => {
            btn.addEventListener('click', () => openImplement(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-details').forEach((btn) => {
            btn.addEventListener('click', () => openDetails(btn.dataset.id));
        });
    }

    function getTask(id) {
        return (plan.tasks || []).find((t) => t.id === id);
    }

    function openModal(backdropId) {
        const el = document.getElementById(backdropId);
        el.classList.add('open');
        el.setAttribute('aria-hidden', 'false');
    }

    function closeModals() {
        document.querySelectorAll('.modal-backdrop').forEach((el) => {
            el.classList.remove('open');
            el.setAttribute('aria-hidden', 'true');
        });
    }

    function openImplement(id) {
        const task = getTask(id);
        if (!task) return;
        const impl = task.implement || {};
        document.getElementById('implementTitle').textContent = task.title;

        const steps = (impl.steps || [])
            .map((s) => `<li>${escapeHtml(s)}</li>`)
            .join('');
        const paths = (impl.paths || [])
            .map((p) => `<code>${escapeHtml(p)}</code>`)
            .join('');

        document.getElementById('implementBody').innerHTML = `
      <p>${escapeHtml(impl.summary || '')}</p>
      ${steps ? `<h3>Steps</h3><ol>${steps}</ol>` : ''}
      ${paths ? `<h3>Repo paths</h3><div class="path-list">${paths}</div>` : ''}
    `;
        openModal('implementModal');
    }

    function openDetails(id) {
        const task = getTask(id);
        if (!task) return;
        document.getElementById('detailsTitle').textContent = task.title;

        const details = task.details || {};
        const links = [...(details.links || []), ...(state.customLinks[id] || [])];
        const linksHtml = links.length
            ? `<ul class="detail-links">${links
                  .map((link) => {
                      const url = link.url || '';
                      const label = escapeHtml(link.label || 'Link');
                      if (!url) {
                          return `<li><span class="muted">${label} — add URL in custom link below</span></li>`;
                      }
                      const href = absUrl(url);
                      const isExternal = href.startsWith('http');
                      return `<li><a href="${escapeHtml(href)}" ${isExternal ? 'target="_blank" rel="noopener"' : ''}>${label}</a></li>`;
                  })
                  .join('')}</ul>`
            : '<p class="muted">No links yet.</p>';

        document.getElementById('detailsBody').innerHTML = `
      ${linksHtml}
      <h3>Add custom link (YouTube, Remotion export, blog draft)</h3>
      <div class="custom-link-row">
        <input type="text" id="customLinkLabel" placeholder="Label e.g. YouTube ep 1">
      </div>
      <div class="custom-link-row">
        <input type="url" id="customLinkUrl" placeholder="https://...">
      </div>
      <button type="button" class="btn btn-primary" id="saveCustomLinkBtn" data-task-id="${escapeHtml(id)}">Save link</button>
    `;

        document.getElementById('saveCustomLinkBtn')?.addEventListener('click', () => {
            const label = document.getElementById('customLinkLabel').value.trim();
            const url = document.getElementById('customLinkUrl').value.trim();
            if (!label) return;
            if (!state.customLinks[id]) state.customLinks[id] = [];
            state.customLinks[id].push({ label, url });
            saveState();
            openDetails(id);
        });

        openModal('detailsModal');
    }

    function rankClass(position) {
        if (position == null || position === '' || Number.isNaN(position)) return 'rank-weak';
        const p = Number(position);
        if (p <= 3) return 'rank-good';
        if (p <= 10) return 'rank-mid';
        return 'rank-weak';
    }

    function defaultImproveNote(kw) {
        if (kw.monitorOnly) {
            return 'Monitor only — copier is #1; do not edit page. Track AI mentions separately.';
        }
        const notes = {
            printer: 'AI fan-out: add supporting blog, third-party listicle, YouTube mention. Keep ai-answer block factual.',
            maintenance: 'B2B owned-machine only. Link from rental-offboard angle; avoid cannibalizing printer rental.',
            copier: 'Monitor only.'
        };
        return notes[kw.cluster] || 'Audit ChatGPT/Perplexity citation; update notes after weekly prompt test.';
    }

    async function fetchSearchKeywords(dateRange) {
        const res = await fetch(`/.netlify/functions/insights-search?dateRange=${dateRange}`);
        if (!res.ok) throw new Error(`Search API ${res.status}`);
        return res.json();
    }

    function mergeKeywordData(apiKeywords) {
        const seed = plan.keywords || [];
        const byKey = new Map();

        seed.forEach((kw) => {
            byKey.set(kw.keyword.toLowerCase(), { ...kw, position: null, clicks: null, impressions: null });
        });

        (apiKeywords || []).forEach((row) => {
            const key = (row.keyword || row.query || '').toLowerCase();
            if (!key) return;
            const existing = byKey.get(key) || {
                keyword: row.keyword || row.query,
                cluster: 'printer',
                targetUrl: '',
                monitorOnly: false
            };
            byKey.set(key, {
                ...existing,
                keyword: existing.keyword || row.keyword || row.query,
                position: row.position ?? row.avgPosition ?? null,
                clicks: row.clicks ?? null,
                impressions: row.impressions ?? null
            });
        });

        return [...byKey.values()].sort((a, b) => {
            const pa = a.position != null ? Number(a.position) : 999;
            const pb = b.position != null ? Number(b.position) : 999;
            return pa - pb;
        });
    }

    function renderKeywords(rows, statusMessage) {
        const tbody = document.getElementById('keywordsBody');
        const statusEl = document.getElementById('analyticsStatus');
        if (statusEl) statusEl.textContent = statusMessage;

        const clusterFilter = document.getElementById('clusterFilter')?.value || '';
        const filtered = rows.filter((kw) => !clusterFilter || kw.cluster === clusterFilter);

        tbody.innerHTML = filtered
            .map((kw) => {
                const key = kw.keyword;
                const manualPos = state.keywordManualPosition[key];
                const apiPos = kw.position != null ? Number(kw.position).toFixed(1) : null;
                const displayPos = manualPos !== undefined && manualPos !== '' ? manualPos : apiPos;
                const posNum = displayPos != null && displayPos !== '' ? Number(displayPos) : null;
                const note =
                    state.keywordNotes[key] !== undefined
                        ? state.keywordNotes[key]
                        : defaultImproveNote(kw);
                const targetHref = absUrl(kw.targetUrl);
                const clusterClass = kw.cluster === 'copier' ? 'copier' : '';

                return `
          <tr data-keyword="${escapeHtml(key)}">
            <td>${escapeHtml(key)}${kw.monitorOnly ? ' <span class="guardrail-pill" style="font-size:0.65rem;">monitor</span>' : ''}</td>
            <td class="rank-cell ${rankClass(posNum)}">
              <input type="text" class="manual-pos-input" data-keyword="${escapeHtml(key)}" value="${displayPos != null ? escapeHtml(String(displayPos)) : ''}" placeholder="—" style="width:52px;padding:4px;border:1px solid var(--line);border-radius:4px;" title="Override if API empty">
            </td>
            <td>${kw.clicks != null ? kw.clicks : '—'}</td>
            <td>${kw.impressions != null ? kw.impressions.toLocaleString() : '—'}</td>
            <td><span class="cluster-tag ${clusterClass}">${escapeHtml(kw.cluster || '')}</span></td>
            <td>${targetHref ? `<a href="${escapeHtml(targetHref)}" target="_blank" rel="noopener">View</a>` : '—'}</td>
            <td>
              <textarea class="notes-input" data-keyword="${escapeHtml(key)}" rows="2">${escapeHtml(note)}</textarea>
            </td>
          </tr>`;
            })
            .join('');

        tbody.querySelectorAll('.notes-input').forEach((ta) => {
            ta.addEventListener('change', () => {
                state.keywordNotes[ta.dataset.keyword] = ta.value;
                saveState();
            });
            ta.addEventListener('blur', () => {
                state.keywordNotes[ta.dataset.keyword] = ta.value;
                saveState();
            });
        });

        tbody.querySelectorAll('.manual-pos-input').forEach((input) => {
            input.addEventListener('change', () => {
                state.keywordManualPosition[input.dataset.keyword] = input.value;
                saveState();
            });
        });
    }

    async function loadKeywords() {
        const dateRange = document.getElementById('keywordDateRange')?.value || '30d';
        try {
            const data = await fetchSearchKeywords(dateRange);
            const rows = mergeKeywordData(data.topKeywords || data.keywords || []);
            renderKeywords(
                rows,
                `Rankings from Search Console (${dateRange}). Last sync: ${data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'just now'}.`
            );
        } catch (err) {
            console.warn(err);
            const rows = mergeKeywordData([]);
            renderKeywords(
                rows,
                'Could not load live rankings (open on marga.biz or set GOOGLE_SERVICE_ACCOUNT_KEY). Using seed keywords — enter positions manually.'
            );
        }
    }

    function switchView(view) {
        document.getElementById('viewProgress').classList.toggle('active', view === 'progress');
        document.getElementById('viewAnalytics').classList.toggle('active', view === 'analytics');
        document.querySelectorAll('.menu-dropdown [data-view]').forEach((el) => {
            el.classList.toggle('active', el.dataset.view === view);
        });
        if (view === 'analytics') loadKeywords();
    }

    function setupMenu() {
        const btn = document.getElementById('menuBtn');
        const dropdown = document.getElementById('menuDropdown');

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = dropdown.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        document.addEventListener('click', () => {
            dropdown.classList.remove('open');
            btn.setAttribute('aria-expanded', 'false');
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());

        dropdown.querySelectorAll('[data-view]').forEach((item) => {
            item.addEventListener('click', () => {
                switchView(item.dataset.view);
                dropdown.classList.remove('open');
            });
        });
    }

    function setupFilters() {
        document.getElementById('phaseFilter')?.addEventListener('change', renderTasks);
        document.getElementById('statusFilter')?.addEventListener('change', renderTasks);
        document.getElementById('clusterFilter')?.addEventListener('change', () => loadKeywords());
        document.getElementById('keywordDateRange')?.addEventListener('change', () => loadKeywords());
        document.getElementById('refreshKeywordsBtn')?.addEventListener('click', () => loadKeywords());
    }

    function setupModals() {
        document.querySelectorAll('[data-close-modal]').forEach((btn) => {
            btn.addEventListener('click', closeModals);
        });
        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
            backdrop.addEventListener('click', (e) => {
                if (e.target === backdrop) closeModals();
            });
        });
    }

    function setupExportReset() {
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            const blob = new Blob(
                [
                    JSON.stringify(
                        {
                            exportedAt: new Date().toISOString(),
                            planVersion: plan.version,
                            state,
                            tasks: (plan.tasks || []).map((t) => ({
                                id: t.id,
                                title: t.title,
                                done: taskDone(t)
                            }))
                        },
                        null,
                        2
                    )
                ],
                { type: 'application/json' }
            );
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `marga-ai-search-progress-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
        });

        document.getElementById('resetBtn')?.addEventListener('click', () => {
            if (!confirm('Clear all checkmarks? Notes and custom links stay saved.')) return;
            state.done = {};
            saveState();
            renderProgress();
            renderTasks();
        });
    }

    async function init() {
        try {
            await loadPlan();
        } catch (e) {
            document.getElementById('tasksBody').innerHTML =
                `<tr><td colspan="4">Failed to load plan: ${escapeHtml(e.message)}</td></tr>`;
            return;
        }

        (plan.tasks || []).forEach((t) => {
            if (t.done && state.done[t.id] === undefined) state.done[t.id] = true;
        });
        saveState();

        renderGuardrails();
        populatePhaseFilter();
        renderProgress();
        renderTasks();
        setupMenu();
        setupFilters();
        setupModals();
        setupExportReset();
    }

    init();
})();
