"""Device DNA & Identity Differentiation Engine.

Distinguishes lookalike devices (e.g., two 'iPhone's or nameless Wi-Fi devices)
and tracks likely MAC-rotation handoffs using:
1. Stable hardware/service identifiers (mDNS instance IDs like adb-..., SSDP USN UUIDs).
2. Unique non-generic DHCP/mDNS hostnames (e.g., itel-A33-Plus, A12-de-Abdelatif).
3. Radio/PHY antenna class (1x1 SISO vs 2x2 MIMO from MCS/TxRate) + TTL + openPorts + RSSI handoff.
"""

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

BASE_DIR = Path(__file__).resolve().parent
IDENTITY_PATH = BASE_DIR / "identity_profiles.json"
BANNED_PATH = BASE_DIR / "banned_identities.json"

_GENERIC_NAMES: Set[str] = {
    "",
    "unknown",
    "wi-fi device",
    "wifi device",
    "iphone",
    "ipad",
    "android",
    "pc",
    "laptop",
    "desktop",
    "localhost",
    "redmi",
    "galaxy",
    "huawei",
    "xiaomi",
    "samsung",
    "oppo",
    "vivo",
    "realme",
    "honor",
    "tl-wr844n",
    "tl-wr840n",
    "tl-wr820n",
    "tlwr844n",
    "tenda",
    "router",
}


def is_unique_hostname(name: str) -> bool:
    clean = (name or "").strip().lower()
    if len(clean) < 4 or clean in _GENERIC_NAMES:
        return False
    if clean.replace(".", "").isdigit():
        return False
    return True


def classify_radio_class(
    mcs_raw: str = "",
    tx_rate_raw: str = "",
    mode_raw: str = "",
    band_raw: str = "",
) -> str:
    mode = (mode_raw or "").strip()
    band = (band_raw or "").strip()
    try:
        mcs = int(mcs_raw) if str(mcs_raw).strip() != "" else -1
    except Exception:
        mcs = -1
    try:
        tx = int(tx_rate_raw) if str(tx_rate_raw).strip() != "" else 0
    except Exception:
        tx = 0

    streams = ""
    if mode in ("11n", "802.11n") or "11n" in mode:
        if mcs >= 8 or tx >= 100000:
            streams = "2x2 MIMO"
        elif mcs >= 0:
            streams = "1x1 SISO"
    elif "11ax" in mode:
        streams = "Wi-Fi 6"
    elif "11ac" in mode:
        streams = "Wi-Fi 5"

    parts = [p for p in (streams, mode, "5G" if "5G" in band else "") if p]
    return " · ".join(parts)


def _parse_int(val: Any) -> Optional[int]:
    try:
        s = str(val).strip()
        if not s:
            return None
        return int(float(s))
    except Exception:
        return None


class IdentityEngine:
    def __init__(
        self,
        path: Path = IDENTITY_PATH,
        banned_path: Path = BANNED_PATH,
    ) -> None:
        self.path = path
        self.banned_path = banned_path
        self.profiles: Dict[str, Dict[str, Any]] = {}
        self.banned: Dict[str, Dict[str, Any]] = {}
        self._last_save_ts: float = 0.0
        self._load()

    def _load(self) -> None:
        if self.path.exists():
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    self.profiles = data
            except Exception:
                self.profiles = {}
        if self.banned_path.exists():
            try:
                with open(self.banned_path, "r", encoding="utf-8") as f:
                    bdata = json.load(f)
                if isinstance(bdata, dict):
                    self.banned = bdata
            except Exception:
                self.banned = {}

    def _save_banned(self) -> None:
        try:
            with open(self.banned_path, "w", encoding="utf-8") as f:
                json.dump(self.banned, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def _save(self, force: bool = False) -> None:
        now = time.time()
        if not force and (now - self._last_save_ts) < 30.0:
            return
        try:
            # Keep bounded to most recent 150 profiles
            if len(self.profiles) > 150:
                ordered = sorted(
                    self.profiles.items(),
                    key=lambda kv: kv[1].get("lastSeenTs", 0.0),
                    reverse=True,
                )[:150]
                self.profiles = dict(ordered)
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self.profiles, f, indent=2, ensure_ascii=False)
            self._last_save_ts = now
        except Exception:
            pass

    def reconcile(
        self,
        online_records: List[Dict[str, Any]],
        known_devices: List[Dict[str, str]],
    ) -> Dict[str, Dict[str, Any]]:
        """Update persistent Device DNA and return per-MAC identity/differentiation metadata."""
        now_ts = time.time()
        online_macs: Set[str] = set()
        known_by_mac = {
            (d.get("mac") or "").strip().upper(): d.get("name", "")
            for d in known_devices
            if d.get("mac")
        }

        # 1. Update online profiles
        for rec in online_records:
            mac = (rec.get("mac") or "").strip().upper()
            if not mac:
                continue
            online_macs.add(mac)
            prev = self.profiles.get(mac, {})
            radio_cls = classify_radio_class(
                rec.get("mcs", ""),
                rec.get("txRate", ""),
                rec.get("mode", ""),
                rec.get("band", ""),
            )
            stable_ids = sorted(
                set(prev.get("stableIds", [])) | set(rec.get("stableIds", []) or [])
            )[:8]
            open_ports = sorted(
                set(rec.get("openPorts", []) or prev.get("openPorts", []))
            )[:10]
            host = (rec.get("hostname") or "").strip() or prev.get("hostname", "")
            friendly = (rec.get("friendlyName") or "").strip() or prev.get("friendlyName", "")
            label = known_by_mac.get(mac) or friendly or host or mac

            self.profiles[mac] = {
                "mac": mac,
                "ip": rec.get("ip", "") or prev.get("ip", ""),
                "label": label,
                "hostname": host,
                "friendlyName": friendly,
                "stableIds": stable_ids,
                "mdnsServices": rec.get("mdnsServices", []) or prev.get("mdnsServices", []),
                "openPorts": open_ports,
                "ttl": rec.get("ttl") if rec.get("ttl") is not None else prev.get("ttl"),
                "radioClass": radio_cls or prev.get("radioClass", ""),
                "mode": rec.get("mode", "") or prev.get("mode", ""),
                "band": rec.get("band", "") or prev.get("band", ""),
                "mcs": rec.get("mcs", "") or prev.get("mcs", ""),
                "rssi": rec.get("rssi", "") or prev.get("rssi", ""),
                "port": rec.get("port", "") or prev.get("port", ""),
                "medium": rec.get("medium", "") or prev.get("medium", ""),
                "randomizedMac": bool(rec.get("randomizedMac")),
                "online": True,
                "lastSeenTs": now_ts,
            }

        # Mark non-present profiles offline (preserving lastSeenTs)
        for mac, prof in self.profiles.items():
            if mac not in online_macs:
                prof["online"] = False

        # 2. Detect same-name collisions among currently online devices
        name_counts: Dict[str, int] = {}
        for rec in online_records:
            disp = (rec.get("friendlyName") or rec.get("hostname") or "").strip().lower()
            if disp:
                name_counts[disp] = name_counts.get(disp, 0) + 1

        # 3. Build identity & differentiation output per online MAC
        results: Dict[str, Dict[str, Any]] = {}
        for rec in online_records:
            mac = (rec.get("mac") or "").strip().upper()
            if not mac:
                continue
            prof = self.profiles[mac]
            disp_name = (rec.get("friendlyName") or rec.get("hostname") or "").strip()
            has_collision = name_counts.get(disp_name.lower(), 0) > 1 if disp_name else False

            # Build concise differentiating badge & DNA tag
            traits: List[str] = []
            if prof["stableIds"]:
                traits.append(prof["stableIds"][0])
            if prof["radioClass"]:
                traits.append(prof["radioClass"])
            if prof["mcs"]:
                traits.append(f"MCS{prof['mcs']}")
            if prof["rssi"]:
                traits.append(f"{prof['rssi']}dBm")
            if prof["ttl"] is not None:
                traits.append(f"TTL{prof['ttl']}")
            if prof["openPorts"]:
                traits.append(f"Ports:{','.join(p.split(':')[-1] for p in prof['openPorts'][:2])}")

            dna_tag = " · ".join(traits[:4])

            # Match against offline profiles (MAC rotation / returning device recognition)
            best_match: Optional[Tuple[int, str, str, str]] = None  # (conf, mac, label, reason)
            cur_stable = set(prof["stableIds"])
            cur_host = prof["hostname"].strip()
            cur_ports = set(prof["openPorts"])
            cur_rssi = _parse_int(prof["rssi"])

            # Only try matching against other MACs if this MAC is randomized or unregistered
            if prof["randomizedMac"] or mac not in known_by_mac:
                for omac, oprof in self.profiles.items():
                    if omac == mac or oprof.get("online"):
                        continue
                    old_label = known_by_mac.get(omac) or oprof.get("label") or omac

                    # Tier 1: Exact stable mDNS / SSDP hardware ID match
                    ostable = set(oprof.get("stableIds") or [])
                    if cur_stable and ostable and (cur_stable & ostable):
                        shared = sorted(cur_stable & ostable)[0]
                        cand = (98, omac, old_label, f"نفس معرّف الجهاز الثابت ({shared})")
                        if not best_match or cand[0] > best_match[0]:
                            best_match = cand
                        continue

                    # Tier 2: Unique non-generic HostName match
                    ohost = (oprof.get("hostname") or "").strip()
                    if is_unique_hostname(cur_host) and cur_host.lower() == ohost.lower():
                        cand = (90, omac, old_label, f"نفس الاسم الفريد ({cur_host})")
                        if not best_match or cand[0] > best_match[0]:
                            best_match = cand
                        continue

                    # Tier 3: Recent MAC-rotation handoff (same radio class, port/medium, TTL, close RSSI)
                    age_sec = now_ts - float(oprof.get("lastSeenTs", 0.0))
                    if prof["randomizedMac"] and 0 <= age_sec <= 300:
                        score = 0
                        reasons: List[str] = []
                        if prof["medium"] == "WLAN" and oprof.get("medium") == "WLAN":
                            score += 20
                            if prof["radioClass"] and prof["radioClass"] == oprof.get("radioClass"):
                                score += 25
                                reasons.append(prof["radioClass"])
                            old_rssi = _parse_int(oprof.get("rssi"))
                            if cur_rssi is not None and old_rssi is not None and abs(cur_rssi - old_rssi) <= 12:
                                score += 15
                                reasons.append("إشارة متقاربة")
                        if cur_host and cur_host.lower() == ohost.lower():
                            score += 20
                            reasons.append(cur_host)
                        if prof["ttl"] is not None and prof["ttl"] == oprof.get("ttl"):
                            score += 10
                        oports = set(oprof.get("openPorts") or [])
                        if cur_ports and oports and (cur_ports & oports):
                            score += 15
                            reasons.append("نفس المنافذ")
                        if score >= 70:
                            cand = (
                                min(88, score),
                                omac,
                                old_label,
                                f"تبديل MAC محتمل ({' · '.join(reasons[:3])})",
                            )
                            if not best_match or cand[0] > best_match[0]:
                                best_match = cand

            results[mac] = {
                "stableIds": prof["stableIds"],
                "mdnsServices": prof["mdnsServices"],
                "radioClass": prof["radioClass"],
                "dnaTag": dna_tag,
                "sameNameConflict": has_collision,
                "diffBadge": " · ".join(traits[:3]) if has_collision else "",
                "likelySameAsMac": best_match[1] if best_match else "",
                "likelySameAsName": best_match[2] if best_match else "",
                "matchConfidence": best_match[0] if best_match else 0,
                "matchReason": best_match[3] if best_match else "",
            }

        self._save()
        return results

    def register_ban(
        self,
        mac: str,
        block_type: str,
        name: str = "",
        interface: str = "DEV.WIFI.AP1",
    ) -> Dict[str, Any]:
        """Persistently remember a banned device's DNA so MAC changes are auto-reblocked."""
        clean_mac = (mac or "").strip().upper()
        if not clean_mac:
            return {}
        prof = self.profiles.get(clean_mac, {})
        host = (prof.get("hostname") or "").strip()
        unique_host = host if is_unique_hostname(host) else ""
        stable_ids = list(prof.get("stableIds") or [])

        # Reuse existing ban entry if this MAC is already tracked under one
        existing_id = None
        for bid, entry in self.banned.items():
            if clean_mac in (entry.get("bannedMacs") or []) or clean_mac == entry.get("sourceMac"):
                existing_id = bid
                break

        ban_id = existing_id or f"ban-{clean_mac.replace(':', '').lower()}"
        entry = self.banned.get(
            ban_id,
            {
                "id": ban_id,
                "name": name or prof.get("label") or unique_host or clean_mac,
                "sourceMac": clean_mac,
                "bannedMacs": [clean_mac],
                "blockTypes": [],
                "interface": interface or "DEV.WIFI.AP1",
                "uniqueHostname": unique_host,
                "stableIds": stable_ids,
                "autoProtected": bool(unique_host or stable_ids),
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "reblockCount": 0,
            },
        )
        if clean_mac not in entry["bannedMacs"]:
            entry["bannedMacs"].append(clean_mac)
        if block_type not in entry["blockTypes"]:
            entry["blockTypes"].append(block_type)
        if interface:
            entry["interface"] = interface
        if name and entry.get("name") in ("", "Client", "Wi-Fi Client", clean_mac):
            entry["name"] = name
        if unique_host and not entry.get("uniqueHostname"):
            entry["uniqueHostname"] = unique_host
        if stable_ids:
            entry["stableIds"] = sorted(set(entry.get("stableIds") or []) | set(stable_ids))
        entry["autoProtected"] = bool(entry.get("uniqueHostname") or entry.get("stableIds"))
        self.banned[ban_id] = entry
        self._save_banned()
        return entry

    def unregister_ban(
        self,
        mac: str = "",
        ban_id: str = "",
        block_type: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Remove a persistent ban (or one blockType from it) when the user unblocks."""
        clean_mac = (mac or "").strip().upper()
        target_id = ban_id
        if not target_id and clean_mac:
            for bid, entry in self.banned.items():
                if clean_mac == entry.get("sourceMac") or clean_mac in (entry.get("bannedMacs") or []):
                    target_id = bid
                    break
        if not target_id or target_id not in self.banned:
            return None
        entry = self.banned[target_id]
        if block_type and len(entry.get("blockTypes") or []) > 1:
            entry["blockTypes"] = [bt for bt in entry["blockTypes"] if bt != block_type]
            self._save_banned()
            return entry
        removed = self.banned.pop(target_id)
        self._save_banned()
        return removed

    def mark_mac_banned(self, ban_id: str, new_mac: str) -> None:
        entry = self.banned.get(ban_id)
        if not entry:
            return
        clean = (new_mac or "").strip().upper()
        if clean and clean not in entry["bannedMacs"]:
            entry["bannedMacs"].append(clean)
            entry["reblockCount"] = int(entry.get("reblockCount", 0)) + 1
            entry["lastReblockAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self._save_banned()

    def sync_existing_bans(
        self,
        blocked_rules: List[Dict[str, str]],
        wlan_acl_rules: List[Dict[str, str]],
        dhcp_by_mac: Optional[Dict[str, Dict[str, str]]] = None,
        fw_fetched: bool = True,
        acl_fetched: bool = True,
    ) -> None:
        """Import existing ZTE firewall/ACL rules into persistent DNA bans and prune ones removed on router."""
        dhcp_by_mac = dhcp_by_mac or {}
        changed = False

        active_fw_macs = {
            (r.get("mac") or "").strip().upper()
            for r in blocked_rules
            if (r.get("mac") or "").strip()
        }
        active_acl_macs = {
            (r.get("mac") or "").strip().upper()
            for r in wlan_acl_rules
            if (r.get("mac") or "").strip()
        }

        for ban_id, entry in list(self.banned.items()):
            entry_macs = {
                str(m).strip().upper()
                for m in ([entry.get("sourceMac", "")] + list(entry.get("bannedMacs") or []))
                if m
            }
            cur_types = list(entry.get("blockTypes") or [])
            new_types = []
            for bt in cur_types:
                if bt == "firewall" and fw_fetched and not (entry_macs & active_fw_macs):
                    changed = True
                    continue
                if bt == "wifi_acl" and acl_fetched and not (entry_macs & active_acl_macs):
                    changed = True
                    continue
                new_types.append(bt)
            if new_types != cur_types:
                entry["blockTypes"] = new_types
            if not new_types and (fw_fetched or acl_fetched):
                print(f"[IDENTITY] Removed ban {entry.get('name', ban_id)} ({ban_id}) — deleted on router")
                del self.banned[ban_id]
                changed = True

        def _ingest(mac_raw: str, name_raw: str, block_type: str, iface: str = "DEV.WIFI.AP1") -> None:
            nonlocal changed
            clean_mac = (mac_raw or "").strip().upper()
            if not clean_mac:
                return
            prof = self.profiles.get(clean_mac, {})
            dhcp_host = (dhcp_by_mac.get(clean_mac, {}).get("HostName") or "").strip()
            prof_host = (prof.get("hostname") or "").strip()
            rule_name = (name_raw or "").strip()

            # Prefer real DHCP/profile hostname; fallback to rule_name if it isn't a synthetic ACL label
            rule_is_synthetic = (
                rule_name.lower().endswith(("_ssid1", "_ssid2", "_ssid3", "_ssid4"))
                or rule_name.lower() in ("wi-fi_device", "wifi_device", "blocked", "client")
            )
            candidate_host = dhcp_host or prof_host or ("" if rule_is_synthetic else rule_name)
            unique_host = candidate_host if is_unique_hostname(candidate_host) else ""
            stable_ids = list(prof.get("stableIds") or [])

            existing = None
            for entry in self.banned.values():
                if clean_mac == entry.get("sourceMac") or clean_mac in (entry.get("bannedMacs") or []):
                    existing = entry
                    break

            if existing is None:
                ban_id = f"ban-{clean_mac.replace(':', '').lower()}"
                display_name = rule_name or dhcp_host or prof.get("label") or clean_mac
                # Prefer longer non-truncated name (e.g. RedmiNote9Pro-RedmiN over RedmiNote9Pro-Re)
                if dhcp_host and len(dhcp_host) > len(display_name):
                    display_name = dhcp_host
                self.banned[ban_id] = {
                    "id": ban_id,
                    "name": display_name,
                    "sourceMac": clean_mac,
                    "bannedMacs": [clean_mac],
                    "blockTypes": [block_type],
                    "interface": iface or "DEV.WIFI.AP1",
                    "uniqueHostname": unique_host,
                    "stableIds": stable_ids,
                    "autoProtected": bool(unique_host or stable_ids),
                    "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "reblockCount": 0,
                }
                changed = True
            else:
                if block_type not in (existing.get("blockTypes") or []):
                    existing.setdefault("blockTypes", []).append(block_type)
                    changed = True
                if rule_name and len(rule_name) > len(existing.get("name", "")) and not rule_is_synthetic:
                    existing["name"] = rule_name
                    changed = True
                if unique_host and (not existing.get("uniqueHostname") or len(unique_host) > len(existing.get("uniqueHostname", ""))):
                    existing["uniqueHostname"] = unique_host
                    changed = True
                if stable_ids:
                    merged_st = sorted(set(existing.get("stableIds") or []) | set(stable_ids))
                    if merged_st != (existing.get("stableIds") or []):
                        existing["stableIds"] = merged_st
                        changed = True
                new_auto = bool(existing.get("uniqueHostname") or existing.get("stableIds"))
                if new_auto != existing.get("autoProtected"):
                    existing["autoProtected"] = new_auto
                    changed = True

        for r in blocked_rules:
            _ingest(r.get("mac", ""), r.get("name", ""), "firewall")
        for r in wlan_acl_rules:
            _ingest(r.get("mac", ""), r.get("name", ""), "wifi_acl", r.get("interface", "DEV.WIFI.AP1"))

        if changed:
            self._save_banned()

    def evaluate_bans(
        self,
        online_records: List[Dict[str, Any]],
        identity_map: Dict[str, Dict[str, Any]],
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Return (auto_reblock_actions, suspicious_warnings) for active online devices."""
        if not self.banned:
            return [], []

        auto_actions: List[Dict[str, Any]] = []
        suspicious: List[Dict[str, Any]] = []

        for rec in online_records:
            mac = (rec.get("mac") or "").strip().upper()
            if not mac:
                continue
            prof = self.profiles.get(mac, {})
            id_info = identity_map.get(mac, {})
            cur_stable = set(prof.get("stableIds") or [])
            cur_host = (prof.get("hostname") or "").strip().lower()
            likely_mac = (id_info.get("likelySameAsMac") or "").upper()
            match_conf = int(id_info.get("matchConfidence") or 0)

            for bid, ban in self.banned.items():
                ban_macs = {m.upper() for m in (ban.get("bannedMacs") or [])}
                ban_stable = set(ban.get("stableIds") or [])
                ban_host = (ban.get("uniqueHostname") or "").strip().lower()

                reason = ""
                confidence = 0

                # Deterministic Tier 1: Exact mDNS/SSDP stable hardware ID
                if cur_stable and ban_stable and (cur_stable & ban_stable):
                    shared = sorted(cur_stable & ban_stable)[0]
                    reason = f"نفس معرّف الجهاز الثابت ({shared})"
                    confidence = 98
                # Deterministic Tier 2: Exact unique non-generic HostName
                elif ban_host and cur_host and cur_host == ban_host:
                    reason = f"نفس الاسم الفريد ({prof.get('hostname', ban_host)})"
                    confidence = 90
                # Already known under this ban (e.g. rule dropped from router)
                elif mac in ban_macs:
                    reason = "مدرج مسبقاً في قائمة الحظر الدائم"
                    confidence = 100

                if confidence >= 90:
                    auto_actions.append(
                        {
                            "banId": bid,
                            "ban": ban,
                            "mac": mac,
                            "ip": rec.get("ip", ""),
                            "name": ban.get("name") or prof.get("label") or mac,
                            "confidence": confidence,
                            "reason": reason,
                        }
                    )
                    break

                # Heuristic Tier 3 (< 90%): Warn only, never auto-block blindly
                if likely_mac and likely_mac in ban_macs and 70 <= match_conf < 90:
                    suspicious.append(
                        {
                            "banId": bid,
                            "ban": ban,
                            "mac": mac,
                            "ip": rec.get("ip", ""),
                            "confidence": match_conf,
                            "reason": id_info.get("matchReason", ""),
                        }
                    )
                    break

        return auto_actions, suspicious

