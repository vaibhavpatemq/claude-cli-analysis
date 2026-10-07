const fs = require('fs');
const path = require('path');

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function isSafeExtractPath(baseDir, candidatePath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidatePath);
  const relative = path.relative(resolvedBase, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function normalizeEntryName(entryName) {
  return entryName.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\./, '');
}

function collectFilesRecursively(dirPath, predicate = () => true) {
  const results = [];

  if (!fs.existsSync(dirPath)) {
    return results;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath, predicate));
    } else if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function findRelevantClaudeFiles(rootDir) {
  const files = collectFilesRecursively(rootDir, (filePath) => {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.jsonl') || lower.endsWith('.json');
  });

  return files.filter((filePath) => {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const fileName = filePath.split('/').pop().toLowerCase();
    const isClaudeLike = normalized.includes('claude')
      || normalized.includes('project')
      || normalized.includes('session')
      || normalized.includes('history')
      || normalized.includes('stats')
      || normalized.includes('conversation')
      || normalized.includes('usage')
      || normalized.includes('tool')
      || fileName.includes('settings')
      || fileName.includes('summary')
      || fileName.includes('history');

    return isClaudeLike || fileName.endsWith('.jsonl') || fileName.endsWith('.json');
  });
}

module.exports = {
  ensureDirectory,
  isSafeExtractPath,
  normalizeEntryName,
  collectFilesRecursively,
  findRelevantClaudeFiles
};
