# AI_BUILD_SPEC.md
> This file is written FOR an AI coding assistant (e.g. Claude Code, Cursor, Copilot). Read it top to bottom and execute in order. Do not skip the core pipeline to build polish features.

## Project
**Name:** CyberSentinel
**One-line description:** A security-monitoring prototype that ingests synthetic network/security events, detects suspicious activity, classifies and scores it, correlates related detections into incidents, explains the evidence behind each one, and recommends a defensive response — presented through a live/historical monitoring dashboard for a security analyst.

## Non-negotiable design principle
Detection, classification, severity scoring, and correlation must all be **deterministic code**, never an LLM guess. The LLM is used ONLY to:
1. Turn an already-computed incident (category + evidence + severity) into a short plain-English narrative.
2. Turn an already-computed severity/category into a recommended response, phrased naturally.

If the LLM call fails or times out, the app must still work — fall back to a template-built explanation/response constructed from the incident's own fields. The analyst-facing verdict must never depend on the LLM being available.

## Stack to use
- Frontend: Next.js (App Router) + Tailwind CSS
- Backend: Next.js API routes (`/app/api/.../route.js`)
- Data: static/synthetic JSON dataset (no external DB required for the prototype)
- LLM: Groq API (free tier, e.g. `llama-3.1-8b-instant`) — fallback to Google Gemini free tier (`gemini-1.5-flash`) if Groq is unavailable
- Hosting: Vercel

## Build order (do not reorder)

### Step 1 — Event dataset
Create `/data/events.json`: an array of synthetic security events covering multiple types — authentication, network/firewall, DNS, process execution, file access. See `DATA_SCHEMA.md` for the exact field shapes. Aim for 60–100 events, including a handful of deliberately clean/benign events so the detection engine has true negatives to correctly ignore.

### Step 2 — Signature library
Create `/data/signatures.json`: an array of detection rules. Each rule has an id, a threat category (e.g. Brute Force, Port Scan, Privilege Escalation, Data Exfiltration, Suspicious Login Geography/Time, C2 Beaconing, Malware Execution Pattern), matching conditions (field/value/threshold logic), a base severity weight, and a short mechanism description used later for LLM context. Aim for 10–15 signatures across the event types from Step 1.

### Step 3 — Detection engine
Create `/lib/detect.js` exporting `detectEvents(events, signatures)`:
- Evaluates every event against every signature's matching conditions.
- Returns an array of detections, each with: event reference(s), matched signature id/category, computed severity, and the specific evidence fields that triggered the match.
- Must correctly produce zero detections for benign events — write this as a testable, pure function.

### Step 4 — Correlation engine
Create `/lib/correlate.js` exporting `correlateDetections(detections)`:
- Groups detections that share a source IP, target host, or user account within a rolling time window (e.g. 15–30 minutes) into a single incident.
- Escalates severity when a correlated incident spans multiple attack-chain stages (e.g. a scan followed by a successful login from the same IP is higher severity than either alone).
- Detections that don't correlate with anything else remain standalone incidents.
- Output shape matches the `Incident` object defined in `DATA_SCHEMA.md`.

### Step 5 — API route with LLM narration + fallback
Create `/app/api/incidents/route.js`:
- On GET, run the pipeline (Steps 3–4) over the dataset, then for each incident call the LLM once to generate a short narrative explanation and a recommended response, using the incident's category, severity, and evidence as context.
- Wrap the LLM call in a try/catch. On failure, construct the narrative and response from a template using the signature's mechanism description and severity tier — never let the route fail just because the LLM call failed.
- Return the full list of incidents as JSON.

### Step 6 — Dashboard UI
Build `/app/page.jsx`:
- **Live queue panel** — open incidents sorted by severity, each showing category, severity, source, matched event count, and status (New / Investigating / Contained / Resolved), with a way to change status.
- **Incident detail view** — clicking an incident expands the evidence trail (exact matched events/fields), the narrative explanation, and the recommended response.
- **Historical view** — resolved incidents, filterable by category/severity, with a simple volume-over-time visualization.
- **Stats bar** — total events processed, active incident count, count by severity tier.
Follow `UI_UX_SPEC.md` for visual treatment.

### Step 7 — Deployment
- Confirm `next build` completes cleanly.
- Add `GROQ_API_KEY` (and `GEMINI_API_KEY` if used as fallback) as environment variables in the Vercel dashboard — never hardcode or expose client-side.
- Deploy via Vercel's native Next.js integration.
- Confirm the deployed URL correctly displays incidents end-to-end, including at least one incident where the LLM fallback path can be manually verified (e.g. by temporarily using an invalid API key).

## Definition of done
- [ ] `/data/events.json` has multiple event types including benign events
- [ ] `/data/signatures.json` has 10–15 signatures across categories
- [ ] `detectEvents()` correctly flags known-bad events and ignores benign ones
- [ ] `correlateDetections()` correctly groups related detections into one incident and escalates severity on chained detections
- [ ] `/app/api/incidents/route.js` returns narrated incidents with a working non-LLM fallback
- [ ] Dashboard shows live queue, incident detail with evidence, historical view, and stats bar
- [ ] Deployed and reachable via a public Vercel URL

## Constraints
- No paid APIs — free tier only.
- No real security/user data — dataset must be synthetic.
- Keep the deterministic engine (Steps 3–4) fully independent of the LLM layer so it can be tested and demoed without any network dependency.
