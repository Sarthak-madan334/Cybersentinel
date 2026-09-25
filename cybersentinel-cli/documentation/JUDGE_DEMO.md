# Judge demonstration brief

CyberSentinel has two compatible components: an analyst dashboard and a Linux companion scanner written in Rust.

## Rust CLI

The CLI is a lightweight native Linux binary. Rust was chosen for memory safety, predictable performance, and a deployable tool with no runtime or service dependency. It runs three live local checks:

1. `ss -tuln` identifies listening ports. A fixed list of backdoor-associated ports, including 4444 and 31337, produces a High finding. Other listening ports remain visible as Info findings.
2. SSH logs from `journalctl` or `/var/log/auth.log` are aggregated by source IP. Five failed password attempts are Medium; ten or more are High.
3. `ps` is inspected for exact offensive-tool executable names, active Netcat listeners, and processes launched from `/tmp` or `/dev/shm`.

All three decisions use deterministic Rust conditions and severity thresholds. No LLM is used by the CLI. Each finding includes the underlying evidence, such as source IP, port, PID, process owner, command line, or failed-attempt count.

The CLI presents a color-coded report and exports `findings.json`. Its fields match the CyberSentinel incident contract: incident ID, category, severity, evidence, narrative, response, timestamps, and status. This lets local findings be reviewed alongside dashboard incidents without inventing a separate reporting format.

## Dashboard

The Next.js dashboard provides the SOC workflow: a visible high-risk vulnerability banner, a live incident queue, severity and evidence details, deterministic correlation, and response-status tracking. The dashboard uses AI only to phrase an already-computed explanation and response; detection, classification, scoring, and correlation remain deterministic, with template fallback when AI is unavailable.
