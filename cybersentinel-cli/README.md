# CyberSentinel CLI

`cybersentinel-cli` is a Linux companion scanner for the CyberSentinel dashboard. It applies deterministic rules to live local signals and produces findings in the dashboard's incident-compatible JSON shape. It does not use an LLM.

## Build

```bash
cargo build --release
```

## Run

```bash
# Print the colour-coded terminal report
./target/release/cybersentinel-cli

# Also write incident-compatible findings.json
./target/release/cybersentinel-cli --json
```

The scanner calls `ss`, `journalctl`, and `ps`. `journalctl` is the preferred source for SSH events. On some distributions, its log retention or permissions may be limited; the scanner then attempts `/var/log/auth.log`, which may require elevated permissions. A failed check is reported as skipped and does not stop the other checks. IPv4, IPv6, TCP, and UDP views of the same port are consolidated into one finding.

Use `--help` to view the available options. Process rules match executable names and explicit arguments; they do not use loose substring matching, which prevents false positives such as matching `ncat` inside `truncate`.

## Detection taxonomy

| Live local check | Dashboard threat category | Deterministic threshold |
| --- | --- | --- |
| Listening ports from `ss -tuln` | Suspicious Listening Port | Backdoor-associated port in the fixed port list |
| Failed SSH authentication events | Brute Force | 5+ attempts = Medium; 10+ = High |
| Running processes from `ps aux` | Malware Execution Pattern | Fixed tool name or suspicious-path indicator match |

The JSON output uses `incident_id`, `category`, `severity`, `severity_tier`, `source_ip`, `host`, `status`, `evidence`, `narrative`, `recommended_response`, `created_at`, and `resolved_at` so it can be reviewed alongside dashboard incidents in a future integration.
