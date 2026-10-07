const { estimateCostForSession } = require('./cost-calculator.service');

function roundNumber(value, digits = 2) {
  return Number(value || 0).toFixed(digits);
}

function createEmptySummary() {
  return {
    totalSessions: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    estimatedCost: 0,
    modelsUsed: 0,
    projects: 0,
    cacheHitRate: 0,
    cacheWriteTokens: 0
  };
}

function asDateString(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function aggregateUsageRecords(records = []) {
  const sessionMap = new Map();
  const projectMap = new Map();
  const modelMap = new Map();
  const dailyMap = new Map();
  const toolMap = new Map();

  for (const record of records) {
    if (!record || typeof record !== 'object') {
      continue;
    }

    const sessionId = record.sessionId || 'unknown-session';
    const project = record.project || 'unknown';
    const model = record.model || 'unknown';
    const dateKey = asDateString(record.timestamp);
    const userName = record.userName || 'unknown-user';

    if (!sessionMap.has(sessionId)) {
      sessionMap.set(sessionId, {
        sessionId,
        project,
        model,
        userName,
        startTime: record.timestamp || null,
        endTime: record.timestamp || null,
        duration: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        messageCount: 0,
        toolCallCount: 0,
        sourceFiles: new Set()
      });
    }

    const session = sessionMap.get(sessionId);
    session.project = session.project || project;
    session.model = session.model || model;
    session.userName = session.userName || userName;
    session.startTime = session.startTime && record.timestamp && new Date(session.startTime) <= new Date(record.timestamp)
      ? session.startTime
      : record.timestamp || session.startTime;
    session.endTime = session.endTime && record.timestamp && new Date(session.endTime) >= new Date(record.timestamp)
      ? session.endTime
      : record.timestamp || session.endTime;
    session.inputTokens += Number(record.inputTokens || 0);
    session.outputTokens += Number(record.outputTokens || 0);
    session.cacheCreationTokens += Number(record.cacheCreationTokens || 0);
    session.cacheReadTokens += Number(record.cacheReadTokens || 0);
    session.totalTokens += Number(record.totalTokens || 0);
    session.messageCount += Number(record.messageCount || 0);
    session.toolCallCount += Number(record.toolCallCount || 0);
    if (record.sourceFile) {
      session.sourceFiles.add(record.sourceFile);
    }

    if (!projectMap.has(project)) {
      projectMap.set(project, {
        project,
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      });
    }

    const projectEntry = projectMap.get(project);
    projectEntry.sessions += 1;
    projectEntry.inputTokens += Number(record.inputTokens || 0);
    projectEntry.outputTokens += Number(record.outputTokens || 0);
    projectEntry.cacheReadTokens += Number(record.cacheReadTokens || 0);
    projectEntry.cacheCreationTokens += Number(record.cacheCreationTokens || 0);
    projectEntry.totalTokens += Number(record.totalTokens || 0);

    if (!modelMap.has(model)) {
      modelMap.set(model, {
        model,
        sessions: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      });
    }

    const modelEntry = modelMap.get(model);
    modelEntry.sessions += 1;
    modelEntry.inputTokens += Number(record.inputTokens || 0);
    modelEntry.outputTokens += Number(record.outputTokens || 0);
    modelEntry.cacheReadTokens += Number(record.cacheReadTokens || 0);
    modelEntry.cacheCreationTokens += Number(record.cacheCreationTokens || 0);
    modelEntry.totalTokens += Number(record.totalTokens || 0);

    if (!dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, {
        date: dateKey,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
        totalTokens: 0,
        sessions: 0,
        estimatedCost: 0
      });
    }

    const daily = dailyMap.get(dateKey);
    daily.inputTokens += Number(record.inputTokens || 0);
    daily.outputTokens += Number(record.outputTokens || 0);
    daily.cacheReadTokens += Number(record.cacheReadTokens || 0);
    daily.cacheCreationTokens += Number(record.cacheCreationTokens || 0);
    daily.totalTokens += Number(record.totalTokens || 0);
    daily.sessions += 1;

    if (record.toolName) {
      if (!toolMap.has(record.toolName)) {
        toolMap.set(record.toolName, {
          tool: record.toolName,
          calls: 0,
          sessions: new Set(),
          percentage: 0
        });
      }

      const toolEntry = toolMap.get(record.toolName);
      toolEntry.calls += 1;
      toolEntry.sessions.add(sessionId);
    }
  }

  const sessions = Array.from(sessionMap.values()).map((session) => {
    session.duration = session.startTime && session.endTime
      ? Math.max(0, new Date(session.endTime) - new Date(session.startTime))
      : 0;
    session.estimatedCost = estimateCostForSession(session);
    session.sourceFiles = Array.from(session.sourceFiles || []);
    return session;
  }).sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0));

  const projects = Array.from(projectMap.values()).map((project) => ({
    ...project,
    estimatedCost: estimateCostForSession(project)
  }));

  const models = Array.from(modelMap.values()).map((model) => ({
    ...model,
    estimatedCost: estimateCostForSession(model)
  }));

  const dailyUsage = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totalTokens = sessions.reduce((sum, session) => sum + Number(session.totalTokens || 0), 0);
  const totalCost = sessions.reduce((sum, session) => sum + Number(session.estimatedCost || 0), 0);
  const totalCacheRead = sessions.reduce((sum, session) => sum + Number(session.cacheReadTokens || 0), 0);
  const totalCacheWrite = sessions.reduce((sum, session) => sum + Number(session.cacheCreationTokens || 0), 0);

  const toolList = Array.from(toolMap.values()).map((tool) => ({
    tool: tool.tool,
    calls: tool.calls,
    sessions: tool.sessions.size,
    percentage: totalTokens > 0 ? Number(((tool.calls / Math.max(1, records.length)) * 100).toFixed(2)) : 0
  })).sort((a, b) => b.calls - a.calls);

  const summary = {
    totalSessions: sessions.length,
    totalTokens,
    inputTokens: sessions.reduce((sum, session) => sum + Number(session.inputTokens || 0), 0),
    outputTokens: sessions.reduce((sum, session) => sum + Number(session.outputTokens || 0), 0),
    cacheCreationTokens: totalCacheWrite,
    cacheReadTokens: totalCacheRead,
    totalCacheTokens: totalCacheRead + totalCacheWrite,
    estimatedCost: totalCost,
    modelsUsed: new Set(sessions.map((session) => session.model)).size,
    projects: new Set(sessions.map((session) => session.project)).size,
    cacheHitRate: totalCacheRead + totalCacheWrite > 0 ? Number(((totalCacheRead / (totalCacheRead + totalCacheWrite)) * 100).toFixed(2)) : 0
  };

  return {
    summary,
    projects,
    models,
    sessions,
    dailyUsage,
    tools: toolList,
    rawRecords: records
  };
}

module.exports = {
  aggregateUsageRecords,
  roundNumber,
  createEmptySummary
};
