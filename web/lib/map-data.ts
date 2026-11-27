import type { CorrelationInsight, LanPortRate, LanPortStat } from "@/lib/store";

export type MapNodeType = "wan" | "router" | "hub" | "switch" | "device";

export interface MapNode {
  id: string;
  name: string;
  type: MapNodeType;
  subType?: "router" | "phone" | "pc" | "camera" | "ap" | "custom";
  x: number;
  y: number;
  parentId?: string;
  portIndex?: number; // 1-based port index on switch
  // Telemetry & device properties
  ip?: string;
  mac?: string;
  cableQuality?: number;
  blocked?: boolean;
  vendor?: string;
  ports?: number; // for switches (e.g. 5, 8, 16, 24)
  uplinkHub?: string;
  uplinkColor?: string;
  selected?: boolean;
  online?: boolean;
  band?: string;
  ssidName?: string;
}

export interface MapCable {
  id: string;
  fromId: string;
  toId: string;
  color?: string;
  strokeWidth?: number;
  dashed?: boolean;
  label?: string;
  fromPortIndex?: number;
}

export interface AutoTopologyInput {
  routerModel?: string;
  routerIp?: string;
  cableDevices?: any[];
  unknownDevices?: any[];
  wifiClients?: any[];
  offlineCable?: any[];
  lanPorts?: LanPortStat[];
  lanPortRates?: LanPortRate[];
  correlationInsights?: CorrelationInsight[];
  hasActiveWifi?: boolean;
  serverCanvas?: {
    positions?: Record<string, { x: number; y: number }>;
    switches?: any[];
    edges?: any[];
  } | null;
  serverTopology?: Record<string, { portOverride?: string; parentMac?: string }> | null;
}

const SCHEMA_VERSION_KEY = "network-map-schema-version";
const SCHEMA_VERSION = "v2-auto";
const ROUTER_SIG_KEY = "network-map-router-sig";
const ROUTER_MACS_KEY = "network-map-router-macs";

const HUB_COLORS: Record<string, { color: string; textColor: string }> = {
  LAN1: { color: "#5B3DF5", textColor: "#FFFFFF" },
  LAN2: { color: "#FF7A45", textColor: "#14121F" },
  LAN3: { color: "#D7F25C", textColor: "#14121F" },
  LAN4: { color: "#14121F", textColor: "#FFFFFF" },
  LAN5: { color: "#0EA5E9", textColor: "#FFFFFF" },
  LAN6: { color: "#10B981", textColor: "#FFFFFF" },
  WIFI: { color: "#FFFFFF", textColor: "#5B3DF5" },
  OFFLINE: { color: "#FFFFFF", textColor: "#6B6880" },
};

export function getPortColor(portName: string): { color: string; textColor: string } {
  const upper = portName.toUpperCase();
  if (HUB_COLORS[upper]) return HUB_COLORS[upper];
  const palette = [
    { color: "#5B3DF5", textColor: "#FFFFFF" },
    { color: "#FF7A45", textColor: "#14121F" },
    { color: "#D7F25C", textColor: "#14121F" },
    { color: "#14121F", textColor: "#FFFFFF" },
    { color: "#0EA5E9", textColor: "#FFFFFF" },
  ];
  const num = Number.parseInt(upper.replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(num) && num >= 1) {
    return palette[(num - 1) % palette.length];
  }
  return palette[0];
}

export function loadSavedPositions(): Record<string, { x: number; y: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("network-map-positions");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePositionsBatch(entries: Array<{ id: string; x: number; y: number }>) {
  if (typeof window === "undefined") return;
  try {
    const current = loadSavedPositions();
    entries.forEach((e) => {
      current[e.id] = { x: e.x, y: e.y };
    });
    localStorage.setItem("network-map-positions", JSON.stringify(current));
  } catch {}
}

export function loadPortAssignments(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("network-map-port-assignments");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePortAssignment(mac: string, portIndex?: number) {
  if (typeof window === "undefined" || !mac) return;
  try {
    const current = loadPortAssignments();
    const upper = mac.toUpperCase();
    if (portIndex === undefined || portIndex === null || portIndex < 0) {
      delete current[upper];
    } else {
      current[upper] = portIndex;
    }
    localStorage.setItem("network-map-port-assignments", JSON.stringify(current));
  } catch {}
}

export function clearAutoLayoutOverrides() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("network-map-positions");
    const ports = loadPortAssignments();
    let changed = false;
    Object.keys(ports).forEach((k) => {
      if (ports[k] === 0) {
        delete ports[k];
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem("network-map-port-assignments", JSON.stringify(ports));
    }
  } catch {}
}

export function clearAllMapOverrides() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("network-map-positions");
    localStorage.removeItem("network-map-port-assignments");
    localStorage.removeItem("network-map-device-parents");
    localStorage.removeItem("network-map-custom-nodes");
    localStorage.removeItem("network-map-deleted-nodes");
    localStorage.removeItem("network-map-switch-meta");
    localStorage.removeItem("network-map-layout");
  } catch {}
}

export function loadDeviceParents(): Record<string, { parentId: string; portIndex?: number }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("network-map-device-parents");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDeviceParent(macOrId: string, parentId?: string, portIndex?: number) {
  if (typeof window === "undefined" || !macOrId) return;
  try {
    const current = loadDeviceParents();
    const upper = macOrId.toUpperCase();
    if (!parentId) {
      delete current[upper];
      delete current[macOrId];
    } else {
      current[upper] = { parentId, portIndex };
      current[macOrId] = { parentId, portIndex };
    }
    localStorage.setItem("network-map-device-parents", JSON.stringify(current));
  } catch {}
}

export function loadCustomNodes(): MapNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("network-map-custom-nodes");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomNode(node: MapNode) {
  if (typeof window === "undefined") return;
  try {
    const current = loadCustomNodes();
    const idx = current.findIndex((n) => n.id === node.id);
    if (idx >= 0) {
      current[idx] = node;
    } else {
      current.push(node);
    }
    localStorage.setItem("network-map-custom-nodes", JSON.stringify(current));
  } catch {}
}

export function removeCustomNode(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = loadCustomNodes().filter((n) => n.id !== id);
    localStorage.setItem("network-map-custom-nodes", JSON.stringify(current));
  } catch {}
}

export function loadDeletedNodeIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("network-map-deleted-nodes");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNodeDeleted(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = new Set(loadDeletedNodeIds());
    current.add(id);
    localStorage.setItem("network-map-deleted-nodes", JSON.stringify(Array.from(current)));
  } catch {}
}

export function clearDeletedNodes() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("network-map-deleted-nodes");
  } catch {}
}

export interface SwitchMetaOverride {
  name?: string;
  ports?: number;
  uplinkHub?: string;
  uplinkColor?: string;
}

export function loadSwitchMeta(): Record<string, SwitchMetaOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("network-map-switch-meta");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSwitchMeta(switchId: string, meta: SwitchMetaOverride) {
  if (typeof window === "undefined" || !switchId) return;
  try {
    const current = loadSwitchMeta();
    current[switchId] = { ...(current[switchId] || {}), ...meta };
    localStorage.setItem("network-map-switch-meta", JSON.stringify(current));
  } catch {}
}

export interface MapDevice {
  id: string;
  name: string;
  type: "router" | "phone" | "pc" | "camera";
  x: number;
  y: number;
  selected?: boolean;
  cableQuality?: number;
  customIcon?: string;
  portIndex?: number;
  ip?: string;
  mac?: string;
  blocked?: boolean;
  vendor?: string;
  parentId?: string;
}

export interface MapSwitch {
  id: string;
  name: string;
  x: number;
  y: number;
  ports: number;
  parentId?: string;
  portIndex?: number;
  uplinkHub: string;
  uplinkColor: string;
  selected?: boolean;
  devices: MapDevice[];
  moreCount?: number;
}

export interface HubNode {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  textColor: string;
  stroke?: string;
  deviceCount: number;
  mbps: number;
  mbpsLabel: string;
  lineDashed?: boolean;
  strokeWidth?: number;
}

export interface PaletteItem {
  id: string;
  name: string;
  sub: string;
  type: "switch" | "ap" | "router" | "camera" | "custom";
  ports?: number;
  iconType: "switch" | "ap" | "router" | "camera" | "custom";
}

export const INITIAL_PALETTE_ITEMS: PaletteItem[] = [
  { id: "sw-5", name: "Switch 5", sub: "5 منافذ", type: "switch", ports: 5, iconType: "switch" },
  { id: "sw-8", name: "Switch 8", sub: "8 منافذ", type: "switch", ports: 8, iconType: "switch" },
  { id: "sw-16", name: "Switch 16", sub: "16 منفذ", type: "switch", ports: 16, iconType: "switch" },
  { id: "ap-wifi", name: "Access Point", sub: "ويفي", type: "ap", iconType: "ap" },
  { id: "r-rep", name: "روتور", sub: "Router / Repeater", type: "router", iconType: "router" },
  { id: "cam-dvr", name: "كاميرا / DVR", sub: "مراقبة", type: "camera", iconType: "camera" },
];

export const INITIAL_HUBS: HubNode[] = [];
export const INITIAL_SWITCHES: MapSwitch[] = [];

function normPortName(port?: string): string {
  const clean = (port || "").trim().toUpperCase();
  const match = clean.match(/^LAN\s*(\d+)/);
  if (match) return `LAN${match[1]}`;
  return clean;
}

function comparePortNames(a: string, b: string): number {
  const na = Number.parseInt(a.replace(/[^0-9]/g, ""), 10);
  const nb = Number.parseInt(b.replace(/[^0-9]/g, ""), 10);
  if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
  return a.localeCompare(b);
}

function resolveDisplayName(d: any, fallbackPrefix = "جهاز"): string {
  const candidates = [d.name, d.friendlyName, d.hostname];
  for (const c of candidates) {
    const val = typeof c === "string" ? c.trim() : "";
    if (val && val !== "Unknown" && val !== "Wi-Fi Device" && val !== "unknown") {
      return val;
    }
  }
  if (d.vendor && typeof d.vendor === "string" && !d.vendor.startsWith("Randomized")) {
    return d.vendor.split("(")[0].trim() || d.ip || fallbackPrefix;
  }
  if (d.ip) return d.ip;
  if (d.mac) return `${fallbackPrefix} ${String(d.mac).slice(-5)}`;
  return fallbackPrefix;
}

function ensureRouterScope(routerSignature: string, activeMacs: string[]) {
  if (typeof window === "undefined") return;
  try {
    const curVer = localStorage.getItem(SCHEMA_VERSION_KEY);
    if (curVer !== SCHEMA_VERSION) {
      clearAllMapOverrides();
      localStorage.setItem(SCHEMA_VERSION_KEY, SCHEMA_VERSION);
      localStorage.setItem(ROUTER_SIG_KEY, routerSignature);
      localStorage.setItem(ROUTER_MACS_KEY, JSON.stringify(activeMacs));
      return;
    }

    if (activeMacs.length === 0) return;

    const prevSig = localStorage.getItem(ROUTER_SIG_KEY) || "";
    let prevMacs: string[] = [];
    try {
      prevMacs = JSON.parse(localStorage.getItem(ROUTER_MACS_KEY) || "[]");
    } catch {}

    let routerChanged = false;
    if (prevSig && prevSig !== routerSignature) {
      routerChanged = true;
    } else if (prevMacs.length >= 2 && activeMacs.length >= 2) {
      const prevSet = new Set(prevMacs);
      const overlap = activeMacs.filter((m) => prevSet.has(m)).length;
      const ratio = overlap / Math.max(prevMacs.length, activeMacs.length);
      if (ratio < 0.2) {
        routerChanged = true;
      }
    }

    if (routerChanged) {
      clearAllMapOverrides();
    }

    localStorage.setItem(ROUTER_SIG_KEY, routerSignature);
    localStorage.setItem(ROUTER_MACS_KEY, JSON.stringify(activeMacs));
  } catch {}
}

function chooseSwitchPortSize(neededPorts: number): number {
  if (neededPorts <= 5) return 5;
  if (neededPorts <= 8) return 8;
  if (neededPorts <= 16) return 16;
  return 24;
}

function normalizeServerTopology(
  serverTopology?: Record<string, { portOverride?: string; parentMac?: string }> | null
) {
  const byMac = new Map<string, { portOverride?: string; parentMac?: string }>();
  if (!serverTopology) return byMac;
  Object.entries(serverTopology).forEach(([k, v]) => {
    if (v) byMac.set(k.toUpperCase(), v);
  });
  return byMac;
}

/**
 * 100% data-driven automatic network topology & layout generator.
 * Builds the entire graph dynamically from ANY ZTE router's discovered telemetry
 * without hardcoded device names or house switch names.
 */
export function buildAutoTopologyNodes(input: AutoTopologyInput): MapNode[] {
  const rawModel = (input.routerModel || "").trim();
  const routerName = rawModel
    ? rawModel.toUpperCase().startsWith("ZTE")
      ? rawModel
      : `ZTE ${rawModel}`
    : "ZTE Router";
  const routerIp = (input.routerIp || "").trim() || "192.168.1.1";

  // 1. Merge Known + Unknown Live Devices cleanly by MAC
  const wiredMap = new Map<string, any>();
  const offlineMap = new Map<string, any>();
  const wifiMap = new Map<string, any>();

  (input.cableDevices || []).forEach((d, idx) => {
    const mac = (d.mac || `CABLE-${idx}`).toUpperCase();
    if (d.online) {
      wiredMap.set(mac, d);
    } else {
      offlineMap.set(mac, d);
    }
  });

  (input.wifiClients || []).forEach((w, idx) => {
    const mac = (w.mac || `WIFI-${idx}`).toUpperCase();
    wifiMap.set(mac, w);
  });

  (input.unknownDevices || []).forEach((u, idx) => {
    const mac = (u.mac || `UNK-${idx}`).toUpperCase();
    if (wiredMap.has(mac) || wifiMap.has(mac) || offlineMap.has(mac)) return;
    if ((u.medium || "").toUpperCase() === "WLAN" || String(u.port || "").includes("WIFI")) {
      wifiMap.set(mac, u);
    } else {
      wiredMap.set(mac, { ...u, online: true });
    }
  });

  const wiredOnline = Array.from(wiredMap.values());
  const wifiAll = Array.from(wifiMap.values());
  const offlineAll = Array.from(offlineMap.values());

  const activeMacs = [
    ...wiredOnline.map((d) => (d.mac || "").toUpperCase()),
    ...wifiAll.map((w) => (w.mac || "").toUpperCase()),
  ].filter(Boolean);

  ensureRouterScope(`${routerName}|${routerIp}`, activeMacs);

  const localSaved = loadSavedPositions();
  const saved: Record<string, { x: number; y: number }> = {
    ...(input.serverCanvas?.positions || {}),
    ...localSaved,
  };
  const portAssignments = loadPortAssignments();
  const savedParents = loadDeviceParents();
  const serverTopo = normalizeServerTopology(input.serverTopology);
  const customNodes = loadCustomNodes();
  const deletedSet = new Set(loadDeletedNodeIds());
  const switchMeta = loadSwitchMeta();

  // 2. Discover real physical LAN ports present on this router
  const lanPortSet = new Set<string>();
  (input.lanPorts || []).forEach((lp) => {
    const p = normPortName(lp.port);
    if (p.startsWith("LAN")) lanPortSet.add(p);
  });
  wiredOnline.forEach((d) => {
    const p = normPortName(d.port);
    if (p.startsWith("LAN")) lanPortSet.add(p);
  });
  (input.lanPortRates || []).forEach((r) => {
    const p = normPortName(r.port);
    if (p.startsWith("LAN")) lanPortSet.add(p);
  });
  // Fallback: if wired devices exist with unknown port, map them to LAN1
  wiredOnline.forEach((d) => {
    const p = normPortName(d.port);
    if (!p.startsWith("LAN")) {
      d._resolvedPort = "LAN1";
      lanPortSet.add("LAN1");
    } else {
      d._resolvedPort = p;
    }
  });

  const sortedLanPorts = Array.from(lanPortSet).sort(comparePortNames);

  // 3. Build device ID lookup & correlation tomography rules
  const devIdByMac = new Map<string, string>();
  wiredOnline.forEach((d, i) => {
    const mac = (d.mac || "").toUpperCase();
    const id = "dev-" + (mac ? mac.replace(/:/g, "").toLowerCase() : `lan-${i}`);
    if (mac) devIdByMac.set(mac, id);
    d._nodeId = id;
  });
  wifiAll.forEach((w, i) => {
    const mac = (w.mac || "").toUpperCase();
    const id = "dev-wifi-" + (mac ? mac.replace(/:/g, "").toLowerCase() : `${i}`);
    if (mac) devIdByMac.set(mac, id);
    w._nodeId = id;
  });

  const apChildByMac = new Map<string, string>();
  const switchGroupEdgesByPort = new Map<string, Array<[string, string]>>();

  (input.correlationInsights || []).forEach((ins) => {
    if ((ins.confidence ?? 0) < 60) return;
    const srcMac = (ins.sourceMac || "").toUpperCase();
    const tgtMac = (ins.targetMac || "").toUpperCase();
    if (!srcMac || !tgtMac) return;
    if (ins.type === "ap_child") {
      if (devIdByMac.has(srcMac)) {
        apChildByMac.set(tgtMac, devIdByMac.get(srcMac)!);
      }
    } else if (ins.type === "switch_group") {
      const p = normPortName(ins.port || "");
      if (p.startsWith("LAN")) {
        if (!switchGroupEdgesByPort.has(p)) switchGroupEdgesByPort.set(p, []);
        switchGroupEdgesByPort.get(p)!.push([srcMac, tgtMac]);
      }
    }
  });

  // Helper: Connected components for switch_group insights on a given port
  function getCorrelationComponents(portName: string, macsOnPort: string[]): string[][] {
    const edges = switchGroupEdgesByPort.get(portName) || [];
    if (edges.length === 0) return [];
    const allowed = new Set(macsOnPort);
    const adj = new Map<string, Set<string>>();
    edges.forEach(([a, b]) => {
      if (!allowed.has(a) || !allowed.has(b)) return;
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    });
    const visited = new Set<string>();
    const groups: string[][] = [];
    adj.forEach((_, start) => {
      if (visited.has(start)) return;
      const comp: string[] = [];
      const stack = [start];
      visited.add(start);
      while (stack.length > 0) {
        const cur = stack.pop()!;
        comp.push(cur);
        adj.get(cur)?.forEach((nxt) => {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            stack.push(nxt);
          }
        });
      }
      if (comp.length >= 2) groups.push(comp);
    });
    return groups;
  }

  // 4. Construct Nodes & Hierarchical Parent-Child Relationships
  const nodes: MapNode[] = [];
  nodes.push({ id: "node-wan", name: "الإنترنت", type: "wan", x: 600, y: 40 });
  nodes.push({
    id: "node-router",
    name: routerName,
    type: "router",
    x: 600,
    y: 230,
    parentId: "node-wan",
    ip: routerIp,
  });

  const hubs: MapNode[] = [];
  const autoSwitches: MapSwitch[] = []; // track switches cleanly for layout
  const generatedSwitches: MapNode[] = [];
  const generatedDevices: MapNode[] = [];

  sortedLanPorts.forEach((portName) => {
    const hubId = `hub-${portName.toLowerCase()}`;
    const c = getPortColor(portName);
    hubs.push({
      id: hubId,
      name: portName,
      type: "hub",
      x: 0,
      y: 0,
      parentId: "node-router",
      uplinkHub: portName,
      uplinkColor: c.color,
    });

    const portDevices = wiredOnline.filter((d) => {
      const mac = (d.mac || "").toUpperCase();
      const sOverride = serverTopo.get(mac);
      const effPort = sOverride?.portOverride ? normPortName(sOverride.portOverride) : d._resolvedPort;
      return effPort === portName;
    });

    // Separate devices that belong to an AP/Router peer child via correlation or explicit parent override
    const directCandidates: any[] = [];
    portDevices.forEach((d) => {
      const mac = (d.mac || "").toUpperCase();
      const devId = d._nodeId;
      const explicitParent = savedParents[mac] || savedParents[devId];
      const serverParent = serverTopo.get(mac)?.parentMac
        ? devIdByMac.get(serverTopo.get(mac)!.parentMac!)
        : undefined;
      const corrParent = apChildByMac.get(mac);

      if (explicitParent?.parentId && explicitParent.parentId !== hubId) {
        // User explicitly assigned this device elsewhere (e.g. custom switch or peer router)
        generatedDevices.push({
          id: devId,
          name: resolveDisplayName(d),
          type: "device",
          subType: (d.category as any) || "router",
          x: 0,
          y: 0,
          parentId: explicitParent.parentId,
          portIndex:
            explicitParent.portIndex !== undefined
              ? explicitParent.portIndex
              : portAssignments[mac],
          ip: d.ip,
          mac: d.mac,
          cableQuality: d.cableHealth?.score ?? 100,
          blocked: d.blocked,
          vendor: d.vendor,
          online: true,
        });
      } else if (!explicitParent && (serverParent || corrParent)) {
        generatedDevices.push({
          id: devId,
          name: resolveDisplayName(d),
          type: "device",
          subType: (d.category as any) || "phone",
          x: 0,
          y: 0,
          parentId: serverParent || corrParent,
          ip: d.ip,
          mac: d.mac,
          cableQuality: d.cableHealth?.score ?? 100,
          blocked: d.blocked,
          vendor: d.vendor,
          online: true,
        });
      } else {
        directCandidates.push(d);
      }
    });

    // Pure physical rule:
    // - 0 devices on LAN port -> empty port (no switch!)
    // - 1 device on LAN port -> direct cable to hub (no switch!)
    // - 2+ devices on LAN port -> physically requires a switch (or correlation-detected sub-switches)
    if (directCandidates.length === 1) {
      const d = directCandidates[0];
      const mac = (d.mac || "").toUpperCase();
      generatedDevices.push({
        id: d._nodeId,
        name: resolveDisplayName(d),
        type: "device",
        subType: (d.category as any) || "router",
        x: 0,
        y: 0,
        parentId: hubId,
        ip: d.ip,
        mac: d.mac,
        cableQuality: d.cableHealth?.score ?? 100,
        blocked: d.blocked,
        vendor: d.vendor,
        online: true,
      });
    } else if (directCandidates.length >= 2) {
      const macsOnPort = directCandidates.map((d) => (d.mac || "").toUpperCase()).filter(Boolean);
      const corrGroups = getCorrelationComponents(portName, macsOnPort);
      const groupedMacSet = new Set<string>();
      corrGroups.forEach((g) => g.forEach((m) => groupedMacSet.add(m)));

      const remaining = directCandidates.filter(
        (d) => !groupedMacSet.has((d.mac || "").toUpperCase())
      );

      // Build switches for remaining devices (chunked cleanly into <= 15 devices per switch)
      const swSpecs: Array<{ id: string; name: string; parentId: string; devs: any[]; isSub?: boolean }> = [];
      if (remaining.length >= 2) {
        const chunkSize = 15;
        const totalChunks = Math.ceil(remaining.length / chunkSize);
        for (let cIdx = 0; cIdx < totalChunks; cIdx++) {
          const chunk = remaining.slice(cIdx * chunkSize, (cIdx + 1) * chunkSize);
          const swId =
            cIdx === 0
              ? `switch-auto-${portName.toLowerCase()}`
              : `switch-auto-${portName.toLowerCase()}-${cIdx + 1}`;
          const swLabel =
            totalChunks === 1 && corrGroups.length === 0
              ? `سويتش ${portName} (تلقائي)`
              : `سويتش ${cIdx + 1} · ${portName}`;
          const parentId = cIdx === 0 ? hubId : `switch-auto-${portName.toLowerCase()}`;
          swSpecs.push({ id: swId, name: swLabel, parentId, devs: chunk });
        }
      } else if (remaining.length === 1) {
        // Remaining single device connects directly to hub alongside correlation sub-switch
        const d = remaining[0];
        generatedDevices.push({
          id: d._nodeId,
          name: resolveDisplayName(d),
          type: "device",
          subType: (d.category as any) || "router",
          x: 0,
          y: 0,
          parentId: hubId,
          ip: d.ip,
          mac: d.mac,
          cableQuality: d.cableHealth?.score ?? 100,
          blocked: d.blocked,
          vendor: d.vendor,
          online: true,
        });
      }

      // Build inferred correlation switches (co-failure / jitter switch_group)
      corrGroups.forEach((groupMacs, gIdx) => {
        const gSet = new Set(groupMacs);
        const groupDevs = directCandidates.filter((d) => gSet.has((d.mac || "").toUpperCase()));
        if (groupDevs.length < 2) return;
        const swId = `switch-corr-${portName.toLowerCase()}-${gIdx + 1}`;
        const primarySwId = swSpecs[0]?.id;
        swSpecs.push({
          id: swId,
          name: `سويتش فرعي #${gIdx + 1} (${portName})`,
          parentId: primarySwId || hubId,
          devs: groupDevs,
          isSub: Boolean(primarySwId),
        });
      });

      swSpecs.forEach((spec) => {
        const swNode: MapNode = {
          id: spec.id,
          name: spec.name,
          type: "switch",
          x: 0,
          y: 0,
          parentId: spec.parentId,
          ports: chooseSwitchPortSize(spec.devs.length + 1),
          uplinkHub: portName,
          uplinkColor: spec.isSub ? "#8B6CFF" : c.color,
          selected: false,
        };
        generatedSwitches.push(swNode);

        spec.devs.forEach((d) => {
          const mac = (d.mac || "").toUpperCase();
          const assignedPort = portAssignments[mac];
          generatedDevices.push({
            id: d._nodeId,
            name: resolveDisplayName(d),
            type: "device",
            subType: (d.category as any) || "router",
            x: 0,
            y: 0,
            parentId: spec.id,
            portIndex: typeof assignedPort === "number" ? assignedPort : undefined,
            ip: d.ip,
            mac: d.mac,
            cableQuality: d.cableHealth?.score ?? 100,
            blocked: d.blocked,
            vendor: d.vendor,
            online: true,
          });
        });
      });
    }
  });

  // 5. Wi-Fi Hub & Real Wi-Fi Clients
  const hasWifiHub =
    wifiAll.length > 0 ||
    Boolean(input.hasActiveWifi) ||
    customNodes.some((cn) => cn.parentId === "hub-wifi");

  if (hasWifiHub) {
    hubs.push({
      id: "hub-wifi",
      name: "الويفي",
      type: "hub",
      x: 0,
      y: 0,
      parentId: "node-router",
      uplinkHub: "WIFI",
      uplinkColor: "#5B3DF5",
    });

    wifiAll.forEach((w, i) => {
      const mac = (w.mac || "").toUpperCase();
      const devId = w._nodeId || `dev-wifi-${i}`;
      const explicitParent = savedParents[mac] || savedParents[devId];
      const corrParent = apChildByMac.get(mac);
      const resolvedParent =
        explicitParent?.parentId || corrParent || "hub-wifi";

      generatedDevices.push({
        id: devId,
        name: resolveDisplayName(w, "هاتف"),
        type: "device",
        subType: (w.category as any) || "phone",
        x: 0,
        y: 0,
        parentId: resolvedParent,
        portIndex: explicitParent?.portIndex,
        ip: w.ip,
        mac: w.mac,
        vendor: w.vendor,
        blocked: w.blocked,
        online: true,
        band: w.band,
        ssidName: w.ssidName,
      });
    });
  }

  // 6. Offline Devices Hub (only if offline wired devices exist)
  if (offlineAll.length > 0) {
    hubs.push({
      id: "hub-offline",
      name: "غير متصل",
      type: "hub",
      x: 0,
      y: 0,
      parentId: "node-router",
      uplinkHub: "OFFLINE",
      uplinkColor: "#9A98AD",
    });

    offlineAll.forEach((d, i) => {
      const mac = (d.mac || "").toUpperCase();
      const devId = "dev-offline-" + (mac ? mac.replace(/:/g, "").toLowerCase() : i);
      generatedDevices.push({
        id: devId,
        name: resolveDisplayName(d),
        type: "device",
        subType: (d.category as any) || "pc",
        x: 0,
        y: 0,
        parentId: "hub-offline",
        ip: d.ip,
        mac: d.mac,
        vendor: d.vendor,
        blocked: d.blocked,
        online: false,
      });
    });
  }

  // Merge everything before filtering & port assignment
  const allNodes: MapNode[] = [...nodes, ...hubs, ...generatedSwitches, ...generatedDevices];

  // Merge user-added custom nodes from Palette
  const existingIds = new Set(allNodes.map((n) => n.id));
  customNodes.forEach((cn) => {
    if (existingIds.has(cn.id)) return;
    const savedParentEntry =
      savedParents[cn.id] || (cn.mac ? savedParents[cn.mac.toUpperCase()] : undefined);
    allNodes.push({
      ...cn,
      parentId: savedParentEntry ? savedParentEntry.parentId : cn.parentId,
      portIndex:
        savedParentEntry?.portIndex !== undefined ? savedParentEntry.portIndex : cn.portIndex,
    });
  });

  // Apply user-saved parent overrides cleanly for custom switches/routers
  const nodeIdSet = new Set(allNodes.map((n) => n.id));
  allNodes.forEach((n) => {
    if (n.type === "switch" || n.type === "device") {
      const macKey = (n.mac || "").toUpperCase();
      const entry = (macKey && savedParents[macKey]) || savedParents[n.id];
      if (entry && (!entry.parentId || nodeIdSet.has(entry.parentId))) {
        n.parentId = entry.parentId || undefined;
        if (entry.portIndex !== undefined) {
          n.portIndex = entry.portIndex;
        }
      } else if (n.parentId && !nodeIdSet.has(n.parentId)) {
        // Orphaned parent (e.g. router changed) -> attach directly back to hub/router
        n.parentId = "node-router";
      }
    }
  });

  // Filter user-deleted nodes
  const finalNodes = deletedSet.size > 0 ? allNodes.filter((n) => !deletedSet.has(n.id)) : allNodes;

  // 7. Apply Switch metadata & auto-assign free physical ports (2..N, port 1 = Uplink)
  finalNodes.forEach((sw) => {
    if (sw.type !== "switch") return;
    const override = switchMeta[sw.id];
    if (override) {
      if (override.name) sw.name = override.name;
      if (override.ports) sw.ports = override.ports;
      if (override.uplinkHub) sw.uplinkHub = override.uplinkHub;
      if (override.uplinkColor) sw.uplinkColor = override.uplinkColor;
    }

    const childSwitches = finalNodes.filter((c) => c.type === "switch" && c.parentId === sw.id);
    const childDevices = finalNodes.filter((c) => c.type === "device" && c.parentId === sw.id);

    const usedPorts = new Set<number>([1]);
    childSwitches.forEach((cs) => {
      if (typeof cs.portIndex === "number" && cs.portIndex >= 2) usedPorts.add(cs.portIndex);
    });
    childDevices.forEach((cd) => {
      if (typeof cd.portIndex === "number" && cd.portIndex >= 2) usedPorts.add(cd.portIndex);
    });

    const nextFreePort = () => {
      let p = 2;
      while (usedPorts.has(p) && p <= 24) p += 1;
      usedPorts.add(p);
      return p;
    };

    childSwitches.forEach((cs) => {
      if (cs.portIndex === undefined) cs.portIndex = nextFreePort();
    });
    childDevices.forEach((cd) => {
      if (cd.portIndex === undefined) {
        cd.portIndex = nextFreePort();
      } else if (cd.portIndex === 0) {
        cd.portIndex = undefined;
      }
    });

    const highestPort = usedPorts.size > 0 ? Math.max(...Array.from(usedPorts)) : 1;
    const neededPorts = Math.max(highestPort, 1 + childSwitches.length + childDevices.length);
    if (!override?.ports) {
      sw.ports = chooseSwitchPortSize(neededPorts);
    }
  });

  // =========================================================================
  // 8. DYNAMIC ZERO-OVERLAP AUTO-LAYOUT ENGINE
  // =========================================================================
  const CENTER_X = 620;
  const HUB_OFFSET_X = 215;
  const BRANCH_GAP_Y = 54;
  const COL_GAP = 72;
  const ROW_GAP = 78;

  const finalHubs = finalNodes.filter((n) => n.type === "hub");
  const lanHubNodes = finalHubs.filter((h) => h.id !== "hub-wifi" && h.id !== "hub-offline");
  const wifiHubNode = finalHubs.find((h) => h.id === "hub-wifi");
  const offlineHubNode = finalHubs.find((h) => h.id === "hub-offline");

  const splitIndex = Math.ceil(lanHubNodes.length / 2);
  const leftHubs = lanHubNodes.slice(0, splitIndex);
  const rightHubs: MapNode[] = [
    ...(wifiHubNode ? [wifiHubNode] : []),
    ...lanHubNodes.slice(splitIndex),
  ];

  const getPeerChildren = (devId: string) =>
    finalNodes.filter((n) => n.type === "device" && n.parentId === devId);

  const getSwitchBlockMetrics = (sw: MapNode) => {
    const swDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === sw.id);
    const maxPerRow = swDevs.length > 8 ? 5 : 4;
    const devRows = swDevs.length > 0 ? Math.ceil(swDevs.length / maxPerRow) : 0;
    const hasPeerChildren = swDevs.some((d) => getPeerChildren(d.id).length > 0);
    const extraPeerH = hasPeerChildren ? 82 : 0;
    const topSpace = 48; // space above switch for its name tag
    const bodyHeight = devRows > 0 ? 92 + (devRows - 1) * ROW_GAP + 52 : 45;
    return {
      swDevs,
      maxPerRow,
      topSpace,
      height: topSpace + bodyHeight + extraPeerH,
    };
  };

  // Recursively collect switches under a hub (direct + cascaded)
  const getSwitchesInBranch = (hubId: string): MapNode[] => {
    const directSw = finalNodes.filter((n) => n.type === "switch" && n.parentId === hubId);
    const allSw: MapNode[] = [];
    const queue = [...directSw];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (seen.has(cur.id)) continue;
      seen.add(cur.id);
      allSw.push(cur);
      finalNodes
        .filter((n) => n.type === "switch" && n.parentId === cur.id)
        .forEach((c) => queue.push(c));
    }
    return allSw;
  };

  const getBranchHeight = (hub: MapNode): number => {
    if (hub.id === "hub-wifi") {
      const wDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === "hub-wifi");
      const rows = Math.max(1, Math.ceil(wDevs.length / 5));
      return Math.max(115, 95 + rows * 72);
    }
    const branchSwitches = getSwitchesInBranch(hub.id);
    const directDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === hub.id);

    let totalH = 0;
    if (branchSwitches.length > 0) {
      totalH = branchSwitches.reduce(
        (acc, sw, idx) => acc + getSwitchBlockMetrics(sw).height + (idx > 0 ? 28 : 0),
        0
      );
    }
    if (directDevs.length > 0) {
      const rows = Math.ceil(directDevs.length / 3);
      totalH += Math.max(96, rows * ROW_GAP + 28);
    }
    return Math.max(82, totalH);
  };

  const applySavedPos = (node: MapNode, defX: number, defY: number) => {
    const s = saved[node.id];
    if (s && typeof s.x === "number" && typeof s.y === "number") {
      node.x = s.x;
      node.y = s.y;
    } else {
      node.x = Math.round(defX);
      node.y = Math.round(defY);
    }
  };

  const layoutSide = (sideHubs: MapNode[], side: "left" | "right"): number => {
    let curY = 105;
    const dir = side === "left" ? -1 : 1;

    sideHubs.forEach((hub) => {
      const branchH = getBranchHeight(hub);
      const branchTop = curY;

      if (hub.id === "hub-wifi") {
        const hubX = CENTER_X + dir * HUB_OFFSET_X;
        const hubY = branchTop + 34;
        applySavedPos(hub, hubX, hubY);

        const wDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === "hub-wifi");
        const apX = hub.x + dir * 135;
        const apY = hub.y;
        wDevs.forEach((w, idx) => {
          const maxPerRow = 5;
          const row = Math.floor(idx / maxPerRow);
          const col = idx % maxPerRow;
          const colsInRow = Math.min(maxPerRow, wDevs.length - row * maxPerRow);
          const rowStartX = apX - ((colsInRow - 1) * 60) / 2;
          applySavedPos(w, rowStartX + col * 60, apY + 72 + row * 70);
        });
      } else {
        const branchSwitches = getSwitchesInBranch(hub.id);
        const directDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === hub.id);

        const hubX = CENTER_X + dir * HUB_OFFSET_X;
        const hubY =
          branchSwitches.length > 0
            ? branchTop + getSwitchBlockMetrics(branchSwitches[0]).topSpace + 18
            : branchTop + branchH / 2;
        applySavedPos(hub, hubX, hubY);

        let subY = branchTop;

        // Place switches & their attached devices
        branchSwitches.forEach((sw, swIdx) => {
          const metrics = getSwitchBlockMetrics(sw);
          const swWidth = 24 + (sw.ports || 8) * 11;
          const baseDist = Math.max(210, swWidth / 2 + 125);
          const swX = hub.x + dir * (swIdx > 0 && sw.parentId?.startsWith("switch-") ? baseDist + 40 : baseDist);
          const swY = subY + metrics.topSpace + 18;
          applySavedPos(sw, swX, swY);

          metrics.swDevs.forEach((dev, idx) => {
            const row = Math.floor(idx / metrics.maxPerRow);
            const col = idx % metrics.maxPerRow;
            const colsInRow = Math.min(
              metrics.maxPerRow,
              metrics.swDevs.length - row * metrics.maxPerRow
            );
            const rowStartX = sw.x - ((colsInRow - 1) * COL_GAP) / 2;
            applySavedPos(dev, rowStartX + col * COL_GAP, sw.y + 92 + row * ROW_GAP);

            // Layout any peer-child phones/devices behind this router/AP
            const peers = getPeerChildren(dev.id);
            peers.forEach((peer, pIdx) => {
              const pStartX = dev.x - ((peers.length - 1) * 56) / 2;
              applySavedPos(peer, pStartX + pIdx * 56, dev.y + 74);
            });
          });

          subY += metrics.height + 28;
        });

        // Place direct devices connected straight to this LAN hub (e.g. 1 device on LAN3/LAN4)
        if (directDevs.length > 0) {
          directDevs.forEach((dev, idx) => {
            const row = Math.floor(idx / 3);
            const col = idx % 3;
            const defX = hub.x + dir * (170 + col * 72);
            const defY =
              branchSwitches.length > 0 ? subY + 25 + row * ROW_GAP : hub.y + row * ROW_GAP;
            applySavedPos(dev, defX, defY);

            const peers = getPeerChildren(dev.id);
            peers.forEach((peer, pIdx) => {
              const pStartX = dev.x - ((peers.length - 1) * 56) / 2;
              applySavedPos(peer, pStartX + pIdx * 56, dev.y + 74);
            });
          });
        }
      }

      curY += branchH + BRANCH_GAP_Y;
    });

    return curY;
  };

  const leftBottomY = layoutSide(leftHubs, "left");
  const rightBottomY = layoutSide(rightHubs, "right");

  const activeHubYs = [...leftHubs, ...rightHubs].map((h) => h.y);
  const avgHubY =
    activeHubYs.length > 0
      ? activeHubYs.reduce((a, b) => a + b, 0) / activeHubYs.length
      : 230;
  const routerDefaultY = Math.max(210, Math.round(avgHubY));
  const routerNode = finalNodes.find((n) => n.id === "node-router")!;
  applySavedPos(routerNode, CENTER_X, routerDefaultY);

  const wanNode = finalNodes.find((n) => n.id === "node-wan")!;
  applySavedPos(wanNode, CENTER_X, Math.max(36, routerNode.y - 185));

  // Layout offline hub & devices cleanly underneath center router
  if (offlineHubNode) {
    const offlineY = Math.max(routerNode.y + 155, Math.min(leftBottomY, rightBottomY) + 15);
    applySavedPos(offlineHubNode, CENTER_X, offlineY);
    const offDevs = finalNodes.filter((n) => n.type === "device" && n.parentId === "hub-offline");
    const maxPerRow = 4;
    offDevs.forEach((d, idx) => {
      const row = Math.floor(idx / maxPerRow);
      const col = idx % maxPerRow;
      const colsInRow = Math.min(maxPerRow, offDevs.length - row * maxPerRow);
      const startX = offlineHubNode.x - ((colsInRow - 1) * 76) / 2;
      applySavedPos(d, startX + col * 76, offlineHubNode.y + 74 + row * 72);
    });
  }

  // Layout any custom orphan / direct-to-router devices cleanly
  const directRouterDevs = finalNodes.filter(
    (n) => n.type === "device" && n.parentId === "node-router"
  );
  directRouterDevs.forEach((d, idx) => {
    const startX = routerNode.x - ((directRouterDevs.length - 1) * 74) / 2;
    applySavedPos(d, startX + idx * 74, routerNode.y + 115);
  });

  void autoSwitches;
  return finalNodes;
}

/**
 * Backward-compatible entrypoint: accepts either AutoTopologyInput OR legacy positional arguments.
 */
export function buildInitialNodes(
  inputOrCableDevices: AutoTopologyInput | any[] = [],
  wifiClients: any[] = [],
  offlineCable: any[] = [],
  serverCanvas?: { positions?: Record<string, { x: number; y: number }> } | null
): MapNode[] {
  if (!Array.isArray(inputOrCableDevices) && inputOrCableDevices && typeof inputOrCableDevices === "object") {
    return buildAutoTopologyNodes(inputOrCableDevices);
  }
  return buildAutoTopologyNodes({
    cableDevices: Array.isArray(inputOrCableDevices) ? inputOrCableDevices : [],
    wifiClients,
    offlineCable,
    serverCanvas: serverCanvas || undefined,
  });
}

export function buildCablesFromNodes(nodes: MapNode[]): MapCable[] {
  const cables: MapCable[] = [];
  nodes.forEach((n) => {
    if (!n.parentId) return;
    const parent = nodes.find((p) => p.id === n.parentId);
    if (!parent) return;

    let color = "#5B3DF5";
    let dashed = false;

    if (parent.type === "wan") {
      color = "#5B3DF5";
    } else if (parent.type === "router") {
      color = n.uplinkColor || "#5B3DF5";
      if (n.id === "hub-offline") {
        color = "#9A98AD";
        dashed = true;
      }
    } else if (parent.type === "hub") {
      color = parent.uplinkColor || "#5B3DF5";
      if (parent.id === "hub-offline") {
        color = "#9A98AD";
        dashed = true;
      }
    } else if (parent.type === "switch") {
      if (n.type === "switch") {
        color = "#8B6CFF";
        dashed = false;
      } else {
        if (!n.portIndex) return;
        color = parent.uplinkColor || "#5B3DF5";
      }
    } else if (parent.type === "device") {
      color = "#8B6CFF";
      dashed = true;
    }

    cables.push({
      id: `cable-${parent.id}-${n.id}`,
      fromId: parent.id,
      toId: n.id,
      color,
      dashed,
      fromPortIndex: n.portIndex,
    });
  });
  return cables;
}

export function nodesToSwitches(nodes: MapNode[]): MapSwitch[] {
  const switchNodes = nodes.filter((n) => n.type === "switch");
  return switchNodes.map((sw) => {
    const childDevices: MapDevice[] = nodes
      .filter((n) => n.parentId === sw.id && n.type === "device")
      .map((d) => ({
        id: d.id,
        name: d.name,
        type: (d.subType as any) || "router",
        x: d.x,
        y: d.y,
        selected: d.selected,
        cableQuality: d.cableQuality,
        portIndex: d.portIndex,
        ip: d.ip,
        mac: d.mac,
        blocked: d.blocked,
        vendor: d.vendor,
        parentId: sw.id,
      }));

    return {
      id: sw.id,
      name: sw.name,
      x: sw.x,
      y: sw.y,
      ports: sw.ports || 8,
      parentId: sw.parentId,
      portIndex: sw.portIndex,
      uplinkHub: sw.uplinkHub || "LAN1",
      uplinkColor: sw.uplinkColor || "#5B3DF5",
      selected: sw.selected,
      devices: childDevices,
    };
  });
}
