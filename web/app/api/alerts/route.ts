import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdmin, readState, writeState } from "@/lib/store";

export async function DELETE(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = await readState();
  state.alerts = [];
  await writeState(state);
  return NextResponse.json({ ok: true });
}
