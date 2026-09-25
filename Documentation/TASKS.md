# TASKS.md
> A checklist of individually-promptable tasks for an AI coding assistant. Feed these ONE AT A TIME, in order, and verify each before moving to the next.
> Project: **CyberSentinel**. Stack: Next.js (App Router) + Tailwind CSS, deployed on Vercel.

---

### TASK 0
"Scaffold a new Next.js project named 'cybersentinel' using the App Router and Tailwind CSS. Set up the folder structure: /app/page.jsx as the main dashboard, /app/api/incidents/route.js as the API route, /lib/ for detection and correlation logic, /data/ for the event dataset and signature library. Confirm it runs with `next dev`."

### TASK 1
"Create /data/events.json with 60-100 synthetic security events across five types: authentication, network/firewall, DNS, process execution, and file access. Use the field structure defined in DATA_SCHEMA.md. Include a realistic mix: some clearly malicious patterns (repeated failed logins from one IP, port scans, off-hours access, connections to known-bad IPs, suspicious process launches), and a meaningful number of entirely benign events so the detection engine has true negatives to correctly ignore."

### TASK 2
"Create /data/signatures.json with 10-15 detection signatures, each with an id, threat category, matching conditions against the event fields, a base severity weight, and a short mechanism description. Cover categories: Brute Force, Port Scan, Privilege Escalation, Data Exfiltration Attempt, Suspicious Login Geography/Time, C2 Beaconing Pattern, and Malware Execution Pattern."

### TASK 3
"Create /lib/detect.js exporting a function detectEvents(events, signatures) that evaluates every event against every signature's matching conditions and returns an array of detections, each including the matched event(s), signature id/category, computed severity, and the specific evidence fields that triggered the match. Write unit tests confirming it correctly flags at least 5 different malicious patterns and produces zero detections for benign events."

### TASK 4
"Create /lib/correlate.js exporting a function correlateDetections(detections) that groups detections sharing a source IP, target host, or user account within a 15-30 minute rolling window into a single incident, escalating severity when an incident spans multiple attack-chain stages (e.g. recon followed by successful access from the same source). Detections that don't correlate with anything remain standalone incidents. Match the Incident object shape from DATA_SCHEMA.md. Write unit tests confirming correct grouping and severity escalation behavior."

### TASK 5
"Create a Next.js API route at /app/api/incidents/route.js with a GET handler that runs detectEvents() then correlateDetections() over /data/events.json and /data/signatures.json, then for each resulting incident calls the Groq API (using GROQ_API_KEY from environment variables) to generate a short narrative explanation and a recommended defensive response based on the incident's category, severity, and evidence. Wrap the LLM call in try/catch: on failure, construct the narrative and response from a template using the signature's mechanism description and severity tier instead of failing the request. Return the full incident list as JSON via NextResponse.json()."

### TASK 6
"Build the main dashboard at /app/page.jsx using React and Tailwind CSS, following UI_UX_SPEC.md. Include: a live queue panel listing open incidents sorted by severity with category, severity, source, matched event count, and an editable status (New/Investigating/Contained/Resolved); an incident detail view (expandable or a side panel) showing the evidence trail, narrative explanation, and recommended response; a historical view of resolved incidents filterable by category/severity with a simple volume-over-time chart; and a stats bar showing total events processed, active incident count, and severity breakdown."

### TASK 7
"Prepare this Next.js project for Vercel deployment: confirm `next build` completes with no errors, confirm /app/api/incidents is correctly recognized as a serverless function, and list the environment variables needed in the Vercel dashboard (GROQ_API_KEY, and GEMINI_API_KEY if used as fallback). Do not hardcode any API keys anywhere in the codebase."

---

## Verification prompts (run after each task)
- After Task 0: "Run `next dev` and confirm the app loads with no errors."
- After Task 3: "Run the unit tests for detect.js and show me the results, including at least one benign event correctly producing no detection."
- After Task 4: "Run the unit tests for correlate.js and show me a case where two detections correctly merge into one incident with escalated severity."
- After Task 5: "Send a test GET request to /api/incidents and show me the raw JSON response, including one incident's narrative and recommended response."
- After Task 6: "Confirm the dashboard renders the live queue, incident detail, historical view, and stats bar — describe what you tested."
- After Task 7: "Run `next build`, confirm it completes cleanly, then confirm the deployed Vercel URL returns real incident data end-to-end."
