const fs = require('fs');
const crypto = require('crypto');

function normalizeNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function getNestedValue(source, paths) {
  for (const key of paths) {
    const value = source?.[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }

  return undefined;
}

function inferProjectFromSource(sourceFile) {
  if (!sourceFile) {
    return 'unknown';
  }

  const normalized = sourceFile.replace(/\\/g, '/');
  const match = normalized.match(/(?:^|\/)(?:\.claude\/)?projects\/([^/]+)/i);
  if (match && match[1]) {
    return match[1]
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  const lastFolder = normalized.split('/').slice(-2, -1)[0];
  return lastFolder ? lastFolder.replace(/[_-]+/g, ' ') : 'unknown';
}

function hashString(value) {
  return crypto.createHash('md5').update(String(value)).digest('hex').slice(0, 12);
}

function findNestedMatch(node, keys) {
  const seen = new WeakSet();

  function walk(current) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }

    if (seen.has(current)) {
      return undefined;
    }
    seen.add(current);

    if (Array.isArray(current)) {
      for (const item of current) {
        const found = walk(item);
        if (found !== undefined) {
          return found;
        }
      }
      return undefined;
    }

    for (const [entryKey, entryValue] of Object.entries(current)) {
      const lowerKey = String(entryKey).toLowerCase();
      const matched = keys.some((key) => lowerKey === key.toLowerCase() || lowerKey.endsWith(key.toLowerCase()) || lowerKey.includes(key.toLowerCase()));

      if (matched && entryValue !== null && entryValue !== undefined) {
        if (typeof entryValue === 'object') {
          const nested = findNestedMatch(entryValue, ['id', 'session_id', 'sessionid']);
          if (nested !== undefined) {
            return nested;
          }
        }
        return entryValue;
      }

      const nested = walk(entryValue);
      if (nested !== undefined) {
        return nested;
      }
    }

    return undefined;
  }

  return walk(node);
}

function getSessionId(event, fallbackSource) {
  const candidate = findNestedMatch(event, ['session_id', 'sessionid', 'session', 'conversation_id', 'conversationid']);
  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim();
  }

  if (typeof candidate === 'number') {
    return String(candidate);
  }

  if (candidate && typeof candidate === 'object') {
    const nestedId = findNestedMatch(candidate, ['id']);
    if (typeof nestedId === 'string' && nestedId.trim()) {
      return nestedId.trim();
    }
  }

  return `session-${hashString(fallbackSource || JSON.stringify(event || {}))}`;
}

function getTimestampValue(event) {
  return getNestedValue(event, ['timestamp', 'created_at', 'createdAt', 'time', 'date', 'event_time', 'ts']);
}

function getModelName(event) {
  const candidates = [];

  function walk(value) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      const normalizedKey = String(key).toLowerCase();
      if ((normalizedKey.includes('model') || normalizedKey.includes('provider')) && typeof nestedValue === 'string' && nestedValue.trim()) {
        candidates.push(nestedValue.trim());
      }
      if (nestedValue && typeof nestedValue === 'object') {
        walk(nestedValue);
      }
    }
  }

  walk(event);

  const first = candidates.find((item) => /claude|sonnet|opus|haiku/i.test(item));
  return first || getNestedValue(event, ['model', 'model_name', 'modelName', 'provider_model', 'metadata.model']) || 'unknown';
}

function getToolName(event) {
  const tool = getNestedValue(event, ['tool', 'tool_name', 'toolName', 'tool_call', 'toolCall']);

  if (typeof tool === 'string') {
    return tool;
  }

  if (tool && typeof tool === 'object') {
    return tool.name || tool.type || 'unknown';
  }

  const calls = getNestedValue(event, ['tool_calls', 'toolCalls']);
  if (Array.isArray(calls) && calls.length > 0) {
    return calls[0]?.name || calls[0]?.tool || 'unknown';
  }

  return null;
}

function normalizeTokenKey(key) {
  const normalized = String(key || '').toLowerCase();

  if (/(input|prompt).*(token)/.test(normalized) && !/cache/.test(normalized)) {
    return 'inputTokens';
  }

  if (/(output|completion).*(token)/.test(normalized)) {
    return 'outputTokens';
  }

  if (/(cache|context).*(write|creation|store).*(token)/.test(normalized) || /(cache.*(write|creation).*token)/.test(normalized)) {
    return 'cacheCreationTokens';
  }

  if (/(cache|context).*(read).*(token)/.test(normalized)) {
    return 'cacheReadTokens';
  }

  return null;
}

function collectUsageMetrics(node, seen = new WeakSet()) {
  const metrics = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0
  };

  function walk(value) {
    if (!value || typeof value !== 'object') {
      return;
    }

    if (seen.has(value)) {
      return;
    }
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }

    for (const [key, nestedValue] of Object.entries(value)) {
      const tokenKey = normalizeTokenKey(key);
      if (tokenKey && nestedValue !== null && nestedValue !== undefined) {
        const numericValue = normalizeNumber(nestedValue, 0);
        metrics[tokenKey] += numericValue;
      }

      if (nestedValue && typeof nestedValue === 'object') {
        walk(nestedValue);
      }
    }
  }

  walk(node);
  return metrics;
}

function getUsageFromEvent(event) {
  const usageStats = collectUsageMetrics(event);

  return {
    inputTokens: usageStats.inputTokens,
    outputTokens: usageStats.outputTokens,
    cacheCreationTokens: usageStats.cacheCreationTokens,
    cacheReadTokens: usageStats.cacheReadTokens
  };
}

function extractUsageFromEvent(event, fallbackProject = 'unknown', sourceFile = 'unknown') {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const usage = getUsageFromEvent(event);
  const hasAnyUsage = [usage.inputTokens, usage.outputTokens, usage.cacheCreationTokens, usage.cacheReadTokens].some((value) => value > 0);

  if (!hasAnyUsage) {
    return null;
  }

  const timestamp = getTimestampValue(event) || new Date().toISOString();
  const sessionId = getSessionId(event, sourceFile);
  const project = getNestedValue(event, ['project']) || fallbackProject || inferProjectFromSource(sourceFile) || 'unknown';
  const model = getModelName(event);
  const toolName = getToolName(event);
  const toolCallCount = Array.isArray(getNestedValue(event, ['tool_calls', 'toolCalls'])) ? getNestedValue(event, ['tool_calls', 'toolCalls']).length : 0;

  const record = {
    timestamp: typeof timestamp === 'string' ? timestamp : new Date(timestamp).toISOString(),
    sessionId,
    project,
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    cacheReadTokens: usage.cacheReadTokens,
    totalTokens: usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens,
    sourceFile
  };

  Object.defineProperties(record, {
    eventType: { value: typeof event.type === 'string' ? event.type : 'unknown', enumerable: false },
    toolName: { value: toolName, enumerable: false },
    messageCount: { value: /message|assistant|user|prompt/i.test(String(event.type || '')) ? 1 : 0, enumerable: false },
    toolCallCount: { value: toolCallCount, enumerable: false }
  });

  return record;
}

function parseClaudeJsonlFile(fileName, lines, fallbackProject = 'unknown') {
  const result = {
    fileName,
    totalLines: lines.length,
    parsedLines: 0,
    invalidLines: 0,
    usageRecords: [],
    toolEvents: [],
    errors: []
  };

  for (const line of lines) {
    if (!line || !String(line).trim()) {
      continue;
    }

    try {
      const parsed = JSON.parse(line);
      const events = Array.isArray(parsed) ? parsed : [parsed];

      for (const event of events) {
        if (!event || typeof event !== 'object') {
          continue;
        }

        result.parsedLines += 1;

        const usageRecord = extractUsageFromEvent(event, fallbackProject, fileName);
        if (usageRecord) {
          result.usageRecords.push(usageRecord);
        }

        const toolName = getToolName(event);
        if (toolName) {
          result.toolEvents.push({
            timestamp: getTimestampValue(event) || new Date().toISOString(),
            sessionId: getSessionId(event, fileName),
            project: getNestedValue(event, ['project']) || fallbackProject || inferProjectFromSource(fileName),
            toolName,
            sourceFile: fileName
          });
        }
      }
    } catch (error) {
      result.invalidLines += 1;
      result.errors.push({ fileName, error: error.message, line: line.slice(0, 200) });
    }
  }

  return result;
}

function scanClaudeDirectory(rootDir) {
  const files = [];
  const walk = (currentPath) => {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = `${currentPath}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && fullPath.toLowerCase().endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  };

  walk(rootDir);
  return files;
}

module.exports = {
  extractUsageFromEvent,
  parseClaudeJsonlFile,
  scanClaudeDirectory,
  inferProjectFromSource,
  getSessionId
};
