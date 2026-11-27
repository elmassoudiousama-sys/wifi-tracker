export type MapNodeType = "wan" | "router" | "hub" | "switch" | "device";

export interface MapNode {
  id: string;
  name: string;
  type: MapNodeType;
  subType?: "router" | "phone" | "pc" | "camera" | "ap" | "custom";
  x: number;
  y: number;
  parentId?: string; // id of parent node (switch, hub, router)
  portIndex?: number; // 1-based port index on switch
  // Telemetry & device properties
  ip?: string;
  mac?: string;
  cableQuality?: number;
  blocked?: boolean;
  vendor?: string;
  ports?: number; // for switches (e.g. 5, 8, 16)
  uplinkHub?: "LAN1" | "LAN2" | "LAN3" | "LAN4" | "WIFI";
  uplinkColor?: string;
  selected?: boolean;
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
      // 0 = explicitly disconnected by user; >= 1 = assigned port index
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
  uplinkHub?: "LAN1" | "LAN2" | "LAN3" | "LAN4" | "WIFI";
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
  cableQuality?: number; // e.g. 58 for 58%
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
  ports: number; // 5, 8, 16, 24
  parentId?: string;
  portIndex?: number;
  uplinkHub: "LAN1" | "LAN2" | "LAN3" | "LAN4" | "WIFI" | string;
  uplinkColor: string;
  selected?: boolean;
  devices: MapDevice[];
  moreCount?: number;
}

export interface HubNode {
  id: "LAN1" | "LAN2" | "LAN3" | "LAN4" | "WIFI";
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

export const INITIAL_HUBS: HubNode[] = [
  {
    id: "LAN1",
    name: "LAN1",
    x: 335,
    y: 130,
    width: 124,
    height: 52,
    color: "#5B3DF5",
    textColor: "#FFFFFF",
    deviceCount: 10,
    mbps: 14.14,
    mbpsLabel: "14.14 Mbps",
  },
  {
    id: "LAN2",
    name: "LAN2",
    x: 335,
    y: 425,
    width: 124,
    height: 52,
    color: "#FF7A45",
    textColor: "#14121F",
    deviceCount: 9,
    mbps: 15.38,
    mbpsLabel: "15.38 Mbps",
  },
  {
    id: "WIFI",
    name: "الويفي",
    x: 790,
    y: 95,
    width: 124,
    height: 52,
    color: "#FFFFFF",
    textColor: "#5B3DF5",
    stroke: "#5B3DF5",
    deviceCount: 5,
    mbps: 0,
    mbpsLabel: "Wi-Fi 5 أجهزة",
  },
  {
    id: "LAN3",
    name: "LAN3",
    x: 805,
    y: 285,
    width: 124,
    height: 52,
    color: "#D7F25C",
    textColor: "#14121F",
    deviceCount: 1,
    mbps: 9.35,
    mbpsLabel: "9.35 Mbps",
  },
  {
    id: "LAN4",
    name: "LAN4",
    x: 805,
    y: 455,
    width: 124,
    height: 52,
    color: "#14121F",
    textColor: "#FFFFFF",
    deviceCount: 1,
    mbps: 0,
    mbpsLabel: "0 Mbps",
    lineDashed: true,
  },
];

export const INITIAL_SWITCHES: MapSwitch[] = [
  {
    id: "switch-salon",
    name: "Switch Salon",
    x: 190,
    y: 130,
    ports: 8,
    uplinkHub: "LAN1",
    uplinkColor: "#5B3DF5",
    selected: true,
    devices: [
      { id: "dev-3azkri", name: "3azkri", type: "router", x: 45, y: 258, portIndex: 1 },
      { id: "dev-abdelmnan", name: "ABDELMNAN", type: "router", x: 115, y: 258, selected: true, cableQuality: 58, portIndex: 2 },
      { id: "dev-galaxy", name: "Galaxy-A07", type: "phone", x: 185, y: 258, portIndex: 3 },
      { id: "dev-tarik", name: "A53-de-tarik", type: "phone", x: 255, y: 258, portIndex: 4 },
    ],
    moreCount: 6,
  },
  {
    id: "switch-bureau",
    name: "Switch Bureau",
    x: 190,
    y: 425,
    ports: 8,
    uplinkHub: "LAN2",
    uplinkColor: "#FF7A45",
    selected: false,
    devices: [
      { id: "dev-biltran1", name: "BILTRAN 1", type: "router", x: 150, y: 548, portIndex: 1 },
    ],
    moreCount: 8,
  },
];

export function buildSwitchesFromDevices(devices: any[]): MapSwitch[] {
  const lan1 = (devices || []).filter((d) => d.port === "LAN1" && d.online);
  const lan2 = (devices || []).filter((d) => d.port === "LAN2" && d.online);

  const sw1X = 180;
  const sw1Y = 130;
  const sw2X = 180;
  const sw2Y = 415;

  // Clean, non-intersecting layout aligned symmetrically under each switch
  const mapDevs1: MapDevice[] = lan1.map((d, i) => {
    const isRow0 = i < 6;
    const col = isRow0 ? i : i - 6;
    const rowX = isRow0 ? sw1X - 110 + col * 44 : sw1X - 88 + col * 44;
    const rowY = isRow0 ? sw1Y + 95 : sw1Y + 165;

    return {
      id: "dev-" + (d.mac ? d.mac.replace(/:/g, "").toLowerCase() : `lan1-${i}`),
      name: d.name,
      type: (d.category as any) || "router",
      x: rowX,
      y: rowY,
      selected: i === 1,
      cableQuality: d.cableHealth?.score ?? 100,
      portIndex: i + 1,
      ip: d.ip,
      mac: d.mac,
      blocked: d.blocked,
      vendor: d.vendor,
    };
  });

  const mapDevs2: MapDevice[] = lan2.map((d, i) => {
    const isRow0 = i < 5;
    const col = isRow0 ? i : i - 5;
    const rowX = isRow0 ? sw2X - 92 + col * 46 : sw2X - 69 + col * 46;
    const rowY = isRow0 ? sw2Y + 95 : sw2Y + 155;

    return {
      id: "dev-" + (d.mac ? d.mac.replace(/:/g, "").toLowerCase() : `lan2-${i}`),
      name: d.name,
      type: (d.category as any) || "router",
      x: rowX,
      y: rowY,
      selected: false,
      cableQuality: d.cableHealth?.score ?? 100,
      portIndex: i + 1,
      ip: d.ip,
      mac: d.mac,
      blocked: d.blocked,
      vendor: d.vendor,
    };
  });

  return [
    {
      id: "switch-salon",
      name: "سويتش الصالون (LAN1)",
      x: sw1X,
      y: sw1Y,
      ports: Math.max(8, lan1.length + 1 <= 8 ? 8 : 16),
      uplinkHub: "LAN1",
      uplinkColor: "#5B3DF5",
      selected: true,
      devices: mapDevs1,
    },
    {
      id: "switch-bureau",
      name: "سويتش المكتب (LAN2)",
      x: sw2X,
      y: sw2Y,
      ports: Math.max(8, lan2.length + 1 <= 8 ? 8 : 16),
      uplinkHub: "LAN2",
      uplinkColor: "#FF7A45",
      selected: false,
      devices: mapDevs2,
    },
  ];
}

export function buildInitialNodes(
  cableDevices: any[] = [],
  wifiClients: any[] = [],
  offlineCable: any[] = [],
  serverCanvas?: { positions?: Record<string, { x: number; y: number }> }
): MapNode[] {
  const localSaved = loadSavedPositions();
  const saved: Record<string, { x: number; y: number }> = {
    ...(serverCanvas?.positions || {}),
    ...localSaved,
  };

  const getNodePos = (id: string, defaultX: number, defaultY: number) => {
    if (saved[id] && typeof saved[id].x === "number" && typeof saved[id].y === "number") {
      return { x: saved[id].x, y: saved[id].y };
    }
    return { x: defaultX, y: defaultY };
  };

  const wanPos = getNodePos("node-wan", 550, 32);
  const routerPos = getNodePos("node-router", 550, 265);
  const lan1Pos = getNodePos("hub-lan1", 355, 105);
  const lan2Pos = getNodePos("hub-lan2", 355, 435);
  const wifiPos = getNodePos("hub-wifi", 785, 70);
  const lan3Pos = getNodePos("hub-lan3", 785, 355);
  const lan4Pos = getNodePos("hub-lan4", 785, 505);
  const sw1Pos = getNodePos("switch-salon", 190, 105);
  const sw2Pos = getNodePos("switch-bureau", 190, 435);

  const sw1SubPos = getNodePos("switch-lan1-sub", sw1Pos.x - 275, sw1Pos.y);
  const sw1CascadePos = getNodePos("switch-lan1-cascade", sw1SubPos.x, sw1SubPos.y + 195);

  const nodes: MapNode[] = [
    {
      id: "node-wan",
      name: "الإنترنت",
      type: "wan",
      x: wanPos.x,
      y: wanPos.y,
    },
    {
      id: "node-router",
      name: "ZTE F680",
      type: "router",
      x: routerPos.x,
      y: routerPos.y,
      parentId: "node-wan",
      ip: "192.168.1.1",
    },
    {
      id: "hub-lan1",
      name: "LAN1",
      type: "hub",
      x: lan1Pos.x,
      y: lan1Pos.y,
      parentId: "node-router",
      uplinkColor: "#5B3DF5",
      uplinkHub: "LAN1",
    },
    {
      id: "hub-lan2",
      name: "LAN2",
      type: "hub",
      x: lan2Pos.x,
      y: lan2Pos.y,
      parentId: "node-router",
      uplinkColor: "#FF7A45",
      uplinkHub: "LAN2",
    },
    {
      id: "hub-wifi",
      name: "الويفي",
      type: "hub",
      x: wifiPos.x,
      y: wifiPos.y,
      parentId: "node-router",
      uplinkColor: "#5B3DF5",
      uplinkHub: "WIFI",
    },
    {
      id: "hub-lan3",
      name: "LAN3",
      type: "hub",
      x: lan3Pos.x,
      y: lan3Pos.y,
      parentId: "node-router",
      uplinkColor: "#D7F25C",
      uplinkHub: "LAN3",
    },
    {
      id: "hub-lan4",
      name: "LAN4",
      type: "hub",
      x: lan4Pos.x,
      y: lan4Pos.y,
      parentId: "node-router",
      uplinkColor: "#14121F",
      uplinkHub: "LAN4",
    },
    {
      id: "switch-salon",
      name: "سويتش 1 الصالون (LAN1)",
      type: "switch",
      x: sw1Pos.x,
      y: sw1Pos.y,
      parentId: "hub-lan1",
      ports: 8,
      uplinkHub: "LAN1",
      uplinkColor: "#5B3DF5",
      selected: false,
    },
    {
      id: "switch-lan1-sub",
      name: "سويتش 2 (LAN1)",
      type: "switch",
      x: sw1SubPos.x,
      y: sw1SubPos.y,
      parentId: "hub-lan1",
      ports: 8,
      uplinkHub: "LAN1",
      uplinkColor: "#5B3DF5",
      selected: false,
    },
    {
      id: "switch-lan1-cascade",
      name: "سويتش الجيران (موزع)",
      type: "switch",
      x: sw1CascadePos.x,
      y: sw1CascadePos.y,
      parentId: "switch-lan1-sub",
      portIndex: 2,
      ports: 5,
      uplinkHub: "LAN1",
      uplinkColor: "#8B6CFF",
      selected: false,
    },
    {
      id: "switch-bureau",
      name: "سويتش المكتب (LAN2)",
      type: "switch",
      x: sw2Pos.x,
      y: sw2Pos.y,
      parentId: "hub-lan2",
      ports: 8,
      uplinkHub: "LAN2",
      uplinkColor: "#FF7A45",
      selected: false,
    },
  ];

  const portAssignments = loadPortAssignments();
  const savedParents = loadDeviceParents();

  // Find L9AHIRA router ID if present for hierarchical phone attachment
  const l9ahiraRouter = (cableDevices || []).find(
    (d) => d.name === "L9AHIRA RACHID 1" || (d.group === "L9AHIRA RACHID" && d.category === "router")
  );
  const l9ahiraRouterId = l9ahiraRouter?.mac
    ? "dev-" + l9ahiraRouter.mac.replace(/:/g, "").toLowerCase()
    : "dev-l9ahira-1";

  // LAN1 Online Devices (smart distribution + auto port tracing)
  const lan1 = (cableDevices || []).filter((d) => d.port === "LAN1" && d.online);
  let salonCount = 0;
  lan1.forEach((d, i) => {
    const upperMac = (d.mac || "").toUpperCase();
    const devId = "dev-" + (d.mac ? d.mac.replace(/:/g, "").toLowerCase() : `lan1-${i}`);
    const assignedPort = portAssignments[upperMac];
    const hasExplicitPort = typeof assignedPort === "number";

    // Hierarchy resolution: respect saved parent first, then smart grouping
    const savedParentEntry = savedParents[upperMac] || savedParents[devId];
    let parentId = "switch-salon";
    let portIndex = hasExplicitPort ? assignedPort : undefined;

    if (savedParentEntry) {
      parentId = savedParentEntry.parentId;
      if (savedParentEntry.portIndex !== undefined) {
        portIndex = savedParentEntry.portIndex;
      }
    } else {
      // Smart Auto-Topology based on user's network structure:
      if (d.name.includes("L9AHIRA") && d.category === "phone") {
        parentId = l9ahiraRouterId;
      } else if (
        d.name === "L9AHIRA RACHID 1" ||
        d.name === "L9AHIRA RACHID 2" ||
        d.name.toLowerCase().includes("l9ahira") ||
        d.name === "RETALI" ||
        d.name === "smail" ||
        d.name === "3azkri"
      ) {
        parentId = "switch-lan1-cascade";
      } else if (salonCount < 4) {
        parentId = "switch-salon";
        salonCount += 1;
      } else {
        parentId = "switch-lan1-sub";
      }
    }

    // Default positioning based on parent switch/device
    const isRow0 = i % 4 < 2;
    const col = i % 4;
    let defaultX = sw1Pos.x - 70 + col * 46;
    let defaultY = sw1Pos.y + 75;

    if (parentId === "switch-lan1-sub") {
      defaultX = sw1SubPos.x - 70 + col * 46;
      defaultY = sw1SubPos.y + 75;
    } else if (parentId === "switch-lan1-cascade") {
      defaultX = sw1CascadePos.x - 60 + (i % 3) * 44;
      defaultY = sw1CascadePos.y + 75;
    } else if (parentId === l9ahiraRouterId) {
      defaultX = sw1CascadePos.x - 50;
      defaultY = sw1CascadePos.y + 135;
    }

    const pos = getNodePos(devId, defaultX, defaultY);

    nodes.push({
      id: devId,
      name: d.name,
      type: "device",
      subType: (d.category as any) || "router",
      x: pos.x,
      y: pos.y,
      parentId,
      portIndex,
      ip: d.ip,
      mac: d.mac,
      cableQuality: d.cableHealth?.score ?? 100,
      blocked: d.blocked,
      vendor: d.vendor,
      selected: false,
    });
  });

  // LAN2 Online Devices
  const lan2 = (cableDevices || []).filter((d) => d.port === "LAN2" && d.online);
  lan2.forEach((d, i) => {
    const upperMac = (d.mac || "").toUpperCase();
    const assignedPort = portAssignments[upperMac];
    const hasExplicitPort = typeof assignedPort === "number";
    const devId = "dev-" + (d.mac ? d.mac.replace(/:/g, "").toLowerCase() : `lan2-${i}`);

    const savedParentEntry = savedParents[upperMac] || savedParents[devId];
    let parentId = "switch-bureau";
    let portIndex = hasExplicitPort ? assignedPort : undefined;

    if (savedParentEntry) {
      parentId = savedParentEntry.parentId;
      if (savedParentEntry.portIndex !== undefined) {
        portIndex = savedParentEntry.portIndex;
      }
    }

    const isRow0 = i < 5;
    const col = isRow0 ? i : i - 5;
    const defaultX = isRow0 ? sw2Pos.x - 92 + col * 46 : sw2Pos.x - 69 + col * 46;
    const defaultY = isRow0 ? sw2Pos.y + 95 : sw2Pos.y + 155;
    const pos = getNodePos(devId, defaultX, defaultY);

    nodes.push({
      id: devId,
      name: d.name,
      type: "device",
      subType: (d.category as any) || "router",
      x: pos.x,
      y: pos.y,
      parentId,
      portIndex,
      ip: d.ip,
      mac: d.mac,
      cableQuality: d.cableHealth?.score ?? 100,
      blocked: d.blocked,
      vendor: d.vendor,
      selected: false,
    });
  });

  // LAN3 Device (if online)
  const lan3Dev = (cableDevices || []).find((d) => d.port === "LAN3" && d.online);
  if (lan3Dev) {
    const devId = "dev-lan3";
    const pos = getNodePos(devId, lan3Pos.x + 165, lan3Pos.y);
    nodes.push({
      id: devId,
      name: lan3Dev.name,
      type: "device",
      subType: (lan3Dev.category as any) || "router",
      x: pos.x,
      y: pos.y,
      parentId: "hub-lan3",
      ip: lan3Dev.ip,
      mac: lan3Dev.mac,
      cableQuality: lan3Dev.cableHealth?.score ?? 100,
    });
  }

  // LAN4 Device (if online)
  const lan4Dev = (cableDevices || []).find((d) => d.port === "LAN4" && d.online);
  if (lan4Dev) {
    const devId = "dev-lan4";
    const pos = getNodePos(devId, lan4Pos.x + 165, lan4Pos.y);
    nodes.push({
      id: devId,
      name: lan4Dev.name,
      type: "device",
      subType: "camera",
      x: pos.x,
      y: pos.y,
      parentId: "hub-lan4",
      ip: lan4Dev.ip,
      mac: lan4Dev.mac,
      cableQuality: lan4Dev.cableHealth?.score ?? 100,
    });
  }

  // Real Wi-Fi Connected Clients as draggable nodes (cleanly centered above LAN3)
  const wifiApX = wifiPos.x + 115;
  (wifiClients || []).forEach((c, i) => {
    const row = Math.floor(i / 5);
    const col = i % 5;
    const colsInRow = Math.min(5, (wifiClients || []).length - row * 5);
    const defaultX = Math.round(wifiApX - ((colsInRow - 1) * 56) / 2 + col * 56);
    const defaultY = wifiPos.y + 72 + row * 68;
    const devId = "dev-wifi-" + (c.mac ? c.mac.replace(/:/g, "").toLowerCase() : i);
    const pos = getNodePos(devId, defaultX, defaultY);
    const safeName = c.name || c.friendlyName || (c.hostname && c.hostname !== "Wi-Fi Device" ? c.hostname : (c.vendor || c.ip || (c.mac ? `هاتف ${c.mac.slice(-5)}` : `هاتف ${i + 1}`)));
    nodes.push({
      id: devId,
      name: safeName,
      type: "device",
      subType: "phone",
      x: pos.x,
      y: pos.y,
      parentId: "hub-wifi",
      ip: c.ip,
      mac: c.mac,
      vendor: c.vendor,
      selected: false,
    });
  });

  // All Disconnected Devices (real data only, no fake limit)
  (offlineCable || []).forEach((d, i) => {
    const devId = "dev-offline-" + (d.mac ? d.mac.replace(/:/g, "").toLowerCase() : i);
    const defaultX = 420 + (i % 4) * 65;
    const defaultY = 508 + Math.floor(i / 4) * 55;
    const pos = getNodePos(devId, defaultX, defaultY);
    nodes.push({
      id: devId,
      name: d.name,
      type: "device",
      subType: (d.category as any) || "pc",
      x: pos.x,
      y: pos.y,
      ip: d.ip,
      mac: d.mac,
      parentId: undefined, // disconnected
    });
  });

  // Merge user-added custom nodes (switches, cameras, APs, etc.)
  const customNodes = loadCustomNodes();
  const existingIds = new Set(nodes.map((n) => n.id));
  customNodes.forEach((cn) => {
    if (existingIds.has(cn.id)) return;
    const pos = getNodePos(cn.id, cn.x, cn.y);
    const savedParentEntry = savedParents[cn.id] || (cn.mac ? savedParents[cn.mac.toUpperCase()] : undefined);
    nodes.push({
      ...cn,
      x: pos.x,
      y: pos.y,
      parentId: savedParentEntry ? savedParentEntry.parentId : cn.parentId,
      portIndex: savedParentEntry?.portIndex !== undefined ? savedParentEntry.portIndex : cn.portIndex,
    });
  });

  // Filter out any user-deleted nodes
  const deletedSet = new Set(loadDeletedNodeIds());
  const finalNodes = deletedSet.size > 0 ? nodes.filter((n) => !deletedSet.has(n.id)) : nodes;

  // Apply saved Switch metadata overrides (ports, name, uplink) & auto-assign free ports to unassigned devices
  const switchMeta = loadSwitchMeta();
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

    // Port 1 is reserved as Uplink LED on every switch
    const usedPorts = new Set<number>([1]);
    childSwitches.forEach((cs) => {
      if (typeof cs.portIndex === "number" && cs.portIndex >= 2) {
        usedPorts.add(cs.portIndex);
      }
    });
    childDevices.forEach((cd) => {
      if (typeof cd.portIndex === "number" && cd.portIndex >= 2) {
        usedPorts.add(cd.portIndex);
      }
    });

    const nextFreePort = () => {
      let p = 2;
      while (usedPorts.has(p) && p <= 24) p += 1;
      usedPorts.add(p);
      return p;
    };

    // Auto-trace any child switch or device that has no explicit port (and wasn't manually disconnected via portIndex === 0)
    childSwitches.forEach((cs) => {
      if (cs.portIndex === undefined) {
        cs.portIndex = nextFreePort();
      }
    });
    childDevices.forEach((cd) => {
      if (cd.portIndex === undefined) {
        cd.portIndex = nextFreePort();
      } else if (cd.portIndex === 0) {
        // Explicit manual disconnect -> render as unassigned
        cd.portIndex = undefined;
      }
    });

    const highestPort = usedPorts.size > 0 ? Math.max(...Array.from(usedPorts)) : 1;
    const neededPorts = Math.max(highestPort, 1 + childSwitches.length + childDevices.length);
    if (!override?.ports) {
      sw.ports = neededPorts <= 5 ? 5 : neededPorts <= 8 ? 8 : neededPorts <= 16 ? 16 : 24;
    }
  });

  // Clean per-parent non-overlapping grid layout for devices without saved positions
  const switchIds = new Set(finalNodes.filter((n) => n.type === "switch").map((n) => n.id));
  const groupedByParent = new Map<string, MapNode[]>();
  finalNodes.forEach((n) => {
    if (n.type !== "device" || !n.parentId) return;
    if (n.parentId.startsWith("hub-") || n.parentId === "node-router" || n.parentId === "node-wan") return;
    if (!groupedByParent.has(n.parentId)) groupedByParent.set(n.parentId, []);
    groupedByParent.get(n.parentId)!.push(n);
  });

  groupedByParent.forEach((children, pId) => {
    const parentNode = finalNodes.find((p) => p.id === pId);
    if (!parentNode) return;
    const isSwitch = switchIds.has(pId);
    const maxPerRow = isSwitch ? (children.length > 6 ? 5 : 4) : 3;
    const colGap = 68; // Wide enough so 8-char labels & 100% badges never overlap
    const rowGap = 74;
    const startOffsetY = isSwitch ? 95 : 78;

    children.forEach((child, idx) => {
      // Only reposition if user hasn't manually dragged/saved a position for this device
      if (saved[child.id] && typeof saved[child.id].x === "number") return;
      const row = Math.floor(idx / maxPerRow);
      const col = idx % maxPerRow;
      const colsInThisRow = Math.min(maxPerRow, children.length - row * maxPerRow);
      const rowStartX = parentNode.x - ((colsInThisRow - 1) * colGap) / 2;
      child.x = Math.round(rowStartX + col * colGap);
      child.y = Math.round(parentNode.y + startOffsetY + row * rowGap);
    });
  });

  return finalNodes;
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
      if (n.name === "LAN2") color = "#FF7A45";
      else if (n.name === "LAN3") color = "#8FB000";
      else if (n.name === "LAN4") {
        color = "#14121F";
        dashed = true;
      }
    } else if (parent.type === "hub") {
      color = parent.uplinkColor || (parent.name === "LAN2" ? "#FF7A45" : "#5B3DF5");
    } else if (parent.type === "switch") {
      if (n.type === "switch") {
        color = "#8B6CFF";
        dashed = false;
      } else {
        // Unassigned devices don't draw a port cable until assigned
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
      uplinkHub: (sw.uplinkHub as any) || "LAN1",
      uplinkColor: sw.uplinkColor || "#5B3DF5",
      selected: sw.selected,
      devices: childDevices,
    };
  });
}
