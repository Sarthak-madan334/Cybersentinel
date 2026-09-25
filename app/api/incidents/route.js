import { NextResponse } from "next/server";
import signatures from "@/data/signatures.json";
import { detectEvents } from "@/lib/detect";
import { correlateDetections } from "@/lib/correlate";
import { allEvents, getIncidentStatus } from "@/lib/runtime-store";

const responseByTier = {
  Critical:"Immediately contain the affected host or account, block the source, preserve evidence, and begin incident response.",
  High:"Contain the affected asset, rotate affected credentials, and review related endpoint and network logs.",
  Medium:"Validate the activity with the asset owner, increase monitoring, and block the indicator if it is not expected.",
  Low:"Review the alert in normal triage and retain the evidence for correlation with future activity."
};

function fallback(incident) {
  const evidence = incident.evidence.slice(0, 2).map(item => `${item.field}=${item.value}`).join(", ");
  return { narrative:`${incident.category} was detected on ${incident.host || "an affected asset"} from ${incident.source_ip || "an identified source"}. Evidence includes ${evidence}. ${incident.mechanism_descriptions[0]}`, recommended_response:responseByTier[incident.severity_tier] };
}

async function narrate(incident) {
  const fallbackCopy = fallback(incident);
  if (!process.env.GROQ_API_KEY) return fallbackCopy;
  try {
    const prompt = `Write two concise sentences for a SOC analyst. Do not make security decisions. Incident: ${JSON.stringify({category:incident.category,severity:incident.severity_tier,evidence:incident.evidence})}`;
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { method:"POST", headers:{ Authorization:`Bearer ${process.env.GROQ_API_KEY}`, "Content-Type":"application/json" }, body:JSON.stringify({ model:"llama-3.1-8b-instant", messages:[{role:"user",content:prompt}], temperature:0.2, max_tokens:180 }), signal:AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Groq request failed");
    const body = await response.json();
    return { narrative:body.choices?.[0]?.message?.content?.trim() || fallbackCopy.narrative, recommended_response:fallbackCopy.recommended_response };
  } catch { return fallbackCopy; }
}

export async function GET() {
  const events = allEvents();
  const detections = detectEvents(events, signatures);
  const baseIncidents = correlateDetections(detections);
  const incidents = await Promise.all(baseIncidents.map(async incident => {
    const saved = getIncidentStatus(incident.incident_id);
    return { ...incident, ...saved, ...(await narrate(incident)) };
  }));
  return NextResponse.json({ events_processed:events.length, detections: detections.length, incidents });
}
