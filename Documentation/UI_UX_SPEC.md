# UI_UX_SPEC.md
> Design direction for CyberSentinel, written for an AI coding assistant to implement directly in the Next.js + Tailwind build. Follow this exactly rather than defaulting to generic component patterns.

## Feeling to aim for
Calm authority. The person using this is a security analyst under time pressure — the interface should feel like a control room, not a marketing page: quiet, dense with real information, nothing decorative. Every element earns its place by conveying a fact (severity, evidence, status), not by looking impressive.

## Color
Keep the base palette almost entirely neutral. Reserve color intensity exclusively for severity — it should be the one thing in the interface that visually jumps, because that's the one thing that matters most at a glance.

- `--bg`: `#0F1113` — near-black, not pure black, dashboard-style dark base
- `--surface`: `#181B1E` — panel/card background, one step lighter than bg
- `--surface-raised`: `#202427` — hover/active panel state
- `--ink`: `#E7E9EA` — primary text
- `--ink-muted`: `#8A9199` — secondary text, timestamps, labels
- `--line`: `#2A2F33` — hairline borders and dividers
- `--sev-critical`: `#E5484D`
- `--sev-high`: `#F5A524`
- `--sev-medium`: `#F5D90A`
- `--sev-low`: `#3DD68C`
- `--sev-info`: `#5B8DEF` (used sparingly, only for informational/status states, never as a decorative accent)

Do not use purple/violet/indigo anywhere. Do not use gradients. Severity colors appear only on severity badges, the severity bar in the detail view, and small status dots — never as large background fills or decorative page elements.

## Typography
Single sans-serif family throughout: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Helvetica Neue", sans-serif`. No display/serif face. Differentiate hierarchy by weight and size only.

- Page title / section headers: 20–24px, weight 600
- Panel headers: 15px, weight 600, `--ink-muted` when secondary
- Body/table text: 14px, weight 400, line-height 1.5
- Monospace (for IPs, hashes, log field values only): `ui-monospace, "SF Mono", Menlo, monospace`, 13px — reserve monospace strictly for literal technical values, never for labels or headings

Sentence case everywhere. No tracked-out uppercase labels, no eyebrow text above headers.

## Layout
A three-zone dashboard, not a single scrolling page:

```
┌───────────────────────────────────────────────────────────┐
│  CyberSentinel        Events: 84   Active: 6   Crit: 1     │  ← stats bar, top
├───────────────────┬───────────────────────────────────────┤
│  LIVE QUEUE        │   INCIDENT DETAIL                     │
│  ─────────────     │   ───────────────                     │
│  ● Critical  IP..  │   Category / Severity                 │
│  ● High      IP..  │   Evidence trail (matched events)     │
│  ● Medium    IP..  │   Narrative explanation                │
│  ○ Low       IP..  │   Recommended response                │
│  [ Historical ▾ ]  │   Status: [New ▾]                      │
└───────────────────┴───────────────────────────────────────┘
```

Left column: fixed-width incident list (queue), sorted by severity descending, with a toggle to switch between "Live" and "Historical." Right column: detail panel for the selected incident, empty-state prompt when nothing is selected ("Select an incident to view details"). Stats bar spans the full width at the top, thin and unobtrusive — numbers only, no icons needed.

## Components

**Severity badge**
A small filled pill or dot + label using the exact `--sev-*` color for that tier, never a generic gray badge with colored text only — severity should be identifiable by color alone at a glance, with text as the accessible backup.

**Incident row (queue)**
Single line: severity dot, category name, source identifier (IP/host/account, monospace), matched event count, relative timestamp. 1px `--line` bottom border between rows, no card treatment, no shadow — this is a list, not a grid of cards. Selected row gets a `--surface-raised` background, not a colored highlight.

**Evidence trail**
A compact table or stacked list of the exact matched log fields — timestamp, field, value — using monospace for values. This is the "proof," so it should look like raw, credible data, not a stylized summary.

**Narrative + recommendation**
Plain body text in `--ink`, no card border needed since it's already inside the detail panel — treat it as prose, not another nested box. Keep nesting shallow: panel → content, not panel → card → subcard.

**Status control**
A simple select/dropdown or small segmented control for New / Investigating / Contained / Resolved — changing it should give immediate visual feedback (the row's dot or label updates) without a page reload.

**Historical view**
A simple volume-over-time chart — a plain bar or line chart (using whatever charting is already available in the stack, no need to add a heavy library) showing incident counts per day/hour, colored by severity if it adds clarity, otherwise a single neutral color with a filter dropdown by category/severity above it.

**Loading state**
No spinner icon. A thin 2px indeterminate progress line at the very top of the viewport while incidents are fetching. Avoid skeleton-loading card shapes.

## Motion
Minimal. Selecting an incident should swap the detail panel content with a quick fade (150–200ms), not a slide or bounce. Status changes update instantly with no animation beyond the color/label change itself. No hover-lift effects, no staggered entrance animations on the queue list.

## What to avoid
- Rounded "SaaS card" grids with identical soft shadows
- Purple/violet accents or gradient backgrounds
- Tracked-out uppercase eyebrow labels
- Icon libraries used to fill empty space rather than convey information
- Multiple competing accent colors — severity colors are reserved exclusively for severity indicators
- Deep visual nesting (cards inside cards inside panels)

## Responsive behavior
Below a certain width, stack the two columns vertically (queue on top as a collapsible list, detail panel below) rather than trying to preserve the side-by-side layout at small sizes. Maintain visible keyboard focus states on all interactive elements (queue rows, status dropdown, filters) at every viewport size.
