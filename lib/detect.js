const compare = (actual, operator, expected) => {
  if (operator === "equals") return actual === expected;
  if (operator === "includes") return String(actual || "").toLowerCase().includes(String(expected).toLowerCase());
  if (operator === ">=") return Number(actual) >= Number(expected);
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  return false;
};

export function severityTier(score) {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

export function detectEvents(events, signatures) {
  const detections = [];
  for (const event of events) for (const signature of signatures) {
    if (event.event_type !== signature.applies_to) continue;
    const conditions = Array.isArray(signature.condition) ? signature.condition : [signature.condition];
    if (!conditions.every(({ field, operator, value }) => compare(event[field], operator, value))) continue;
    const evidence = conditions.map(({ field, value }) => ({ event_id:event.id, field, value:event[field], expected:value }));
    detections.push({ detection_id:`det_${detections.length + 1}`, signature_id:signature.id, category:signature.category,
      severity:signature.base_severity, severity_tier:severityTier(signature.base_severity), mechanism_description:signature.mechanism_description,
      matched_event_ids:[event.id], source_ip:event.source_ip, host:event.host, user:event.user, timestamp:event.timestamp, evidence, event });
  }
  return detections;
}
