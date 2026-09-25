# AI_USAGE_NOTE.md
> Required submission document: tools used, tasks delegated to AI, and important changes/decisions made by the participant. Edit this template to reflect what was actually done.

## AI tools used
- Claude / Codex / Cursor (or whichever coding assistant was used) — for scaffolding, code generation, and debugging assistance throughout the build.
- Groq API (`llama-3.1-8b-instant`) — used at runtime by the deployed application itself to generate incident narrative explanations and recommended responses (not a development tool, but part of the product).

## Major tasks delegated to AI
- Initial project scaffolding (Next.js App Router structure, Tailwind configuration).
- Boilerplate for the API route handler and basic fetch/state logic in the dashboard component.
- First draft of the synthetic event dataset and signature library entries, generated from a specification of required event types and threat categories.
- Tailwind styling implementation based on a written design specification (see `UI_UX_SPEC.md`).
- Drafting of unit tests for `detectEvents()` and `correlateDetections()`.
- Runtime narrative/response generation inside the deployed app (the LLM call itself is a product feature, described in `ARCHITECTURE.md`).

## Important decisions and changes made by the participant
- Chose the core architectural principle that detection, classification, severity scoring, and correlation must be deterministic code, with the LLM restricted to narration only — this decision shapes the entire system and was not something delegated to AI.
- Set the specific severity weights and thresholds in `signatures.json` (e.g. the failed-login-attempt threshold for brute force, the correlation time window) based on judgment about what produces believable, demonstrable results rather than accepting first-draft AI-suggested values unchanged.
- Reviewed and adjusted the AI-generated synthetic dataset to ensure a realistic mix of malicious and benign events, so the detection engine has genuine true negatives to correctly ignore, rather than an unrealistically all-malicious dataset.
- Verified the non-LLM fallback path actually triggers correctly on API failure (tested manually by temporarily invalidating the API key) rather than trusting the AI-generated try/catch block without confirmation.
- Made the final call on UI layout tradeoffs under time constraints — e.g., prioritizing the live queue and incident detail panel as must-haves and treating the historical chart as a feature to simplify first if time ran short.
- Take full responsibility for the correctness, security, and functionality of the submitted code, per the competition's stated requirement that participants remain responsible for the submitted work regardless of AI assistance.
