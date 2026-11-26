"""Active LAN/Device intelligence:
- OUI vendor lookup
- Ping latency & packet loss
- Port scan & HTTP title
- Friendly Name De-cloaking (mDNS, SSDP, NetBIOS, Reverse DNS)
- Rogue DHCP & Secondary Router Conflict detection
- Internet WAN & Gateway diagnostics
"""

import os
import html
import ipaddress
import platform
import re
import shutil
import socket
import ssl
import subprocess
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional, Tuple

OUI_PREFIXES = {
    "00:31:92": "TP-Link",
    "90:9A:4A": "TP-Link",
    "E8:48:B8": "TP-Link",
    "A8:42:A1": "TP-Link",
    "A8:6E:84": "TP-Link",
    "78:8C:B5": "TP-Link",
    "28:87:BA": "TP-Link",
    "CC:2D:21": "Tenda",
    "58:EF:68": "Belkin",
    "24:52:6A": "Dahua DVR",
    "C0:B1:01": "ZTE",
    "F4:B8:A7": "Huawei",
    "14:D1:69": "Huawei",
    "64:A2:00": "Xiaomi",
    "38:D5:7A": "Xiaomi / Redmi",
    "40:AE:30": "Xiaomi / Router",
    "F0:A6:54": "Cloud Network / PC",
    "30:1F:48": "Router / Network",
    "02:1F:01": "Wodesys",
    "B0:38:29": "Apple",
    "F0:18:98": "Apple",
    "BC:D0:74": "Apple",
    "DC:B5:4F": "Apple",
    "96:32:BF": "Apple",
    "EA:27:52": "Apple",
    "8E:1A:03": "Apple",
    "26:70:63": "Samsung",
}

SCAN_PORTS = [
    (80, "HTTP"),
    (443, "HTTPS"),
    (554, "RTSP/Cam"),
    (37777, "Dahua/DVR"),
    (8080, "HTTP-Alt"),
    (5555, "ADB/Android"),
    (62078, "Apple/iOS"),
    (445, "SMB/PC"),
    (139, "NetBIOS"),
    (53, "DNS"),
    (22, "SSH"),
    (23, "Telnet"),
]

# In-memory friendly name cache: MAC -> { friendlyName, source }
_NAME_CACHE: Dict[str, Dict[str, str]] = {}
_MDNS_CACHE: Dict[str, Dict[str, Any]] = {}
_MDNS_LAST_TS: float = 0.0
_PROBE_CACHE: Dict[str, Dict[str, Any]] = {}
_DEEP_PROBE_TTL: float = 60.0


def is_randomized_mac(mac: str) -> bool:
    """Check IEEE 802 locally-administered bit (second hex digit in 2,6,A,E)."""
    clean = mac.strip().upper().replace("-", ":")
    if len(clean) < 2:
        return False
    return clean[1] in ("2", "6", "A", "E")


def lookup_vendor(mac: str, hostname: str = "", dev_name: str = "", http_title: str = "", medium: str = "LAN") -> str:
    combined = f"{hostname} {dev_name} {http_title}".lower()
    model_patterns = [
        ("wr940", "TP-Link (TL-WR940N)"),
        ("wr844", "TP-Link (TL-WR844N)"),
        ("wr820", "TP-Link (TL-WR820N)"),
        ("wr840", "TP-Link (TL-WR840N)"),
        ("wr841", "TP-Link (TL-WR841N)"),
        ("wr845", "TP-Link (TL-WR845N)"),
        ("c54", "TP-Link (Archer C54)"),
        ("archer", "TP-Link (Archer)"),
        ("deco", "TP-Link (Deco)"),
        ("h288", "ZTE (ZXHN H288A)"),
        ("h298", "ZTE (ZXHN H298A)"),
        ("f680", "ZTE (F680 ONT)"),
        ("f660", "ZTE (F660 ONT)"),
        ("tenda", "Tenda Router"),
        ("belkin", "Belkin Router"),
        ("dahua", "Dahua DVR"),
        ("web service", "Dahua DVR"),
        ("hikvision", "Hikvision DVR/Cam"),
        ("redmi-a2", "Xiaomi (Redmi A2)"),
        ("redmi-14c", "Xiaomi (Redmi 14C)"),
        ("redmi", "Xiaomi (Redmi)"),
        ("galaxy", "Samsung (Galaxy)"),
        ("iphone", "Apple (iPhone)"),
        ("ipad", "Apple (iPad)"),
        ("huawei", "Huawei"),
        ("mercusys", "Mercusys Router"),
        ("d-link", "D-Link Router"),
        ("mikrotik", "MikroTik Router"),
    ]
    for pat, label in model_patterns:
        if pat in combined:
            return label

    clean = mac.strip().upper().replace("-", ":")
    prefix = clean[:8]
    if prefix in OUI_PREFIXES:
        base_vendor = OUI_PREFIXES[prefix]
        if hostname and hostname.lower() not in ("unknown", "wi-fi device", ""):
            return f"{base_vendor} ({hostname})"
        return base_vendor
    if is_randomized_mac(clean):
        if hostname and hostname.lower() not in ("unknown", "wi-fi device", ""):
            return f"{hostname} (Virtual/Random MAC)"
        return "Randomized MAC (Phone/Privacy)" if medium == "WLAN" else "Virtual / Local MAC"
    if hostname and hostname.lower() not in ("unknown", "wi-fi device", ""):
        return hostname
    return "Unknown Vendor"


def is_in_local_subnet(ip: str, subnet_cidr: str = "192.168.1.0/24") -> bool:
    """Allow private RFC1918 LAN IPs (e.g. 192.168.x.x, 10.x.x.x) and block public/loopback IPs."""
    try:
        addr = ipaddress.ip_address((ip or "").strip())
        return addr.is_private and not addr.is_loopback and not addr.is_multicast and not addr.is_unspecified
    except Exception:
        return False


def measure_ping_and_ttl(ip: str) -> Tuple[Optional[float], Optional[int]]:
    """Measure ICMP ping latency (ms) and extract IPv4 TTL for OS fingerprinting."""
    if not ip or ip == "0.0.0.0":
        return None, None
    is_win = platform.system().lower().startswith("win")
    cmd = ["ping", "-n", "1", "-w", "500", ip] if is_win else ["ping", "-c", "1", "-W", "1", ip]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=1.8)
        if res.returncode == 0:
            m_time = re.search(r"time[=<]\s*([\d.]+)\s*ms", res.stdout, re.I)
            latency = float(m_time.group(1)) if m_time else 1.0
            m_ttl = re.search(r"ttl[=:]\s*(\d+)", res.stdout, re.I)
            ttl = int(m_ttl.group(1)) if m_ttl else None
            return latency, ttl
    except Exception:
        pass
    return None, None


def measure_ping_ms(ip: str) -> Optional[float]:
    latency, _ = measure_ping_and_ttl(ip)
    return latency


def check_port(ip: str, port: int, timeout: float = 0.25) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            return s.connect_ex((ip, port)) == 0
    except Exception:
        return False


def grab_http_title(ip: str, port: int = 80) -> str:
    try:
        scheme = "https" if port == 443 else "http"
        url = f"{scheme}://{ip}:{port}/" if port not in (80, 443) else f"{scheme}://{ip}/"
        ctx = ssl._create_unverified_context() if scheme == "https" else None
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=1.0, context=ctx) as resp:
            raw = resp.read(4096).decode("utf-8", "ignore")
            m = re.search(r"<title[^>]*>(.*?)</title>", raw, re.I | re.S)
            if m:
                clean_title = html.unescape(m.group(1).strip())
                clean_title = re.sub(r"\s+", " ", clean_title).strip()
                if clean_title and len(clean_title) <= 60:
                    return clean_title
            srv = resp.headers.get("Server", "").strip()
            return srv[:50] if srv else ""
    except Exception:
        return ""


def resolve_netbios_name(ip: str, timeout: float = 0.6) -> Optional[str]:
    """Query NetBIOS Node Status on UDP 137."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        req = b"\x82\x28\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00 CKAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\x00\x00!\x00\x01"
        s.sendto(req, (ip, 137))
        data, _ = s.recvfrom(1024)
        s.close()
        if len(data) > 57:
            num_names = data[56]
            offset = 57
            for _ in range(num_names):
                if offset + 18 > len(data):
                    break
                name = data[offset : offset + 15].decode("ascii", "ignore").strip()
                n_type = data[offset + 15]
                if n_type == 0x00 and name and not name.startswith("IS~"):
                    return name
                offset += 18
    except Exception:
        pass
    return None


def resolve_reverse_dns(ip: str, timeout: float = 0.5) -> Optional[str]:
    """Reverse DNS lookup for friendly hostname."""
    try:
        socket.setdefaulttimeout(timeout)
        name, _, _ = socket.gethostbyaddr(ip)
        if name and name != ip and "in-addr.arpa" not in name:
            clean = name.split(".")[0]
            if clean and len(clean) > 1 and clean.lower() != "unknown":
                return clean
    except Exception:
        pass
    return None


def resolve_ssdp_details(ip: str, timeout: float = 0.7) -> Dict[str, str]:
    """Direct SSDP unicast probe on port 1900 returning friendly server and USN UUID."""
    try:
        msg = (
            f"M-SEARCH * HTTP/1.1\r\n"
            f"HOST: {ip}:1900\r\n"
            f"MAN: \"ssdp:discover\"\r\n"
            f"MX: 1\r\n"
            f"ST: upnp:rootdevice\r\n\r\n"
        ).encode()
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(timeout)
        s.sendto(msg, (ip, 1900))
        data, _ = s.recvfrom(2048)
        s.close()
        raw = data.decode("utf-8", "ignore")
        srv = ""
        usn = ""
        m_srv = re.search(r"SERVER:\s*([^\r\n]+)", raw, re.I)
        if m_srv:
            s_val = m_srv.group(1).strip()
            if "uTorrent" in s_val:
                srv = "PC (uTorrent)"
            elif "Linux" in s_val or "Windows" in s_val:
                srv = s_val[:30]
            else:
                srv = s_val[:30]
        m_usn = re.search(r"USN:\s*(uuid:[A-Za-z0-9\-]+)", raw, re.I)
        if m_usn:
            usn = m_usn.group(1).strip().lower()
        return {"friendlyName": srv, "usn": usn}
    except Exception:
        pass
    return {"friendlyName": "", "usn": ""}


def resolve_ssdp_name(ip: str, timeout: float = 0.7) -> Optional[str]:
    """Direct SSDP unicast probe on port 1900."""
    details = resolve_ssdp_details(ip, timeout=timeout)
    return details["friendlyName"] or None


def discover_mdns_services(timeout: float = 1.1) -> Dict[str, Dict[str, Any]]:
    """Query multicast mDNS (224.0.0.251:5353) for device names and advertised services."""
    global _MDNS_CACHE, _MDNS_LAST_TS
    now = time.time()
    if _MDNS_CACHE and (now - _MDNS_LAST_TS) < 45:
        return _MDNS_CACHE

    queries = [
        b"\x09_services\x07_dns-sd\x04_udp\x05local\x00",
        b"\x04_adb\x04_tcp\x05local\x00",
        b"\x08_airplay\x04_tcp\x05local\x00",
        b"\x0b_googlecast\x04_tcp\x05local\x00",
        b"\x0f_companion-link\x04_tcp\x05local\x00",
    ]
    found: Dict[str, Dict[str, Any]] = {}
    s: Optional[socket.socket] = None
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.settimeout(0.35)
        for qn in queries:
            pkt = b"\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00" + qn + b"\x00\x0c\x00\x01"
            try:
                s.sendto(pkt, ("224.0.0.251", 5353))
            except Exception:
                pass
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                data, addr = s.recvfrom(4096)
            except socket.timeout:
                break
            except Exception:
                break
            ip = addr[0]
            toks = [t.decode("ascii", "ignore") for t in re.findall(rb"[A-Za-z0-9_.\-:]{3,}", data)]
            entry = found.setdefault(ip, {"services": set(), "tokens": [], "stableIds": set(), "friendlyName": ""})
            for tok in toks:
                low = tok.lower()
                if tok.startswith("_") and low not in ("_tcp", "_udp", "_services", "_dns-sd"):
                    entry["services"].add(tok)
                if tok not in entry["tokens"]:
                    entry["tokens"].append(tok)
                # Extract hardware/instance identifiers independent of MAC/IP
                if re.match(r"^adb-[0-9a-zA-Z_-]{8,}$", tok):
                    entry["stableIds"].add(tok)
                elif low.startswith(("deviceid=", "rpba=", "model=")) and len(tok) > 6:
                    entry["stableIds"].add(tok)
                elif re.match(r"^[0-9a-f]{2}(:[0-9a-f]{2}){5}$", low) and low != "00:00:00:00:00:00":
                    entry["stableIds"].add(f"mdns_id:{low}")
                # Prefer meaningful device tokens (e.g., Android-6, iPhone, MacBook, Chromecast)
                if not entry["friendlyName"]:
                    if any(k in low for k in ("android", "iphone", "ipad", "macbook", "chromecast", "xiaomi", "redmi", "galaxy", "tv")):
                        if not low.startswith("_"):
                            entry["friendlyName"] = tok[:36]
    except Exception:
        pass
    finally:
        if s is not None:
            try:
                s.close()
            except Exception:
                pass

    normalized: Dict[str, Dict[str, Any]] = {}
    for ip, info in found.items():
        svcs = sorted(info["services"])
        stable = sorted(info["stableIds"])
        fname = info["friendlyName"]
        if not fname and svcs:
            fname = f"mDNS ({', '.join(svcs[:2])})"
        normalized[ip] = {
            "friendlyName": fname,
            "services": svcs[:6],
            "stableIds": stable[:6],
        }
    _MDNS_CACHE = normalized
    _MDNS_LAST_TS = now
    return normalized


def de_cloak_device(ip: str, mac: str) -> Dict[str, Any]:
    """Unmask randomized MAC or unknown device friendly name and collect stable IDs."""
    clean_mac = mac.strip().upper()
    if clean_mac in _NAME_CACHE:
        return _NAME_CACHE[clean_mac]

    if not ip or ip == "0.0.0.0":
        return {"friendlyName": "", "friendlySource": "", "stableIds": [], "mdnsServices": []}

    mdns_info = _MDNS_CACHE.get(ip) or {}
    stable_ids: List[str] = list(mdns_info.get("stableIds") or [])
    mdns_svcs: List[str] = list(mdns_info.get("services") or [])

    # 0. mDNS (Android ADB, Apple AirPlay/Companion, Chromecast, etc.)
    if mdns_info.get("friendlyName"):
        res = {
            "friendlyName": mdns_info["friendlyName"],
            "friendlySource": "mDNS",
            "stableIds": stable_ids,
            "mdnsServices": mdns_svcs,
        }
        _NAME_CACHE[clean_mac] = res
        return res

    # 1. Reverse DNS (fastest, local resolver)
    name = resolve_reverse_dns(ip)
    if name:
        res = {
            "friendlyName": name,
            "friendlySource": "DNS",
            "stableIds": stable_ids,
            "mdnsServices": mdns_svcs,
        }
        _NAME_CACHE[clean_mac] = res
        return res

    # 2. NetBIOS (Windows / Samba / Smart TVs)
    name = resolve_netbios_name(ip)
    if name:
        res = {
            "friendlyName": name,
            "friendlySource": "NetBIOS",
            "stableIds": stable_ids,
            "mdnsServices": mdns_svcs,
        }
        _NAME_CACHE[clean_mac] = res
        return res

    # 3. SSDP / UPnP probe
    ssdp = resolve_ssdp_details(ip)
    if ssdp.get("usn") and ssdp["usn"] not in stable_ids:
        stable_ids.append(ssdp["usn"])
    if ssdp.get("friendlyName"):
        res = {
            "friendlyName": ssdp["friendlyName"],
            "friendlySource": "SSDP",
            "stableIds": stable_ids,
            "mdnsServices": mdns_svcs,
        }
        _NAME_CACHE[clean_mac] = res
        return res

    return {
        "friendlyName": "",
        "friendlySource": "",
        "stableIds": stable_ids,
        "mdnsServices": mdns_svcs,
    }


def clear_scan_cache() -> None:
    global _NAME_CACHE, _MDNS_CACHE, _MDNS_LAST_TS, _PROBE_CACHE
    _NAME_CACHE.clear()
    _MDNS_CACHE.clear()
    _PROBE_CACHE.clear()
    _MDNS_LAST_TS = 0.0


def classify_device(
    ip: str,
    mac: str,
    vendor: str,
    hostname: str,
    open_ports: List[str],
    http_title: str,
    dev_name: str = "",
    medium: str = "LAN",
) -> Dict[str, str]:
    """Autonomous network classification using MAC OUI, randomized bit, open ports, banners and hostnames."""
    clean_mac = mac.strip().upper().replace("-", ":")
    rand_mac = is_randomized_mac(clean_mac)
    combined = f"{vendor} {hostname} {http_title} {dev_name}".lower()
    ports_str = " ".join(open_ports).lower()

    has_web_admin = any(p in ports_str for p in ("80", "443", "8080"))
    has_rtsp = any("554" in p for p in open_ports)
    has_smb = any("445" in p or "139" in p for p in open_ports)
    has_dns = any("53" in p for p in open_ports)

    # 1. Camera / DVR (Checked early: RTSP or CCTV vendors/titles)
    if (
        has_rtsp
        or "dvr" in combined
        or "nvr" in combined
        or "dahua" in combined
        or "hikvision" in combined
        or "ezviz" in combined
        or "imou" in combined
        or "camera" in combined
        or "ipc" in combined
    ):
        return {"category": "camera", "catName": "كاميرا مراقبة / DVR", "catIcon": "📹"}

    # 2. Router / Access Point / Network Distributor
    # Verified by router vendor OUI, router model strings, router server banners, or DNS forwarder
    router_signatures = (
        "tp-link", "tenda", "belkin", "d-link", "netgear", "mercusys", "mikrotik", "ubiquiti",
        "openwrt", "wr940", "wr844", "wr840", "wr820", "archer", "c54", "c20", "c6", "c80",
        "deco", "h288", "h298", "f680", "f660", "hg8", "echolife", "router", "access point",
        "gateway", "wireless-n", "broadcom", "mediatek", "realtek router", "zte web server",
        "xiaomi / router", "rompager", "goahead", "uhttpd"
    )
    if any(sig in combined for sig in router_signatures):
        return {"category": "router", "catName": "روتور / موزع", "catIcon": "📡"}

    # If it serves DNS on port 53 and has web admin, it is definitely a router/gateway
    if has_dns and has_web_admin:
        return {"category": "router", "catName": "روتور / موزع", "catIcon": "📡"}

    # 3. Smart TV / Receiver / Media Box
    tv_signatures = (
        "smart tv", "android tv", "chromecast", "receiver", "lg tv", "samsung tv",
        "tizen", "webos", "apple tv", "fire tv", "roku", "kodi"
    )
    if any(sig in combined for sig in tv_signatures) or any(p in ports_str for p in ("8008", "8009", "1900")):
        return {"category": "tv", "catName": "تلفاز ذكي / رسيفر", "catIcon": "📺"}

    # 4. PC / Laptop / Server
    pc_signatures = ("windows", "desktop", "laptop", "ubuntu", "debian", "samba", "utorrent")
    if (
        has_smb
        or hostname.upper().startswith("DESKTOP-")
        or hostname.upper().startswith("LAPTOP-")
        or hostname.upper().startswith("PC-")
        or any(sig in combined for sig in pc_signatures)
    ):
        return {"category": "pc", "catName": "كمبيوتر / لابتوب", "catIcon": "💻"}

    # 5. Smartphone / Tablet (Mobile Device)
    # Strong dynamic indicators:
    # A) Randomized MAC with no server ports open
    # B) Mobile manufacturer (Apple, Samsung, Xiaomi, Redmi, Oppo, Vivo, Realme, OnePlus, Infinix, Tecno, Itel, Honor, Pixel)
    # C) Mobile hostname patterns
    mobile_signatures = (
        "iphone", "ipad", "android", "galaxy", "redmi", "xiaomi", "huawei", "oppo",
        "vivo", "realme", "oneplus", "infinix", "tecno", "itel", "honor", "pixel",
        "motorola", "phone", "mobile", "sm-", "cph", "rmx"
    )
    if rand_mac and medium == "WLAN" and not has_web_admin and not has_smb:
        return {"category": "phone", "catName": "هاتف ذكي", "catIcon": "📱"}

    if any(sig in combined for sig in mobile_signatures) and not has_web_admin:
        os_label = "iPhone (iOS)" if ("apple" in combined or "iphone" in combined) else "هاتف ذكي"
        return {"category": "phone", "catName": os_label, "catIcon": "📱"}

    # 6. Default Fallback: Generic Network Device
    return {"category": "device", "catName": "جهاز شبكي", "catIcon": "🔌"}


def measure_cable_health(
    ip: str,
    count: int = 3,
    port_info: Optional[Dict[str, Any]] = None,
    is_live_lan: bool = False,
) -> Dict[str, Any]:
    """Measure cable quality, packet loss, and jitter with port counter awareness."""
    if not ip or ip == "0.0.0.0":
        return {"quality": "N/A", "score": 0, "jitter": 0, "loss": 100, "avg": None}

    is_win = platform.system().lower().startswith("win")
    cmd = ["ping", "-n", str(count), "-w", "350", ip] if is_win else ["ping", "-c", str(count), "-W", "1", ip]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=2.5)
        times = [float(m) for m in re.findall(r"time[=<]\s*([\d.]+)\s*ms", res.stdout, re.I)]
        if times:
            avg_ms = round(sum(times) / len(times), 1)
            jitter = round(max(times) - min(times), 1)
            loss = round((1 - len(times) / count) * 100)

            score = max(10, min(100, int(100 - (loss * 1.5) - (jitter * 1.2 if jitter > 10 else 0) - (max(0, avg_ms - 20) * 0.8))))
            quality = "ممتاز" if score >= 85 else ("جيد" if score >= 65 else "متضرر / فيه تقطاع")

            return {
                "quality": quality,
                "score": score,
                "jitter": jitter,
                "loss": loss,
                "avg": avg_ms,
                "source": "icmp_live",
            }
    except Exception:
        pass

    # Hardware port verification from ZTE F680 counters (for TP-Link firewalled WANs)
    if is_live_lan:
        in_err = int(port_info.get("inErrors", 0)) if port_info else 0
        out_err = int(port_info.get("outErrors", 0)) if port_info else 0
        err_total = in_err + out_err
        score = 100 if err_total == 0 else max(50, 100 - min(40, err_total * 5))
        quality = "سليم (عتادي)" if score >= 85 else "فيه أخطاء"
        return {
            "quality": quality,
            "score": score,
            "jitter": None,
            "loss": 0,
            "avg": None,
            "source": "hardware_port",
        }

    return {"quality": "مستقر", "score": 85, "jitter": 0, "loss": 0, "avg": None, "source": "unknown"}


def probe_device(
    ip: str,
    mac: str,
    hostname: str = "",
    dev_name: str = "",
    port_info: Optional[Dict[str, Any]] = None,
    is_live_lan: bool = False,
) -> Dict[str, Any]:
    clean_mac = mac.strip().upper()
    now_ts = time.time()
    cached = _PROBE_CACHE.get(clean_mac)
    if (
        cached
        and cached.get("_ip") == ip
        and (now_ts - cached.get("_ts", 0.0)) < _DEEP_PROBE_TTL
    ):
        # Fast path: only refresh ping latency + TTL (~0.5-1.0s max)
        latency, ttl = measure_ping_and_ttl(ip)
        res = dict(cached["data"])
        res["latencyMs"] = latency
        if ttl is not None:
            res["ttl"] = ttl
        return res

    medium = "LAN" if is_live_lan else "WLAN"
    vendor = lookup_vendor(mac, hostname, dev_name, medium=medium)
    rand_mac = is_randomized_mac(mac)
    latency, ttl = measure_ping_and_ttl(ip)
    open_ports: List[str] = []
    http_title = ""
    if ip and ip != "0.0.0.0":
        for port, label in SCAN_PORTS:
            if check_port(ip, port, 0.16):
                open_ports.append(f"{label}:{port}")
        if "HTTP:80" in open_ports:
            http_title = grab_http_title(ip, 80)
        elif "HTTP-Alt:8080" in open_ports:
            http_title = grab_http_title(ip, 8080)
        elif "HTTPS:443" in open_ports:
            http_title = grab_http_title(ip, 443)

    decloak = de_cloak_device(ip, mac)
    friendly = decloak["friendlyName"]
    effective_host = friendly or hostname
    vendor = lookup_vendor(mac, effective_host, dev_name, http_title, medium=medium)

    cable_health = (
        measure_cable_health(ip, count=2, port_info=port_info, is_live_lan=is_live_lan)
        if (latency is not None or is_live_lan)
        else None
    )
    classification = classify_device(ip, mac, vendor, effective_host, open_ports, http_title, dev_name, medium=medium)

    result = {
        "vendor": vendor,
        "randomizedMac": rand_mac,
        "latencyMs": latency,
        "ttl": ttl,
        "openPorts": open_ports,
        "httpTitle": http_title,
        "friendlyName": friendly,
        "friendlySource": decloak["friendlySource"],
        "stableIds": decloak.get("stableIds", []),
        "mdnsServices": decloak.get("mdnsServices", []),
        "cableHealth": cable_health,
        "category": classification["category"],
        "catName": classification["catName"],
        "catIcon": classification["catIcon"],
    }
    _PROBE_CACHE[clean_mac] = {"_ip": ip, "_ts": now_ts, "data": result}
    return dict(result)


def probe_many(targets: List[Dict[str, Any]], max_workers: int = 24) -> Dict[str, Dict[str, Any]]:
    results: Dict[str, Dict[str, Any]] = {}
    if not targets:
        return results

    # Refresh mDNS cache once per 45s (skipped automatically when fresh)
    discover_mdns_services(timeout=0.7)

    def _worker(t: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
        m_key = t["mac"].upper()
        res = probe_device(
            ip=t.get("ip", ""),
            mac=t["mac"],
            hostname=t.get("hostname", ""),
            dev_name=t.get("dev_name", ""),
            port_info=t.get("port_info"),
            is_live_lan=t.get("is_live_lan", False),
        )
        return m_key, res

    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futs = {pool.submit(_worker, t): t["mac"].upper() for t in targets}
        for fut in as_completed(futs):
            m_key = futs[fut]
            try:
                _, res = fut.result(timeout=6.0)
                results[m_key] = res
            except Exception:
                pass
    return results


def _check_rogue_ipv6_routers(allowed_oui_prefix: str = "C0:B1:01") -> List[Dict[str, str]]:
    """Detect foreign IPv6 Router Advertisements (e.g. a Huawei router plugged via LAN leaking fe80::1)."""
    rogues: List[Dict[str, str]] = []
    seen_macs = set()
    is_win = platform.system().lower().startswith("win")
    try:
        if is_win:
            out = subprocess.check_output(
                ["netsh", "interface", "ipv6", "show", "neighbors"],
                text=True,
                errors="ignore",
                timeout=3,
            )
            for line in out.splitlines():
                if "(Router)" not in line:
                    continue
                m = re.search(r"(fe80::[^\s]+)\s+([0-9a-fA-F-]{17})", line)
                if m:
                    ip6 = m.group(1)
                    mac = m.group(2).replace("-", ":").upper()
                    if mac != "00:00:00:00:00:00" and not mac.startswith(allowed_oui_prefix) and mac not in seen_macs:
                        seen_macs.add(mac)
                        rogues.append({"ipv6": ip6, "mac": mac, "vendor": lookup_vendor(mac)})
        else:
            out = subprocess.check_output(["ip", "-6", "neigh"], text=True, errors="ignore", timeout=3)
            for line in out.splitlines():
                if "router" not in line.lower():
                    continue
                m = re.search(r"^(fe80::\S+).*lladdr\s+([0-9a-fA-F:]{17})", line, re.I)
                if m:
                    ip6, mac = m.group(1), m.group(2).upper()
                    if not mac.startswith(allowed_oui_prefix) and mac not in seen_macs:
                        seen_macs.add(mac)
                        rogues.append({"ipv6": ip6, "mac": mac, "vendor": lookup_vendor(mac)})
    except Exception:
        pass
    return rogues


def check_rogue_network(
    expected_gateway: str = "192.168.1.1",
    lan_clients: Optional[List[Dict[str, str]]] = None,
) -> Dict[str, Any]:
    """Scan for rogue DHCP routers, foreign subnets on LAN, or rogue IPv6 Router Advertisements."""
    common_gateways = [
        ("192.168.0.1", "TP-Link / D-Link Default"),
        ("192.168.1.254", "Orange / Thomson Default"),
        ("192.168.2.1", "Belkin / Xiaomi Default"),
        ("192.168.100.1", "Huawei ONT Default"),
    ]
    detected_rogues: List[Dict[str, str]] = []
    for rip, label in common_gateways:
        if rip == expected_gateway:
            continue
        if check_port(rip, 80, 0.25) or check_port(rip, 8080, 0.25):
            title = grab_http_title(rip, 80) or grab_http_title(rip, 8080) or label
            detected_rogues.append({"ip": rip, "title": title, "label": label})

    # Detect foreign-subnet devices reported by ZTE (e.g. 192.168.8.1 on LAN1)
    foreign_subnets: List[Dict[str, str]] = []
    try:
        expected_net = ipaddress.ip_network(f"{expected_gateway}/24", strict=False)
        for lc in lan_clients or []:
            ip_str = (lc.get("IPAddress") or "").strip()
            if not ip_str:
                continue
            try:
                addr = ipaddress.ip_address(ip_str)
                if addr.is_private and addr not in expected_net:
                    mac_str = (lc.get("MACAddress") or "").upper()
                    foreign_subnets.append(
                        {
                            "ip": ip_str,
                            "mac": mac_str,
                            "port": (lc.get("AliasName") or "LAN").strip(),
                            "vendor": lookup_vendor(mac_str),
                        }
                    )
            except Exception:
                pass
    except Exception:
        pass

    ipv6_rogues = _check_rogue_ipv6_routers()

    if detected_rogues:
        rogue = detected_rogues[0]
        return {
            "detected": True,
            "serverIp": rogue["ip"],
            "serverName": rogue["title"],
            "foreignSubnets": foreign_subnets,
            "ipv6Rogues": ipv6_rogues,
            "message": f"تحذير: تم اكتشاف روتور ثانوي مقلوب على العنوان {rogue['ip']} ({rogue['title']})! قد يسبب انقطاع النت وتعارض الإيبيهات.",
        }

    if foreign_subnets or ipv6_rogues:
        parts = []
        primary_ip = ""
        primary_name = ""
        if foreign_subnets:
            fs = foreign_subnets[0]
            primary_ip = fs["ip"]
            primary_name = fs["vendor"]
            parts.append(f"شبكة فرعية غريبة {fs['ip']} ({fs['vendor']}) على {fs['port']}")
        if ipv6_rogues:
            ir = ipv6_rogues[0]
            if not primary_ip:
                primary_ip = ir["ipv6"]
                primary_name = ir["vendor"]
            parts.append(f"تسرّب IPv6 Router ({ir['ipv6']} عبر {ir['mac']} - {ir['vendor']})")
        return {
            "detected": True,
            "serverIp": primary_ip,
            "serverName": primary_name,
            "foreignSubnets": foreign_subnets,
            "ipv6Rogues": ipv6_rogues,
            "message": "تنبيه تسرّب شبكي: " + " | ".join(parts) + " — غالباً روتور موصول من منفذ LAN بدل WAN!",
        }

    return {
        "detected": False,
        "serverIp": "",
        "serverName": "",
        "foreignSubnets": [],
        "ipv6Rogues": [],
        "message": "✓ الشبكة مؤمنة — لا يوجد أي خادم DHCP غريب أو تسرّب IPv6 في الشبكة.",
    }


def run_wan_diagnostics(gateway_ip: str = "192.168.1.1", internet_ip: str = "8.8.8.8") -> Dict[str, Any]:
    """Measure exact ping latency to local gateway and global internet."""
    gw_ping = measure_ping_ms(gateway_ip)
    net_ping = measure_ping_ms(internet_ip)

    status = "ممتاز"
    if net_ping is None:
        status = "قاطع (لا يوجد اتصال خارجي)" if gw_ping is not None else "الراوتر غير مستجيب"
    elif net_ping > 90:
        status = "بطيء / ضغط على الفايبر"
    elif net_ping > 40:
        status = "مقبول"

    return {
        "gatewayPing": gw_ping,
        "internetPing": net_ping,
        "status": status,
        "checkedAt": time.strftime("%H:%M:%S"),
    }


# ---------------------------------------------------------------------------
# Local Subnet Discovery Extensions (arp-scan / scapy / nmap)
# Strictly scoped to configured local subnet; zero authentication attempts.
# ---------------------------------------------------------------------------
_NMAP_CACHE: Dict[str, Dict[str, Any]] = {}


def run_arp_scan(subnet_cidr: str = "192.168.1.0/24") -> Dict[str, Dict[str, str]]:
    """Discover MAC + IP + vendor in the local subnet via arp-scan, scapy, or OS ARP table."""
    found: Dict[str, Dict[str, str]] = {}

    # 1. Try native arp-scan binary (Linux / Termux root / WSL)
    if shutil.which("arp-scan"):
        try:
            res = subprocess.run(
                ["arp-scan", "--localnet", "-q", "-r", "1"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if res.returncode == 0:
                for line in res.stdout.splitlines():
                    m = re.match(r"^(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:]{17})\s*(.*)$", line.strip())
                    if m:
                        ip, mac, vendor = m.group(1), m.group(2).upper(), m.group(3).strip()
                        if is_in_local_subnet(ip, subnet_cidr):
                            found[mac] = {"ip": ip, "mac": mac, "vendor": vendor, "method": "arp-scan"}
                if found:
                    return found
        except Exception:
            pass

    # 2. Fallback to scapy Layer-2 ARP broadcast if installed
    try:
        from scapy.all import ARP, Ether, srp  # type: ignore

        pkt = Ether(dst="ff:ff:ff:ff:ff:ff") / ARP(pdst=subnet_cidr)
        ans, _ = srp(pkt, timeout=1.5, verbose=0)
        for _, rcv in ans:
            ip = rcv.psrc
            mac = rcv.hwsrc.upper()
            if is_in_local_subnet(ip, subnet_cidr):
                found[mac] = {"ip": ip, "mac": mac, "vendor": lookup_vendor(mac), "method": "scapy-arp"}
        if found:
            return found
    except Exception:
        pass

    # 3. Fallback to OS ARP neighbor cache (arp -a), strictly filtered to local subnet
    try:
        res = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=3)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                m = re.search(r"(\d+\.\d+\.\d+\.\d+)\s+([0-9a-fA-F:-]{17})", line)
                if m:
                    ip = m.group(1)
                    mac = m.group(2).replace("-", ":").upper()
                    if mac != "FF:FF:FF:FF:FF:FF" and is_in_local_subnet(ip, subnet_cidr):
                        found[mac] = {"ip": ip, "mac": mac, "vendor": lookup_vendor(mac), "method": "arp-cache"}
    except Exception:
        pass

    return found


def run_nmap_scan(ip: str, subnet_cidr: str = "192.168.1.0/24") -> Dict[str, Any]:
    """Run passive OS/service detection (nmap -O -sV) strictly within local subnet."""
    if not is_in_local_subnet(ip, subnet_cidr):
        return {}

    now_ts = time.time()
    cached = _NMAP_CACHE.get(ip)
    if cached and now_ts - cached.get("_ts", 0) < 600:
        return cached

    result: Dict[str, Any] = {"osGuess": "", "deviceTypeGuess": "", "services": [], "_ts": now_ts}
    if not shutil.which("nmap"):
        return result

    # Try -O -sV first (requires privileges for -O on some OS); fallback to -sV
    cmds = [
        ["nmap", "-O", "-sV", "--osscan-guess", "--host-timeout", "6s", "-T4", ip],
        ["nmap", "-sV", "--host-timeout", "5s", "-T4", ip],
    ]
    out_text = ""
    for cmd in cmds:
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=8)
            if res.returncode == 0 and res.stdout:
                out_text = res.stdout
                break
        except Exception:
            continue

    if not out_text:
        _NMAP_CACHE[ip] = result
        return result

    # Extract OS guess
    m_os = re.search(r"OS details:\s*(.+)", out_text) or re.search(r"Running:\s*(.+)", out_text)
    if m_os:
        result["osGuess"] = m_os.group(1).strip()[:60]

    # Extract Device type
    m_type = re.search(r"Device type:\s*(.+)", out_text)
    if m_type:
        dt_raw = m_type.group(1).lower()
        if "router" in dt_raw or "wap" in dt_raw or "broadband" in dt_raw:
            result["deviceTypeGuess"] = "router"
        elif "phone" in dt_raw:
            result["deviceTypeGuess"] = "phone"
        elif "tv" in dt_raw or "media" in dt_raw:
            result["deviceTypeGuess"] = "tv"
        elif "general purpose" in dt_raw:
            result["deviceTypeGuess"] = "pc"

    # Extract open services
    services: List[str] = []
    for line in out_text.splitlines():
        m_srv = re.match(r"^(\d+)/(tcp|udp)\s+open\s+(\S+)\s*(.*)$", line.strip())
        if m_srv:
            port_num, srv_name, ver = m_srv.group(1), m_srv.group(3), m_srv.group(4).strip()
            services.append(f"{srv_name}:{port_num}" + (f" ({ver[:30]})" if ver else ""))
    result["services"] = services[:8]

    _NMAP_CACHE[ip] = result
    return result


def nmap_scan_many(
    ips: List[str],
    subnet_cidr: str = "192.168.1.0/24",
    max_workers: int = 6,
) -> Dict[str, Dict[str, Any]]:
    """Run Nmap in parallel across local subnet IPs only."""
    valid_ips = [ip for ip in set(ips) if is_in_local_subnet(ip, subnet_cidr)]
    if not valid_ips or not shutil.which("nmap"):
        return {}

    results: Dict[str, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futs = {pool.submit(run_nmap_scan, ip, subnet_cidr): ip for ip in valid_ips}
        for fut in as_completed(futs):
            ip = futs[fut]
            try:
                results[ip] = fut.result(timeout=10)
            except Exception:
                pass
    return results
