import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(auth.body, {
      status: auth.status,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }
  const state = await readState();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
