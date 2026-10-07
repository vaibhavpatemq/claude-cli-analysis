const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');

const { aggregateUsageRecords } = require('../server/services/token-analyzer.service');
const { estimateCostForUsage, estimateCostForSession, resolveModelPricing } = require('../server/services/cost-calculator.service');
const { validateZipFile, processUploadedZip } = require('../server/services/zip.service');

const usageRecords = [
  {
    timestamp: '2026-10-01T10:00:00Z',
    sessionId: 's1',
    project: 'alpha',
    model: 'claude-sonnet',
    inputTokens: 100,
    outputTokens: 60,
    cacheCreationTokens: 20,
    cacheReadTokens: 30,
    totalTokens: 210,
    sourceFile: 'session-a.jsonl'
  },
  {
    timestamp: '2026-10-01T11:00:00Z',
    sessionId: 's2',
    project: 'beta',
    model: 'claude-haiku',
    inputTokens: 50,
    outputTokens: 40,
    cacheCreationTokens: 10,
    cacheReadTokens: 15,
    totalTokens: 115,
    sourceFile: 'session-b.jsonl'
  }
];

test('token aggregation computes totals and cache values', () => {
  const result = aggregateUsageRecords(usageRecords);
  assert.equal(result.summary.totalSessions, 2);
  assert.equal(result.summary.totalTokens, 325);
  assert.equal(result.summary.inputTokens, 150);
  assert.equal(result.summary.outputTokens, 100);
  assert.equal(result.summary.cacheCreationTokens, 30);
  assert.equal(result.summary.cacheReadTokens, 45);
});

test('cost calculation is model aware and positive', () => {
  const usageCost = estimateCostForUsage({
    model: 'claude-sonnet',
    inputTokens: 100000,
    outputTokens: 50000,
    cacheCreationTokens: 20000,
    cacheReadTokens: 25000
  });

  const sessionCost = estimateCostForSession({
    model: 'claude-opus',
    inputTokens: 10000,
    outputTokens: 10000,
    cacheCreationTokens: 2000,
    cacheReadTokens: 1000
  });

  assert.ok(usageCost > 0);
  assert.ok(sessionCost > 0);
  assert.equal(resolveModelPricing('claude-sonnet').input, 3);
});

test('daily, project, and model grouping is aggregated correctly', () => {
  const result = aggregateUsageRecords(usageRecords);
  assert.equal(result.dailyUsage.length, 1);
  assert.equal(result.projects.length, 2);
  assert.equal(result.models.length, 2);
  assert.equal(result.sessions[0].sessionId, 's1');
});

test('zip validation rejects invalid archive and accepts a valid one', () => {
  const invalid = { originalname: 'not-valid.txt', size: 128 };
  assert.throws(() => validateZipFile(invalid), /Invalid ZIP/);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-zip-'));
  const zipPath = path.join(tempDir, 'valid.zip');
  const archive = new AdmZip();
  archive.addFile('.claude/projects/project-a/session.jsonl', Buffer.from('{"type":"assistant_message","usage":{"input_tokens":10}}\n'));
  archive.writeZip(zipPath);

  const file = { originalname: 'valid.zip', path: zipPath, size: fs.statSync(zipPath).size };
  assert.doesNotThrow(() => validateZipFile(file));
  const processed = processUploadedZip(file);
  assert.ok(processed.extractedDir);
  assert.ok(processed.claudeFiles.length >= 1);

  const { rmSync } = fs;
  rmSync(tempDir, { recursive: true, force: true });
});
