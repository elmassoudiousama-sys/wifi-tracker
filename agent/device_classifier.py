"""Device Classifier & SQLite Persistence (discovered_devices).

Combines passive/local signals (MAC OUI vendor, ICMP TTL, Nmap OS/service
detection, and open ports) into a unified classification with a confidence score.

Legal & Scope Boundaries:
- Strictly limited to the configured local subnet (e.g. 192.168.1.0/24).
- Never performs authentication, brute-force, or credential attempts on any
  discovered device.
- External/secondary routers are explicitly labeled as gateway devices whose
  downstream clients are unknown, without guessing or probing behind them.
"""

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "discovered_devices.db"

GATEWAY_NOTICE = "جهاز بوابة - أجهزة إضافية ورائه غير معروفة"


def init_db(db_path: Path = DB_PATH) -> None:
    """Initialize SQLite discovered_devices table if it does not exist."""
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS discovered_devices (
                mac TEXT PRIMARY KEY,
                ip TEXT,
                vendor TEXT,
                os_guess TEXT,
                device_type_guess TEXT,
                ttl INTEGER,
                open_ports TEXT,
                confidence INTEGER,
                last_seen TEXT,
                discovery_method TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def upsert_discovered_device(info: Dict[str, Any], db_path: Path = DB_PATH) -> None:
    """Insert or update a classified device in SQLite."""
    mac = (info.get("mac") or "").strip().upper()
    if not mac:
        return
    init_db(db_path)
    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute(
            """
            INSERT INTO discovered_devices (
                mac, ip, vendor, os_guess, device_type_guess,
                ttl, open_ports, confidence, last_seen, discovery_method
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(mac) DO UPDATE SET
                ip = excluded.ip,
                vendor = excluded.vendor,
                os_guess = excluded.os_guess,
                device_type_guess = excluded.device_type_guess,
                ttl = COALESCE(excluded.ttl, discovered_devices.ttl),
                open_ports = excluded.open_ports,
                confidence = excluded.confidence,
                last_seen = excluded.last_seen,
                discovery_method = excluded.discovery_method
            """,
            (
                mac,
                info.get("ip", ""),
                info.get("vendor", ""),
                info.get("osGuess", "Unknown"),
                info.get("deviceTypeGuess", "device"),
                info.get("ttl"),
                json.dumps(info.get("openPorts", []), ensure_ascii=False),
                int(info.get("confidence", 0)),
                info.get("lastSeen", datetime.now(timezone.utc).isoformat()),
                info.get("discoveryMethod", "zte-native"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def guess_os_from_ttl(ttl: Optional[int]) -> str:
    """Infer base OS family from IPv4 ICMP TTL."""
    if ttl is None or ttl <= 0:
        return "Unknown"
    if ttl <= 64:
        return "Linux / Android / iOS"
    if ttl <= 128:
        return "Windows"
    if ttl <= 255:
        return "Router / Network OS"
    return "Unknown"


def classify_and_merge(
    mac: str,
    ip: str,
    vendor: str = "",
    hostname: str = "",
    ttl: Optional[int] = None,
    nmap_info: Optional[Dict[str, Any]] = None,
    open_ports: Optional[List[str]] = None,
    http_title: str = "",
    dev_name: str = "",
    discovery_method: str = "zte-native",
    base_category: str = "",
) -> Dict[str, Any]:
    """Merge OUI vendor, TTL, Nmap OS/services, and open ports into discoveryInfo."""
    open_ports = open_ports or []
    nmap_info = nmap_info or {}
    nmap_os = (nmap_info.get("osGuess") or "").strip()
    nmap_type = (nmap_info.get("deviceTypeGuess") or "").strip()
    nmap_services = nmap_info.get("services") or []

    combined = f"{vendor} {hostname} {http_title} {dev_name} {nmap_os}".lower()
    ports_str = " ".join(open_ports + nmap_services).lower()

    # 1. Determine OS Guess (priority: Nmap OS -> Vendor/Hostname hints -> TTL)
    os_guess = "Unknown"
    confidence = 35

    if nmap_os:
        os_guess = nmap_os
        confidence += 35
    elif "iphone" in combined or "ios" in combined or "apple" in combined:
        os_guess = "iOS / macOS"
        confidence += 20
    elif "android" in combined or "redmi" in combined or "xiaomi" in combined or "samsung" in combined:
        os_guess = "Android"
        confidence += 20
    elif "windows" in combined or "smb/pc" in ports_str or "445" in ports_str:
        os_guess = "Windows"
        confidence += 25
    elif ttl is not None:
        os_guess = guess_os_from_ttl(ttl)
        confidence += 15

    if ttl is not None:
        confidence += 10
    if vendor and vendor not in ("Unknown Vendor", "Randomized MAC (Phone/Privacy)"):
        confidence += 15
    if open_ports:
        confidence += 10

    # 2. Determine Device Type Guess
    device_type = base_category or nmap_type or "device"
    if not base_category or base_category == "device":
        if any(k in combined for k in ("tp-link", "tenda", "belkin", "mikrotik", "zte", "router", "openwrt", "h288", "f680", "wr844", "wr940", "archer")):
            device_type = "router"
        elif "554" in ports_str or any(k in combined for k in ("dahua", "hikvision", "dvr", "nvr", "camera")):
            device_type = "camera"
        elif any(k in combined for k in ("smart tv", "tizen", "webos", "chromecast", "android tv")):
            device_type = "tv"
        elif "445" in ports_str or "windows" in os_guess.lower() or any(k in combined for k in ("desktop", "laptop", "pc")):
            device_type = "pc"
        elif any(k in combined for k in ("esp", "tuya", "sonoff", "shelly", "iot", "printer")):
            device_type = "iot"
        elif any(k in combined for k in ("iphone", "android", "redmi", "galaxy", "xiaomi", "huawei", "phone")):
            device_type = "phone"

    is_gateway = device_type == "router"
    gateway_notice = ""

    confidence = max(20, min(98, confidence))
    methods = [m for m in discovery_method.split("+") if m]
    if nmap_os or nmap_services:
        if "nmap" not in methods:
            methods.append("nmap")
    if ttl is not None and "ttl" not in methods:
        methods.append("ttl")

    return {
        "mac": mac.strip().upper(),
        "ip": ip,
        "vendor": vendor,
        "osGuess": os_guess,
        "deviceTypeGuess": device_type,
        "ttl": ttl,
        "openPorts": open_ports,
        "nmapServices": nmap_services,
        "confidence": confidence,
        "discoveryMethod": "+".join(methods) if methods else "zte-native",
        "isGatewayDevice": is_gateway,
        "gatewayNotice": gateway_notice,
        "lastSeen": datetime.now(timezone.utc).isoformat(),
    }
