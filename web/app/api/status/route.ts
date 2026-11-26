import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdmin, readState } from "@/lib/store";

export async function GET(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const state = await readState();
  return NextResponse.json(state);
}
