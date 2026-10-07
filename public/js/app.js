document.addEventListener('DOMContentLoaded', () => {
  const uploadBox = document.getElementById('upload-box');
  const uploadInput = document.getElementById('zip-input');
  const statusPanel = document.getElementById('status-panel');
  const errorBox = document.getElementById('error-box');
  const dashboard = document.getElementById('dashboard');

  let currentData = null;

  function mergeReports(existingReport, incomingReport) {
    const existingSessions = Array.isArray(existingReport?.sessions) ? existingReport.sessions : [];
    const incomingSessions = Array.isArray(incomingReport?.sessions) ? incomingReport.sessions : [];
    const allSessions = [...existingSessions, ...incomingSessions];
    const sessionMap = new Map();

    for (const session of allSessions) {
      const key = session.sessionId || `${session.project || 'unknown'}-${session.startTime || Math.random()}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, { ...session });
      }
    }

    const mergedSessions = Array.from(sessionMap.values());
    const projectMap = new Map();
    const modelMap = new Map();
    const dailyMap = new Map();
    const toolMap = new Map();

    for (const session of mergedSessions) {
      const project = session.project || 'unknown';
      const model = session.model || 'unknown';
      const day = session.startTime ? new Date(session.startTime).toISOString().slice(0, 10) : 'unknown';
      const userName = session.userName || 'unknown-user';

      if (!projectMap.has(project)) {
        projectMap.set(project, { project, sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, estimatedCost: 0, users: new Set() });
      }
      const projectEntry = projectMap.get(project);
      projectEntry.sessions += 1;
      projectEntry.inputTokens += Number(session.inputTokens || 0);
      projectEntry.outputTokens += Number(session.outputTokens || 0);
      projectEntry.cacheReadTokens += Number(session.cacheReadTokens || 0);
      projectEntry.cacheCreationTokens += Number(session.cacheCreationTokens || 0);
      projectEntry.totalTokens += Number(session.totalTokens || 0);
      projectEntry.estimatedCost += Number(session.estimatedCost || 0);
      projectEntry.users.add(userName);

      if (!modelMap.has(model)) {
        modelMap.set(model, { model, sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, estimatedCost: 0, users: new Set() });
      }
      const modelEntry = modelMap.get(model);
      modelEntry.sessions += 1;
      modelEntry.inputTokens += Number(session.inputTokens || 0);
      modelEntry.outputTokens += Number(session.outputTokens || 0);
      modelEntry.cacheReadTokens += Number(session.cacheReadTokens || 0);
      modelEntry.cacheCreationTokens += Number(session.cacheCreationTokens || 0);
      modelEntry.totalTokens += Number(session.totalTokens || 0);
      modelEntry.estimatedCost += Number(session.estimatedCost || 0);
      modelEntry.users.add(userName);

      if (!dailyMap.has(day)) {
        dailyMap.set(day, { date: day, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, sessions: 0, estimatedCost: 0 });
      }
      const dayEntry = dailyMap.get(day);
      dayEntry.inputTokens += Number(session.inputTokens || 0);
      dayEntry.outputTokens += Number(session.outputTokens || 0);
      dayEntry.cacheReadTokens += Number(session.cacheReadTokens || 0);
      dayEntry.cacheCreationTokens += Number(session.cacheCreationTokens || 0);
      dayEntry.totalTokens += Number(session.totalTokens || 0);
      dayEntry.sessions += 1;
      dayEntry.estimatedCost += Number(session.estimatedCost || 0);

      const toolNames = Array.isArray(session.tools) ? session.tools : [];
      for (const tool of toolNames) {
        const toolName = tool.tool || tool.name || 'Other';
        if (!toolMap.has(toolName)) {
          toolMap.set(toolName, { tool: toolName, calls: 0, sessions: new Set() });
        }
        const toolEntry = toolMap.get(toolName);
        toolEntry.calls += Number(tool.calls || 1);
        toolEntry.sessions.add(session.sessionId || session.project || 'unknown');
      }
    }

    const mergedProjects = Array.from(projectMap.values()).map((entry) => ({
      ...entry,
      users: Array.from(entry.users)
    }));
    const mergedModels = Array.from(modelMap.values()).map((entry) => ({
      ...entry,
      users: Array.from(entry.users)
    }));
    const mergedDailyUsage = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const mergedTools = Array.from(toolMap.values()).map((entry) => ({
      tool: entry.tool,
      calls: entry.calls,
      sessions: entry.sessions.size,
      percentage: mergedSessions.length ? Number(((entry.calls / Math.max(1, mergedSessions.length)) * 100).toFixed(2)) : 0
    }));

    const summary = {
      totalSessions: mergedSessions.length,
      totalTokens: mergedSessions.reduce((sum, session) => sum + Number(session.totalTokens || 0), 0),
      inputTokens: mergedSessions.reduce((sum, session) => sum + Number(session.inputTokens || 0), 0),
      outputTokens: mergedSessions.reduce((sum, session) => sum + Number(session.outputTokens || 0), 0),
      cacheCreationTokens: mergedSessions.reduce((sum, session) => sum + Number(session.cacheCreationTokens || 0), 0),
      cacheReadTokens: mergedSessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0),
      estimatedCost: mergedSessions.reduce((sum, session) => sum + Number(session.estimatedCost || 0), 0),
      modelsUsed: new Set(mergedSessions.map((session) => session.model || 'unknown')).size,
      projects: new Set(mergedSessions.map((session) => session.project || 'unknown')).size,
      cacheHitRate: mergedSessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0) + mergedSessions.reduce((sum, session) => sum + Number(session.cacheCreationTokens || 0), 0) > 0
        ? Number((mergedSessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0) / (mergedSessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0) + mergedSessions.reduce((sum, session) => sum + Number(session.cacheCreationTokens || 0), 0))) * 100)
        : 0
    };

    const allUserNames = [
      ...((existingReport?.users || []).map((item) => item.name || item)),
      ...((incomingReport?.users || []).map((item) => item.name || item)),
      ...mergedSessions.map((session) => session.userName || 'unknown-user')
    ];

    return {
      summary,
      projects: mergedProjects,
      models: mergedModels,
      sessions: mergedSessions,
      dailyUsage: mergedDailyUsage,
      tools: mergedTools,
      insights: [...(existingReport?.insights || []), ...(incomingReport?.insights || [])],
      users: Array.from(new Set(allUserNames)).map((userName) => ({
        name: userName,
        summary: {
          totalSessions: mergedSessions.filter((session) => (session.userName || 'unknown-user') === userName).length,
          totalTokens: mergedSessions.filter((session) => (session.userName || 'unknown-user') === userName).reduce((sum, session) => sum + Number(session.totalTokens || 0), 0),
          estimatedCost: mergedSessions.filter((session) => (session.userName || 'unknown-user') === userName).reduce((sum, session) => sum + Number(session.estimatedCost || 0), 0)
        }
      })),
      metadata: {
        ...(existingReport?.metadata || {}),
        ...(incomingReport?.metadata || {}),
        generatedAt: new Date().toISOString(),
        uploadedArchives: [
          ...((existingReport?.metadata?.uploadedArchives) || []),
          ...((incomingReport?.metadata?.source) ? [incomingReport.metadata.source] : [])
        ]
      }
    };
  }

  uploadInput.multiple = true;
  uploadInput.addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length) {
      await handleUpload(files);
    }
  });

  const dropZone = document.querySelector('.upload-box');
  ['dragover', 'dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (eventName === 'dragover') {
        dropZone.style.borderColor = 'rgba(79, 142, 247, 0.8)';
      }
      if (eventName === 'dragleave') {
        dropZone.style.borderColor = 'rgba(148, 163, 184, 0.45)';
      }
    });
  });

  dropZone.addEventListener('drop', async (event) => {
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length) {
      await handleUpload(files);
    }
  });

  function showStatus() {
    uploadBox.classList.add('hidden');
    statusPanel.classList.remove('hidden');
    errorBox.classList.add('hidden');
  }

  function hideStatus() {
    statusPanel.classList.add('hidden');
    uploadBox.classList.remove('hidden');
  }

  async function handleUpload(files) {
    showStatus();

    try {
      const selectedUser = document.getElementById('user-name')?.value || '';
      const data = await analyzeZipFiles(files, selectedUser);
      currentData = currentData ? mergeReports(currentData, data) : data;
      dashboard.classList.remove('hidden');
      bindFilters(currentData);
      DashboardRenderer.run(currentData);
      hideStatus();
    } catch (error) {
      hideStatus();
      errorBox.textContent = error.message || 'An unexpected error occurred.';
      errorBox.classList.remove('hidden');
    }
  }

  function bindFilters(data) {
    const options = FilterManager.getOptions(data);
    const userSelect = document.getElementById('user-filter');
    const projectSelect = document.getElementById('project-filter');
    const modelSelect = document.getElementById('model-filter');
    userSelect.innerHTML = options.users.map((user) => `<option value="${user}">${user === 'all' ? 'All Users' : user}</option>`).join('');
    projectSelect.innerHTML = options.projects.map((project) => `<option value="${project}">${project === 'all' ? 'All Projects' : project}</option>`).join('');
    modelSelect.innerHTML = options.models.map((model) => `<option value="${model}">${model === 'all' ? 'All Models' : model}</option>`).join('');

    userSelect.onchange = (event) => {
      FilterManager.setState({ user: event.target.value });
      DashboardRenderer.run(currentData);
    };

    projectSelect.onchange = (event) => {
      FilterManager.setState({ project: event.target.value });
      DashboardRenderer.run(currentData);
    };

    modelSelect.onchange = (event) => {
      FilterManager.setState({ model: event.target.value });
      DashboardRenderer.run(currentData);
    };

    const dateFilter = document.getElementById('date-filter');
    dateFilter.addEventListener('change', (event) => {
      FilterManager.setState({ date: event.target.value });
      document.getElementById('custom-range').classList.toggle('hidden', event.target.value !== 'custom');
      DashboardRenderer.run(currentData);
    });

    const customFrom = document.getElementById('date-from');
    const customTo = document.getElementById('date-to');
    customFrom.addEventListener('change', (event) => {
      FilterManager.state.customRange.from = event.target.value;
      DashboardRenderer.run(currentData);
    });
    customTo.addEventListener('change', (event) => {
      FilterManager.state.customRange.to = event.target.value;
      DashboardRenderer.run(currentData);
    });

    const searchInput = document.getElementById('session-search');
    searchInput.addEventListener('input', (event) => {
      FilterManager.setState({ search: event.target.value });
      DashboardRenderer.run(currentData);
    });

    document.getElementById('export-csv').addEventListener('click', () => exportCsv(currentData));
    document.getElementById('export-json').addEventListener('click', () => exportJson(currentData));
    document.getElementById('print-report').addEventListener('click', () => window.print());
  }

  function exportCsv(data) {
    if (!data) return;

    const rows = [
      ['Session', 'Project', 'Model', 'Start', 'Duration', 'Input', 'Output', 'Cache Read', 'Cache Write', 'Total', 'Cost'],
      ...(data.sessions || []).map((s) => [
        s.sessionId || '',
        s.project || '',
        s.model || '',
        s.startTime || '',
        s.duration || '',
        s.inputTokens || 0,
        s.outputTokens || 0,
        s.cacheReadTokens || 0,
        s.cacheCreationTokens || 0,
        s.totalTokens || 0,
        s.estimatedCost || 0
      ])
    ];

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 'claude-session-report.csv');
  }

  function exportJson(data) {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8;' }), 'claude-analysis.json');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
});
