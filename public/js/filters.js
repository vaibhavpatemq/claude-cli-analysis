const FilterManager = (() => {
  const state = {
    date: 'all',
    user: 'all',
    project: 'all',
    model: 'all',
    search: '',
    customRange: { from: '', to: '' }
  };

  function getOptions(data) {
    const projects = ['all', ...new Set((data.projects || []).map((item) => item.project || item.name || item))];
    const models = ['all', ...new Set((data.models || []).map((item) => item.model || item.name || item))];
    const users = ['all', ...new Set((data.sessions || []).map((item) => item.userName || 'unknown-user'))];
    return { projects, models, users };
  }

  function getFilteredData(data) {
    if (!data || !data.sessions) {
      return { ...data, sessions: [] };
    }

    let sessions = [...data.sessions];
    const projectFilter = state.project;
    const modelFilter = state.model;
    const userFilter = state.user;
    const searchTerm = (state.search || '').toLowerCase();

    if (userFilter !== 'all') {
      sessions = sessions.filter((session) => (session.userName || 'unknown-user') === userFilter);
    }

    if (projectFilter !== 'all') {
      sessions = sessions.filter((session) => session.project === projectFilter);
    }

    if (modelFilter !== 'all') {
      sessions = sessions.filter((session) => session.model === modelFilter);
    }

    if (state.date !== 'all') {
      const today = new Date();
      const before = new Date(today);
      before.setDate(today.getDate() - 30);

      sessions = sessions.filter((session) => {
        if (!session.startTime) return true;
        const date = new Date(session.startTime);

        if (state.date === 'today') {
          return date.toDateString() === today.toDateString();
        }

        if (state.date === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          return date.toDateString() === yesterday.toDateString();
        }

        if (state.date === '7') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          return date >= sevenDaysAgo;
        }

        if (state.date === '30') {
          return date >= before;
        }

        if (state.date === 'custom') {
          const from = state.customRange.from ? new Date(state.customRange.from) : null;
          const to = state.customRange.to ? new Date(state.customRange.to) : null;
          if (from && to) {
            return date >= from && date <= to;
          }
          return true;
        }

        return true;
      });
    }

    if (searchTerm) {
      sessions = sessions.filter((session) => {
        const haystack = `${session.sessionId || ''} ${session.project || ''} ${session.model || ''} ${session.userName || ''} ${session.sourceFiles?.join(' ') || ''}`.toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    const summary = {
      totalSessions: sessions.length,
      totalTokens: sessions.reduce((sum, session) => sum + Number(session.totalTokens || 0), 0),
      inputTokens: sessions.reduce((sum, session) => sum + Number(session.inputTokens || 0), 0),
      outputTokens: sessions.reduce((sum, session) => sum + Number(session.outputTokens || 0), 0),
      cacheCreationTokens: sessions.reduce((sum, session) => sum + Number(session.cacheCreationTokens || 0), 0),
      cacheReadTokens: sessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0),
      estimatedCost: sessions.reduce((sum, session) => sum + Number(session.estimatedCost || 0), 0),
      modelsUsed: new Set(sessions.map((session) => session.model || 'unknown')).size,
      projects: new Set(sessions.map((session) => session.project || 'unknown')).size
    };

    const projectTotals = new Map();
    const modelTotals = new Map();

    for (const session of sessions) {
      const projectName = session.project || 'unknown';
      const modelName = session.model || 'unknown';

      if (!projectTotals.has(projectName)) {
        projectTotals.set(projectName, { project: projectName, sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, estimatedCost: 0 });
      }

      const projectEntry = projectTotals.get(projectName);
      projectEntry.sessions += 1;
      projectEntry.inputTokens += Number(session.inputTokens || 0);
      projectEntry.outputTokens += Number(session.outputTokens || 0);
      projectEntry.cacheReadTokens += Number(session.cacheReadTokens || 0);
      projectEntry.cacheCreationTokens += Number(session.cacheCreationTokens || 0);
      projectEntry.totalTokens += Number(session.totalTokens || 0);
      projectEntry.estimatedCost += Number(session.estimatedCost || 0);

      if (!modelTotals.has(modelName)) {
        modelTotals.set(modelName, { model: modelName, sessions: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, totalTokens: 0, estimatedCost: 0 });
      }

      const modelEntry = modelTotals.get(modelName);
      modelEntry.sessions += 1;
      modelEntry.inputTokens += Number(session.inputTokens || 0);
      modelEntry.outputTokens += Number(session.outputTokens || 0);
      modelEntry.cacheReadTokens += Number(session.cacheReadTokens || 0);
      modelEntry.cacheCreationTokens += Number(session.cacheCreationTokens || 0);
      modelEntry.totalTokens += Number(session.totalTokens || 0);
      modelEntry.estimatedCost += Number(session.estimatedCost || 0);
    }

    return {
      ...data,
      summary,
      sessions,
      projects: Array.from(projectTotals.values()),
      models: Array.from(modelTotals.values()),
      filteredBy: { ...state },
      userNames: Array.from(new Set((data.sessions || []).map((session) => session.userName || 'unknown-user')))
    };
  }

  function setState(nextState) {
    Object.assign(state, nextState);
  }

  function reset() {
    state.date = 'all';
    state.user = 'all';
    state.project = 'all';
    state.model = 'all';
    state.search = '';
    state.customRange = { from: '', to: '' };
  }

  return { state, getOptions, getFilteredData, setState, reset };
})();
