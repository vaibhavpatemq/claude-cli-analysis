const { aggregateUsageRecords } = require('./token-analyzer.service');
const { formatCurrency, PRICING_METADATA } = require('./cost-calculator.service');

function buildInsights(summary, projects, models, sessions) {
  const insights = [];

  if (projects.length) {
    const topProject = [...projects].sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0))[0];
    if (topProject && summary.totalTokens) {
      const share = ((topProject.totalTokens / summary.totalTokens) * 100).toFixed(1);
      insights.push({
        title: 'High Token Usage',
        text: `${topProject.project} consumed ${share}% of total tokens.`
      });
    }
  }

  if (sessions.length) {
    const topSession = [...sessions].sort((a, b) => Number(b.estimatedCost || 0) - Number(a.estimatedCost || 0))[0];
    if (topSession) {
      insights.push({
        title: 'High Cost Session',
        text: `Session ${topSession.sessionId} consumed the highest estimated cost at ${formatCurrency(topSession.estimatedCost || 0)}.`
      });
    }

    const topFive = [...sessions].sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0)).slice(0, 5);
    const topFiveTokens = topFive.reduce((sum, session) => sum + Number(session.totalTokens || 0), 0);
    if (summary.totalTokens) {
      insights.push({
        title: 'Potential Optimization',
        text: `The top 5 sessions account for ${(topFiveTokens / summary.totalTokens * 100).toFixed(1)}% of total token consumption.`
      });
    }
  }

  if (summary.totalTokens) {
    const topModel = [...models].sort((a, b) => Number(b.totalTokens || 0) - Number(a.totalTokens || 0))[0];
    if (topModel) {
      const share = ((topModel.totalTokens / summary.totalTokens) * 100).toFixed(1);
      insights.push({
        title: 'Model Usage',
        text: `${topModel.model} is responsible for ${share}% of total usage.`
      });
    }
  }

  if (summary.cacheReadTokens + summary.cacheCreationTokens > 0) {
    const cacheEfficiency =((summary.cacheReadTokens / (summary.cacheReadTokens + summary.cacheCreationTokens)) * 100).toFixed(1);
    insights.push({
      title: 'Cache Efficiency',
      text: `Cache read tokens represent ${cacheEfficiency}% of cached usage.`
    });
  }

  return insights;
}

function buildAnalysisReport(parsedResults = [], metadata = {}) {
  const flattenedRecords = parsedResults.flatMap((result) => {
    const records = result.usageRecords || [];
    return records.map((record) => ({
      ...record,
      userName: record.userName || result.userName || metadata.userName || 'unknown-user'
    }));
  });
  const aggregates = aggregateUsageRecords(flattenedRecords);
  const insights = buildInsights(aggregates.summary, aggregates.projects, aggregates.models, aggregates.sessions);

  return {
    summary: aggregates.summary,
    projects: aggregates.projects,
    models: aggregates.models,
    sessions: aggregates.sessions,
    dailyUsage: aggregates.dailyUsage,
    tools: aggregates.tools,
    insights,
    users: Array.from(new Set((aggregates.sessions || []).map((session) => session.userName || 'unknown-user'))).map((userName) => ({
      name: userName,
      summary: {
        totalSessions: (aggregates.sessions || []).filter((session) => (session.userName || 'unknown-user') === userName).length,
        totalTokens: (aggregates.sessions || []).filter((session) => (session.userName || 'unknown-user') === userName).reduce((sum, session) => sum + Number(session.totalTokens || 0), 0),
        estimatedCost: (aggregates.sessions || []).filter((session) => (session.userName || 'unknown-user') === userName).reduce((sum, session) => sum + Number(session.estimatedCost || 0), 0)
      }
    })),
    metadata: {
      generatedAt: new Date().toISOString(),
      pricing: {
        ...PRICING_METADATA,
        details: 'Pricing configuration used: 2026-10-07 / default-pricing-v1'
      },
      privacyNotice: 'Your Claude CLI data is processed locally by this application. No Claude authentication is required. No data is sent to Anthropic. Temporary uploaded files are deleted after processing.',
      source: metadata.sourceFileName || 'uploaded-zip',
      extractedDirectory: metadata.extractedDirectory || null,
      claudeFilesCount: metadata.claudeFilesCount || 0,
      parserStats: parsedResults.reduce((agg, result) => {
        agg.totalLines += Number(result.totalLines || 0);
        agg.parsedLines += Number(result.parsedLines || 0);
        agg.invalidLines += Number(result.invalidLines || 0);
        return agg;
      }, { totalLines: 0, parsedLines: 0, invalidLines: 0 })
    }
  };
}

module.exports = {
  buildInsights,
  buildAnalysisReport
};
