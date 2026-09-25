import { NextResponse } from "next/server";
import { setIncidentStatus } from "@/lib/runtime-store";

const validStatuses = new Set(["New", "Investigating", "Contained", "Resolved"]);

export async function PATCH(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!validStatuses.has(body.status)) return NextResponse.json({ error:"A valid incident status is required." }, { status:400 });
  const update = setIncidentStatus(id, body.status);
  return NextResponse.json({ incident_id:id, ...update });
}
