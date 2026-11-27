import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, readState, writeState } from "@/lib/store";

export async function DELETE(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const state = await readState();
  state.alerts = [];
  await writeState(state);
  return NextResponse.json({ ok: true });
}
