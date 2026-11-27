import { NextRequest, NextResponse } from "next/server";
import { authorizeAdmin, readState, writeState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const auth = await authorizeAdmin(req);
  if (!auth.ok) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const body = await req.json();
  const { action, mac, name, instId, interface: iface, enable, isolation, hidden, mirrorSrc, mirrorDest } = body;
  const allowedActions = [
    "block",
    "unblock",
    "reboot_router",
    "run_diagnostics",
    "rescan_network",
    "wifi_acl_block",
    "wifi_acl_unblock",
    "auto_track_ban",
    "unban_identity",
    "set_ssid_config",
    "set_port_mirror",
  ];
  if (!allowedActions.includes(action)) {
    return NextResponse.json({ error: "Invalid command" }, { status: 400 });
  }

  const upperMac = String(mac || "").trim().toUpperCase();
  const state = await readState();
  state.commands = state.commands || [];

  const isUniqueName = (rawName: string) => {
    const clean = (rawName || "").trim();
    if (clean.length < 4) return false;
    const low = clean.toLowerCase();
    const generic = new Set([
      "unknown", "client", "wi-fi device", "wifi device", "wi-fi_device",
      "android", "iphone", "ipad", "macbook", "pc", "laptop", "desktop",
      "phone", "smartphone", "device", "xiaomi", "redmi", "samsung", "huawei",
      "oppo", "vivo", "realme", "poco", "oneplus", "zte", "tp-link", "tenda", "d-link",
    ]);
    if (generic.has(low)) return false;
    if (/^([0-9a-f]{2}[:\-]){5}[0-9a-f]{2}$/i.test(clean)) return false;
    return true;
  };

  const upsertBannedIdentity = (blockTypesToAdd: string[], ifaceName = "DEV.WIFI.AP1") => {
    state.bannedIdentities = state.bannedIdentities || [];
    const wifiMatch = (state.wifiClients || []).find((w) => w.mac.toUpperCase() === upperMac);
    const devMatch = (state.devices || []).find((d) => d.mac.toUpperCase() === upperMac);
    const unkMatch = (state.unknownDevices || []).find((u) => u.mac.toUpperCase() === upperMac);
    const stableIds =
      wifiMatch?.identity?.stableIds ||
      devMatch?.identity?.stableIds ||
      unkMatch?.identity?.stableIds ||
      [];
    const candidateHost =
      (wifiMatch?.hostname || devMatch?.hostname || unkMatch?.hostname || name || "").trim();
    const uniqueHostname = isUniqueName(candidateHost) ? candidateHost : "";
    const existing = state.bannedIdentities.find(
      (b) => b.sourceMac.toUpperCase() === upperMac || b.bannedMacs.some((m) => m.toUpperCase() === upperMac)
    );
    if (existing) {
      if (!existing.bannedMacs.some((m) => m.toUpperCase() === upperMac)) {
        existing.bannedMacs.push(upperMac);
      }
      for (const bt of blockTypesToAdd) {
        if (!existing.blockTypes.includes(bt)) existing.blockTypes.push(bt);
      }
      if (uniqueHostname && !existing.uniqueHostname) existing.uniqueHostname = uniqueHostname;
      if (stableIds.length > 0) {
        existing.stableIds = Array.from(new Set([...(existing.stableIds || []), ...stableIds]));
      }
      existing.autoProtected = Boolean(existing.uniqueHostname || (existing.stableIds && existing.stableIds.length > 0));
    } else {
      state.bannedIdentities.push({
        id: `ban-${upperMac.replace(/:/g, "").toLowerCase()}`,
        name: name || candidateHost || upperMac,
        sourceMac: upperMac,
        bannedMacs: [upperMac],
        blockTypes: [...blockTypesToAdd],
        interface: ifaceName,
        uniqueHostname,
        stableIds: [...stableIds],
        autoProtected: Boolean(uniqueHostname || stableIds.length > 0),
        createdAt: new Date().toISOString(),
        reblockCount: 0,
      });
    }
  };

  const removeBannedType = (blockType: string) => {
    if (!state.bannedIdentities) return;
    state.bannedIdentities = state.bannedIdentities
      .map((b) => {
        const matches =
          b.sourceMac.toUpperCase() === upperMac ||
          b.bannedMacs.some((m) => m.toUpperCase() === upperMac);
        if (!matches) return b;
        const remaining = (b.blockTypes || []).filter((bt) => bt !== blockType);
        return remaining.length > 0 ? { ...b, blockTypes: remaining } : null;
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  };

  if (action === "reboot_router" || action === "run_diagnostics" || action === "rescan_network") {
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: action === "reboot_router" ? "ROUTER" : action === "rescan_network" ? "ALL" : "WAN",
      name: action === "reboot_router" ? "ZTE F680" : action === "rescan_network" ? "Deep Rescan" : "Diagnostics",
      createdAt: new Date().toISOString(),
    });
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (action === "set_ssid_config") {
    if (!instId) {
      return NextResponse.json({ error: "Missing instId for SSID config" }, { status: 400 });
    }
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: String(instId),
      name: name || String(instId),
      instId: String(instId),
      enable,
      isolation,
      hidden,
      createdAt: new Date().toISOString(),
    });
    state.wlanSsids = (state.wlanSsids || []).map((s) =>
      s.instId === instId
        ? {
            ...s,
            enable: typeof enable === "boolean" ? enable : s.enable,
            isolation: typeof isolation === "boolean" ? isolation : s.isolation,
            hidden: typeof hidden === "boolean" ? hidden : s.hidden,
          }
        : s
    );
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (action === "set_port_mirror") {
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: "MIRROR",
      name: mirrorDest || "Port Mirror",
      enable: Boolean(enable),
      mirrorSrc: mirrorSrc || "IGD.WANALL",
      mirrorDest: mirrorDest || "",
      createdAt: new Date().toISOString(),
    });
    state.portMirror = {
      enable: Boolean(enable),
      src: mirrorSrc || "IGD.WANALL",
      dest: enable ? mirrorDest || "" : "",
    };
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (action === "auto_track_ban") {
    if (!mac) {
      return NextResponse.json({ error: "Missing MAC for auto track ban" }, { status: 400 });
    }
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: upperMac,
      name: name || "Wi-Fi Client",
      instId: instId || "",
      interface: iface || "DEV.WIFI.AP1",
      createdAt: new Date().toISOString(),
    });
    state.wlanAclRules = state.wlanAclRules || [];
    if (!state.wlanAclRules.some((r) => r.mac.toUpperCase() === upperMac)) {
      state.wlanAclRules.push({
        instId: instId || "pending",
        name: name || "Wi-Fi Client",
        mac: upperMac,
        interface: iface || "DEV.WIFI.AP1",
      });
    }
    state.blockedRules = state.blockedRules || [];
    if (!state.blockedRules.some((r) => r.mac.toUpperCase() === upperMac)) {
      state.blockedRules.push({
        instId: "pending",
        name: name || "Wi-Fi Client",
        mac: upperMac,
      });
    }
    state.wifiClients = (state.wifiClients || []).map((w) =>
      w.mac.toUpperCase() === upperMac ? { ...w, blocked: true } : w
    );
    upsertBannedIdentity(["wifi_acl", "firewall"], iface || "DEV.WIFI.AP1");
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (action === "wifi_acl_block" || action === "wifi_acl_unblock") {
    if (action === "wifi_acl_block" && !mac) {
      return NextResponse.json({ error: "Missing MAC for Wi-Fi ACL" }, { status: 400 });
    }
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: upperMac,
      name: name || "Wi-Fi Client",
      instId: instId || "",
      interface: iface || "DEV.WIFI.AP1",
      createdAt: new Date().toISOString(),
    });
    if (action === "wifi_acl_block") {
      state.wlanAclRules = state.wlanAclRules || [];
      if (!state.wlanAclRules.some((r) => r.mac.toUpperCase() === upperMac)) {
        state.wlanAclRules.push({
          instId: instId || "pending",
          name: name || "Wi-Fi Client",
          mac: upperMac,
          interface: iface || "DEV.WIFI.AP1",
        });
      }
      upsertBannedIdentity(["wifi_acl"], iface || "DEV.WIFI.AP1");
    } else {
      if (instId) {
        state.wlanAclRules = (state.wlanAclRules || []).filter((r) => r.instId !== instId);
      } else if (upperMac) {
        state.wlanAclRules = (state.wlanAclRules || []).filter((r) => r.mac.toUpperCase() !== upperMac);
      }
      removeBannedType("wifi_acl");
    }
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (action === "unban_identity") {
    state.commands.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      action,
      mac: upperMac,
      name: name || "Banned Identity",
      instId: instId || "",
      createdAt: new Date().toISOString(),
    });
    const removedIdentity = (state.bannedIdentities || []).find(
      (b) => b.id === instId || b.sourceMac.toUpperCase() === upperMac
    );
    const macsToClear = new Set<string>(
      [upperMac, ...(removedIdentity?.bannedMacs || [])].map((m) => m.toUpperCase()).filter(Boolean)
    );
    state.bannedIdentities = (state.bannedIdentities || []).filter(
      (b) => b.id !== instId && b.sourceMac.toUpperCase() !== upperMac
    );
    state.wlanAclRules = (state.wlanAclRules || []).filter(
      (r) => !macsToClear.has(r.mac.toUpperCase())
    );
    state.blockedRules = (state.blockedRules || []).filter(
      (r) => !macsToClear.has(r.mac.toUpperCase())
    );
    await writeState(state);
    return NextResponse.json({ ok: true, queued: state.commands.length, state });
  }

  if (!mac) {
    return NextResponse.json({ error: "Missing MAC for block/unblock" }, { status: 400 });
  }

  state.commands.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    mac: upperMac,
    name: name || "Client",
    instId: instId || "",
    createdAt: new Date().toISOString(),
  });

  // Optimistically persist blocked state so 8s status polls do not revert the UI
  const isBlk = action === "block";
  state.devices = (state.devices || []).map((d) =>
    d.mac.toUpperCase() === upperMac ? { ...d, blocked: isBlk } : d
  );
  state.wifiClients = (state.wifiClients || []).map((w) =>
    w.mac.toUpperCase() === upperMac ? { ...w, blocked: isBlk } : w
  );
  state.unknownDevices = (state.unknownDevices || []).map((u) =>
    u.mac.toUpperCase() === upperMac ? { ...u, blocked: isBlk } : u
  );
  if (isBlk) {
    state.blockedRules = state.blockedRules || [];
    if (!state.blockedRules.some((r) => r.mac.toUpperCase() === upperMac)) {
      state.blockedRules.push({
        instId: instId || "pending",
        name: name || "Client",
        mac: upperMac,
      });
    }
    upsertBannedIdentity(["firewall"]);
  } else {
    state.blockedRules = (state.blockedRules || []).filter(
      (r) => r.mac.toUpperCase() !== upperMac
    );
    removeBannedType("firewall");
  }

  await writeState(state);
  return NextResponse.json({ ok: true, queued: state.commands.length, state });
}
