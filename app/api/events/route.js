import { NextResponse } from "next/server";
import { ingestEvent } from "@/lib/runtime-store";

const required = ["id", "timestamp", "event_type", "source_ip", "host"];
const allowedTypes = new Set(["auth", "network", "dns", "process", "file"]);

export async function POST(request) {
  const event = await request.json().catch(() => null);
  if (!event || required.some(field => !event[field]) || !allowedTypes.has(event.event_type)) {
    return NextResponse.json({ error:"Event requires id, timestamp, event_type, source_ip, and host." }, { status:400 });
  }
  ingestEvent(event);
  return NextResponse.json({ accepted:true, event }, { status:201 });
}
