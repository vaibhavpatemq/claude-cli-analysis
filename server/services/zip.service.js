const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { ensureDirectory, isSafeExtractPath, normalizeEntryName, findRelevantClaudeFiles } = require('../utils/file.utils');

const MAX_ZIP_SIZE_BYTES = Number(process.env.MAX_UPLOAD_SIZE_BYTES || 100 * 1024 * 1024);
const TEMP_ROOT = path.join(__dirname, '../../uploads');

function validateZipFile(file) {
  if (!file) {
    throw new Error('No file uploaded.');
  }

  if (!file.originalname.toLowerCase().endsWith('.zip')) {
    throw new Error('Invalid ZIP file. The upload must end in .zip.');
  }

  if (file.size > MAX_ZIP_SIZE_BYTES) {
    throw new Error(`ZIP file exceeds the maximum limit of ${Math.round(MAX_ZIP_SIZE_BYTES / (1024 * 1024))} MB.`);
  }

  return true;
}

function safeExtractZip(zipPath, destinationDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  ensureDirectory(destinationDir);

  for (const entry of entries) {
    const entryName = normalizeEntryName(entry.entryName);
    if (!entryName) {
      continue;
    }

    const normalizedTarget = path.resolve(destinationDir, entryName);
    if (!isSafeExtractPath(destinationDir, normalizedTarget)) {
      throw new Error(`Unsafe ZIP entry detected: ${entry.entryName}`);
    }

    if (entry.isDirectory) {
      ensureDirectory(normalizedTarget);
      continue;
    }

    const parentDir = path.dirname(normalizedTarget);
    ensureDirectory(parentDir);
    fs.writeFileSync(normalizedTarget, entry.getData(), { mode: 0o600 });
  }
}

function processUploadedZip(file) {
  validateZipFile(file);

  const storageDir = path.join(TEMP_ROOT, 'tmp');
  ensureDirectory(storageDir);

  const extractedDir = path.join(storageDir, `claude-${Date.now()}`);
  ensureDirectory(extractedDir);

  // Privacy model: uploaded client data is kept only long enough to parse the ZIP,
  // then it is deleted as part of the analysis lifecycle to avoid storing raw data.
  safeExtractZip(file.path, extractedDir);

  const claudeFiles = findRelevantClaudeFiles(extractedDir);

  return {
    extractedDir,
    claudeFiles,
    fileName: file.originalname
  };
}

function cleanupTemporaryFiles(extractedDir) {
  if (!extractedDir || !fs.existsSync(extractedDir)) {
    return;
  }

  fs.rmSync(extractedDir, { recursive: true, force: true });
}

module.exports = {
  MAX_ZIP_SIZE_BYTES,
  validateZipFile,
  safeExtractZip,
  processUploadedZip,
  cleanupTemporaryFiles
};
