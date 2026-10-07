const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

const rootDir = path.join(__dirname, '..');
const sampleDir = path.join(rootDir, 'sample-data');
const claudeRoot = path.join(sampleDir, '.claude', 'projects');

const projects = [
  {
    name: 'project-alpha',
    sessions: [
      { id: 'alpha-session-1', model: 'claude-sonnet', day: '2026-10-01', events: 5 },
      { id: 'alpha-session-2', model: 'claude-haiku', day: '2026-10-03', events: 4 }
    ]
  },
  {
    name: 'project-beta',
    sessions: [
      { id: 'beta-session-1', model: 'claude-opus', day: '2026-10-02', events: 6 },
      { id: 'beta-session-2', model: 'claude-sonnet', day: '2026-10-05', events: 3 }
    ]
  },
  {
    name: 'project-gamma',
    sessions: [
      { id: 'gamma-session-1', model: 'claude-3-5-sonnet', day: '2026-10-04', events: 4 },
      { id: 'gamma-session-2', model: 'claude-3-5-haiku', day: '2026-10-06', events: 5 }
    ]
  }
];

function buildEvent(session, index, toolName, usage) {
  return {
    type: index % 2 === 0 ? 'assistant_message' : 'tool_call',
    session_id: session.id,
    project: session.project,
    model: session.model,
    timestamp: `${session.day}T${String(10 + index).padStart(2, '0')}:${String(10 + index * 5).padStart(2, '0')}:00Z`,
    tool_name: toolName,
    usage,
    metadata: { source: 'synthetic' }
  };
}

function createSampleFile() {
  fs.rmSync(sampleDir, { recursive: true, force: true });
  fs.mkdirSync(claudeRoot, { recursive: true });

  for (const project of projects) {
    const projectDir = path.join(claudeRoot, project.name);
    fs.mkdirSync(projectDir, { recursive: true });

    for (const session of project.sessions) {
      const sessionPath = path.join(projectDir, `${session.id}.jsonl`);
      const lines = [];
      const baseUsage = {
        'claude-sonnet': { input_tokens: 15000, output_tokens: 8000, cache_creation_input_tokens: 3000, cache_read_input_tokens: 18000 },
        'claude-haiku': { input_tokens: 7000, output_tokens: 4000, cache_creation_input_tokens: 2000, cache_read_input_tokens: 5000 },
        'claude-opus': { input_tokens: 22000, output_tokens: 12000, cache_creation_input_tokens: 5000, cache_read_input_tokens: 25000 },
        'claude-3-5-sonnet': { input_tokens: 16000, output_tokens: 9000, cache_creation_input_tokens: 3500, cache_read_input_tokens: 14000 },
        'claude-3-5-haiku': { input_tokens: 9000, output_tokens: 7000, cache_creation_input_tokens: 2500, cache_read_input_tokens: 8000 }
      };

      const usage = baseUsage[session.model];
      for (let index = 0; index < session.events; index += 1) {
        const toolName = index % 2 === 0 ? 'Read' : 'Write';
        const event = buildEvent({ ...session, project: project.name }, index, toolName, {
          input_tokens: usage.input_tokens + index * 200,
          output_tokens: usage.output_tokens + index * 100,
          cache_creation_input_tokens: usage.cache_creation_input_tokens + index * 50,
          cache_read_input_tokens: usage.cache_read_input_tokens + index * 100
        });
        lines.push(`${JSON.stringify(event)}\n`);
      }

      fs.writeFileSync(sessionPath, lines.join(''));
    }
  }

  const zip = new AdmZip();
  zip.addLocalFolder(path.join(sampleDir, '.claude'));
  zip.writeZip(path.join(sampleDir, 'claude.zip'));

  fs.writeFileSync(path.join(sampleDir, 'README.md'), 'Synthetic Claude CLI sample archive generated for local testing.\n');
  console.log(`Sample data generated in ${sampleDir}`);
}

createSampleFile();
