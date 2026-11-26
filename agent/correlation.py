"""Temporal Correlation & Passive Network Tomography Engine.

Infers hidden network topology (which phone is behind which AP, which routers
share a sub-switch) WITHOUT changing hardware and WITHOUT needing neighbor passwords,
using three passive techniques:
1. Co-Failure Correlation (simultaneous offline/online transitions, ignoring global outages).
2. Correlated Latency/Jitter Spikes (simultaneous branch congestion/cable glitches).
3. Passive Non-Intrusive Fingerprinting (lightweight UDP SNMP 'public' check).
"""

import json
import socket
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

BASE_DIR = Path(__file__).resolve().parent
CORR_STATE_PATH = BASE_DIR / "correlation_state.json"

# Minimal SNMPv1 GetRequest for sysDescr.0 (1.3.6.1.2.1.1.1.0) with community "public"
_SNMP_PUBLIC_GET = bytes.fromhex(
    "302602010004067075626c6963a019020400000001020100020100300b300906082b060102010101000500"
)


def _pair_key(mac1: str, mac2: str) -> str:
    a, b = sorted([mac1.strip().upper(), mac2.strip().upper()])
    return f"{a}|{b}"


class CorrelationEngine:
    def __init__(self, state_path: Path = CORR_STATE_PATH) -> None:
        self.state_path = state_path
        self.state: Dict[str, Any] = {
            "coFailures": {},
            "jitterSpikes": {},
            "passiveProbes": {},
            "lastProbeAt": 0.0,
        }
        self._load()

    def _load(self) -> None:
        if self.state_path.exists():
            try:
                with open(self.state_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                if isinstance(data, dict):
                    self.state["coFailures"] = data.get("coFailures", {})
                    self.state["jitterSpikes"] = data.get("jitterSpikes", {})
                    self.state["passiveProbes"] = data.get("passiveProbes", {})
                    self.state["lastProbeAt"] = float(data.get("lastProbeAt", 0.0))
            except Exception:
                pass

    def _save(self) -> None:
        try:
            with open(self.state_path, "w", encoding="utf-8") as f:
                json.dump(self.state, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

    def _record_pair(
        self,
        bucket: str,
        mac_a: str,
        mac_b: str,
        port: str,
        now_iso: str,
    ) -> None:
        key = _pair_key(mac_a, mac_b)
        store = self.state[bucket]
        entry = store.get(key)
        if not entry:
            entry = {
                "aMac": mac_a,
                "bMac": mac_b,
                "port": port,
                "count": 0,
                "lastSeen": now_iso,
            }
        entry["count"] = int(entry.get("count", 0)) + 1
        entry["lastSeen"] = now_iso
        entry["port"] = port
        store[key] = entry

    def observe_cycle(
        self,
        device_states: List[Dict[str, Any]],
        prev_online: Dict[str, bool],
    ) -> List[Dict[str, Any]]:
        """Analyze the current cycle for co-failures, jitter spikes, and passive probes."""
        now_ts = time.time()
        now_iso = datetime.now(timezone.utc).isoformat()
        changed = False

        # Group all known devices by LAN port
        by_port: Dict[str, List[Dict[str, Any]]] = {}
        dev_by_mac: Dict[str, Dict[str, Any]] = {}
        for d in device_states:
            mac = (d.get("mac") or "").strip().upper()
            if not mac:
                continue
            dev_by_mac[mac] = d
            port = d.get("port") or "-"
            if port.startswith("LAN"):
                by_port.setdefault(port, []).append(d)

        # 1. Co-Failure & Co-Recovery Correlation (per LAN port, ignoring global outages)
        for port, devs in by_port.items():
            total_on_port = len(devs)
            if total_on_port < 3:
                continue

            dropped: List[Dict[str, Any]] = []
            recovered: List[Dict[str, Any]] = []

            for d in devs:
                mac = (d.get("mac") or "").upper()
                was_online = prev_online.get(mac)
                is_online = bool(d.get("online"))
                if was_online is True and not is_online:
                    dropped.append(d)
                elif was_online is False and is_online:
                    recovered.append(d)

            # Partial branch outage: >= 2 devices dropped together, but <= 65% of port
            max_partial = max(2, int(total_on_port * 0.65))
            if 2 <= len(dropped) <= max_partial:
                for i in range(len(dropped)):
                    for j in range(i + 1, len(dropped)):
                        self._record_pair(
                            "coFailures",
                            dropped[i]["mac"].upper(),
                            dropped[j]["mac"].upper(),
                            port,
                            now_iso,
                        )
                        changed = True

            if 2 <= len(recovered) <= max_partial:
                for i in range(len(recovered)):
                    for j in range(i + 1, len(recovered)):
                        self._record_pair(
                            "coFailures",
                            recovered[i]["mac"].upper(),
                            recovered[j]["mac"].upper(),
                            port,
                            now_iso,
                        )
                        changed = True

            # 2. Correlated Latency / Jitter Spikes
            spiking: List[Dict[str, Any]] = []
            healthy_count = 0
            for d in devs:
                if not d.get("online"):
                    continue
                ch = d.get("cableHealth") or {}
                if ch.get("source") != "icmp_live":
                    continue
                jitter = float(ch.get("jitter") or 0)
                avg = float(ch.get("avg") or 0)
                loss = float(ch.get("loss") or 0)
                if jitter >= 35.0 or avg >= 90.0 or loss >= 5.0:
                    spiking.append(d)
                elif jitter < 15.0 and loss == 0:
                    healthy_count += 1

            # Only correlate if >= 2 devices spiked while at least 1 other device on same LAN stayed healthy
            if len(spiking) >= 2 and healthy_count >= 1 and len(spiking) <= max_partial:
                for i in range(len(spiking)):
                    for j in range(i + 1, len(spiking)):
                        self._record_pair(
                            "jitterSpikes",
                            spiking[i]["mac"].upper(),
                            spiking[j]["mac"].upper(),
                            port,
                            now_iso,
                        )
                        changed = True

        # 3. Passive Non-Intrusive Probe (every 10 minutes)
        if now_ts - self.state.get("lastProbeAt", 0.0) >= 600:
            self.state["lastProbeAt"] = now_ts
            for d in device_states:
                if d.get("online") and d.get("category") == "router" and d.get("ip"):
                    ip = d["ip"]
                    snmp_open = self._check_snmp_public(ip)
                    self.state["passiveProbes"][ip] = {
                        "snmpOpen": snmp_open,
                        "checkedAt": now_ts,
                    }
            changed = True

        if changed:
            self._save()

        return self.build_insights(dev_by_mac)

    @staticmethod
    def _check_snmp_public(ip: str) -> bool:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            sock.settimeout(0.35)
            sock.sendto(_SNMP_PUBLIC_GET, (ip, 161))
            data, _ = sock.recvfrom(1024)
            sock.close()
            return len(data) > 0
        except Exception:
            return False

    def build_insights(self, dev_by_mac: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Build human-readable topology insights from collected correlation evidence."""
        all_keys = set(self.state["coFailures"].keys()) | set(self.state["jitterSpikes"].keys())
        insights: List[Dict[str, Any]] = []

        for key in all_keys:
            co = self.state["coFailures"].get(key, {})
            jit = self.state["jitterSpikes"].get(key, {})
            co_count = int(co.get("count", 0))
            jit_count = int(jit.get("count", 0))

            # Require meaningful evidence: at least 1 co-failure OR 3+ correlated jitter spikes
            if co_count < 1 and jit_count < 3:
                continue

            parts = key.split("|")
            if len(parts) != 2:
                continue
            mac_a, mac_b = parts
            dev_a = dev_by_mac.get(mac_a)
            dev_b = dev_by_mac.get(mac_b)
            if not dev_a or not dev_b:
                continue

            cat_a = dev_a.get("category", "device")
            cat_b = dev_b.get("category", "device")

            # Determine relationship type
            if cat_a == "router" and cat_b != "router":
                rel_type = "ap_child"
                src, tgt = dev_a, dev_b
            elif cat_b == "router" and cat_a != "router":
                rel_type = "ap_child"
                src, tgt = dev_b, dev_a
            elif cat_a == "router" and cat_b == "router":
                rel_type = "switch_group"
                src, tgt = dev_a, dev_b
            else:
                continue

            confidence = min(98, 50 + co_count * 22 + min(jit_count, 5) * 6)
            reasons: List[str] = []
            if co_count > 0:
                reasons.append(f"انقطاع/عودة متزامنة ({co_count}x)")
            if jit_count > 0:
                reasons.append(f"تقطع Ping متزامن ({jit_count}x)")

            last_seen = co.get("lastSeen") or jit.get("lastSeen") or ""

            insights.append(
                {
                    "id": f"corr-{mac_a[-5:].replace(':', '')}-{mac_b[-5:].replace(':', '')}",
                    "type": rel_type,
                    "confidence": confidence,
                    "reason": " · ".join(reasons),
                    "sourceMac": src["mac"].upper(),
                    "sourceName": src["name"],
                    "targetMac": tgt["mac"].upper(),
                    "targetName": tgt["name"],
                    "port": co.get("port") or jit.get("port") or src.get("port", ""),
                    "evidenceCount": co_count + jit_count,
                    "lastObserved": last_seen,
                }
            )

        insights.sort(key=lambda x: (x["confidence"], x["evidenceCount"]), reverse=True)
        return insights[:15]
