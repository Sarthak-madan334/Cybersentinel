# CLI build specification

Build a synchronous Rust binary that runs three local Linux checks: listening ports through `ss -tuln`, failed SSH attempts through `journalctl` with `/var/log/auth.log` fallback, and suspicious process commands through `ps aux`.

Detection and scoring are deterministic thresholds only. Use a fixed suspicious-port list, five and ten SSH failure thresholds, and fixed suspicious process indicators. Each result must become an incident-compatible record with evidence, severity, a templated narrative, and a templated response. Never call an LLM.

Use `colored`, `serde`, `serde_json`, and `chrono`; handle unavailable commands by reporting a skipped check. `--json` must write `findings.json`.
