const test = require('node:test');
const assert = require('node:assert/strict');
const { parseClaudeJsonlFile, extractUsageFromEvent } = require('../server/services/claude-parser.service');

test('parser handles valid JSONL and extracts usage', () => {
  const lines = [
    JSON.stringify({
      type: 'assistant_message',
      timestamp: '2026-10-01T12:00:00Z',
      model: 'claude-sonnet',
      session_id: 'sess-1',
      project: 'project-a',
      usage: { input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 20, cache_read_input_tokens: 30 }
    }),
    JSON.stringify({ type: 'tool_result', timestamp: '2026-10-01T12:02:00Z', session_id: 'sess-1', model: 'claude-sonnet', usage: { input_tokens: 25, output_tokens: 10 } })
  ];

  const result = parseClaudeJsonlFile('test.jsonl', lines, 'project-a');
  assert.equal(result.totalLines, 2);
  assert.equal(result.parsedLines, 2);
  assert.equal(result.invalidLines, 0);
  assert.equal(result.usageRecords.length, 2);
  assert.equal(result.usageRecords[0].totalTokens, 200);
  assert.equal(result.usageRecords[0].project, 'project-a');
});

test('parser ignores invalid JSON lines and tracks errors', () => {
  const lines = [
    '{"type":"ok"}',
    'not valid json',
    JSON.stringify({ type: 'assistant_message', usage: { input_tokens: 10 } })
  ];

  const result = parseClaudeJsonlFile('bad.jsonl', lines, 'project-b');
  assert.equal(result.totalLines, 3);
  assert.equal(result.invalidLines, 1);
  assert.equal(result.parsedLines, 2);
});

test('extractUsageFromEvent normalizes token fields', () => {
  const record = extractUsageFromEvent({
    timestamp: '2026-10-01T10:00:00Z',
    session_id: 'abc',
    model: 'claude-haiku',
    usage: { input_tokens: 40, output_tokens: 15, cache_creation_input_tokens: 5, cache_read_input_tokens: 10 }
  }, 'project-c', 'sample.jsonl');

  assert.deepEqual(record, {
    timestamp: '2026-10-01T10:00:00Z',
    sessionId: 'abc',
    project: 'project-c',
    model: 'claude-haiku',
    inputTokens: 40,
    outputTokens: 15,
    cacheCreationTokens: 5,
    cacheReadTokens: 10,
    totalTokens: 70,
    sourceFile: 'sample.jsonl'
  });
});

test('extractUsageFromEvent supports nested Claude payloads', () => {
  const record = extractUsageFromEvent({
    metadata: {
      session: { id: 'nested-session' },
      model: 'claude-sonnet',
      project: 'real-project'
    },
    data: {
      usage: {
        input_tokens: 200,
        output_tokens: 100,
        cache_write_tokens: 50,
        cache_read_input_tokens: 40
      }
    }
  }, 'fallback-project', 'nested.jsonl');

  assert.equal(record.sessionId, 'nested-session');
  assert.equal(record.model, 'claude-sonnet');
  assert.equal(record.inputTokens, 200);
  assert.equal(record.outputTokens, 100);
  assert.equal(record.cacheCreationTokens, 50);
  assert.equal(record.cacheReadTokens, 40);
  assert.equal(record.totalTokens, 390);
});
