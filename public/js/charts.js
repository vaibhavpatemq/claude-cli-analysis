const ChartManager = (() => {
  const charts = {};

  function destroyAll() {
    Object.values(charts).forEach((chart) => chart.destroy());
    Object.keys(charts).forEach((key) => delete charts[key]);
  }

  function buildDailyUsage(data) {
    const labels = data.dailyUsage.map((entry) => entry.date);
    const totals = data.dailyUsage.map((entry) => entry.totalTokens || 0);
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Tokens',
          data: totals,
          borderColor: '#4f8ef7',
          backgroundColor: 'rgba(79, 142, 247, 0.2)',
          tension: 0.2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function buildTokenDistribution(data) {
    const summary = data.summary || {};
    const dataset = [
      Number(summary.inputTokens || 0),
      Number(summary.outputTokens || 0),
      Number(summary.cacheReadTokens || 0),
      Number(summary.cacheCreationTokens || 0)
    ];

    return {
      type: 'doughnut',
      data: {
        labels: ['Input', 'Output', 'Cache Read', 'Cache Write'],
        datasets: [{
          data: dataset,
          backgroundColor: ['#4f8ef7', '#36a2eb', '#8b5cf6', '#22c55e']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function buildModelUsage(data) {
    return {
      type: 'bar',
      data: {
        labels: (data.models || []).map((item) => item.model || item.name || 'Unknown'),
        datasets: [{
          label: 'Tokens',
          data: (data.models || []).map((item) => item.totalTokens || 0),
          backgroundColor: '#36a2eb'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function buildProjectUsage(data) {
    return {
      type: 'bar',
      data: {
        labels: (data.projects || []).map((item) => item.project || item.name || 'Unknown'),
        datasets: [{
          label: 'Tokens',
          data: (data.projects || []).map((item) => item.totalTokens || 0),
          backgroundColor: '#8b5cf6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function buildCostChart(data) {
    const labels = data.dailyUsage.map((entry) => entry.date);
    const totals = data.dailyUsage.map((entry) => Number((entry.estimatedCost || 0)).toFixed(2));
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Estimated Cost',
          data: totals,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.18)',
          tension: 0.2
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function buildSessionsChart(data) {
    const labels = data.dailyUsage.map((entry) => entry.date);
    const totals = data.dailyUsage.map((entry) => entry.sessions || 0);
    return {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Sessions',
          data: totals,
          backgroundColor: '#f59e0b'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    };
  }

  function render(data) {
    if (!window.Chart) {
      return;
    }

    destroyAll();

    const safeData = data || {};
    const dailyUsage = Array.isArray(safeData.dailyUsage) ? safeData.dailyUsage : [];
    const projects = Array.isArray(safeData.projects) ? safeData.projects : [];
    const models = Array.isArray(safeData.models) ? safeData.models : [];
    const safeChartData = { ...safeData, dailyUsage, projects, models };

    const chartDefinitions = [
      ['daily-usage-chart', buildDailyUsage(safeChartData)],
      ['token-distribution-chart', buildTokenDistribution(safeChartData)],
      ['model-usage-chart', buildModelUsage(safeChartData)],
      ['project-usage-chart', buildProjectUsage(safeChartData)],
      ['cost-chart', buildCostChart(safeChartData)],
      ['sessions-chart', buildSessionsChart(safeChartData)]
    ];

    chartDefinitions.forEach(([chartId, config]) => {
      const canvas = document.getElementById(chartId);
      if (!canvas) return;
      try {
        charts[chartId] = new window.Chart(canvas, config);
      } catch (_error) {
        // Keep the dashboard visible even if a chart cannot be rendered.
      }
    });
  }

  return { render };
})();
