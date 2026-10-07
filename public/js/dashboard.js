const DashboardRenderer = (() => {
  const formatNumber = (value) => Number(value || 0).toLocaleString();
  const formatCurrency = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Number(value || 0));

  function run(data) {
    const safeData = data || {};
    const filtered = FilterManager.getFilteredData(safeData);
    const summary = filtered.summary || {
      totalSessions: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      estimatedCost: 0,
      modelsUsed: 0,
      projects: 0
    };

    renderSummaryCards(summary);
    renderProjectMatrix(filtered.projects || []);
    renderModelMatrix(filtered.models || []);
    renderSessionTable(filtered.sessions || []);
    renderInsights(filtered.insights || []);
    ChartManager.render(filtered);
  }

  function renderSummaryCards(summary = {}) {
    const cards = [
      { label: 'Total Sessions', value: formatNumber(summary.totalSessions || 0) },
      { label: 'Total Tokens', value: `${formatNumber(summary.totalTokens || 0)}` },
      { label: 'Input Tokens', value: `${formatNumber(summary.inputTokens || 0)}` },
      { label: 'Output Tokens', value: `${formatNumber(summary.outputTokens || 0)}` },
      { label: 'Cache Read', value: `${formatNumber(summary.cacheReadTokens || 0)}` },
      { label: 'Cache Write', value: `${formatNumber(summary.cacheCreationTokens || 0)}` },
      { label: 'Estimated Cost', value: formatCurrency(summary.estimatedCost || 0) },
      { label: 'Models Used', value: `${summary.modelsUsed || 0}` },
      { label: 'Projects', value: `${summary.projects || 0}` }
    ];

    const container = document.getElementById('summary-cards');
    container.innerHTML = cards.map((card) => `
      <article class="summary-card">
        <div class="label">${card.label}</div>
        <div class="value">${card.value}</div>
      </article>
    `).join('');
  }

  function renderProjectMatrix(rows) {
    const tbody = document.getElementById('project-matrix-body');
    tbody.innerHTML = (rows || []).map((project) => `
      <tr>
        <td>${project.project || 'Unknown'}</td>
        <td>${project.sessions || 0}</td>
        <td>${formatNumber(project.inputTokens || 0)}</td>
        <td>${formatNumber(project.outputTokens || 0)}</td>
        <td>${formatNumber(project.cacheReadTokens || 0)}</td>
        <td>${formatNumber(project.cacheCreationTokens || 0)}</td>
        <td>${formatNumber(project.totalTokens || 0)}</td>
        <td>${formatCurrency(project.estimatedCost || 0)}</td>
      </tr>
    `).join('');
  }

  function renderModelMatrix(rows) {
    const tbody = document.getElementById('model-matrix-body');
    tbody.innerHTML = (rows || []).map((model) => `
      <tr>
        <td>${model.model || 'Unknown'}</td>
        <td>${model.sessions || 0}</td>
        <td>${formatNumber(model.inputTokens || 0)}</td>
        <td>${formatNumber(model.outputTokens || 0)}</td>
        <td>${formatNumber(model.cacheReadTokens || 0)}</td>
        <td>${formatNumber(model.cacheCreationTokens || 0)}</td>
        <td>${formatNumber(model.totalTokens || 0)}</td>
        <td>${formatCurrency(model.estimatedCost || 0)}</td>
      </tr>
    `).join('');
  }

  function renderSessionTable(sessions) {
    const tbody = document.getElementById('sessions-table-body');
    tbody.innerHTML = (sessions || []).map((session) => `
      <tr>
        <td>${session.sessionId || 'Unknown'}</td>
        <td>${session.project || 'Unknown'}</td>
        <td>${session.model || 'Unknown'}</td>
        <td>${session.startTime ? new Date(session.startTime).toLocaleString() : 'N/A'}</td>
        <td>${formatDuration(session.duration || 0)}</td>
        <td>${formatNumber(session.inputTokens || 0)}</td>
        <td>${formatNumber(session.outputTokens || 0)}</td>
        <td>${formatNumber(session.cacheReadTokens || 0)}</td>
        <td>${formatNumber(session.cacheCreationTokens || 0)}</td>
        <td>${formatNumber(session.totalTokens || 0)}</td>
        <td>${formatCurrency(session.estimatedCost || 0)}</td>
        <td>${session.toolCallCount || 0}</td>
      </tr>
    `).join('');
  }

  function renderInsights(insights) {
    const list = document.getElementById('insights-list');
    list.innerHTML = (insights || []).map((item) => `<li><strong>${item.title}:</strong> ${item.text}</li>`).join('');
  }

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '0m';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  return { run };
})();
