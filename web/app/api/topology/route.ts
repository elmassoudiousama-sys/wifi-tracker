import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, readState, writeState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const body = await req.json();
  const state = await readState();

  if (body.reset) {
    state.topology = {};
    state.canvas = { positions: {}, switches: [], edges: [] };
    await writeState(state);
    return NextResponse.json({ ok: true, state });
  }

  if (body.canvas) {
    state.canvas = {
      positions: body.canvas.positions || {},
      switches: body.canvas.switches || [],
      edges: body.canvas.edges || [],
    };
    await writeState(state);
    return NextResponse.json({ ok: true, state });
  }

  const mac = String(body.mac || "").trim().toUpperCase();
  if (!mac) {
    return NextResponse.json({ error: "MAC is required" }, { status: 400 });
  }

  state.topology = state.topology || {};
  state.topology[mac] = {
    ...(body.portOverride ? { portOverride: String(body.portOverride) } : {}),
    ...(body.parentMac ? { parentMac: String(body.parentMac).toUpperCase() } : {}),
  };

  await writeState(state);
  return NextResponse.json({ ok: true, state });
}
