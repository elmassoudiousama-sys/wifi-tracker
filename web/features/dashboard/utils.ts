import type { DeviceState } from "@/lib/store";

export function formatPortLabel(port?: string): string {
  if (!port || port === "-" || port.trim() === "") return "—";
  if (port.startsWith("LAN")) return port;
  if (port.includes("AP1")) return "Wi-Fi 2.4G";
  if (port.includes("AP2")) return "Wi-Fi 5G";
  if (port.includes("WIFI")) return "Wi-Fi";
  return port;
}

export function formatClock(iso?: string | null): string {
  return (iso ? new Date(iso) : new Date()).toLocaleTimeString("en-GB", { hour12: false });
}

export function isWifiDevice(device: DeviceState): boolean {
  const port = (device.port || "").toUpperCase();
  const medium = (device.medium || "").toUpperCase();
  const cat = (device.category || "").toLowerCase();
  return medium === "WLAN" || port.includes("WIFI") || port.includes("AP") || cat === "phone";
}

export function hasWebAdmin(device: DeviceState | Record<string, unknown>): boolean {
  const record = device as Record<string, unknown>;
  const ip = String(record.ip || "");
  if (!ip || ip === "0.0.0.0" || ip === "-") return false;
  const category = String(record.category || "").toLowerCase();
  const categoryName = String(record.catName || "").toLowerCase();
  if (category === "router" || category === "camera" || categoryName.includes("روتور") || categoryName.includes("كاميرا")) return true;
  const ports = (record.openPorts as string[]) || [];
  if (ports.some((port) => port.includes("80") || port.includes("443") || port.includes("8080"))) return true;
  const vendor = String(record.vendor || "").toLowerCase();
  const name = String(record.name || "").toLowerCase();
  if (String(record.httpTitle || "").length > 0) return true;
  if (["192.168.1.1", "192.168.1.112", "192.168.1.108"].includes(ip)) return true;
  return (
    ["dahua", "router", "tp-link", "tenda"].some((value) => vendor.includes(value)) ||
    ["biltran", "dvr", "router", "zkri", "abdelmnan"].some((value) => name.includes(value))
  );
}

export function credentialsFor(vendorRaw: unknown): string {
  const vendor = String(vendorRaw || "").toLowerCase();
  if (vendor.includes("zte")) return "admin / (كود الروتور) أو user / user";
  if (vendor.includes("dahua")) return "admin / admin (أو كود DVR)";
  if (vendor.includes("tp-link")) return "admin / admin أو tplinkwifi.net";
  if (vendor.includes("tenda")) return "admin (أو فارغ)";
  return "admin / admin أو (كود الروتور)";
}

export function healthClass(score: number): string {
  return score >= 85 ? "cable-good" : score >= 65 ? "cable-warn" : "cable-bad";
}
