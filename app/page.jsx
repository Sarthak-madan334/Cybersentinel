"use client";
import { useEffect, useMemo, useState } from "react";

const rank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
const colour = { Critical: "#E5484D", High: "#F5A524", Medium: "#F5D90A", Low: "#3DD68C" };
const statuses = ["New", "Investigating", "Contained", "Resolved"];
const categoryOptions = [
  "All",
  "Brute Force",
  "Port Scan",
  "C2 Beaconing Pattern",
  "Data Exfiltration Attempt",
  "Privilege Escalation",
  "Malware Execution Pattern",
];

function Severity({ tier }) {
  return (
    <span className="severity-pill">
      <i style={{ background: colour[tier] || "#5B8DEF" }} />
      {tier}
    </span>
  );
}

function formatTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("Live");
  const [category, setCategory] = useState("All");
  const [severity, setSeverity] = useState("All");

  const loadIncidents = async (keepSelection = false) => {
    const result = await fetch("/api/incidents").then((r) => r.json());
    setData(result);
    setSelected((current) => {
      if (keepSelection && current) {
        return result.incidents.find((item) => item.incident_id === current.incident_id) || null;
      }
      return null;
    });
  };

  useEffect(() => {
    loadIncidents().catch(() => setData({ incidents: [], events_processed: 0 }));
  }, []);

  const incidents = useMemo(() => {
    return (data?.incidents || [])
      .filter((item) => {
        const matchesView = view === "Live" ? item.status !== "Resolved" : item.status === "Resolved";
        const matchesCategory = category === "All" || item.category.includes(category);
        const matchesSeverity = severity === "All" || item.severity_tier === severity;
        return matchesView && matchesCategory && matchesSeverity;
      })
      .sort((a, b) => rank[b.severity_tier] - rank[a.severity_tier]);
  }, [data, view, category, severity]);

  const active = (data?.incidents || []).filter((item) => item.status !== "Resolved");
  const highRiskIncidents = active.filter((item) => item.severity_tier === "Critical" || item.severity_tier === "High");
  const affectedHosts = new Set(highRiskIncidents.map((item) => item.host).filter(Boolean));
  const totals = useMemo(() => {
    const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    for (const item of active) {
      if (severityCounts[item.severity_tier] !== undefined) {
        severityCounts[item.severity_tier] += 1;
      }
    }
    return severityCounts;
  }, [active]);

  const updateStatus = async (status) => {
    if (!selected) return;
    const response = await fetch(`/api/incidents/${selected.incident_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) return;
    const update = await response.json();
    const changed = { ...selected, ...update };
    setSelected(changed);
    setData((old) => ({
      ...old,
      incidents: (old?.incidents || []).map((item) =>
        item.incident_id === changed.incident_id ? { ...item, ...update } : item,
      ),
    }));
  };

  return (
    <main className="dashboard-shell">
      {!data && <div className="progress" />}

      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-icon" aria-hidden="true">
            <span />
          </div>
          <h1>Sarthak&apos;s CyberSentinel</h1>
        </div>

        <div className="stats-strip">
          <div className="stat-box">
            <strong>{data?.events_processed ?? "—"}</strong>
            <span>Events</span>
          </div>
          <div className="stat-box">
            <strong>{active.length}</strong>
            <span>Active</span>
          </div>
          <div className="stat-box">
            <strong>{totals.Critical}</strong>
            <span>Critical</span>
          </div>
          <div className="stat-box risk-stat">
            <strong>{highRiskIncidents.length}</strong>
            <span>High risk</span>
          </div>
        </div>

        <div className="header-actions">
          <button className="refresh-button" onClick={() => loadIncidents(true)}>
            Refresh pipeline
          </button>
          <div className="avatar" aria-label="Sarthak's analyst profile">SM</div>
        </div>
      </header>

      <section className="hero-block">
        <h2>Security operations overview</h2>
        <p>Deterministic detections, evidence-backed incident correlation, and analyst response tracking.</p>
      </section>

      {highRiskIncidents.length > 0 && (
        <section className="risk-banner" aria-label="High-risk vulnerabilities requiring attention">
          <div className="risk-marker" aria-hidden="true">!</div>
          <div>
            <strong>Vulnerabilities requiring attention</strong>
            <p>{highRiskIncidents.length} high-risk incident{highRiskIncidents.length === 1 ? "" : "s"} across {affectedHosts.size} affected host{affectedHosts.size === 1 ? "" : "s"}. Review Critical and High findings first.</p>
          </div>
          <button onClick={() => { setView("Live"); setSeverity("Critical"); }}>View Critical</button>
        </section>
      )}

      <section className="queue-panel">
        <div className="section-header">
          <h3>Live queue</h3>
          <label className="select-wrap">
            <select value={view} onChange={(e) => setView(e.target.value)}>
              <option value="Live">Live</option>
              <option value="Historical">Historical</option>
            </select>
          </label>
        </div>

        {view === "Historical" && (
          <div className="filter-row">
            <label className="select-wrap small">
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {categoryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-wrap small">
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="All">All severities</option>
                {Object.keys(rank).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="content-grid">
          <div className="queue-list">
            {incidents.length ? (
              incidents.map((item) => (
                <button
                  key={item.incident_id}
                  className={`incident-row ${selected?.incident_id === item.incident_id ? "selected" : ""}`}
                  onClick={() => setSelected(item)}
                >
                  <div className="row-main">
                    <div className="row-meta">
                      <Severity tier={item.severity_tier} />
                      <span className="source">{item.source_ip || item.host}</span>
                    </div>
                    <span className="time-stamp">{new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p>{item.category}</p>
                </button>
              ))
            ) : (
              <div className="empty-state">No incidents match these filters.</div>
            )}
          </div>

          {selected && (
            <aside className="detail-panel">
              <div className="detail-header">
                <div className="detail-title">
                  <Severity tier={selected.severity_tier} />
                  <h4>{selected.category}</h4>
                </div>

                <label className="status-field">
                  <span>Status</span>
                  <select value={selected.status} onChange={(e) => updateStatus(e.target.value)}>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="detail-meta">
                <code>{selected.source_ip || "unknown source"}</code>
                <span>·</span>
                <span>{selected.host || "unknown host"}</span>
                <span>·</span>
                <span>{selected.user || "No account"}</span>
              </div>

              <div className="severity-bar">
                <span
                  className="severity-fill"
                  style={{ width: `${Math.min(selected.severity, 100)}%`, background: colour[selected.severity_tier] || "#5B8DEF" }}
                />
              </div>

              <section className="detail-section">
                <div className="section-label">Evidence trail</div>
                <div className="evidence-list">
                  {selected.evidence.map((entry, index) => {
                    const event = selected.matched_events.find((item) => item.id === entry.event_id);
                    return (
                      <div className="evidence-row" key={`${entry.event_id}-${entry.field}-${index}`}>
                        <time>{formatTime(event?.timestamp)}</time>
                        <span>{entry.field}</span>
                        <code>{String(entry.value)}</code>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="detail-section">
                <div className="section-label">Analyst narrative</div>
                <p>{selected.narrative}</p>
              </section>

              <section className="detail-section">
                <div className="section-label">Recommended response</div>
                <p>{selected.recommended_response}</p>
              </section>
            </aside>
          )}
        </div>
      </section>

      <style jsx>{`
        :global(html) {
          color-scheme: dark;
        }

        :global(body) {
          margin: 0;
          background: #0f1113;
          color: #e7e9ea;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Helvetica Neue", sans-serif;
        }

        * {
          box-sizing: border-box;
        }

        button,
        select {
          font: inherit;
        }

        button:focus-visible,
        select:focus-visible {
          outline: 2px solid #5b8def;
          outline-offset: 2px;
        }

        .dashboard-shell {
          min-height: 100vh;
          background: #0f1113;
          color: #e7e9ea;
          padding: 0 20px 28px;
        }

        .topbar {
          display: grid;
          grid-template-columns: 1fr auto auto;
          align-items: center;
          gap: 20px;
          width: min(1280px, 100%);
          margin: 0 auto;
          min-height: 86px;
          padding: 18px 0;
          border-bottom: 1px solid #23272c;
        }

        .brand-wrap {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          justify-self: start;
        }

        .brand-icon {
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: linear-gradient(135deg, #ff7a7a, #d73859);
          display: grid;
          place-items: center;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
        }

        .brand-icon span {
          display: block;
          width: 11px;
          height: 11px;
          border: 2px solid rgba(255,255,255,0.9);
          border-radius: 50%;
          position: relative;
        }

        .brand-icon span::before {
          content: "";
          position: absolute;
          inset: -4px;
          border: 2px solid rgba(255,255,255,0.8);
          border-radius: 50%;
        }

        h1,
        h2,
        h3,
        h4,
        p,
        strong,
        span,
        code,
        time,
        small {
          margin: 0;
        }

        h1 {
          font-size: clamp(1.8rem, 3vw, 3rem);
          font-weight: 700;
          letter-spacing: -0.06em;
          color: #edf1f4;
        }

        .stats-strip {
          display: flex;
          align-items: center;
          justify-self: center;
          gap: 16px;
          padding: 0 4px;
        }

        .stat-box {
          min-width: 88px;
          display: grid;
          gap: 2px;
          text-align: center;
        }

        .stat-box strong {
          font-size: clamp(1.9rem, 3vw, 2.5rem);
          font-weight: 700;
          color: #edf1f4;
          letter-spacing: -0.05em;
          line-height: 1;
        }

        .stat-box span {
          font-size: 12px;
          color: #8a9199;
          text-transform: none;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
          justify-self: end;
        }

        .refresh-button {
          border: 1px solid #2a2f33;
          background: #1a1d20;
          color: #edf1f4;
          border-radius: 12px;
          padding: 12px 18px;
          font-size: 15px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .refresh-button:hover {
          background: #202427;
        }

        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #202427;
          color: #edf1f4;
          border: 1px solid #2a2f33;
          display: grid;
          place-items: center;
          font-size: 12px;
          font-weight: 700;
        }

        .hero-block {
          width: min(1280px, 100%);
          margin: 0 auto;
          padding: 40px 0 28px;
        }

        .hero-block h2 {
          font-size: clamp(2.4rem, 4vw, 4.2rem);
          font-weight: 700;
          letter-spacing: -0.06em;
          margin-bottom: 10px;
        }

        .hero-block p {
          color: #9aa4ad;
          font-size: clamp(1.1rem, 2vw, 1.7rem);
          letter-spacing: -0.03em;
        }

        .risk-banner {
          width: min(1280px, 100%);
          margin: 0 auto 26px;
          padding: 15px 18px;
          display: flex;
          align-items: center;
          gap: 14px;
          border: 1px solid rgba(229, 72, 77, 0.65);
          border-left: 4px solid #e5484d;
          border-radius: 12px;
          background: rgba(229, 72, 77, 0.08);
        }

        .risk-marker {
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #e5484d;
          color: #fff;
          font-weight: 800;
        }

        .risk-banner strong { color: #ffd9da; font-size: 15px; }
        .risk-banner p { margin-top: 3px; color: #f0b9bb; font-size: 13px; }
        .risk-banner button { margin-left: auto; border: 1px solid rgba(229,72,77,0.8); border-radius: 8px; background: #e5484d; color: #fff; padding: 9px 12px; font-size: 13px; font-weight: 650; cursor: pointer; white-space: nowrap; }
        .risk-banner button:hover { background: #f05b60; }

        .queue-panel {
          width: min(1280px, 100%);
          margin: 0 auto;
          border-top: 1px solid #23272c;
          padding-top: 20px;
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 12px;
        }

        .section-header h3 {
          font-size: clamp(1.2rem, 2vw, 2rem);
          font-weight: 700;
          letter-spacing: -0.04em;
          color: #edf1f4;
        }

        .select-wrap {
          min-width: 120px;
        }

        select {
          width: 100%;
          border: 1px solid #2a2f33;
          background: #181b1e;
          color: #edf1f4;
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
        }

        .filter-row {
          display: flex;
          gap: 12px;
          margin-bottom: 18px;
        }

        .filter-row .select-wrap {
          min-width: 180px;
        }

        .content-grid {
          display: grid;
          grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
          gap: 18px;
          align-items: start;
        }

        .queue-list {
          border-top: 1px solid #23272c;
          background: rgba(17, 20, 22, 0.45);
          border-radius: 16px 16px 0 0;
          overflow: hidden;
        }

        .incident-row {
          width: 100%;
          display: block;
          background: transparent;
          border: 0;
          border-bottom: 1px solid #23272c;
          text-align: left;
          color: #edf1f4;
          padding: 16px 18px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .incident-row:hover,
        .incident-row.selected {
          background: rgba(255, 255, 255, 0.02);
        }

        .row-main {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 10px;
        }

        .row-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .source {
          color: #9aa4ad;
          font-size: 12px;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .time-stamp {
          color: #7c8a95;
          font-size: 12px;
          white-space: nowrap;
        }

        .incident-row p {
          font-size: 15px;
          line-height: 1.5;
          color: #edf1f4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .detail-panel {
          border: 1px solid #23272c;
          background: rgba(17, 20, 22, 0.45);
          border-radius: 16px;
          padding: 20px;
        }

        .detail-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 12px;
        }

        .detail-title {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .detail-title h4 {
          font-size: 1.1rem;
          letter-spacing: -0.03em;
          color: #edf1f4;
        }

        .status-field {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #9aa4ad;
        }

        .status-field select {
          min-width: 128px;
        }

        .detail-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          color: #9aa4ad;
          font-size: 12px;
        }

        .detail-meta code {
          color: #edf1f4;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
        }

        .severity-bar {
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 18px;
        }

        .severity-fill {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .detail-section {
          padding-top: 18px;
          border-top: 1px solid #23272c;
          margin-top: 18px;
        }

        .section-label {
          font-size: 12px;
          color: #9aa4ad;
          margin-bottom: 12px;
          text-transform: none;
        }

        .detail-section p {
          color: #edf1f4;
          line-height: 1.7;
          font-size: 14px;
        }

        .evidence-list {
          display: grid;
          gap: 10px;
        }

        .evidence-row {
          display: grid;
          grid-template-columns: 150px 140px minmax(0, 1fr);
          gap: 12px;
          align-items: center;
          background: rgba(255,255,255,0.02);
          border: 1px solid #23272c;
          border-radius: 10px;
          padding: 10px 12px;
        }

        .evidence-row time,
        .evidence-row span {
          color: #9aa4ad;
          font-size: 12px;
        }

        .evidence-row code {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          color: #edf1f4;
          font-size: 12px;
          overflow-wrap: anywhere;
        }

        .severity-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          width: fit-content;
          padding: 5px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.06);
          color: #edf1f4;
          font-size: 11px;
          font-weight: 600;
        }

        .severity-pill i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        .empty-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 120px;
          color: #9aa4ad;
          border: 1px dashed #2a2f33;
          border-radius: 12px;
          margin: 18px;
          background: rgba(255,255,255,0.01);
        }

        .progress {
          position: fixed;
          top: 0;
          left: 0;
          width: 30%;
          height: 2px;
          background: #5b8def;
          animation: pulse 1.2s ease-in-out infinite alternate;
          z-index: 50;
        }

        @keyframes pulse {
          from { opacity: 0.4; transform: translateX(0); }
          to { opacity: 1; transform: translateX(140%); }
        }

        @media (max-width: 980px) {
          .topbar {
            grid-template-columns: 1fr;
            justify-items: start;
          }

          .stats-strip,
          .header-actions {
            justify-self: start;
          }

          .content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-shell {
            padding: 0 14px 20px;
          }

          .stats-strip {
            flex-wrap: wrap;
            gap: 12px;
          }

          .header-actions {
            width: 100%;
            justify-content: space-between;
          }

          .refresh-button {
            flex: 1;
          }

          .evidence-row {
            grid-template-columns: 1fr;
          }

          .risk-banner { align-items: flex-start; }
          .risk-banner button { margin: 10px 0 0 -42px; align-self: flex-end; }
        }
      `}</style>
    </main>
  );
}
