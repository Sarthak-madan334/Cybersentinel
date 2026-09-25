# Architecture

```
ss -tuln ──────────────┐
journalctl/auth.log ──┼─> deterministic Rust checks ─> findings ─> terminal report / findings.json
ps aux ───────────────┘
```

Each check owns collection and parsing. Shared constructors map a matched rule into the dashboard-compatible incident fields. The process has no network calls, database, or LLM dependency. `findings.json` is deliberately compatible with CyberSentinel's dashboard incident model but is not automatically imported by the dashboard.
