# Claude Code Usage & Productivity Analyzer

## What is this?

This project is a standalone local web application for analyzing a manually exported Claude CLI ZIP archive. It does not authenticate with Claude, does not require an Anthropic API key, and does not call the Claude API.

The application accepts a ZIP file that contains local Claude CLI data, parses the available JSONL session files, aggregates token usage, estimates cost using a configurable pricing table, and displays the results in a dashboard.

## Features

- ZIP upload and validation
- Local-only processing with no external calls
- Safe ZIP extraction with traversal protection
- Discovery and parsing of Claude JSONL session files
- Token, cache, model, and project aggregation
- Estimated cost calculation using a configurable model pricing table
- Filters for project, model, and date range
- Session-level analytics and insights
- CSV/JSON export and print support
- Synthetic sample-data generation for testing

## Architecture

The app is organized into a simple Node.js + Express backend and a vanilla JavaScript frontend.

- `server/server.js` starts the backend server
- `server/routes/analysis.routes.js` exposes the REST API
- `server/services/zip.service.js` validates and extracts ZIP archives
- `server/services/claude-parser.service.js` scans and parses JSONL records
- `server/services/token-analyzer.service.js` aggregates usage metrics
- `server/services/cost-calculator.service.js` calculates estimated costs
- `server/services/report.service.js` assembles the dashboard payload
- `public/` contains the client dashboard and UI logic

## Installation

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser.

## Development

```bash
npm run dev
```

## Generate sample data

```bash
npm run generate-sample
```

This creates synthetic `.claude` session files and a sample `sample-data/claude.zip` that can be uploaded into the app for end-to-end testing.

## How to export Claude CLI data

Clients can create a ZIP archive that contains the relevant local Claude CLI data, such as:

```text
claude.zip
└── .claude/
    ├── projects/
    │   ├── project-a/
    │   │   └── session.jsonl
    │   └── project-b/
    │       └── session.jsonl
    ├── history.jsonl
    └── stats-cache.json
```

The parser is designed to tolerate variations in directory layout and different local Claude CLI data versions. It searches for `.jsonl` files and handles missing or malformed fields without crashing the overall analysis.

## Privacy

This application processes uploaded Claude CLI data locally on the machine running the app. It does not require Claude authentication, does not call the Anthropic API, and does not send uploaded files to third-party services.

The app keeps uploaded ZIP files only long enough to extract, parse, and analyze them, and then removes the temporary extracted directory after processing.

## Limitations

- Claude CLI local data formats can change across versions.
- Some session records may omit usage metadata or tool details.
- Estimated costs are derived from the configured local pricing table and should be treated as estimates, not official invoices.

## License

MIT
