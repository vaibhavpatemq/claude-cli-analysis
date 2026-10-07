const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processUploadedZip, cleanupTemporaryFiles } = require('../services/zip.service');
const { scanClaudeDirectory, parseClaudeJsonlFile } = require('../services/claude-parser.service');
const { buildAnalysisReport } = require('../services/report.service');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE_BYTES || 100 * 1024 * 1024) },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.toLowerCase().endsWith('.zip')) {
      cb(null, true);
      return;
    }

    cb(new Error('Only ZIP files are supported for Claude exports.'));
  }
});

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'claude-code-analyzer',
    timestamp: new Date().toISOString()
  });
});

router.post('/analyze', upload.array('files', 20), async (req, res) => {
  try {
    const files = Array.isArray(req.files) && req.files.length ? req.files : req.file ? [req.file] : [];
    if (!files.length) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload a ZIP archive containing your Claude CLI export.'
      });
    }

    const userName = (req.body.userName || req.body.user || '').trim() || 'unknown-user';
    const parsedResults = [];
    let totalClaudeFiles = 0;

    for (const file of files) {
      const zipResult = processUploadedZip(file);
      const claudeFiles = zipResult.claudeFiles;
      const resolvedUserName = (req.body.userName || req.body.user || '').trim() || file.originalname.replace(/\.zip$/i, '') || 'unknown-user';

      if (!claudeFiles || claudeFiles.length === 0) {
        cleanupTemporaryFiles(zipResult.extractedDir);
        continue;
      }

      totalClaudeFiles += claudeFiles.length;

      for (const filePath of claudeFiles) {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        const fileName = path.basename(filePath);
        const fallbackProject = path.basename(path.dirname(filePath)) || 'unknown';
        const result = parseClaudeJsonlFile(fileName, lines, fallbackProject);
        result.userName = resolvedUserName;
        parsedResults.push(result);
      }

      cleanupTemporaryFiles(zipResult.extractedDir);
    }

    if (!parsedResults.length) {
      return res.status(400).json({
        error: 'No Claude usage data was found.',
        message: 'Please make sure your ZIP contains the Claude CLI session/project JSONL files.'
      });
    }

    const report = buildAnalysisReport(parsedResults, {
      sourceFileName: files.map((file) => file.originalname).join(', '),
      extractedDirectory: null,
      claudeFilesCount: totalClaudeFiles,
      userName
    });

    return res.json({
      ...report,
      userNames: Array.from(new Set((report.sessions || []).map((session) => session.userName || 'unknown-user')))
    });
  } catch (error) {
    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          if (file && file.path) fs.unlinkSync(file.path);
        } catch (_unlinkError) {
          // Ignore cleanup errors during upload validation failures.
        }
      }
    }

    return res.status(400).json({
      error: 'Analysis failed',
      message: error.message || 'The uploaded archive could not be processed.'
    });
  }
});

module.exports = router;
