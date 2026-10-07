const MODEL_PRICING = {
  'claude-opus': { input: 15, output: 75, cacheRead: 7.5, cacheWrite: 18.75 },
  'claude-sonnet': { input: 3, output: 15, cacheRead: 0.75, cacheWrite: 3.75 },
  'claude-haiku': { input: 0.8, output: 4, cacheRead: 0.2, cacheWrite: 0.4 },
  'claude-3-5-sonnet': { input: 3, output: 15, cacheRead: 0.75, cacheWrite: 3.75 },
  'claude-3-5-haiku': { input: 0.8, output: 4, cacheRead: 0.2, cacheWrite: 0.4 },
  'unknown': { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
};

const PRICING_METADATA = {
  date: '2026-10-07',
  version: 'default-pricing-v1',
  note: 'Estimated costs are based on configured local pricing values and are not official Claude invoices.'
};

function resolveModelPricing(modelName) {
  if (!modelName) {
    return MODEL_PRICING.unknown;
  }

  const normalized = String(modelName).toLowerCase();
  return MODEL_PRICING[normalized] || MODEL_PRICING.unknown;
}

function estimateCostForUsage({ model = 'unknown', inputTokens = 0, outputTokens = 0, cacheCreationTokens = 0, cacheReadTokens = 0 }) {
  const pricing = resolveModelPricing(model);
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  const cacheWriteCost = (cacheCreationTokens / 1_000_000) * pricing.cacheWrite;
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.cacheRead;

  return Number((inputCost + outputCost + cacheWriteCost + cacheReadCost).toFixed(6));
}

function estimateCostForSession(session = {}) {
  const model = session.model || 'unknown';
  return estimateCostForUsage({
    model,
    inputTokens: Number(session.inputTokens || 0),
    outputTokens: Number(session.outputTokens || 0),
    cacheCreationTokens: Number(session.cacheCreationTokens || 0),
    cacheReadTokens: Number(session.cacheReadTokens || 0)
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

module.exports = {
  MODEL_PRICING,
  PRICING_METADATA,
  resolveModelPricing,
  estimateCostForUsage,
  estimateCostForSession,
  formatCurrency
};
