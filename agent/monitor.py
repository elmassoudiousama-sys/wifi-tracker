"""24/7 Fiber Monitor Agent for Huawei POT-LX1 (Termux) or Windows/Linux PC."""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

import requests

from scanner import (
    check_rogue_network,
    clear_scan_cache,
    nmap_scan_many,
    probe_many,
    run_arp_scan,
    run_wan_diagnostics,
)
from zte_client import ZTEF680Client, _parse_instances
from correlation import CorrelationEngine
from device_classifier import classify_and_merge, upsert_discovered_device
from identity import IdentityEngine

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"
DEVICES_PATH = BASE_DIR / "devices.json"
MODEL_CACHE_PATH = BASE_DIR / "device_models.json"


def _load_model_cache() -> Dict[str, Dict[str, str]]:
    if MODEL_CACHE_PATH.exists():
        try:
            with open(MODEL_CACHE_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {}
        except Exception:
            pass
    return {}


def _save_model_cache(cache: Dict[str, Dict[str, str]]) -> None:
    try:
        with open(MODEL_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


_MODEL_CACHE: Dict[str, Dict[str, str]] = _load_model_cache()

# Global states across loop runs
_PREV_PORT_BYTES: Dict[str, Dict[str, Any]] = {}
_BLACKOUT_TRACKER: Dict[str, Dict[str, Any]] = {}
_BLACKOUT_HISTORY: List[Dict[str, Any]] = []
_LAST_WAN_DIAG: Dict[str, Any] = {}
_LAST_ROGUE_CHECK: Dict[str, Any] = {}
_LAST_ARP_MAP: Dict[str, Dict[str, str]] = {}
_LAST_DHCP_LEASES: List[Dict[str, str]] = []
_LAST_WLAN_SSIDS: List[Dict[str, Any]] = []
_LAST_WLAN_ACL: List[Dict[str, str]] = []
_LAST_OPTICAL_INFO: Dict[str, str] = {}
_LAST_SYSTEM_STATUS: Dict[str, str] = {}
_LAST_PORT_MIRROR: Dict[str, str] = {}
_LAST_ASSOC_HOSTNAMES: Dict[str, str] = {}
_WIFI_MISS_COUNT: Dict[str, int] = {}
_RECENT_WLAN_MACS: Set[str] = set()
_WARNED_SUSPICIOUS_MACS: Set[str] = set()
_CYCLE_COUNT = 0
_CORRELATION_ENGINE = CorrelationEngine()
_IDENTITY_ENGINE = IdentityEngine()


def load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def norm_mac(mac: str) -> str:
    return mac.strip().upper()


def send_telegram(cfg: Dict[str, Any], text: str) -> None:
    token = cfg.get("telegram_bot_token", "").strip()
    chat_id = cfg.get("telegram_chat_id", "").strip()
    if not token or not chat_id:
        return
    try:
        requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
    except Exception as exc:
        print(f"[Telegram] Failed: {exc}")


def format_duration(seconds: float) -> str:
    mins = max(1, int(round(seconds / 60)))
    if mins < 60:
        return f"{mins} دقيقة"
    hours = mins // 60
    rem = mins % 60
    return f"{hours} س و {rem} د" if rem else f"{hours} ساعة"


UPSTASH_REDIS_KEY = "fiber_monitor_state_v1"


def _execute_commands(
    commands: List[Dict[str, Any]],
    client: ZTEF680Client,
    blocked_by_mac: Dict[str, Dict[str, str]],
) -> bool:
    global _LAST_WAN_DIAG
    executed_any = False
    for cmd in commands:
      try:
        action = cmd.get("action")
        mac = norm_mac(cmd.get("mac", ""))
        name = cmd.get("name", "Client")
        if action == "block" and mac:
            print(f"[CMD] Blocking {name} ({mac})...")
            res_xml = client.block_mac(name, mac)
            print(f"[CMD] Block result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
            _IDENTITY_ENGINE.register_ban(mac, "firewall", name=name)
            executed_any = True
        elif action == "unblock" and mac:
            blk = blocked_by_mac.get(mac)
            inst_id = cmd.get("instId") or (blk.get("_InstID") if blk else "")
            if (not inst_id or inst_id == "pending") and mac:
                try:
                    for rule in client.get_mac_filters():
                        if norm_mac(rule.get("SrcMacAddr", "")) == mac:
                            inst_id = rule.get("_InstID", "")
                            break
                except Exception:
                    pass
            if inst_id and inst_id != "pending":
                print(f"[CMD] Unblocking {name} ({mac})...")
                res_xml = client.unblock_mac(inst_id)
                print(f"[CMD] Unblock result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
                executed_any = True
            _IDENTITY_ENGINE.unregister_ban(mac=mac, block_type="firewall")
        elif action == "reboot_router":
            print("[CMD] Received Reboot Router request! Attempting remote restart...")
            try:
                res_reb = client.reboot_router()
                print(f"[CMD] Reboot result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_reb else res_reb[:160]}")
            except Exception as e:
                print(f"[CMD] Reboot post error: {e}")
            executed_any = True
        elif action == "run_diagnostics":
            print("[CMD] Running instant WAN diagnostics...")
            _LAST_WAN_DIAG = run_wan_diagnostics()
            executed_any = True
        elif action == "rescan_network":
            print("[CMD] Running deep network re-scan and refreshing cache...")
            clear_scan_cache()
            _LAST_WAN_DIAG = run_wan_diagnostics()
            executed_any = True
        elif action == "wifi_acl_block" and mac:
            iface = cmd.get("interface") or "DEV.WIFI.AP1"
            print(f"[CMD] Adding Wi-Fi L2 ACL block for {name} ({mac}) on {iface}...")
            res_xml = client.block_wlan_mac(name, mac, interface=iface)
            print(f"[CMD] Wi-Fi ACL result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
            _IDENTITY_ENGINE.register_ban(mac, "wifi_acl", name=name, interface=iface)
            executed_any = True
        elif action == "auto_track_ban" and mac:
            iface = cmd.get("interface") or "DEV.WIFI.AP1"
            print(f"[CMD] Auto-Track Ban (L2 ACL + Firewall + DNA) for {name} ({mac}) on {iface}...")
            try:
                existing_acl = [r for r in client.get_wlan_acl_rules() if norm_mac(r.get("MACAddress", "")) == mac]
                if not existing_acl:
                    res_acl = client.block_wlan_mac(name, mac, interface=iface)
                    print(f"[CMD] Auto-Track ACL result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_acl else res_acl[:160]}")
            except Exception as e:
                print(f"[CMD] Auto-Track ACL error: {e}")
            try:
                existing_fw = [r for r in client.get_mac_filters() if norm_mac(r.get("SrcMacAddr", "")) == mac]
                if not existing_fw:
                    res_fw = client.block_mac(name, mac)
                    print(f"[CMD] Auto-Track FW result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_fw else res_fw[:160]}")
            except Exception as e:
                print(f"[CMD] Auto-Track FW error: {e}")
            _IDENTITY_ENGINE.register_ban(mac, "wifi_acl", name=name, interface=iface)
            _IDENTITY_ENGINE.register_ban(mac, "firewall", name=name, interface=iface)
            executed_any = True
        elif action == "wifi_acl_unblock":
            inst_id = cmd.get("instId", "")
            if (not inst_id or inst_id == "pending") and mac:
                try:
                    for rule in client.get_wlan_acl_rules():
                        if norm_mac(rule.get("MACAddress", "")) == mac:
                            inst_id = rule.get("_InstID", "")
                            break
                except Exception:
                    pass
            if inst_id and inst_id != "pending":
                print(f"[CMD] Removing Wi-Fi L2 ACL rule {inst_id}...")
                res_xml = client.unblock_wlan_mac(inst_id)
                print(f"[CMD] Wi-Fi ACL remove result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
                executed_any = True
            _IDENTITY_ENGINE.unregister_ban(mac=mac, block_type="wifi_acl")
        elif action == "unban_identity":
            ban_id = cmd.get("instId", "")
            removed = _IDENTITY_ENGINE.unregister_ban(mac=mac, ban_id=ban_id)
            target_macs = {norm_mac(m) for m in ((removed or {}).get("bannedMacs") or []) if m}
            if mac:
                target_macs.add(mac)
            if target_macs:
                try:
                    for rule in client.get_mac_filters():
                        if norm_mac(rule.get("SrcMacAddr", "")) in target_macs and rule.get("_InstID"):
                            client.unblock_mac(rule["_InstID"])
                except Exception:
                    pass
                try:
                    for rule in client.get_wlan_acl_rules():
                        if norm_mac(rule.get("MACAddress", "")) in target_macs and rule.get("_InstID"):
                            client.unblock_wlan_mac(rule["_InstID"])
                except Exception:
                    pass
                print(f"[CMD] Removed persistent DNA ban {(removed or {}).get('name', name)} ({len(target_macs)} MACs)")
                executed_any = True
        elif action == "set_ssid_config":
            inst_id = cmd.get("instId", "")
            if inst_id:
                print(f"[CMD] Updating SSID {inst_id} settings...")
                res_xml = client.update_ssid_settings(
                    inst_id,
                    enable=cmd.get("enable"),
                    isolation=cmd.get("isolation"),
                    hidden=cmd.get("hidden"),
                )
                print(f"[CMD] SSID update result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
                executed_any = True
        elif action == "set_port_mirror":
            en = bool(cmd.get("enable", False))
            m_src = cmd.get("mirrorSrc") or "IGD.WANALL"
            m_dest = cmd.get("mirrorDest") or ""
            print(f"[CMD] Setting ZTE Port Mirroring enable={en} src={m_src} dest={m_dest}...")
            res_xml = client.set_port_mirror(enable=en, mirror_src=m_src, mirror_dest=m_dest)
            print(f"[CMD] Port Mirror result: {'SUCC' if 'IF_ERRORSTR>SUCC' in res_xml else res_xml[:160]}")
            executed_any = True
      except Exception as cmd_exc:
        print(f"[CMD Error] {cmd.get('action')} ({cmd.get('mac')}): {cmd_exc}")
    return executed_any


def _refresh_payload_after_commands(
    payload: Dict[str, Any],
    client: ZTEF680Client,
) -> None:
    global _LAST_WLAN_ACL
    new_filters = client.get_mac_filters()
    new_blk_macs = {norm_mac(r.get("SrcMacAddr", "")): r for r in new_filters if r.get("SrcMacAddr")}
    payload["blockedRules"] = [
        {"instId": r.get("_InstID", ""), "name": r.get("Name", ""), "mac": norm_mac(r.get("SrcMacAddr", ""))}
        for r in new_filters if r.get("SrcMacAddr")
    ]
    try:
        acl_rows = client.get_wlan_acl_rules()
        _LAST_WLAN_ACL = acl_rows
        payload["wlanAclRules"] = [
            {
                "instId": r.get("_InstID", ""),
                "name": r.get("Name", ""),
                "mac": norm_mac(r.get("MACAddress", "")),
                "interface": r.get("Interface", "DEV.WIFI.AP1"),
            }
            for r in acl_rows if r.get("MACAddress")
        ]
    except Exception:
        pass
    payload["bannedIdentities"] = list(_IDENTITY_ENGINE.banned.values())
    payload["diagnostics"] = _LAST_WAN_DIAG
    for d in payload["devices"]:
        blk = new_blk_macs.get(norm_mac(d["mac"]))
        d["blocked"] = blk is not None
        d["blockInstId"] = blk.get("_InstID", "") if blk else ""
    for w in payload["wifiClients"]:
        blk = new_blk_macs.get(norm_mac(w["mac"]))
        w["blocked"] = blk is not None
        w["blockInstId"] = blk.get("_InstID", "") if blk else ""
    payload["alerts"] = []


def _apply_remote_meta(
    known_devices: List[Dict[str, str]],
    meta_map: Optional[Dict[str, Any]],
    added_list: Optional[List[Dict[str, Any]]],
) -> None:
    if meta_map is None and added_list is None:
        return
    meta_map = meta_map or {}
    updated = []
    seen_m = set()
    for d in known_devices:
        m = norm_mac(d["mac"])
        info = meta_map.get(m, {})
        if info.get("removed"):
            continue
        updated.append(
            {
                "name": info.get("name") or d["name"],
                "ip": d["ip"],
                "mac": m,
                "group": info.get("group") or d.get("group", d["name"]),
            }
        )
        seen_m.add(m)
    for a in added_list or []:
        m = norm_mac(a.get("mac", ""))
        if m and m not in seen_m and not meta_map.get(m, {}).get("removed"):
            updated.append(
                {
                    "name": a.get("name", "New Device"),
                    "ip": a.get("ip", ""),
                    "mac": m,
                    "group": a.get("group") or a.get("name", "Other"),
                }
            )
            seen_m.add(m)
    known_devices[:] = updated
    with open(DEVICES_PATH, "w", encoding="utf-8") as f:
        json.dump(known_devices, f, indent=2, ensure_ascii=False)
    print(f"[Sync] Updated devices.json ({len(known_devices)} devices)")


def _sync_upstash(
    upstash_url: str,
    upstash_token: str,
    payload: Dict[str, Any],
    client: ZTEF680Client,
    known_devices: List[Dict[str, str]],
    blocked_by_mac: Dict[str, Dict[str, str]],
) -> None:
    """Sync live state directly with Upstash Redis (cloud relay for Vercel)."""
    headers = {"Authorization": f"Bearer {upstash_token}"}
    prev: Dict[str, Any] = {}
    try:
        r_get = requests.get(f"{upstash_url}/get/{UPSTASH_REDIS_KEY}", headers=headers, timeout=12)
        if r_get.ok:
            raw_res = r_get.json().get("result")
            if raw_res:
                prev = json.loads(raw_res)
    except Exception as exc:
        print(f"[Upstash] Read warning: {exc}")

    now_iso = payload.get("updatedAt") or datetime.now(timezone.utc).isoformat()
    meta_map = prev.get("deviceMeta") or {}
    added_list = prev.get("addedDevices") or []
    pending_cmds = prev.get("commands") or []

    new_alerts = [{**a, "at": now_iso} for a in (payload.get("alerts") or [])]
    merged_alerts = (new_alerts + (prev.get("alerts") or []))[:60]

    merged_devices = []
    for d in payload.get("devices") or []:
        m = norm_mac(d.get("mac", ""))
        meta = meta_map.get(m, {})
        if meta.get("removed"):
            continue
        merged_devices.append(
            {
                **d,
                "name": meta.get("name") or d.get("name"),
                "group": meta.get("group") or d.get("group"),
                "note": meta.get("note") or "",
                "category": meta.get("category") or d.get("category"),
                "catName": meta.get("catName") or d.get("catName"),
                "catIcon": meta.get("catIcon") or d.get("catIcon"),
            }
        )

    merged_state = {
        **prev,
        **payload,
        "updatedAt": now_iso,
        "totalKnown": len(merged_devices),
        "onlineCount": sum(1 for d in merged_devices if d.get("online")),
        "devices": merged_devices,
        "alerts": merged_alerts,
        "commands": [],
        "deviceMeta": meta_map,
        "addedDevices": added_list,
        "devicesDirty": False,
    }

    r_set = requests.post(
        f"{upstash_url}/set/{UPSTASH_REDIS_KEY}",
        headers={**headers, "Content-Type": "application/json"},
        data=json.dumps(json.dumps(merged_state, ensure_ascii=False)),
        timeout=15,
    )
    if not r_set.ok:
        print(f"[Upstash] Write error {r_set.status_code}: {r_set.text[:160]}")
        return

    if pending_cmds:
        executed_any = _execute_commands(pending_cmds, client, blocked_by_mac)
        if executed_any:
            _refresh_payload_after_commands(payload, client)
            merged_state.update(
                {
                    "blockedRules": payload["blockedRules"],
                    "diagnostics": payload["diagnostics"],
                    "devices": payload["devices"],
                    "wifiClients": payload["wifiClients"],
                }
            )
            requests.post(
                f"{upstash_url}/set/{UPSTASH_REDIS_KEY}",
                headers={**headers, "Content-Type": "application/json"},
                data=json.dumps(json.dumps(merged_state, ensure_ascii=False)),
                timeout=15,
            )

    if prev.get("devicesDirty") or meta_map:
        _apply_remote_meta(known_devices, meta_map, added_list)


def run_once(
    client: ZTEF680Client,
    known_devices: List[Dict[str, str]],
    cfg: Dict[str, Any],
    prev_online: Dict[str, bool],
    seen_unknown: Set[str],
    disconnect_counts: Dict[str, int],
) -> None:
    global _PREV_PORT_BYTES, _BLACKOUT_TRACKER, _BLACKOUT_HISTORY
    global _LAST_WAN_DIAG, _LAST_ROGUE_CHECK, _LAST_ARP_MAP, _WIFI_MISS_COUNT, _RECENT_WLAN_MACS, _CYCLE_COUNT
    global _LAST_DHCP_LEASES, _LAST_WLAN_SSIDS, _LAST_WLAN_ACL, _LAST_OPTICAL_INFO, _LAST_SYSTEM_STATUS, _LAST_PORT_MIRROR, _LAST_ASSOC_HOSTNAMES

    _CYCLE_COUNT += 1
    prev_online_snapshot = dict(prev_online)

    lan = client.get_lan_clients()
    wlan = client.get_wlan_clients()
    if not lan and not wlan:
        print("[ZTE] Empty LAN+WLAN response (session likely preempted); re-logging in...")
        client.login()
        lan = client.get_lan_clients()
        wlan = client.get_wlan_clients()
        if not lan and not wlan:
            print("[ZTE] Still empty after re-login; skipping cycle to avoid bogus offline wipeout.")
            return
    mac_filters = client.get_mac_filters()
    fw_fetched = not getattr(client, "last_xml_expired", False)
    acl_fetched = False
    try:
        fresh_acl = client.get_wlan_acl_rules()
        if not getattr(client, "last_xml_expired", False):
            _LAST_WLAN_ACL = fresh_acl
            acl_fetched = True
    except Exception:
        pass
    raw_ports = client.get_lan_ports()

    if _CYCLE_COUNT % 4 == 1 or not _LAST_DHCP_LEASES:
        try:
            _LAST_DHCP_LEASES = client.get_dhcp_leases()
        except Exception:
            pass
        try:
            _LAST_WLAN_SSIDS = client.get_wlan_ssids()
        except Exception:
            pass
        try:
            _LAST_OPTICAL_INFO = client.get_optical_info()
        except Exception:
            pass
        try:
            _LAST_SYSTEM_STATUS = client.get_system_status()
        except Exception:
            pass
        try:
            _LAST_PORT_MIRROR = client.get_port_mirror_status()
        except Exception:
            pass
        try:
            assoc_xml = client._get_xml(
                "?_type=menuData&_tag=status_associated_devices_lua.lua",
                view_tag="localNetStatus",
            )
            for inst in _parse_instances(assoc_xml, "OBJ_ACCESSDEV_ID"):
                m = norm_mac(inst.get("MACAddress", ""))
                h = (inst.get("HostName") or "").strip()
                if m and h and h.lower() != "unknown":
                    _LAST_ASSOC_HOSTNAMES[m] = h
        except Exception:
            pass

    dhcp_leases_raw = _LAST_DHCP_LEASES
    wlan_ssids = _LAST_WLAN_SSIDS
    wlan_acl_raw = _LAST_WLAN_ACL
    optical_info = _LAST_OPTICAL_INFO
    system_status = _LAST_SYSTEM_STATUS
    port_mirror_raw = _LAST_PORT_MIRROR

    # Enrich hostnames from DHCP leases & associated devices
    assoc_hostnames: Dict[str, str] = dict(_LAST_ASSOC_HOSTNAMES)
    dhcp_by_mac: Dict[str, Dict[str, str]] = {}
    for dl in dhcp_leases_raw:
        dm = norm_mac(dl.get("MACAddr", ""))
        if not dm:
            continue
        dhcp_by_mac[dm] = dl
        dh = (dl.get("HostName") or "").strip()
        if dh and dh.lower() != "unknown":
            assoc_hostnames[dm] = dh

    lan_ports: List[Dict[str, Any]] = []
    for idx, p in enumerate(raw_ports, start=1):
        port_name = f"LAN{idx}"
        in_b = int(p.get("InBytes", 0) or 0)
        out_b = int(p.get("OutBytes", 0) or 0)
        lan_ports.append(
            {
                "port": port_name,
                "status": p.get("Status", "0"),
                "speed": p.get("Speed", "0"),
                "duplex": p.get("Duplex", "0"),
                "inBytes": in_b,
                "outBytes": out_b,
                "totalBytes": in_b + out_b,
                "inErrors": int(p.get("RxErrors", 0) or 0),
                "outErrors": int(p.get("TxErrors", 0) or 0),
            }
        )

    # 1. Real-time Bandwidth calculations (Throughput in Mbps per LAN port)
    now_ts = time.time()
    lan_port_rates: List[Dict[str, Any]] = []
    for p in lan_ports:
        pname = p["port"]
        cur_in = p["inBytes"]
        cur_out = p["outBytes"]
        prev = _PREV_PORT_BYTES.get(pname)
        rx_mbps = 0.0
        tx_mbps = 0.0
        if prev:
            dt = max(1.0, now_ts - prev["ts"])
            delta_out = max(0, cur_out - prev["outBytes"])
            delta_in = max(0, cur_in - prev["inBytes"])
            # In ZTE GPON counters, outBytes is Router -> LAN client = Download
            rx_mbps = round((delta_out * 8) / (dt * 1_000_000), 2)
            tx_mbps = round((delta_in * 8) / (dt * 1_000_000), 2)
        _PREV_PORT_BYTES[pname] = {"inBytes": cur_in, "outBytes": cur_out, "ts": now_ts}

        is_hog = rx_mbps >= 45.0
        lan_port_rates.append(
            {
                "port": pname,
                "rxMbps": rx_mbps,
                "txMbps": tx_mbps,
                "totalMbps": round(rx_mbps + tx_mbps, 2),
                "isHog": is_hog,
                "totalInGB": round(cur_in / (1024**3), 2),
                "totalOutGB": round(cur_out / (1024**3), 2),
            }
        )

    live_by_mac: Dict[str, Dict[str, Any]] = {}
    for d in lan:
        mac = norm_mac(d.get("MACAddress", ""))
        if not mac:
            continue
        host = (d.get("HostName") or "").strip()
        resolved_host = (
            host if (host and host.lower() != "unknown")
            else (assoc_hostnames.get(mac, "") or _MODEL_CACHE.get(mac, {}).get("hostname", ""))
        )
        port_name = (d.get("AliasName") or d.get("PortName") or "-").strip()
        live_by_mac[mac] = {
            "ip": d.get("IPAddress", ""),
            "ipv6": d.get("IPV6Address") or d.get("IPv6Address", ""),
            "hostname": resolved_host,
            "port": port_name,
            "medium": "LAN",
            "rssi": "",
            "snr": "",
            "txRate": "",
            "rxRate": "",
            "linkTime": "",
        }

    ssid_map = {s["instId"]: s for s in wlan_ssids if s.get("instId")}

    for w in wlan:
        mac = norm_mac(w.get("MACAddress", ""))
        if not mac:
            continue
        _RECENT_WLAN_MACS.add(mac)
        w_host = (w.get("HostName") or "").strip()
        if w_host.lower() == "unknown":
            w_host = ""
        cached_host = _MODEL_CACHE.get(mac, {}).get("hostname", "")
        ap_id = (w.get("AliasName") or w.get("WlanId") or "DEV.WIFI.AP1").strip()
        ssid_meta = ssid_map.get(ap_id, {})
        band_label = ssid_meta.get("band") or w.get("BAND") or w.get("Band") or ""
        chan_width = w.get("BAND") or w.get("Band") or ""
        if ssid_meta.get("band") and chan_width and chan_width != ssid_meta["band"]:
            band_label = f"{ssid_meta['band']} ({chan_width})"
        live_by_mac[mac] = {
            "ip": w.get("IPAddress", ""),
            "ipv6": w.get("IPV6Address") or w.get("IPv6Address", ""),
            "hostname": w_host or assoc_hostnames.get(mac, "") or cached_host or "Wi-Fi Device",
            "port": ap_id,
            "ssidName": ssid_meta.get("essid", ""),
            "medium": "WLAN",
            "rssi": w.get("RSSI") or w.get("Rssi", ""),
            "noise": w.get("NOISE") or w.get("Noise", ""),
            "snr": w.get("SNR") or w.get("Snr", ""),
            "txRate": w.get("TxRate", ""),
            "rxRate": w.get("RxRate", ""),
            "mcs": w.get("MCS", ""),
            "mode": w.get("CurrentMode") or w.get("Mode", ""),
            "band": band_label,
            "linkTime": w.get("LinkTime", ""),
        }

    # Merge local ARP scan (arp-scan / scapy / OS ARP cache) strictly within local_subnet
    local_subnet = cfg.get("local_subnet", "192.168.1.0/24")
    if _CYCLE_COUNT % 3 == 1 or not _LAST_ARP_MAP:
        try:
            _LAST_ARP_MAP = run_arp_scan(local_subnet)
        except Exception:
            pass
    for arp_mac, arp_info in _LAST_ARP_MAP.items():
        arp_ip = arp_info.get("ip", "")
        if not arp_ip or arp_ip == "192.168.1.1":
            continue
        if arp_mac not in live_by_mac:
            # Avoid re-adding a disconnected Wi-Fi phone from stale ARP cache as a LAN device
            if arp_mac in _RECENT_WLAN_MACS:
                continue
            live_by_mac[arp_mac] = {
                "ip": arp_ip,
                "ipv6": "",
                "hostname": assoc_hostnames.get(arp_mac, ""),
                "port": "LAN1",
                "medium": "LAN",
                "rssi": "",
                "snr": "",
                "txRate": "",
                "rxRate": "",
                "linkTime": "",
                "discoveryMethod": arp_info.get("method", "arp-scan"),
            }
        else:
            live_by_mac[arp_mac]["discoveryMethod"] = f"zte-native+{arp_info.get('method', 'arp-scan')}"

    blocked_by_mac = {norm_mac(r.get("SrcMacAddr", "")): r for r in mac_filters if r.get("SrcMacAddr")}

    # Map port statistics by port name (LAN1, LAN2, ...)
    port_stats_map = {p["port"]: p for p in lan_ports}
    known_name_by_mac = {norm_mac(d["mac"]): d["name"] for d in known_devices}

    # Probe live devices for deep telemetry, de-cloaking, and hardware cable health
    targets = []
    for mac, info in live_by_mac.items():
        if not info.get("ip"):
            continue
        p_info = port_stats_map.get(info.get("port"))
        targets.append({
            "ip": info["ip"],
            "mac": mac,
            "hostname": info.get("hostname", ""),
            "dev_name": known_name_by_mac.get(mac, ""),
            "port_info": p_info,
            "is_live_lan": info.get("medium") == "LAN",
        })
    probe_map = probe_many(targets, max_workers=24) if cfg.get("enable_ping", True) else {}
    nmap_map = nmap_scan_many([t["ip"] for t in targets], local_subnet) if cfg.get("enable_nmap", True) else {}

    # Preserve and update persistent brand+model cache across router reboots
    model_dirty = False
    for mac, info in live_by_mac.items():
        probe = probe_map.get(mac)
        if not probe:
            continue
        cached = _MODEL_CACHE.get(mac, {})
        cur_vendor = probe.get("vendor", "")
        cur_host = info.get("hostname", "") or probe.get("friendlyName", "")
        is_generic_vendor = cur_vendor in ("", "Unknown Vendor", "Randomized MAC (Phone/Privacy)", "TP-Link")
        if is_generic_vendor and cached.get("vendor"):
            probe["vendor"] = cached["vendor"]
        elif not is_generic_vendor and "(" in cur_vendor and cached.get("vendor") != cur_vendor:
            _MODEL_CACHE[mac] = {"hostname": cur_host or cached.get("hostname", ""), "vendor": cur_vendor}
            model_dirty = True
        if cur_host and cur_host.lower() not in ("unknown", "wi-fi device") and cached.get("hostname") != cur_host:
            entry = _MODEL_CACHE.get(mac, {})
            entry["hostname"] = cur_host
            if not entry.get("vendor") and cur_vendor:
                entry["vendor"] = cur_vendor
            _MODEL_CACHE[mac] = entry
            model_dirty = True
    if model_dirty:
        _save_model_cache(_MODEL_CACHE)

    # Device DNA & MAC-rotation identity reconciliation
    identity_records: List[Dict[str, Any]] = []
    for mac, info in live_by_mac.items():
        probe = probe_map.get(mac, {})
        identity_records.append(
            {
                "mac": mac,
                "ip": info.get("ip", ""),
                "hostname": info.get("hostname", ""),
                "friendlyName": probe.get("friendlyName", ""),
                "stableIds": probe.get("stableIds", []),
                "mdnsServices": probe.get("mdnsServices", []),
                "openPorts": probe.get("openPorts", []),
                "ttl": probe.get("ttl"),
                "mcs": info.get("mcs", ""),
                "txRate": info.get("txRate", ""),
                "mode": info.get("mode", ""),
                "band": info.get("band", ""),
                "rssi": info.get("rssi", ""),
                "port": info.get("port", ""),
                "medium": info.get("medium", ""),
                "randomizedMac": probe.get("randomizedMac", False),
            }
        )
    identity_map: Dict[str, Dict[str, Any]] = {}
    try:
        identity_map = _IDENTITY_ENGINE.reconcile(identity_records, known_devices)
    except Exception:
        pass

    alerts: List[Dict[str, str]] = []

    # Sync existing ZTE firewall/ACL rules (old + new) and Auto-Reblock rotated MACs
    try:
        cur_blocked_rules = [
            {"instId": r.get("_InstID", ""), "name": r.get("Name", ""), "mac": norm_mac(r.get("SrcMacAddr", ""))}
            for r in mac_filters if r.get("SrcMacAddr")
        ]
        cur_acl_rules = [
            {"instId": r.get("_InstID", ""), "name": r.get("Name", ""), "mac": norm_mac(r.get("MACAddress", "")), "interface": r.get("Interface", "DEV.WIFI.AP1")}
            for r in wlan_acl_raw if r.get("MACAddress")
        ]
        _IDENTITY_ENGINE.sync_existing_bans(
            cur_blocked_rules,
            cur_acl_rules,
            dhcp_by_mac,
            fw_fetched=fw_fetched,
            acl_fetched=acl_fetched,
        )
        auto_actions, suspicious_matches = _IDENTITY_ENGINE.evaluate_bans(identity_records, identity_map)
        wlan_acl_by_mac = {norm_mac(r.get("MACAddress", "")): r for r in wlan_acl_raw if r.get("MACAddress")}
        refreshed_fw = False
        refreshed_acl = False
        for act in auto_actions:
            new_mac = act["mac"]
            ban = act["ban"]
            btypes = ban.get("blockTypes") or []
            bname = act["name"]
            ban_macs_set = {norm_mac(m) for m in (ban.get("bannedMacs") or []) if m}
            applied = False

            if "firewall" in btypes and new_mac not in blocked_by_mac:
                # Find an existing firewall rule for this banned identity to update in-place
                existing_fw = None
                for bm in ban_macs_set:
                    if bm in blocked_by_mac:
                        existing_fw = blocked_by_mac[bm]
                        break
                if existing_fw and existing_fw.get("_InstID"):
                    old_inst = existing_fw["_InstID"]
                    old_name = existing_fw.get("Name") or bname
                    print(f"[AUTO-REBLOCK] Updating existing Firewall rule {old_inst} ({old_name}) -> {new_mac}")
                    res_xml = client.update_mac_filter(old_inst, old_name, new_mac)
                else:
                    print(f"[AUTO-REBLOCK] Firewall blocking {bname} new MAC {new_mac} ({act['reason']})")
                    res_xml = client.block_mac(bname, new_mac)
                if "<IF_ERRORSTR>SUCC</IF_ERRORSTR>" in res_xml:
                    applied = True
                    refreshed_fw = True
                else:
                    print(f"[AUTO-REBLOCK] Firewall failed: {res_xml[:160]}")

            if "wifi_acl" in btypes and new_mac not in wlan_acl_by_mac:
                iface = ban.get("interface") or "DEV.WIFI.AP1"
                # Find existing WLAN ACL rule(s) for this banned identity to update in-place
                existing_acls = [
                    r for r in wlan_acl_raw
                    if norm_mac(r.get("MACAddress", "")) in ban_macs_set and r.get("_InstID")
                ]
                if existing_acls:
                    for old_acl in existing_acls:
                        old_inst = old_acl["_InstID"]
                        old_name = old_acl.get("Name") or bname
                        old_iface = old_acl.get("Interface") or iface
                        print(f"[AUTO-REBLOCK] Updating existing Wi-Fi ACL {old_inst} ({old_name}) -> {new_mac}")
                        res_xml = client.update_wlan_mac(old_inst, old_name, new_mac, interface=old_iface)
                        if "<IF_ERRORSTR>SUCC</IF_ERRORSTR>" in res_xml:
                            applied = True
                            refreshed_acl = True
                        else:
                            print(f"[AUTO-REBLOCK] Wi-Fi ACL update failed: {res_xml[:160]}")
                else:
                    print(f"[AUTO-REBLOCK] Wi-Fi ACL blocking {bname} new MAC {new_mac} on {iface} ({act['reason']})")
                    res_xml = client.block_wlan_mac(bname, new_mac, interface=iface)
                    if "<IF_ERRORSTR>SUCC</IF_ERRORSTR>" in res_xml:
                        applied = True
                        refreshed_acl = True
                    else:
                        print(f"[AUTO-REBLOCK] Wi-Fi ACL failed: {res_xml[:160]}")
            if applied:
                _IDENTITY_ENGINE.mark_mac_banned(act["banId"], new_mac)
                msg = (
                    f"🛡️ حظر تلقائي (تغيير MAC): {bname} حاول الدخول بـ {new_mac} "
                    f"({act.get('ip') or '-'}) ← تم حظره تلقائياً! [{act['reason']}]"
                )
                alerts.append({"type": "auto_reblock", "mac": new_mac, "name": bname, "message": msg})
                send_telegram(cfg, msg)

        if refreshed_fw:
            mac_filters = client.get_mac_filters()
            blocked_by_mac = {norm_mac(r.get("SrcMacAddr", "")): r for r in mac_filters if r.get("SrcMacAddr")}
        if refreshed_acl:
            wlan_acl_raw = client.get_wlan_acl_rules()
            _LAST_WLAN_ACL = wlan_acl_raw

        for warn in suspicious_matches:
            wmac = warn["mac"]
            if wmac not in _WARNED_SUSPICIOUS_MACS:
                _WARNED_SUSPICIOUS_MACS.add(wmac)
                wname = warn["ban"].get("name", "جهاز محظور")
                msg = (
                    f"⚠️ اشتباه تغيير MAC: الجهاز {wmac} ({warn.get('ip') or '-'}) "
                    f"يشبه المحظور {wname} ({warn['confidence']}%) [{warn['reason']}]"
                )
                alerts.append({"type": "suspicious_mac", "mac": wmac, "name": wname, "message": msg})
                send_telegram(cfg, msg)
    except Exception as exc:
        print(f"[AUTO-REBLOCK] Warning: {exc}")
    known_macs = {norm_mac(d["mac"]) for d in known_devices}
    device_states: List[Dict[str, Any]] = []

    now_iso = datetime.now(timezone.utc).isoformat()

    # Track bandwidth hogs
    for rate_item in lan_port_rates:
        if rate_item["isHog"]:
            pname = rate_item["port"]
            devs = [d["name"] for d in known_devices if live_by_mac.get(norm_mac(d["mac"]), {}).get("port") == pname]
            msg = f"⚠️ استهلاك صبيب مرتفع على {pname}: {rate_item['rxMbps']} Mbps تحميل! الأجهزة المرتبطة: {', '.join(devs[:3])}"
            alerts.append({"type": "bandwidth_hog", "mac": pname, "name": pname, "message": msg})

    for dev in known_devices:
        mac = norm_mac(dev["mac"])
        live = live_by_mac.get(mac)
        probe = probe_map.get(mac, {})
        current_ip = live["ip"] if live and live.get("ip") else dev["ip"]
        is_online = live is not None or (probe.get("latencyMs") is not None)

        # 2. Blackout & Uptime history tracking
        if mac in prev_online and prev_online[mac] != is_online:
            if not is_online:
                # Device went offline
                disconnect_counts[mac] = disconnect_counts.get(mac, 0) + 1
                _BLACKOUT_TRACKER[mac] = {
                    "startedAt": now_iso,
                    "name": dev["name"],
                    "port": dev.get("group", dev["name"]),
                }
                msg = f"OFFLINE: {dev['name']} ({current_ip}) - Connection lost!"
                alerts.append({"type": "device_offline", "mac": mac, "name": dev["name"], "message": msg})
                send_telegram(cfg, msg)
            else:
                # Device came back online
                started_entry = _BLACKOUT_TRACKER.pop(mac, None)
                dur_str = "أقل من دقيقة"
                if started_entry and started_entry.get("startedAt"):
                    try:
                        s_dt = datetime.fromisoformat(started_entry["startedAt"])
                        dur_sec = (datetime.now(timezone.utc) - s_dt).total_seconds()
                        dur_str = format_duration(dur_sec)
                    except Exception:
                        pass
                _BLACKOUT_HISTORY.insert(
                    0,
                    {
                        "id": f"{int(time.time())}-{mac[-5:]}",
                        "mac": mac,
                        "name": dev["name"],
                        "port": live.get("port", "-") if live else "-",
                        "startedAt": started_entry.get("startedAt", now_iso) if started_entry else now_iso,
                        "endedAt": now_iso,
                        "duration": dur_str,
                        "active": False,
                    },
                )
                _BLACKOUT_HISTORY = _BLACKOUT_HISTORY[:30]
                msg = f"ONLINE: {dev['name']} ({current_ip}) - عاد للاتصال (انقطع لمدة {dur_str})"
                alerts.append({"type": "device_online", "mac": mac, "name": dev["name"], "message": msg})
                send_telegram(cfg, msg)
        prev_online[mac] = is_online

        blk = blocked_by_mac.get(mac)
        medium = live["medium"] if live else ("WLAN" if dev.get("group") == "PC" else "LAN")
        friendly = probe.get("friendlyName", "")
        friendly_src = probe.get("friendlySource", "")
        host_str = (live.get("hostname", "") if live else "") or assoc_hostnames.get(mac, "")
        disc_method = live.get("discoveryMethod", "zte-native") if live else "zte-native"
        discovery_info = classify_and_merge(
            mac=mac,
            ip=current_ip,
            vendor=probe.get("vendor", ""),
            hostname=friendly or host_str,
            ttl=probe.get("ttl"),
            nmap_info=nmap_map.get(current_ip),
            open_ports=probe.get("openPorts", []),
            http_title=probe.get("httpTitle", ""),
            dev_name=dev["name"],
            discovery_method=disc_method,
            base_category=probe.get("category", ""),
        )
        if is_online:
            try:
                upsert_discovered_device(discovery_info)
            except Exception:
                pass

        device_states.append(
            {
                "name": dev["name"],
                "group": dev.get("group", dev["name"]),
                "expectedIp": dev["ip"],
                "ip": current_ip,
                "ipv6": live.get("ipv6", "") if live else "",
                "mac": mac,
                "hostname": host_str,
                "friendlyName": friendly,
                "friendlySource": friendly_src,
                "online": is_online,
                "medium": medium if is_online else "OFFLINE",
                "port": live["port"] if live else "-",
                "rssi": live.get("rssi", "") if live else "",
                "snr": live.get("snr", "") if live else "",
                "txRate": live.get("txRate", "") if live else "",
                "rxRate": live.get("rxRate", "") if live else "",
                "linkTime": live.get("linkTime", "") if live else "",
                "vendor": probe.get("vendor", ""),
                "randomizedMac": probe.get("randomizedMac", False),
                "latencyMs": probe.get("latencyMs"),
                "openPorts": probe.get("openPorts", []),
                "httpTitle": probe.get("httpTitle", ""),
                "disconnects": disconnect_counts.get(mac, 0),
                "blocked": blk is not None,
                "blockInstId": blk.get("_InstID", "") if blk else "",
                "cableHealth": probe.get("cableHealth"),
                "category": probe.get("category", "device"),
                "catName": probe.get("catName", "جهاز شبكي"),
                "catIcon": probe.get("catIcon", "🔌"),
                "discoveryInfo": discovery_info,
                "identity": identity_map.get(mac),
            }
        )

    unknown_cable: List[Dict[str, Any]] = []
    wifi_clients: List[Dict[str, Any]] = []

    for mac, info in live_by_mac.items():
        probe = probe_map.get(mac, {})
        blk = blocked_by_mac.get(mac)
        friendly = probe.get("friendlyName", "")
        friendly_src = probe.get("friendlySource", "")
        c_ip = info.get("ip", "")
        discovery_info = classify_and_merge(
            mac=mac,
            ip=c_ip,
            vendor=probe.get("vendor", ""),
            hostname=friendly or info.get("hostname", ""),
            ttl=probe.get("ttl"),
            nmap_info=nmap_map.get(c_ip),
            open_ports=probe.get("openPorts", []),
            http_title=probe.get("httpTitle", ""),
            dev_name=friendly or info.get("hostname", ""),
            discovery_method=info.get("discoveryMethod", "zte-native"),
            base_category=probe.get("category", ""),
        )
        try:
            upsert_discovered_device(discovery_info)
        except Exception:
            pass

        if info.get("medium") == "WLAN":
            _WIFI_MISS_COUNT.pop(mac, None)
            wifi_clients.append(
                {
                    "mac": mac,
                    "ip": c_ip,
                    "ipv6": info.get("ipv6", ""),
                    "hostname": friendly or info.get("hostname", "") or "Wi-Fi Device",
                    "friendlyName": friendly,
                    "friendlySource": friendly_src,
                    "port": info.get("port", "DEV.WIFI.AP1"),
                    "ssidName": info.get("ssidName", ""),
                    "rssi": info.get("rssi", ""),
                    "noise": info.get("noise", ""),
                    "snr": info.get("snr", ""),
                    "txRate": info.get("txRate", ""),
                    "rxRate": info.get("rxRate", ""),
                    "mcs": info.get("mcs", ""),
                    "mode": info.get("mode", ""),
                    "band": info.get("band", ""),
                    "linkTime": info.get("linkTime", ""),
                    "vendor": probe.get("vendor", ""),
                    "randomizedMac": probe.get("randomizedMac", False),
                    "latencyMs": probe.get("latencyMs"),
                    "blocked": blk is not None,
                    "blockInstId": blk.get("_InstID", "") if blk else "",
                    "isKnown": mac in known_macs,
                    "category": probe.get("category", "phone"),
                    "catName": probe.get("catName", "هاتف ذكي"),
                    "catIcon": probe.get("catIcon", "📱"),
                    "discoveryInfo": discovery_info,
                    "identity": identity_map.get(mac),
                }
            )
        if mac not in known_macs:
            id_info = identity_map.get(mac)
            unknown_cable.append(
                {
                    "mac": mac,
                    "ip": c_ip,
                    "hostname": friendly or info.get("hostname", "") or "Unknown",
                    "friendlyName": friendly,
                    "friendlySource": friendly_src,
                    "port": info.get("port", ""),
                    "medium": info.get("medium", ""),
                    "vendor": probe.get("vendor", ""),
                    "randomizedMac": probe.get("randomizedMac", False),
                    "latencyMs": probe.get("latencyMs"),
                    "openPorts": probe.get("openPorts", []),
                    "httpTitle": probe.get("httpTitle", ""),
                    "blocked": blk is not None,
                    "blockInstId": blk.get("_InstID", "") if blk else "",
                    "cableHealth": probe.get("cableHealth"),
                    "category": probe.get("category", "device"),
                    "catName": probe.get("catName", "جهاز شبكي"),
                    "catIcon": probe.get("catIcon", "🔌"),
                    "discoveryInfo": discovery_info,
                    "identity": id_info,
                }
            )
            if mac not in seen_unknown:
                seen_unknown.add(mac)
                dev_label = friendly or info.get("hostname") or "Unknown"
                same_note = ""
                if id_info and id_info.get("likelySameAsName"):
                    same_note = f" [نفس الجهاز؟ ← {id_info['likelySameAsName']} ({id_info.get('matchConfidence', 0)}%)]"
                msg = f"NEW DEVICE: {dev_label} ({info.get('ip')}) MAC {mac} on {info.get('port')}{same_note}"
                alerts.append({"type": "new_device", "mac": mac, "name": dev_label, "message": msg})
                send_telegram(cfg, msg)

    blocked_rules = [
        {
            "instId": rule.get("_InstID", ""),
            "name": rule.get("Name", ""),
            "mac": norm_mac(rule.get("SrcMacAddr", "")),
        }
        for rule in mac_filters
        if rule.get("SrcMacAddr")
    ]

    # Combine active offline cards with historical blackout events
    active_blackouts: List[Dict[str, Any]] = []
    for mac, tracker in _BLACKOUT_TRACKER.items():
        dur_str = "انقطاع نشط حالياً"
        try:
            s_dt = datetime.fromisoformat(tracker["startedAt"])
            dur_sec = (datetime.now(timezone.utc) - s_dt).total_seconds()
            dur_str = format_duration(dur_sec)
        except Exception:
            pass
        active_blackouts.append(
            {
                "id": f"act-{mac[-5:]}",
                "mac": mac,
                "name": tracker["name"],
                "port": tracker.get("port", "-"),
                "startedAt": tracker["startedAt"],
                "endedAt": None,
                "duration": dur_str,
                "active": True,
            }
        )

    all_blackouts = active_blackouts + _BLACKOUT_HISTORY

    # 3. Rogue DHCP / Foreign Subnet / IPv6 RA check (run every 3 cycles)
    if _CYCLE_COUNT % 3 == 1 or not _LAST_ROGUE_CHECK:
        try:
            _LAST_ROGUE_CHECK = check_rogue_network(lan_clients=lan)
            if _LAST_ROGUE_CHECK.get("detected"):
                alerts.append(
                    {
                        "type": "rogue_dhcp",
                        "mac": _LAST_ROGUE_CHECK.get("serverIp", "ROGUE"),
                        "name": "Rogue Router Alert",
                        "message": _LAST_ROGUE_CHECK["message"],
                    }
                )
        except Exception:
            pass

    # 4. WAN & Gateway Diagnostics (run every 2 cycles)
    if _CYCLE_COUNT % 2 == 1 or not _LAST_WAN_DIAG:
        try:
            _LAST_WAN_DIAG = run_wan_diagnostics()
        except Exception:
            pass

    # 5. Temporal Correlation & Passive Network Tomography
    correlation_insights: List[Dict[str, Any]] = []
    try:
        correlation_insights = _CORRELATION_ENGINE.observe_cycle(device_states, prev_online_snapshot)
    except Exception:
        pass

    wlan_acl_rules = [
        {
            "instId": r.get("_InstID", ""),
            "name": r.get("Name", ""),
            "mac": norm_mac(r.get("MACAddress", "")),
            "interface": r.get("Interface", "DEV.WIFI.AP1"),
        }
        for r in wlan_acl_raw
        if r.get("MACAddress")
    ]
    dhcp_leases = [
        {
            "ip": dl.get("IPAddr", ""),
            "mac": norm_mac(dl.get("MACAddr", "")),
            "hostname": (dl.get("HostName") or "").strip(),
            "port": dl.get("PhyPortName", ""),
            "expiresSec": int(dl.get("ExpiredTime", 0) or 0),
        }
        for dl in dhcp_leases_raw
        if dl.get("IPAddr")
    ]
    router_url = str(cfg.get("router_url") or "http://192.168.1.1")
    m_ip = re.search(r"https?://([^/:]+)", router_url)
    router_ip = m_ip.group(1) if m_ip else "192.168.1.1"
    router_health = {
        "model": system_status.get("ModelName") or "ZTE",
        "ip": router_ip,
        "softwareVer": system_status.get("SoftwareVer", ""),
        "hardwareVer": system_status.get("HardwareVer", ""),
        "cpuUsage": int(system_status.get("CpuUsage1", 0) or 0) if system_status else 0,
        "memUsage": int(system_status.get("MemUsage", 0) or 0) if system_status else 0,
        "uptimeSec": int(system_status.get("PowerOnTime", 0) or 0) if system_status else 0,
        "rxPowerDbm": optical_info.get("RxPower", "") if optical_info else "",
        "txPowerDbm": optical_info.get("TxPower", "") if optical_info else "",
        "tempC": optical_info.get("Temp", "") if optical_info else "",
        "los": (optical_info.get("LosInfo", "0") == "1") if optical_info else False,
        "regStatus": optical_info.get("RegStatus", "") if optical_info else "",
    }
    port_mirror = {
        "enable": port_mirror_raw.get("MirrorEnable", "0") == "1",
        "src": port_mirror_raw.get("MirrorSrc", "IGD.WANALL"),
        "dest": port_mirror_raw.get("MirrorDest", ""),
    }

    payload = {
        "updatedAt": now_iso,
        "totalKnown": len(device_states),
        "onlineCount": sum(1 for d in device_states if d["online"]),
        "unknownCount": len(unknown_cable),
        "devices": device_states,
        "wifiClients": wifi_clients,
        "unknownDevices": unknown_cable,
        "blockedRules": blocked_rules,
        "wlanAclRules": wlan_acl_rules,
        "bannedIdentities": list(_IDENTITY_ENGINE.banned.values()),
        "wlanSsids": wlan_ssids,
        "dhcpLeases": dhcp_leases,
        "portMirror": port_mirror,
        "lanPorts": lan_ports,
        "lanPortRates": lan_port_rates,
        "blackoutHistory": all_blackouts[:25],
        "rogueDhcp": _LAST_ROGUE_CHECK,
        "diagnostics": _LAST_WAN_DIAG,
        "correlationInsights": correlation_insights,
        "alerts": alerts,
    }
    if router_health:
        payload["routerHealth"] = router_health

    api_url = cfg.get("api_url", "").rstrip("/")
    api_mac = norm_mac(cfg.get("api_mac", ""))
    if api_url and api_mac and "192.168." in api_url:
        host_entry = live_by_mac.get(api_mac)
        if host_entry and host_entry.get("ip"):
            api_url = re.sub(r"http://192\.168\.\d+\.\d+", f"http://{host_entry['ip']}", api_url)
    api_secret = cfg.get("api_secret", "")
    upstash_url = cfg.get("upstash_url", "").rstrip("/")
    upstash_token = cfg.get("upstash_token", "")

    if upstash_url and upstash_token:
        try:
            _sync_upstash(upstash_url, upstash_token, payload, client, known_devices, blocked_by_mac)
        except Exception as exc:
            print(f"[Upstash] Sync failed: {exc}")

    sync_targets: List[str] = []
    for raw_url in [api_url, *(cfg.get("extra_api_urls") or [])]:
        u = str(raw_url or "").strip().rstrip("/")
        if u and "YOUR_VERCEL" not in u and u not in sync_targets:
            sync_targets.append(u)

    all_commands: List[Dict[str, Any]] = []
    synced_targets: List[str] = []
    for target_url in sync_targets:
        try:
            res = requests.post(
                f"{target_url}/api/sync",
                json=payload,
                headers={"Authorization": f"Bearer {api_secret}"},
                timeout=15,
            )
            if res.ok:
                synced_targets.append(target_url)
                resp_json = res.json()
                cmds = resp_json.get("commands", [])
                if cmds:
                    all_commands.extend(cmds)
                _apply_remote_meta(
                    known_devices,
                    resp_json.get("deviceMeta"),
                    resp_json.get("addedDevices"),
                )
            else:
                print(f"[API] Sync error ({target_url}) {res.status_code}: {res.text[:200]}")
        except Exception as exc:
            print(f"[API] Sync failed ({target_url}): {exc}")

    if all_commands:
        executed_any = _execute_commands(all_commands, client, blocked_by_mac)
        if executed_any:
            _refresh_payload_after_commands(payload, client)
            for target_url in synced_targets:
                try:
                    requests.post(
                        f"{target_url}/api/sync",
                        json=payload,
                        headers={"Authorization": f"Bearer {api_secret}"},
                        timeout=15,
                    )
                except Exception as exc:
                    print(f"[API] Post-command sync failed ({target_url}): {exc}")

    print(
        f"[{datetime.now().strftime('%H:%M:%S')}] "
        f"Cable Online: {payload['onlineCount']}/{payload['totalKnown']} | "
        f"Wi-Fi: {len(wifi_clients)} | Unknown: {payload['unknownCount']} | Blocked: {len(blocked_by_mac)}"
    )


def main() -> None:
    if not CONFIG_PATH.exists():
        print("Missing config.json! Copy config.example.json to config.json and fill in your values.")
        sys.exit(1)
    cfg = load_json(CONFIG_PATH)
    known_devices = load_json(DEVICES_PATH)
    client = ZTEF680Client(
        cfg["router_url"],
        cfg.get("router_user") or cfg.get("router_username", "admin"),
        cfg["router_password"],
    )
    while True:
        try:
            client.login()
            break
        except Exception as exc:
            print(f"[ZTE Login Retry] {exc} (waiting 20s before retry)")
            time.sleep(20)
    print(f"Connected to ZTE F680 at {cfg['router_url']}. Monitoring {len(known_devices)} devices...")

    prev_online: Dict[str, bool] = {}
    seen_unknown: Set[str] = set()
    disconnect_counts: Dict[str, int] = {}
    poll = int(cfg.get("poll_seconds", 30))

    while True:
        try:
            run_once(client, known_devices, cfg, prev_online, seen_unknown, disconnect_counts)
        except Exception as exc:
            print(f"[Loop Error] {exc}")
            try:
                client.login()
            except Exception as login_exc:
                print(f"[ZTE Re-login Backoff] {login_exc} (waiting 20s)")
                time.sleep(20)
                continue
        time.sleep(poll)


if __name__ == "__main__":
    main()
