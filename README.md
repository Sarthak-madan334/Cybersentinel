# CyberSentinel

CyberSentinel is a security monitoring prototype that turns synthetic security events into deterministic, evidence-backed incidents for a SOC analyst.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## API

- `GET /api/incidents` runs deterministic detection and correlation, then returns narrated incidents. Groq narration uses `GROQ_API_KEY` when configured and falls back to a local template otherwise.
- `POST /api/events` accepts a valid `auth`, `network`, `dns`, `process`, or `file` event and adds it to the running prototype.
- `PATCH /api/incidents/:id` updates an incident to `New`, `Investigating`, `Contained`, or `Resolved` during the running session.

Detection, classification, severity scoring, and correlation are deterministic code. The LLM only writes the analyst narrative.

See [Documentation](./Documentation/) for the architecture, schema, and build specification.
