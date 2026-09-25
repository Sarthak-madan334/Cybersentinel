# AI usage note

## Tools used

- Codex was used for project scaffolding, implementation assistance, debugging, UI refinement, documentation drafts, and test guidance.
- Groq is an optional runtime service used only to phrase dashboard incident narratives and response wording.

## Work assisted by AI

- Next.js dashboard and API route scaffolding.
- Draft synthetic event data, signature definitions, Rust parsing helpers, and terminal report formatting.
- Documentation structure and responsive interface refinements.

## Participant decisions and review

- The participant selected the deterministic security architecture: rules decide detection, category, severity, and correlation; AI never makes those security decisions.
- The participant selected and reviewed detection thresholds, correlation behavior, port indicators, process indicators, and response guidance.
- The participant tested the Rust CLI in Ubuntu, including the correction for a false positive caused by matching `ncat` inside `truncate`.
- The participant remains responsible for the security claims, final implementation, configuration, and submitted result.
