# CyberSentinel

A security-monitoring prototype that detects suspicious network/security activity, classifies and scores it, correlates related detections into incidents, explains the evidence behind them, and recommends a defensive response — through a live analyst dashboard.

## Why this approach
Most "AI security" demos just ask a chatbot "is this malicious?" — which is fast to build but impossible to trust, since the model can produce a confident-sounding answer with no real justification. CyberSentinel is built the other way around: **detection, classification, and severity scoring are all deterministic, rule-based code.** The LLM is only used to narrate an already-computed result in plain English. This means every verdict in the dashboard is traceable back to specific evidence, and the app keeps working even if the LLM API is unavailable.

## Features (mapped to challenge requirements)
- Ingests a synthetic dataset of network/security events across five types (auth, network, DNS, process, file)
- Identifies suspicious activity using a rule-based signature library
- Classifies detections into threat categories (Brute Force, Port Scan, Privilege Escalation, Data Exfiltration, and more)
- Assigns a severity score and tier to every detection and incident
- Shows the exact evidence behind every alert
- Groups related detections into correlated incidents, escalating severity when an attack progresses through multiple stages
- Recommends a tiered defensive response per incident
- Provides a live incident queue plus a historical/resolved view with summary stats

## Tech stack
- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Backend:** Next.js API routes
- **Data:** static synthetic JSON dataset (`/data/events.json`, `/data/signatures.json`)
- **LLM:** Groq API free tier (fallback: Google Gemini free tier)
- **Hosting:** Vercel

## Setup and run

```bash
# install dependencies
npm install

# set required environment variables (create a .env.local file)
GROQ_API_KEY=your_groq_api_key_here

# run locally
npm run dev
# app runs at http://localhost:3000

# build for production
npm run build

# deploy
vercel deploy
```

## How it works
1. A synthetic event dataset is scored against a signature library of known attack patterns — this is plain rule-matching, not machine learning.
2. Matching detections that share a source IP, host, or account within a time window are grouped into a single incident, with severity increasing if the incident spans multiple attack stages (e.g. reconnaissance followed by successful access).
3. Each incident is passed to an LLM once, to generate a short narrative explanation and a recommended response — grounded entirely in the evidence already computed, with a template-based fallback if the LLM call fails.
4. The dashboard presents open incidents in a live queue sorted by severity, lets an analyst update status as they investigate, and keeps a historical view of resolved incidents.

## Further documentation
See the `documentation/` folder for full technical detail:
- [`AI_BUILD_SPEC.md`](./AI_BUILD_SPEC.md) — build specification and step-by-step implementation order
- [`TASKS.md`](./TASKS.md) — individually-promptable task checklist for AI-assisted development
- [`UI_UX_SPEC.md`](./UI_UX_SPEC.md) — dashboard design specification
- [`DATA_SCHEMA.md`](./DATA_SCHEMA.md) — event, signature, detection, and incident data shapes
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — pipeline architecture and the deterministic-vs-LLM boundary
- [`AI_USAGE_NOTE.md`](./AI_USAGE_NOTE.md) — AI tool usage disclosure for submission
