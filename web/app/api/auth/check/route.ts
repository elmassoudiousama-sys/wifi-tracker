import { NextRequest, NextResponse } from "next/server";
import { getAuthLockStatus } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const status = await getAuthLockStatus(req);
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
