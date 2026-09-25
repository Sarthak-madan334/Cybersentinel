# CyberSentinel

CyberSentinel is an explainable security-monitoring prototype for SOC analysts. It turns security events into deterministic, evidence-backed incidents and includes a companion Rust CLI for live Linux host scanning.

## Workflow

```
Synthetic events or Linux host signals
        ↓
Deterministic signatures and thresholds
        ↓
Severity scoring and incident correlation
        ↓
Evidence, analyst narrative, and defensive response
        ↓
Dashboard queue and historical review
```

Detection, threat classification, severity scoring, and correlation are deterministic code. The optional Groq integration only writes a plain-language explanation after an incident has already been calculated. A local template fallback keeps the application functional without an API key.

## Run the dashboard

Requirements: Node.js 20+ and pnpm or npm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`. `GROQ_API_KEY` is optional; leaving it blank uses deterministic template narration.

For a production check:

```bash
pnpm build
```

## Dashboard API

- `GET /api/incidents` runs detection and correlation over the configured event dataset.
- `POST /api/events` accepts a valid `auth`, `network`, `dns`, `process`, or `file` event for the running session.
- `PATCH /api/incidents/:id` updates an incident to `New`, `Investigating`, `Contained`, or `Resolved` during the running session.

## Run the Linux Rust CLI

Requirements: Linux, Rust stable, and the standard `ss`, `journalctl`, and `ps` commands.

```bash
cd cybersentinel-cli
cargo build --release
./target/release/cybersentinel-cli --menu
```

Use `./target/release/cybersentinel-cli --json` to produce `findings.json`, an incident-compatible export for review alongside dashboard findings. See [the CLI README](./cybersentinel-cli/README.md) for check behavior and permission notes.

## Reproducibility and submission material

- [Synthetic events](./data/events.json) and [detection signatures](./data/signatures.json) reproduce the dashboard pipeline.
- [Architecture](./Documentation/ARCHITECTURE.md) documents the deterministic versus LLM boundary.
- [Data schema](./Documentation/DATA_SCHEMA.md) documents event, detection, and incident fields.
- [AI usage note](./AI_USAGE_NOTE.md) records AI assistance and participant decisions.
- [Judge demo brief](./cybersentinel-cli/documentation/JUDGE_DEMO.md) explains the Rust CLI and dashboard workflow.
