import { NextRequest, NextResponse } from "next/server";
import { mergeDevicesWithMeta, readState, writeState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const secret =
    process.env.AGENT_SECRET ||
    (process.env.NODE_ENV !== "production" ? "dev-secret" : "");
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const prev = await readState();
  const pendingCommands = prev.commands || [];
  const metaMap = prev.deviceMeta || {};

  const now = new Date().toISOString();
  const newAlerts = (body.alerts || []).map((a: Record<string, string>) => ({ ...a, at: now }));
  const mergedAlerts = [...newAlerts, ...(prev.alerts || [])].slice(0, 60);
  const mergedDevices = mergeDevicesWithMeta(body.devices || [], metaMap);

  const responsePayload: Record<string, unknown> = {
    ok: true,
    commands: pendingCommands,
  };

  if (prev.devicesDirty || Object.keys(metaMap).length > 0) {
    responsePayload.deviceMeta = metaMap;
    responsePayload.addedDevices = prev.addedDevices || [];
  }

  await writeState({
    ...prev,
    updatedAt: body.updatedAt || now,
    totalKnown: mergedDevices.length,
    onlineCount: mergedDevices.filter((d) => d.online).length,
    unknownCount: (body.unknownDevices || []).length,
    devices: mergedDevices,
    wifiClients: body.wifiClients || prev.wifiClients || [],
    unknownDevices: body.unknownDevices || [],
    blockedRules: body.blockedRules ?? [],
    wlanAclRules: body.wlanAclRules ?? prev.wlanAclRules ?? [],
    bannedIdentities: body.bannedIdentities ?? prev.bannedIdentities ?? [],
    wlanSsids: body.wlanSsids || prev.wlanSsids || [],
    dhcpLeases: body.dhcpLeases || prev.dhcpLeases || [],
    routerHealth: body.routerHealth || prev.routerHealth || undefined,
    portMirror: body.portMirror || prev.portMirror || undefined,
    lanPorts: body.lanPorts || prev.lanPorts || [],
    lanPortRates: body.lanPortRates || prev.lanPortRates || [],
    blackoutHistory: body.blackoutHistory || prev.blackoutHistory || [],
    rogueDhcp: body.rogueDhcp || prev.rogueDhcp || undefined,
    diagnostics: body.diagnostics || prev.diagnostics || undefined,
    correlationInsights: body.correlationInsights ?? prev.correlationInsights ?? [],
    alerts: mergedAlerts,
    commands: [],
    devicesDirty: false,
  });

  return NextResponse.json(responsePayload);
}
