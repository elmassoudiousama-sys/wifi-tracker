"""ZTE F680 (V6.0.20P1N86) HTTP client for Termux / Python."""

import base64
import codecs
import hashlib
import os
import re
import time
import urllib.parse
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional

import requests

# Hardcoded RSA public key from ZTE F680 login/ajax JS (asyEncode)
ZTE_PUBKEY_B64 = (
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAodPTerkUVCYmv28SOfRV"
    "7UKHVujx/HjCUTAWy9l0L5H0JV0LfDudTdMNPEKloZsNam3YrtEnq6jqMLJV4ASb"
    "1d6axmIgJ636wyTUS99gj4BKs6bQSTUSE8h/QkUYv4gEIt3saMS0pZpd90y6+B/9"
    "hZxZE/RKU8e+zgRqp1/762TB7vcjtjOwXRDEL0w71Jk9i8VUQ59MR1Uj5E8X3WIc"
    "fYSK5RWBkMhfaTRM6ozS9Bqhi40xlSOb3GBxCmliCifOJNLoO9kFoWgAIw5hkSIb"
    "GH+4Csop9Uy8VvmmB+B3ubFLN35qIa5OG5+SDXn4L7FeAA5lRiGxRi8tsWrtew8w"
    "nwIDAQAB"
)


def _parse_rsa_spki(b64_der: str) -> tuple[int, int]:
    """Parse X.509 SubjectPublicKeyInfo RSA key without external crypto libs."""
    der = base64.b64decode(b64_der)

    def read_len(buf: bytes, idx: int) -> tuple[int, int]:
        l = buf[idx]
        if l < 0x80:
            return l, idx + 1
        n = l & 0x7F
        return int.from_bytes(buf[idx + 1 : idx + 1 + n], "big"), idx + 1 + n

    def read_tlv(buf: bytes, idx: int) -> tuple[int, bytes, int]:
        tag = buf[idx]
        length, pos = read_len(buf, idx + 1)
        return tag, buf[pos : pos + length], pos + length

    _, top, _ = read_tlv(der, 0)
    _, alg_id, pos = read_tlv(top, 0)
    _, bitstr, _ = read_tlv(top, pos)
    # Skip leading unused-bits byte (0x00) inside BIT STRING
    _, rsa_seq, _ = read_tlv(bitstr[1:], 0)
    _, mod_bytes, pos2 = read_tlv(rsa_seq, 0)
    _, exp_bytes, _ = read_tlv(rsa_seq, pos2)
    return int.from_bytes(mod_bytes, "big"), int.from_bytes(exp_bytes, "big")


_RSA_N, _RSA_E = _parse_rsa_spki(ZTE_PUBKEY_B64)


def zte_asy_encode(src: str) -> str:
    """Replicate JSEncrypt RSA PKCS#1 v1.5 encryption used for the Check header."""
    data = src.encode("utf-8")
    k = (_RSA_N.bit_length() + 7) // 8
    ps_len = k - len(data) - 3
    if ps_len < 8:
        raise ValueError("Input too long for RSA key")
    # Non-zero random padding bytes
    ps = bytearray()
    while len(ps) < ps_len:
        b = os.urandom(1)
        if b != b"\x00":
            ps.extend(b)
    em = b"\x00\x02" + bytes(ps) + b"\x00" + data
    m = int.from_bytes(em, "big")
    c = pow(m, _RSA_E, _RSA_N)
    return base64.b64encode(c.to_bytes(k, "big")).decode("ascii")


def _parse_instances(xml_text: str, container_tag: str) -> List[Dict[str, str]]:
    """Parse ZTE <Instance><ParaName>...</ParaName><ParaValue>...</ParaValue></Instance>."""
    root = ET.fromstring(xml_text)
    container = root.find(f".//{container_tag}")
    if container is None:
        return []
    results: List[Dict[str, str]] = []
    for inst in container.findall("Instance"):
        item: Dict[str, str] = {}
        names = inst.findall("ParaName")
        vals = inst.findall("ParaValue")
        for n_el, v_el in zip(names, vals):
            if n_el.text:
                item[n_el.text.strip()] = (v_el.text or "").strip()
        if item:
            results.append(item)
    return results


class ZTEF680Client:
    """Client for ZTE F680 router web interface."""

    def __init__(self, base_url: str = "http://192.168.1.1", username: str = "admin", password: str = ""):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.session = requests.Session()
        self.session.headers.update({"X-Requested-With": "XMLHttpRequest"})
        self.session_token: str = ""
        self._last_view_tag: str = ""
        self._last_view_ts: float = 0.0
        self.last_xml_expired: bool = False

    def _ts(self) -> str:
        return str(int(time.time() * 1000))

    def _refresh_runtime_token(self) -> None:
        """Fetch main page after login to extract _sessionTmpToken."""
        r = self.session.get(f"{self.base_url}/", timeout=10)
        r.raise_for_status()
        m = re.search(r'_sessionTmpToken\s*=\s*["\']([^"\']+)["\']', r.text)
        if m:
            self.session_token = codecs.decode(m.group(1), "unicode_escape")
            return
        m2 = re.search(r'id="_sessionTOKEN"[^>]*value="([^"]*)"', r.text)
        if m2:
            self.session_token = m2.group(1)

    def login(self) -> bool:
        """Authenticate to the router, preempting an active session if needed."""
        # Always start from a clean cookie jar so ZTE issues a fresh valid SID
        self.session.cookies.clear()
        self.session_token = ""
        self._last_view_tag = ""
        self._last_view_ts = 0.0
        # Prime SID + _TESTCOOKIESUPPORT=1 cookies before login_entry
        try:
            self.session.get(f"{self.base_url}/", timeout=10)
        except Exception:
            pass
        r_init = self.session.get(f"{self.base_url}/?_type=loginData&_tag=login_entry", timeout=10)
        r_init.raise_for_status()
        init_json = r_init.json()
        sess_tok = init_json.get("sess_token", "")

        r_tok = self.session.get(
            f"{self.base_url}/?_type=loginData&_tag=login_token&_={self._ts()}", timeout=10
        )
        r_tok.raise_for_status()
        tok_root = ET.fromstring(r_tok.text)
        nonce = (tok_root.text or "").strip()

        pw_hash = hashlib.sha256((self.password + nonce).encode("utf-8")).hexdigest()
        payload = {
            "action": "login",
            "Password": pw_hash,
            "Username": self.username,
            "_sessionTOKEN": sess_tok,
        }
        r_login = self.session.post(
            f"{self.base_url}/?_type=loginData&_tag=login_entry",
            data=payload,
            timeout=10,
        )
        r_login.raise_for_status()
        data = r_login.json()

        err_msg = str(data.get("loginErrMsg") or "")
        err_lower = err_msg.lower()
        if data.get("lockingTime", 0) not in (0, None) or "occup" in err_lower or "busy" in err_lower or "redémarrer" in err_lower or "restart" in err_lower:
            raise RuntimeError(f"Login failed (router busy/locked): {data}")

        if not data.get("login_need_refresh"):
            # Handle active session preemption if another browser is logged in
            if data.get("sess_token"):
                sess_tok = data["sess_token"]
            if "preempt" in str(data).lower() or data.get("promptMsg") or err_msg:
                r_pre = self.session.post(
                    f"{self.base_url}/?_type=loginData&_tag=login_preempt",
                    data={"_sessionTOKEN": sess_tok},
                    timeout=10,
                )
                if not (r_pre.ok and r_pre.json().get("login_need_refresh")):
                    raise RuntimeError(f"Login failed: {data}")
            else:
                raise RuntimeError(f"Login failed: {data}")

        self._refresh_runtime_token()
        # Handle ZTE session preemption picker rendered on GET / when another session is active
        try:
            r_home = self.session.get(f"{self.base_url}/", timeout=10)
            r_home.raise_for_status()
            preempt_matches = re.findall(
                r'name=["\']?preempt_sessid["\']?\s+value=["\']?([A-Za-z0-9]+)',
                r_home.text,
            )
            if preempt_matches:
                for psid in preempt_matches[:1]:
                    r_pre2 = self.session.post(
                        f"{self.base_url}/?_type=loginData&_tag=login_preempt",
                        data={"preempt_sessid": psid, "action": "preempt"},
                        timeout=10,
                    )
                    if r_pre2.ok and r_pre2.json().get("login_need_refresh"):
                        self._refresh_runtime_token()
                        break
        except Exception:
            pass
        # Verify the session is genuinely authenticated (not silently bounced to 404/login)
        r_check = self.session.get(
            f"{self.base_url}/?_type=menuView&_tag=localNetStatus&Menu3Location=0&_={self._ts()}",
            timeout=10,
        )
        if self._is_session_expired(r_check.text):
            raise RuntimeError(f"Login failed (session not active after login): {data}")
        m = re.search(r'_sessionTmpToken\s*=\s*["\']([^"\']+)["\']', r_check.text)
        if m:
            self.session_token = codecs.decode(m.group(1), "unicode_escape")
        self._last_view_tag = "localNetStatus"
        self._last_view_ts = time.time()
        return True

    def logout(self) -> None:
        """Best-effort logout to free the ZTE web session slot."""
        try:
            if not self.session_token:
                self._refresh_runtime_token()
            self.session.post(
                f"{self.base_url}/?_type=loginData&_tag=logout_entry",
                data={"IF_LogOff": "1", "_sessionTOKEN": self.session_token},
                timeout=5,
            )
        except Exception:
            pass
        self.session.cookies.clear()
        self.session_token = ""
        self._last_view_tag = ""
        self._last_view_ts = 0.0

    @staticmethod
    def _is_session_expired(text: str) -> bool:
        return (
            "SessionTimeout" in text
            or ("Frm_Username" in text and "login_entry" in text)
            or ("404 Not Found" in text and "top.location.href" in text)
        )

    def _open_view(self, view_tag: str) -> None:
        """Load menuView first, as ZTE F680 requires view state and issues a fresh _sessionTmpToken."""
        r = self.session.get(
            f"{self.base_url}/?_type=menuView&_tag={view_tag}&Menu3Location=0&_={self._ts()}",
            timeout=10,
        )
        r.raise_for_status()
        if self._is_session_expired(r.text):
            self.login()
            r = self.session.get(
                f"{self.base_url}/?_type=menuView&_tag={view_tag}&Menu3Location=0&_={self._ts()}",
                timeout=10,
            )
            r.raise_for_status()
        m = re.search(r'_sessionTmpToken\s*=\s*["\']([^"\']+)["\']', r.text)
        if m:
            self.session_token = codecs.decode(m.group(1), "unicode_escape")
        self._last_view_tag = view_tag
        self._last_view_ts = time.time()

    def _get_xml(self, path_query: str, view_tag: Optional[str] = None) -> str:
        self.last_xml_expired = False
        if view_tag and (view_tag != self._last_view_tag or (time.time() - self._last_view_ts) > 10.0):
            self._open_view(view_tag)
        url = f"{self.base_url}/{path_query}&_={self._ts()}"
        r = self.session.get(url, timeout=10)
        r.raise_for_status()
        if self._is_session_expired(r.text):
            self.login()
            if view_tag:
                self._open_view(view_tag)
            r = self.session.get(f"{self.base_url}/{path_query}&_={self._ts()}", timeout=10)
            r.raise_for_status()
        self.last_xml_expired = self._is_session_expired(r.text)
        return r.text

    def _post_signed(self, tag: str, params: Dict[str, Any], view_tag: Optional[str] = None) -> str:
        """Send a signed POST request with _sessionTOKEN and Check header."""
        if not self.session_token:
            self._refresh_runtime_token()
        if view_tag:
            self._open_view(view_tag)
        body_pairs = [(k, str(v)) for k, v in params.items()]
        body_pairs.append(("_sessionTOKEN", self.session_token))
        post_str = urllib.parse.urlencode(body_pairs)
        digest = hashlib.sha256(post_str.encode("utf-8")).hexdigest()
        check_hdr = zte_asy_encode(digest)
        r = self.session.post(
            f"{self.base_url}/?_type=menuData&_tag={tag}",
            data=post_str,
            headers={
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "Check": check_hdr,
            },
            timeout=15,
        )
        r.raise_for_status()
        if "SessionTimeout" in r.text or "expir" in r.text.lower():
            self.login()
            if view_tag:
                self._open_view(view_tag)
            body_pairs = [(k, str(v)) for k, v in params.items()]
            body_pairs.append(("_sessionTOKEN", self.session_token))
            post_str = urllib.parse.urlencode(body_pairs)
            digest = hashlib.sha256(post_str.encode("utf-8")).hexdigest()
            check_hdr = zte_asy_encode(digest)
            r = self.session.post(
                f"{self.base_url}/?_type=menuData&_tag={tag}",
                data=post_str,
                headers={
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "Check": check_hdr,
                },
                timeout=15,
            )
            r.raise_for_status()
        return r.text

    def get_lan_clients(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=accessdev_landevs_lua.lua", view_tag="localNetStatus")
        return _parse_instances(xml_text, "OBJ_ACCESSDEV_ID")

    def get_wlan_clients(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=wlan_client_stat_lua.lua", view_tag="localNetStatus")
        return _parse_instances(xml_text, "OBJ_WLAN_AD_ID")

    def get_lan_ports(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=status_lan_info_lua.lua", view_tag="localNetStatus")
        return _parse_instances(xml_text, "OBJ_PON_PORT_BASIC_STATUS_ID")

    def get_mac_filters(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=firewall_macfilterv3_lua.lua", view_tag="filterCriteria")
        return _parse_instances(xml_text, "OBJ_MACFILTER_ID")

    def get_dhcp_leases(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml(
            "?_type=menuData&_tag=Localnet_LanMgrIpv4_DHCPHostInfo_lua.lua",
            view_tag="lanMgrIpv4",
        )
        return _parse_instances(xml_text, "OBJ_DHCPHOSTINFO_ID") or _parse_instances(xml_text, "OBJ_ACCESSDEV_ID") or self._parse_all_instances(xml_text)

    def get_dhcp_static_rules(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml(
            "?_type=menuData&_tag=Localnet_LanMgrIpv4_DHCPStaticRule_lua.lua",
            view_tag="lanMgrIpv4",
        )
        return _parse_instances(xml_text, "OBJ_DHCPBIND_ID")

    def get_optical_info(self) -> Dict[str, str]:
        xml_text = self._get_xml("?_type=menuData&_tag=optical_info_lua.lua", view_tag="ponopticalinfo")
        merged: Dict[str, str] = {}
        for inst in self._parse_all_instances(xml_text):
            merged.update(inst)
        return merged

    def get_system_status(self) -> Dict[str, str]:
        xml_text = self._get_xml("?_type=menuData&_tag=devmgr_statusmgr_lua.lua", view_tag="statusMgr")
        merged: Dict[str, str] = {}
        for inst in self._parse_all_instances(xml_text):
            merged.update(inst)
        return merged

    def get_wlan_ssids(self) -> List[Dict[str, str]]:
        """Fetch SSID configurations without exposing passphrases or WEP keys."""
        xml_text = self._get_xml("?_type=menuData&_tag=wlan_wlansssidconf_lua.lua", view_tag="wlanBasic")
        radios = {
            r.get("_InstID", ""): r.get("Band", "")
            for r in _parse_instances(xml_text, "OBJ_WLANSETTING_ID")
        }
        ssids: List[Dict[str, str]] = []
        for ap in _parse_instances(xml_text, "OBJ_WLANAP_ID"):
            ssids.append(
                {
                    "instId": ap.get("_InstID", ""),
                    "alias": ap.get("Alias", ""),
                    "essid": ap.get("ESSID", ""),
                    "band": radios.get(ap.get("WLANViewName", ""), ""),
                    "enable": ap.get("Enable", "0") == "1",
                    "isolation": ap.get("VapIsolationEnable", "0") == "1",
                    "hidden": ap.get("ESSIDHideEnable", "0") == "1",
                    "maxUsers": int(ap.get("MaxUserNum", 32) or 32),
                    "authMode": ap.get("11iAuthMode") or ap.get("WPAAuthMode") or "",
                    "encryptType": ap.get("11iEncryptType") or ap.get("WPAEncryptType") or "",
                }
            )
        return ssids

    def get_wlan_acl_rules(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=wlan_macfilterrule_lua.lua", view_tag="wlanAdvanced")
        return _parse_instances(xml_text, "OBJ_ACLCFG_ID")

    def get_wlan_acl_policy(self) -> List[Dict[str, str]]:
        xml_text = self._get_xml("?_type=menuData&_tag=wlan_macfilteraclpolicy_lua.lua", view_tag="wlanAdvanced")
        return _parse_instances(xml_text, "OBJ_WLANAP_ID")

    def get_port_mirror_status(self) -> Dict[str, str]:
        xml_text = self._get_xml("?_type=menuData&_tag=mirror_mirrormgr_lua.lua", view_tag="mirror")
        rows = _parse_instances(xml_text, "OBJ_MIRROR_ID")
        return rows[0] if rows else {}

    @staticmethod
    def _parse_all_instances(xml_text: str) -> List[Dict[str, str]]:
        root = ET.fromstring(xml_text)
        results: List[Dict[str, str]] = []
        for inst in root.findall(".//Instance"):
            item: Dict[str, str] = {}
            for n_el, v_el in zip(inst.findall("ParaName"), inst.findall("ParaValue")):
                if n_el.text:
                    item[n_el.text.strip()] = (v_el.text or "").strip()
            if item:
                results.append(item)
        return results

    def ensure_wlan_acl_ban(self, interface: str = "DEV.WIFI.AP1") -> None:
        """Ensure WLAN ACL policy for target interface is set to Ban (Blacklist)."""
        try:
            policies = self.get_wlan_acl_policy()
            for p in policies:
                if p.get("_InstID") == interface and p.get("ACLPolicy") != "Ban":
                    self._post_signed(
                        "wlan_macfilteraclpolicy_lua.lua",
                        {
                            "IF_ACTION": "Apply",
                            "_InstID": interface,
                            "ACLPolicy": "Ban",
                        },
                        view_tag="wlanAdvanced",
                    )
                    break
        except Exception:
            pass

    def reboot_router(self) -> str:
        """Reboot ZTE F680 router using devmgr_restartmgr_lua.lua."""
        return self._post_signed(
            "devmgr_restartmgr_lua.lua",
            {"IF_ACTION": "Restart"},
            view_tag="rebootAndReset",
        )

    def block_wlan_mac(self, name: str, mac: str, interface: str = "DEV.WIFI.AP1") -> str:
        """Add a MAC address to WLAN L2 ACL (Ban list), retrying with MAC suffix on duplicate name."""
        self.ensure_wlan_acl_ban(interface)
        clean_mac = mac.lower().strip()
        suffix = clean_mac.replace(":", "")[-4:]
        base_name = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:24] or "WifiBlocked"
        res = self._post_signed(
            "wlan_macfilterrule_lua.lua",
            {
                "IF_ACTION": "Apply",
                "_InstID": "-1",
                "Name": base_name,
                "MACAddress": clean_mac,
                "Interface": interface,
            },
            view_tag="wlanAdvanced",
        )
        if "<IF_ERRORSTR>SUCC</IF_ERRORSTR>" not in res and suffix:
            uniq_name = f"{base_name[:19]}_{suffix}"
            res = self._post_signed(
                "wlan_macfilterrule_lua.lua",
                {
                    "IF_ACTION": "Apply",
                    "_InstID": "-1",
                    "Name": uniq_name,
                    "MACAddress": clean_mac,
                    "Interface": interface,
                },
                view_tag="wlanAdvanced",
            )
        return res

    def update_wlan_mac(
        self,
        inst_id: str,
        name: str,
        mac: str,
        interface: str = "DEV.WIFI.AP1",
    ) -> str:
        """Update an existing WLAN L2 ACL rule's MAC address in-place."""
        clean_mac = mac.lower().strip()
        clean_name = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:24] or "WifiBlocked"
        return self._post_signed(
            "wlan_macfilterrule_lua.lua",
            {
                "IF_ACTION": "Apply",
                "_InstID": inst_id,
                "Name": clean_name,
                "MACAddress": clean_mac,
                "Interface": interface,
            },
            view_tag="wlanAdvanced",
        )

    def unblock_wlan_mac(self, inst_id: str) -> str:
        """Delete a WLAN L2 ACL rule by its _InstID."""
        return self._post_signed(
            "wlan_macfilterrule_lua.lua",
            {
                "IF_ACTION": "Delete",
                "_InstID": inst_id,
            },
            view_tag="wlanAdvanced",
        )

    def update_ssid_settings(
        self,
        inst_id: str,
        enable: Optional[bool] = None,
        isolation: Optional[bool] = None,
        hidden: Optional[bool] = None,
    ) -> str:
        """Update SSID Enable, VapIsolationEnable, or ESSIDHideEnable on ZTE F680."""
        params: Dict[str, Any] = {
            "IF_ACTION": "Apply",
            "_InstID": inst_id,
        }
        if enable is not None:
            params["Enable"] = "1" if enable else "0"
        if isolation is not None:
            params["VapIsolationEnable"] = "1" if isolation else "0"
        if hidden is not None:
            params["ESSIDHideEnable"] = "1" if hidden else "0"
        return self._post_signed("wlan_wlansssidconf_lua.lua", params, view_tag="wlanBasic")

    def set_port_mirror(
        self,
        enable: bool,
        mirror_src: str = "IGD.WANALL",
        mirror_dest: str = "",
    ) -> str:
        """Enable or disable ZTE F680 WAN Port Mirroring to a physical LAN port."""
        params: Dict[str, Any] = {
            "IF_ACTION": "Apply",
            "_InstID": "IGD",
            "MirrorEnable": "1" if enable else "0",
            "MirrorSrc": mirror_src,
            "MirrorDest": mirror_dest if enable else "",
        }
        return self._post_signed("mirror_mirrormgr_lua.lua", params, view_tag="mirror")

    def block_mac(self, name: str, mac: str) -> str:
        """Add a MAC address to Filtre MAC (Liste noire), retrying with MAC suffix on duplicate name."""
        clean_mac = mac.lower().strip()
        suffix = clean_mac.replace(":", "")[-4:]
        base_name = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:16] or "Blocked"
        res = self._post_signed(
            "firewall_macfilterv3_lua.lua",
            {
                "IF_ACTION": "Apply",
                "_InstID": "-1",
                "Name": base_name,
                "Type": "Route",
                "Protocol": "ALL",
                "SrcMacAddr": clean_mac,
            },
            view_tag="filterCriteria",
        )
        if "<IF_ERRORSTR>SUCC</IF_ERRORSTR>" not in res and suffix:
            uniq_name = f"{base_name[:11]}_{suffix}"
            res = self._post_signed(
                "firewall_macfilterv3_lua.lua",
                {
                    "IF_ACTION": "Apply",
                    "_InstID": "-1",
                    "Name": uniq_name,
                    "Type": "Route",
                    "Protocol": "ALL",
                    "SrcMacAddr": clean_mac,
                },
                view_tag="filterCriteria",
            )
        return res

    def update_mac_filter(self, inst_id: str, name: str, mac: str) -> str:
        """Update an existing Filtre MAC rule's MAC address in-place."""
        clean_mac = mac.lower().strip()
        clean_name = re.sub(r"[^A-Za-z0-9_-]", "_", name)[:16] or "Blocked"
        return self._post_signed(
            "firewall_macfilterv3_lua.lua",
            {
                "IF_ACTION": "Apply",
                "_InstID": inst_id,
                "Name": clean_name,
                "Type": "Route",
                "Protocol": "ALL",
                "SrcMacAddr": clean_mac,
            },
            view_tag="filterCriteria",
        )

    def unblock_mac(self, inst_id: str) -> str:
        """Delete a MAC filter rule by its _InstID."""
        return self._post_signed(
            "firewall_macfilterv3_lua.lua",
            {
                "IF_ACTION": "Delete",
                "_InstID": inst_id,
            },
            view_tag="filterCriteria",
        )
