# ARCHITECTURE.md

## Overview
CyberSentinel is a single Next.js application. There is no separate backend service — API routes within the same project handle the detection pipeline and serve results to the dashboard.

## Pipeline

```
/data/events.json  ──┐
                      ├──▶ detectEvents() ──▶ detections[] ──▶ correlateDetections() ──▶ incidents[]
/data/signatures.json┘        (lib/detect.js)                      (lib/correlate.js)
                                                                            │
                                                                            ▼
                                                          for each incident:
                                                          try LLM narration (Groq)
                                                          catch → template fallback
                                                                            │
                                                                            ▼
                                                          /app/api/incidents/route.js
                                                          returns incidents[] as JSON
                                                                            │
                                                                            ▼
                                                          /app/page.jsx dashboard
                                                          (live queue, detail panel,
                                                           historical view, stats bar)
```

## Module responsibilities

| Module | Responsibility |
|---|---|
| `/data/events.json` | Synthetic security event dataset — the raw input |
| `/data/signatures.json` | Rule-based detection signature library |
| `/lib/detect.js` | Pure function: matches events against signatures, outputs detections with evidence |
| `/lib/correlate.js` | Pure function: groups related detections into incidents, escalates severity on chained detections |
| `/app/api/incidents/route.js` | Orchestrates the pipeline per request, adds LLM narration with fallback, returns JSON |
| `/app/page.jsx` | Dashboard UI — fetches from the API route and renders the analyst workflow |

## The deterministic-vs-LLM boundary

This is the core architectural principle of the project and must not be violated during implementation.

**Deterministic (rule-based code, no LLM involved):**
- Whether an event is suspicious (matching against signature conditions)
- Which threat category a detection belongs to
- The severity score and tier assigned to a detection or incident
- Whether multiple detections correlate into a single incident
- Severity escalation logic when detections chain together

**LLM-assisted (narration only, never decision-making):**
- Converting an incident's category + evidence + severity into a short, readable narrative sentence for the analyst
- Converting an incident's category + severity into natural-language response wording

**Why this boundary matters:** an LLM asked "is this malicious?" can hallucinate a confident-sounding but wrong answer with no traceable justification. By keeping detection and scoring in deterministic code, every verdict in CyberSentinel is reproducible and auditable — the LLM's role is limited to phrasing, and if it's ever unavailable, the deterministic fallback (built from the signature's `mechanism_description` and the severity tier) still produces a complete, usable incident record. This is also why `/lib/detect.js` and `/lib/correlate.js` are written as pure functions with no network calls — they can be unit tested and demoed with zero dependency on external services.

## Data flow on a typical page load
1. Dashboard calls `GET /app/api/incidents`.
2. The route loads `events.json` and `signatures.json`, runs `detectEvents()` then `correlateDetections()`.
3. For each incident, the route attempts one LLM call; on failure it falls back to a template.
4. The route returns the full incident array as JSON.
5. The dashboard splits incidents into "Live" (status ≠ Resolved) and "Historical" (status = Resolved) for the two queue views, and renders the stats bar from simple counts over the same array.

## Extensibility notes
- New event types are added by extending the common envelope in `DATA_SCHEMA.md` and adding matching signatures — no changes to `detect.js`'s core loop are required if conditions are expressed generically (field/operator/value).
- New correlation strategies (e.g. correlating by user account instead of only IP/host) are additive changes to `correlate.js`'s grouping key logic.
- Swapping the LLM provider (Groq → Gemini) only touches the narration call inside `/app/api/incidents/route.js`; no other module is aware of which LLM is in use.
