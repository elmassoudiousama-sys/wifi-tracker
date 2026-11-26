import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedAdmin, readState, writeState } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const mac = String(body.mac || "").trim().toUpperCase();
  if (!mac) {
    return NextResponse.json({ error: "MAC is required" }, { status: 400 });
  }

  const state = await readState();
  state.deviceMeta = state.deviceMeta || {};
  state.addedDevices = state.addedDevices || [];

  const prevMeta = state.deviceMeta[mac] || {};
  const nextMeta = {
    ...prevMeta,
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.group !== undefined ? { group: String(body.group).trim() } : {}),
    ...(body.paymentStatus !== undefined ? { paymentStatus: body.paymentStatus } : {}),
    ...(body.note !== undefined ? { note: String(body.note).trim() } : {}),
    ...(body.category !== undefined ? { category: String(body.category).trim() } : {}),
    ...(body.catName !== undefined ? { catName: String(body.catName).trim() } : {}),
    ...(body.catIcon !== undefined ? { catIcon: String(body.catIcon).trim() } : {}),
    removed: false,
  };
  state.deviceMeta[mac] = nextMeta;

  if (body.isNew) {
    const existsInAdded = state.addedDevices.some((d) => d.mac.toUpperCase() === mac);
    const entry = {
      name: nextMeta.name || body.name || "New Device",
      ip: String(body.ip || ""),
      mac,
      group: nextMeta.group || nextMeta.name || "Other",
    };
    if (!existsInAdded) {
      state.addedDevices.push(entry);
    }
    const existsInDevices = state.devices.some((d) => d.mac.toUpperCase() === mac);
    if (!existsInDevices) {
      state.devices.push({
        name: entry.name,
        group: entry.group,
        expectedIp: entry.ip,
        ip: entry.ip,
        mac,
        online: true,
        medium: body.medium || "LAN",
        port: body.port || "-",
        blocked: false,
        note: nextMeta.note || "",
        category: nextMeta.category || body.category || "device",
        catName: nextMeta.catName || body.catName || "جهاز شبكي",
        catIcon: nextMeta.catIcon || body.catIcon || "🔌",
      });
      state.unknownDevices = state.unknownDevices.filter((u) => u.mac.toUpperCase() !== mac);
      state.totalKnown = state.devices.length;
      state.onlineCount = state.devices.filter((d) => d.online).length;
      state.unknownCount = state.unknownDevices.length;
    }
  } else {
    state.devices = state.devices.map((d) =>
      d.mac.toUpperCase() === mac
        ? {
            ...d,
            name: nextMeta.name || d.name,
            group: nextMeta.group || d.group,
            note: nextMeta.note ?? d.note,
            category: nextMeta.category || d.category,
            catName: nextMeta.catName || d.catName,
            catIcon: nextMeta.catIcon || d.catIcon,
          }
        : d
    );
  }

  state.devicesDirty = true;
  await writeState(state);
  return NextResponse.json({ ok: true, state });
}

export async function DELETE(req: NextRequest) {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const mac = String(body.mac || "").trim().toUpperCase();
  if (!mac) {
    return NextResponse.json({ error: "MAC is required" }, { status: 400 });
  }

  const state = await readState();
  state.deviceMeta = state.deviceMeta || {};
  state.deviceMeta[mac] = { ...(state.deviceMeta[mac] || {}), removed: true };
  state.addedDevices = (state.addedDevices || []).filter((d) => d.mac.toUpperCase() !== mac);
  state.devices = state.devices.filter((d) => d.mac.toUpperCase() !== mac);
  state.totalKnown = state.devices.length;
  state.onlineCount = state.devices.filter((d) => d.online).length;
  state.devicesDirty = true;
  await writeState(state);
  return NextResponse.json({ ok: true, state });
}
