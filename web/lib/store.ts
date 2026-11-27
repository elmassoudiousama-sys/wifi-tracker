import fs from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

export interface DeviceIdentityInfo {
  stableIds?: string[];
  mdnsServices?: string[];
  radioClass?: string;
  dnaTag?: string;
  sameNameConflict?: boolean;
  diffBadge?: string;
  likelySameAsMac?: string;
  likelySameAsName?: string;
  matchConfidence?: number;
  matchReason?: string;
}

export interface DiscoveryInfo {
  mac: string;
  ip: string;
  vendor?: string;
  osGuess?: string;
  deviceTypeGuess?: string;
  ttl?: number | null;
  openPorts?: string[];
  nmapServices?: string[];
  confidence?: number;
  discoveryMethod?: string;
  isGatewayDevice?: boolean;
  gatewayNotice?: string;
  lastSeen?: string;
}

export interface DeviceState {
  name: string;
  group: string;
  expectedIp: string;
  ip: string;
  ipv6?: string;
  mac: string;
  hostname?: string;
  friendlyName?: string;
  friendlySource?: string;
  online: boolean;
  medium: string;
  port: string;
  rssi?: string;
  snr?: string;
  txRate?: string;
  rxRate?: string;
  linkTime?: string;
  vendor?: string;
  randomizedMac?: boolean;
  latencyMs?: number | null;
  openPorts?: string[];
  httpTitle?: string;
  disconnects?: number;
  blocked: boolean;
  blockInstId?: string;
  note?: string;
  category?: string;
  catName?: string;
  catIcon?: string;
  cableHealth?: {
    quality: string;
    score: number;
    jitter: number;
    loss: number;
    avg?: number | null;
  };
  discoveryInfo?: DiscoveryInfo;
  identity?: DeviceIdentityInfo;
}

export interface WifiClient {
  mac: string;
  ip: string;
  ipv6?: string;
  hostname: string;
  friendlyName?: string;
  friendlySource?: string;
  port: string;
  ssidName?: string;
  rssi?: string;
  noise?: string;
  snr?: string;
  txRate?: string;
  rxRate?: string;
  mcs?: string;
  mode?: string;
  band?: string;
  linkTime?: string;
  vendor?: string;
  randomizedMac?: boolean;
  latencyMs?: number | null;
  blocked: boolean;
  blockInstId?: string;
  isKnown?: boolean;
  category?: string;
  catName?: string;
  catIcon?: string;
  discoveryInfo?: DiscoveryInfo;
  identity?: DeviceIdentityInfo;
}

export interface UnknownDevice {
  mac: string;
  ip: string;
  hostname: string;
  friendlyName?: string;
  friendlySource?: string;
  port: string;
  medium: string;
  vendor?: string;
  randomizedMac?: boolean;
  latencyMs?: number | null;
  openPorts?: string[];
  httpTitle?: string;
  blocked: boolean;
  blockInstId?: string;
  category?: string;
  catName?: string;
  catIcon?: string;
  discoveryInfo?: DiscoveryInfo;
  identity?: DeviceIdentityInfo;
}

export interface AlertItem {
  type: string;
  mac: string;
  name: string;
  message: string;
  at?: string;
}

export type CommandAction =
  | "block"
  | "unblock"
  | "reboot_router"
  | "run_diagnostics"
  | "rescan_network"
  | "wifi_acl_block"
  | "wifi_acl_unblock"
  | "auto_track_ban"
  | "unban_identity"
  | "set_ssid_config"
  | "set_port_mirror";

export interface PendingCommand {
  id: string;
  action: CommandAction;
  mac: string;
  name: string;
  instId?: string;
  interface?: string;
  enable?: boolean;
  isolation?: boolean;
  hidden?: boolean;
  mirrorSrc?: string;
  mirrorDest?: string;
  createdAt: string;
}

export interface DeviceMeta {
  name?: string;
  group?: string;
  paymentStatus?: "paid" | "late";
  note?: string;
  removed?: boolean;
  category?: string;
  catName?: string;
  catIcon?: string;
}

export interface KnownDeviceEntry {
  name: string;
  ip: string;
  mac: string;
  group: string;
}

export interface LanPortStat {
  port: string;
  status: string;
  speed: string;
  duplex: string;
  inBytes: number;
  outBytes: number;
  totalBytes: number;
  inErrors?: number;
  outErrors?: number;
}

export interface TopologyNodeMeta {
  portOverride?: string;
  parentMac?: string;
}

export interface CanvasSwitch {
  id: string;
  name: string;
  kind?: "switch" | "router";
  portCount?: number;
  ip?: string;
}

export interface CanvasEdge {
  id: string;
  fromId: string;
  fromPort?: string;
  toId: string;
}

export interface CanvasLayout {
  positions: Record<string, { x: number; y: number }>;
  switches: CanvasSwitch[];
  edges: CanvasEdge[];
}

export interface BlockedRule {
  instId: string;
  name: string;
  mac: string;
}

export interface LanPortRate {
  port: string;
  rxMbps: number;
  txMbps: number;
  totalMbps: number;
  isHog: boolean;
  devices?: string[];
  totalInGB?: number;
  totalOutGB?: number;
}

export interface BlackoutEvent {
  id: string;
  mac: string;
  name: string;
  port: string;
  startedAt: string;
  endedAt?: string | null;
  duration: string;
  active: boolean;
}

export interface WlanSsidConfig {
  instId: string;
  alias: string;
  essid: string;
  band: string;
  enable: boolean;
  isolation: boolean;
  hidden: boolean;
  maxUsers: number;
  authMode?: string;
  encryptType?: string;
}

export interface WlanAclRule {
  instId: string;
  name: string;
  mac: string;
  interface: string;
}

export interface BannedIdentity {
  id: string;
  name: string;
  sourceMac: string;
  bannedMacs: string[];
  blockTypes: string[];
  interface?: string;
  uniqueHostname?: string;
  stableIds?: string[];
  autoProtected?: boolean;
  reblockCount?: number;
  lastReblockAt?: string;
  createdAt?: string;
}

export interface DhcpLeaseEntry {
  ip: string;
  mac: string;
  hostname: string;
  port: string;
  expiresSec: number;
}

export interface RouterHealthInfo {
  model: string;
  softwareVer?: string;
  hardwareVer?: string;
  cpuUsage: number;
  memUsage: number;
  uptimeSec: number;
  rxPowerDbm?: string;
  txPowerDbm?: string;
  tempC?: string;
  los?: boolean;
  regStatus?: string;
}

export interface PortMirrorConfig {
  enable: boolean;
  src: string;
  dest: string;
}

export interface RogueDhcpInfo {
  detected: boolean;
  serverIp?: string;
  serverName?: string;
  foreignSubnets?: Array<{ ip: string; mac: string; port: string; vendor: string }>;
  ipv6Rogues?: Array<{ ipv6: string; mac: string; vendor: string }>;
  message: string;
}

export interface WanDiagnostics {
  gatewayPing?: number | null;
  internetPing?: number | null;
  status: string;
  checkedAt: string;
}

export interface CorrelationInsight {
  id: string;
  type: "ap_child" | "switch_group";
  confidence: number;
  reason: string;
  sourceMac: string;
  sourceName: string;
  targetMac: string;
  targetName: string;
  port?: string;
  evidenceCount: number;
  lastObserved: string;
}

export interface MonitorState {
  updatedAt: string | null;
  totalKnown: number;
  onlineCount: number;
  unknownCount: number;
  devices: DeviceState[];
  wifiClients?: WifiClient[];
  unknownDevices: UnknownDevice[];
  blockedRules?: BlockedRule[];
  wlanAclRules?: WlanAclRule[];
  bannedIdentities?: BannedIdentity[];
  wlanSsids?: WlanSsidConfig[];
  dhcpLeases?: DhcpLeaseEntry[];
  routerHealth?: RouterHealthInfo;
  portMirror?: PortMirrorConfig;
  lanPorts?: LanPortStat[];
  lanPortRates?: LanPortRate[];
  blackoutHistory?: BlackoutEvent[];
  rogueDhcp?: RogueDhcpInfo;
  diagnostics?: WanDiagnostics;
  correlationInsights?: CorrelationInsight[];
  topology?: Record<string, TopologyNodeMeta>;
  canvas?: CanvasLayout;
  alerts: AlertItem[];
  commands: PendingCommand[];
  deviceMeta: Record<string, DeviceMeta>;
  addedDevices: KnownDeviceEntry[];
  devicesDirty?: boolean;
}

const DEFAULT_STATE: MonitorState = {
  updatedAt: null,
  totalKnown: 0,
  onlineCount: 0,
  unknownCount: 0,
  devices: [],
  wifiClients: [],
  unknownDevices: [],
  blockedRules: [],
  lanPorts: [],
  topology: {},
  canvas: { positions: {}, switches: [], edges: [] },
  alerts: [],
  commands: [],
  deviceMeta: {},
  addedDevices: [],
  devicesDirty: false,
};

const REDIS_KEY = "fiber_monitor_state_v1";
const LOCKOUT_KEY = "fiber_monitor_auth_lockouts_v1";
const LOCAL_DIR = process.env.VERCEL ? path.join("/tmp", ".data") : path.join(process.cwd(), ".data");
const LOCAL_FILE = path.join(LOCAL_DIR, "state.json");
const LOCKOUT_FILE = path.join(LOCAL_DIR, "auth-lockouts.json");

export const MAX_AUTH_ATTEMPTS = 3;
export const AUTH_LOCKOUT_MS = 24 * 60 * 60 * 1000;

interface AuthLockoutEntry {
  count: number;
  lockedUntil?: number;
  lastFailAt?: number;
}

export function isAuthorizedAdmin(req: Request): boolean {
  const pass =
    process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV !== "production" ? "dev-admin" : "");
  return Boolean(pass && req.headers.get("x-admin-password") === pass);
}

function getClientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for") || "";
  const firstIp = xff.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  return firstIp || realIp || "default";
}

function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();
}

let neonTableReady = false;

async function getNeonSql() {
  const dbUrl = getDatabaseUrl();
  const sql = neon(dbUrl);
  if (!neonTableReady) {
    await sql`
      CREATE TABLE IF NOT EXISTS monitor_state (
        id TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    neonTableReady = true;
  }
  return sql;
}

function hasUpstash(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function readKeyJson<T>(key: string, localPath: string, fallback: T): Promise<T> {
  if (getDatabaseUrl()) {
    try {
      const sql = await getNeonSql();
      const rows = (await sql`SELECT payload FROM monitor_state WHERE id = ${key} LIMIT 1`) as Array<{
        payload?: string;
      }>;
      const raw = rows?.[0]?.payload;
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      console.error(`[Neon read ${key} error]`, err);
      return fallback;
    }
  }

  if (hasUpstash()) {
    try {
      const url = `${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
        cache: "no-store",
      });
      if (!res.ok) return fallback;
      const data = await res.json();
      if (!data.result) return fallback;
      return JSON.parse(data.result) as T;
    } catch {
      return fallback;
    }
  }

  try {
    if (!fs.existsSync(localPath)) return fallback;
    const raw = fs.readFileSync(localPath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeKeyJson(key: string, localPath: string, value: unknown): Promise<void> {
  const serialized = JSON.stringify(value);
  if (getDatabaseUrl()) {
    const sql = await getNeonSql();
    await sql`
      INSERT INTO monitor_state (id, payload, updated_at)
      VALUES (${key}, ${serialized}, NOW())
      ON CONFLICT (id)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
    return;
  }

  if (hasUpstash()) {
    const url = `${process.env.UPSTASH_REDIS_REST_URL}/set/${key}`;
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serialized),
      cache: "no-store",
    });
    return;
  }

  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, serialized, "utf-8");
}

export async function getAuthLockStatus(req: Request): Promise<{
  locked: boolean;
  attemptsLeft: number;
  maxAttempts: number;
  lockedUntil?: string;
}> {
  const clientKey = getClientKey(req);
  const now = Date.now();
  const lockouts = await readKeyJson<Record<string, AuthLockoutEntry>>(LOCKOUT_KEY, LOCKOUT_FILE, {});
  const rec = lockouts[clientKey];
  if (rec?.lockedUntil && rec.lockedUntil > now) {
    return {
      locked: true,
      attemptsLeft: 0,
      maxAttempts: MAX_AUTH_ATTEMPTS,
      lockedUntil: new Date(rec.lockedUntil).toISOString(),
    };
  }
  const used = rec && (!rec.lockedUntil || rec.lockedUntil <= now) ? rec.count || 0 : 0;
  return {
    locked: false,
    attemptsLeft: Math.max(0, MAX_AUTH_ATTEMPTS - used),
    maxAttempts: MAX_AUTH_ATTEMPTS,
  };
}

export async function authorizeAdmin(req: Request): Promise<
  | { ok: true }
  | {
      ok: false;
      status: 401 | 429;
      body: {
        error: string;
        locked: boolean;
        attemptsLeft: number;
        maxAttempts: number;
        lockedUntil?: string;
        retryAfterSeconds?: number;
      };
    }
> {
  const clientKey = getClientKey(req);
  const now = Date.now();
  const lockouts = await readKeyJson<Record<string, AuthLockoutEntry>>(LOCKOUT_KEY, LOCKOUT_FILE, {});
  const rec = lockouts[clientKey];

  if (rec?.lockedUntil && rec.lockedUntil > now) {
    return {
      ok: false,
      status: 429,
      body: {
        error: "Locked",
        locked: true,
        attemptsLeft: 0,
        maxAttempts: MAX_AUTH_ATTEMPTS,
        lockedUntil: new Date(rec.lockedUntil).toISOString(),
        retryAfterSeconds: Math.max(1, Math.ceil((rec.lockedUntil - now) / 1000)),
      },
    };
  }

  if (isAuthorizedAdmin(req)) {
    if (rec) {
      delete lockouts[clientKey];
      await writeKeyJson(LOCKOUT_KEY, LOCKOUT_FILE, lockouts);
    }
    return { ok: true };
  }

  const prevCount = rec && (!rec.lockedUntil || rec.lockedUntil <= now) ? rec.count || 0 : 0;
  const nextCount = prevCount + 1;

  if (nextCount >= MAX_AUTH_ATTEMPTS) {
    const lockedUntil = now + AUTH_LOCKOUT_MS;
    lockouts[clientKey] = { count: nextCount, lockedUntil, lastFailAt: now };
    await writeKeyJson(LOCKOUT_KEY, LOCKOUT_FILE, lockouts);
    return {
      ok: false,
      status: 429,
      body: {
        error: "Locked",
        locked: true,
        attemptsLeft: 0,
        maxAttempts: MAX_AUTH_ATTEMPTS,
        lockedUntil: new Date(lockedUntil).toISOString(),
        retryAfterSeconds: Math.ceil(AUTH_LOCKOUT_MS / 1000),
      },
    };
  }

  lockouts[clientKey] = { count: nextCount, lastFailAt: now };
  await writeKeyJson(LOCKOUT_KEY, LOCKOUT_FILE, lockouts);
  return {
    ok: false,
    status: 401,
    body: {
      error: "Unauthorized",
      locked: false,
      attemptsLeft: MAX_AUTH_ATTEMPTS - nextCount,
      maxAttempts: MAX_AUTH_ATTEMPTS,
    },
  };
}

export async function readState(): Promise<MonitorState> {
  const data = await readKeyJson<Partial<MonitorState>>(REDIS_KEY, LOCAL_FILE, {});
  return { ...DEFAULT_STATE, ...data };
}

export async function writeState(state: MonitorState): Promise<void> {
  await writeKeyJson(REDIS_KEY, LOCAL_FILE, state);
}

export function mergeDevicesWithMeta(
  devices: DeviceState[],
  metaMap: Record<string, DeviceMeta>
): DeviceState[] {
  return devices
    .filter((d) => !metaMap[d.mac.toUpperCase()]?.removed)
    .map((d) => {
      const m = metaMap[d.mac.toUpperCase()] || {};
      return {
        ...d,
        name: m.name || d.name,
        group: m.group || d.group,
        note: m.note || "",
        category: m.category || d.category,
        catName: m.catName || d.catName,
        catIcon: m.catIcon || d.catIcon,
      };
    });
}
