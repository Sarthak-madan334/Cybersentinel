import seedEvents from "@/data/events.json";

const store = globalThis.__cyberSentinelStore || {
  ingestedEvents: [],
  incidentStatuses: new Map()
};

globalThis.__cyberSentinelStore = store;

export function allEvents() {
  return [...seedEvents, ...store.ingestedEvents];
}

export function ingestEvent(event) {
  store.ingestedEvents.push(event);
  return event;
}

export function getIncidentStatus(id) {
  return store.incidentStatuses.get(id);
}

export function setIncidentStatus(id, status) {
  store.incidentStatuses.set(id, { status, resolved_at: status === "Resolved" ? new Date().toISOString() : null });
  return store.incidentStatuses.get(id);
}
