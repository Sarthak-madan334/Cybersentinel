import { severityTier } from "./detect.js";

const WINDOW_MS = 30 * 60 * 1000;
const stageFor = (category) => ({ "Port Scan":"Reconnaissance", "Brute Force":"Credential Access", "Suspicious Login Geography/Time":"Initial Access", "Privilege Escalation":"Privilege Escalation", "Data Exfiltration Attempt":"Exfiltration", "C2 Beaconing Pattern":"Command and Control", "Malware Execution Pattern":"Execution" }[category] || "Detection");

export function correlateDetections(detections) {
  const sorted = [...detections].sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  const groups = [];
  for (const detection of sorted) {
    const when = new Date(detection.timestamp).getTime();
    const group = groups.find(g => when - new Date(g.last).getTime() <= WINDOW_MS && g.detections.some(d =>
      (d.source_ip && d.source_ip === detection.source_ip) || (d.host && d.host === detection.host) || (d.user && d.user === detection.user)));
    if (group) { group.detections.push(detection); group.last = detection.timestamp; } else groups.push({ detections:[detection], last:detection.timestamp });
  }
  return groups.map((group, index) => {
    const detectionsInGroup = group.detections;
    const stages = [...new Set(detectionsInGroup.map(d => stageFor(d.category)))];
    const maxSeverity = Math.max(...detectionsInGroup.map(d => d.severity));
    const severity = Math.min(100, maxSeverity + Math.max(0, stages.length - 1) * 12);
    const first = detectionsInGroup[0];
    const categories = [...new Set(detectionsInGroup.map(d => d.category))];
    return { incident_id:`inc_${String(index + 1).padStart(3,"0")}`, category:categories.join(" → "), severity, severity_tier:severityTier(severity),
      source_ip:first.source_ip, host:first.host, user:first.user, status:index % 5 === 4 ? "Resolved" : "New",
      detection_ids:detectionsInGroup.map(d => d.detection_id), matched_events:detectionsInGroup.map(d => d.event),
      evidence:detectionsInGroup.flatMap(d => d.evidence), mechanism_descriptions:[...new Set(detectionsInGroup.map(d => d.mechanism_description))],
      created_at:first.timestamp, resolved_at:index % 5 === 4 ? new Date(new Date(first.timestamp).getTime() + 3600000).toISOString() : null };
  });
}
