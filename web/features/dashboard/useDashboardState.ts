"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommandAction, DeviceState, MonitorState, WifiClient } from "@/lib/store";
import type { DrawerTab, HistoryPoint, SortCol, SortDir, StatusFilter, View } from "@/features/dashboard/types";
import { formatPortLabel, hasWebAdmin, isWifiDevice } from "@/features/dashboard/utils";

export function useDashboardState() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [state, setState] = useState<MonitorState | null>(null);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [view, setView] = useState<View>("overview");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [portFilter, setPortFilter] = useState<string>("ALL");
  const [sortCol, setSortCol] = useState<SortCol>("status");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [busyMac, setBusyMac] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectItem, setInspectItem] = useState<Record<string, unknown> | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("info");

  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [showRx, setShowRx] = useState(true);
  const [showTx, setShowTx] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [modalDevice, setModalDevice] = useState<{
    mac: string;
    name: string;
    ip: string;
    port: string;
    medium: string;
    isNew: boolean;
    category?: string;
    catName?: string;
    catIcon?: string;
  } | null>(null);
  const [confirmReboot, setConfirmReboot] = useState(false);
  const [activeProxyIframe, setActiveProxyIframe] = useState<{
    ip: string;
    name: string;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistoryKey = useRef<string>("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    const rawLock = localStorage.getItem("fiber_auth_locked_until");
    const parsedLock = rawLock ? Number(rawLock) : 0;
    if (parsedLock && parsedLock > Date.now()) {
      setLockedUntil(parsedLock);
      setAttemptsLeft(0);
      setAuthError("تم تجاوز 3 محاولات خاطئة. يرجى الانتظار 24 ساعة قبل إعادة المحاولة.");
    } else if (rawLock) {
      localStorage.removeItem("fiber_auth_locked_until");
    }

    const savedPw = localStorage.getItem("fiber_admin_pw") || "";
    if (savedPw && !(parsedLock && parsedLock > Date.now())) {
      setPassword(savedPw);
      setAuthed(true);
      fetchStatus(savedPw);
    }
    const savedTheme = localStorage.getItem("fiber_theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setInspectItem(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("fiber_theme", next);
  };

  const fetchStatus = useCallback(async (pw: string) => {
    const res = await fetch("/api/status", {
      headers: { "x-admin-password": pw },
      cache: "no-store",
    });
    if (res.status === 429) {
      let body: { lockedUntil?: string; retryAfterSeconds?: number } = {};
      try {
        body = await res.json();
      } catch {}
      const untilMs = body.lockedUntil
        ? new Date(body.lockedUntil).getTime()
        : Date.now() + (body.retryAfterSeconds || 86400) * 1000;
      setAuthed(false);
      setAttemptsLeft(0);
      setLockedUntil(untilMs);
      localStorage.setItem("fiber_auth_locked_until", String(untilMs));
      localStorage.removeItem("fiber_admin_pw");
      setAuthError("تم قفل الدخول لمدة 24 ساعة بعد 3 محاولات خاطئة.");
      return;
    }
    if (res.status === 401) {
      let body: { attemptsLeft?: number } = {};
      try {
        body = await res.json();
      } catch {}
      const left = typeof body.attemptsLeft === "number" ? body.attemptsLeft : null;
      setAuthed(false);
      setAttemptsLeft(left);
      localStorage.removeItem("fiber_admin_pw");
      setAuthError(
        left !== null
          ? `كلمة السر غير صحيحة — متبقي ليك ${left} ${left === 1 ? "محاولة" : "محاولات"} قبل القفل لمدة 24 ساعة.`
          : "كلمة السر غير صحيحة"
      );
      return;
    }
    if (res.ok) {
      setAuthError("");
      setAttemptsLeft(null);
      setLockedUntil(null);
      localStorage.removeItem("fiber_auth_locked_until");
      setAuthed(true);
      setState(await res.json());
    }
  }, []);

  useEffect(() => {
    if (!authed || !password) return;
    fetchStatus(password);
    const id = setInterval(() => fetchStatus(password), 4000);
    return () => clearInterval(id);
  }, [authed, password, fetchStatus]);

  // Collect measurements every time state updates
  useEffect(() => {
    if (!state?.updatedAt) return;
    if (lastHistoryKey.current === state.updatedAt) return;
    lastHistoryKey.current = state.updatedAt;
    const rates = state.lanPortRates || [];
    const cable = (state.devices || []).filter((d) => !isWifiDevice(d));
    const point: HistoryPoint = {
      at: state.updatedAt,
      rx: Math.round(rates.reduce((s, r) => s + (r.rxMbps || 0), 0) * 100) / 100,
      tx: Math.round(rates.reduce((s, r) => s + (r.txMbps || 0), 0) * 100) / 100,
      online: cable.filter((d) => d.online).length,
      offline: cable.filter((d) => !d.online).length,
      ping: state.diagnostics?.internetPing ?? null,
    };
    setHistory((prev) => [...prev, point].slice(-40));
  }, [state]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const cleanPw = password.trim();
    if (!cleanPw) return;
    localStorage.setItem("fiber_admin_pw", cleanPw);
    setPassword(cleanPw);
    await fetchStatus(cleanPw);
  }

  function handleLogout() {
    localStorage.removeItem("fiber_admin_pw");
    setAuthed(false);
  }

  async function sendCommand(
    action: CommandAction,
    mac: string = "",
    name: string = "",
    instId?: string,
    extra?: {
      interface?: string;
      enable?: boolean;
      isolation?: boolean;
      hidden?: boolean;
      mirrorSrc?: string;
      mirrorDest?: string;
    }
  ) {
    if (
      action === "block" ||
      action === "unblock" ||
      action === "wifi_acl_block" ||
      action === "wifi_acl_unblock" ||
      action === "auto_track_ban" ||
      action === "unban_identity"
    ) {
      setBusyMac(mac);
    }
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": password,
        },
        body: JSON.stringify({ action, mac, name, instId, ...extra }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.state) setState(data.state);
        if (action === "block") showToast(`تم إرسال أمر إيقاف ${name} وتسجيله في التعقب`);
        else if (action === "unblock") showToast(`تم إرسال أمر تشغيل ${name}`);
        else if (action === "wifi_acl_block") showToast(`تم طرد ${name} (L2 ACL) وتسجيله في التعقب`);
        else if (action === "wifi_acl_unblock") showToast(`تم فك طرد الـ Wi-Fi لـ ${name}`);
        else if (action === "auto_track_ban") showToast(`تم طرد ${name} وتفعيل التتبع التلقائي ⚡`);
        else if (action === "unban_identity") showToast(`تم إلغاء الحظر الدائم لـ ${name}`);
        else if (action === "set_ssid_config") showToast(`تم إرسال تعديل شبكة ${name}`);
        else if (action === "set_port_mirror") showToast("تم إرسال إعداد Port Mirroring للراوتر ✓");
        else if (action === "reboot_router") showToast("تم إرسال أمر إعادة تشغيل الراوتر للهاتف ✓");
        else if (action === "run_diagnostics") showToast("جاري فحص جودة الاتصال والبينغ...");
        else if (action === "rescan_network") showToast("جاري فحص كابلات الشبكة وتحديث الأجهزة...");
      }
    } finally {
      setBusyMac(null);
    }
  }

  async function saveModalDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!modalDevice) return;
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({
        mac: modalDevice.mac,
        name: modalDevice.name,
        group: modalDevice.name,
        ip: modalDevice.ip,
        port: modalDevice.port,
        medium: modalDevice.medium,
        isNew: modalDevice.isNew,
        category: modalDevice.category,
        catName: modalDevice.catName,
        catIcon: modalDevice.catIcon,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setState(data.state);
      showToast(modalDevice.isNew ? `تم حفظ ${modalDevice.name}` : `تم تعديل الاسم إلى ${modalDevice.name}`);
      setModalDevice(null);
    }
  }

  async function removeDevice(mac: string, name: string) {
    const res = await fetch("/api/devices", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ mac }),
    });
    if (res.ok) {
      const data = await res.json();
      setState(data.state);
      showToast(`تم حذف ${name}`);
      setModalDevice(null);
    }
  }

  async function clearAlerts() {
    const res = await fetch("/api/alerts", {
      method: "DELETE",
      headers: { "x-admin-password": password },
    });
    if (res.ok) await fetchStatus(password);
  }

  /* ------------------------------ Derived data ------------------------------ */

  const blockedRuleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of state?.blockedRules || []) {
      if (r.mac) map.set(r.mac.toUpperCase(), r.instId);
    }
    return map;
  }, [state?.blockedRules]);

  const allDevices = state?.devices || [];

  const cableDevices = useMemo(() => {
    return allDevices
      .filter((d) => !isWifiDevice(d))
      .map((d) => {
        const upper = d.mac.toUpperCase();
        const isBlocked = d.blocked || blockedRuleMap.has(upper);
        return {
          ...d,
          blocked: isBlocked,
          blockInstId: d.blockInstId || blockedRuleMap.get(upper) || "",
        };
      });
  }, [allDevices, blockedRuleMap]);

  const wifiClients = useMemo<WifiClient[]>(() => {
    const rawWifi = state?.wifiClients || [];
    const wifiMacs = new Set(rawWifi.map((w) => w.mac.toUpperCase()));

    const phoneDevices: WifiClient[] = allDevices
      .filter((d) => isWifiDevice(d) && !wifiMacs.has(d.mac.toUpperCase()))
      .map((d) => ({
        mac: d.mac,
        ip: d.ip,
        ipv6: d.ipv6,
        hostname: d.name,
        friendlyName: d.friendlyName,
        friendlySource: d.friendlySource,
        port: d.port || "Wi-Fi",
        rssi: d.rssi,
        snr: d.snr,
        txRate: d.txRate,
        rxRate: d.rxRate,
        linkTime: d.linkTime,
        vendor: d.vendor,
        randomizedMac: d.randomizedMac,
        latencyMs: d.latencyMs,
        blocked: d.blocked,
        blockInstId: d.blockInstId,
        category: d.category || "phone",
        catName: d.catName || "هاتف ذكي",
        catIcon: d.catIcon || "📱",
      }));

    const combined = [...rawWifi, ...phoneDevices];
    return combined.map((w) => {
      const upper = w.mac.toUpperCase();
      const isBlocked = w.blocked || blockedRuleMap.has(upper);
      return {
        ...w,
        blocked: isBlocked,
        blockInstId: w.blockInstId || blockedRuleMap.get(upper) || "",
      };
    });
  }, [state?.wifiClients, allDevices, blockedRuleMap]);

  const unknownDevices = state?.unknownDevices || [];
  const blockedRules = state?.blockedRules || [];
  const offlineCable = useMemo(() => cableDevices.filter((d) => !d.online), [cableDevices]);
  const onlineCableCount = cableDevices.filter((d) => d.online).length;
  const blockedCount = blockedRules.length;

  const portRates = useMemo(() => {
    if (state?.lanPortRates && state.lanPortRates.length > 0) return state.lanPortRates;
    return (state?.lanPorts || []).map((lp) => ({
      port: lp.port,
      rxMbps: 0,
      txMbps: 0,
      totalMbps: 0,
      isHog: false,
      totalOutGB: Math.round(lp.outBytes / 1024 ** 3),
      totalInGB: Math.round(lp.inBytes / 1024 ** 3),
    }));
  }, [state?.lanPortRates, state?.lanPorts]);

  const totalRx = Math.round(portRates.reduce((s, r) => s + (r.rxMbps || 0), 0) * 10) / 10;

  const cablePortCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of cableDevices) {
      const p = formatPortLabel(d.port);
      map.set(p, (map.get(p) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [cableDevices]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: cableDevices.length,
      router: 0,
      phone: 0,
      camera: 0,
      pc: 0,
      tv: 0,
      device: 0,
    };
    for (const d of cableDevices) {
      const cat = d.category || "device";
      if (counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.device = (counts.device || 0) + 1;
      }
    }
    return counts;
  }, [cableDevices]);

  const sortedCable = useMemo(() => {
    const filtered = cableDevices.filter((d) => {
      const q = search.trim().toLowerCase();
      if (q) {
        const hit =
          d.name.toLowerCase().includes(q) ||
          d.ip.toLowerCase().includes(q) ||
          d.mac.toLowerCase().includes(q) ||
          (d.vendor || "").toLowerCase().includes(q) ||
          (d.httpTitle || "").toLowerCase().includes(q) ||
          (d.catName || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (statusFilter === "online" && !d.online) return false;
      if (statusFilter === "offline" && d.online) return false;
      if (statusFilter === "blocked" && !d.blocked) return false;
      if (portFilter !== "ALL" && formatPortLabel(d.port) !== portFilter) return false;
      if (categoryFilter !== "ALL") {
        const cat = d.category || "device";
        if (categoryFilter === "other") {
          if (["router", "phone", "camera", "pc"].includes(cat)) return false;
        } else if (cat !== categoryFilter) {
          return false;
        }
      }
      return true;
    });

    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "status") {
        cmp = Number(a.online) - Number(b.online);
        if (cmp === 0) cmp = a.name.localeCompare(b.name, "en");
      } else if (sortCol === "name") {
        cmp = a.name.localeCompare(b.name, "en");
      } else if (sortCol === "ip") {
        const pa = a.ip.split(".").map(Number);
        const pb = b.ip.split(".").map(Number);
        for (let i = 0; i < 4; i++) {
          if ((pa[i] || 0) !== (pb[i] || 0)) {
            cmp = (pa[i] || 0) - (pb[i] || 0);
            break;
          }
        }
      } else if (sortCol === "port") {
        cmp = formatPortLabel(a.port).localeCompare(formatPortLabel(b.port));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [cableDevices, search, statusFilter, portFilter, categoryFilter, sortCol, sortDir]);

  const webEquipment = useMemo(() => {
    const list: Array<{
      ip: string;
      name: string;
      model: string;
      type: "ont" | "router" | "camera";
      ports: string[];
      pingMs?: number | null;
      credentialsHint: string;
      online: boolean;
    }> = [];

    list.push({
      ip: "192.168.1.1",
      name: "روتور الفايبر الرئيسي (ZTE F680)",
      model: "ZTE F680 ONT V6.0",
      type: "ont",
      ports: ["HTTP:80", "HTTPS:443"],
      pingMs: state?.diagnostics?.gatewayPing,
      credentialsHint: "admin / (كود الروتور)",
      online: true,
    });

    (state?.devices || []).forEach((d) => {
      if (!d.ip || d.ip === "0.0.0.0" || d.ip === "192.168.1.1") return;
      const isDvr =
        d.ip === "192.168.1.108" ||
        d.name.toLowerCase().includes("dvr") ||
        (d.vendor || "").toLowerCase().includes("dahua");
      const isZte2 = d.ip === "192.168.1.112" || (d.httpTitle || "").includes("H288A");
      const isRouter =
        d.category === "router" ||
        d.catName?.includes("روتور") ||
        (d.vendor || "").toLowerCase().includes("tp-link") ||
        (d.vendor || "").toLowerCase().includes("tenda") ||
        hasWebAdmin(d);

      if (isRouter || isDvr || isZte2) {
        list.push({
          ip: d.ip,
          name: d.name || d.hostname || d.ip,
          model: d.httpTitle || d.hostname || d.vendor || "روتور شبكي",
          type: isDvr ? "camera" : "router",
          ports: d.openPorts && d.openPorts.length > 0 ? d.openPorts : ["HTTP:80"],
          pingMs: d.latencyMs,
          credentialsHint: isDvr
            ? "admin / admin (أو كود DVR)"
            : isZte2
            ? "admin / (كود الروتور) أو user / user"
            : (d.vendor || "").toLowerCase().includes("tenda")
            ? "admin (أو بدون باسورد)"
            : "admin / admin",
          online: d.online,
        });
      }
    });

    return list;
  }, [state]);

  const statusCounts = useMemo(
    () => ({
      all: cableDevices.length,
      online: onlineCableCount,
      offline: offlineCable.length,
      blocked: cableDevices.filter((d) => d.blocked).length,
    }),
    [cableDevices, onlineCableCount, offlineCable.length]
  );

  /* ------------------------------ Action helpers ------------------------------ */

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  function sortIndicator(col: SortCol) {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function goTo(v: View) {
    setView(v);
    setSelected(new Set());
  }

  function openInspect(item: Record<string, unknown>) {
    setDrawerTab("info");
    setInspectItem(item);
  }

  function toggleSelected(mac: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(mac)) next.delete(mac);
      else next.add(mac);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const allSelected = sortedCable.length > 0 && sortedCable.every((d) => prev.has(d.mac));
      return allSelected ? new Set() : new Set(sortedCable.map((d) => d.mac));
    });
  }

  async function bulkBlock() {
    const targets = sortedCable.filter((d) => selected.has(d.mac) && !d.blocked);
    for (const d of targets) {
      await sendCommand("block", d.mac, d.name);
    }
    setSelected(new Set());
  }

  async function bulkUnblock() {
    const targets = sortedCable.filter((d) => selected.has(d.mac) && d.blocked);
    for (const d of targets) {
      await sendCommand("unblock", d.mac, d.name, d.blockInstId);
    }
    setSelected(new Set());
  }

  function copyProxyLink(ip: string) {
    const fullUrl = `${window.location.origin}/api/proxy/${ip}`;
    navigator.clipboard.writeText(fullUrl);
    showToast(`✓ تم نسخ رابط البروكسي لـ ${ip}`);
  }

  const isFresh = Boolean(state?.updatedAt && Date.now() - new Date(state.updatedAt).getTime() < 90_000);
  const segDevices = [...cableDevices].sort((a, b) => Number(b.online) - Number(a.online));
  const availability = cableDevices.length > 0 ? Math.round((onlineCableCount / cableDevices.length) * 100) : 0;
  const lastPing = state?.diagnostics?.internetPing;

  const titles: Record<View, string> = {
    overview: "نظرة عامة",
    cable: "أجهزة الكابل",
    wifi: "أجهزة الويفي",
    gateway: "بوابة الرواتر",
    security: "الأمان والحظر",
    activity: "السجل والأحداث",
  };

  const navItems: Array<{
    id: View;
    label: string;
    icon: string;
    count?: number;
    tone?: "alert" | "warn";
  }> = [
    { id: "overview", label: "نظرة عامة", icon: "dashboard" },
    {
      id: "cable",
      label: "أجهزة الكابل",
      icon: "devices",
      count: cableDevices.length,
      tone: offlineCable.length > 0 ? "alert" : undefined,
    },
    { id: "wifi", label: "أجهزة الويفي", icon: "wifi", count: wifiClients.length },
    { id: "gateway", label: "بوابة الرواتر", icon: "globe", count: webEquipment.length },
    {
      id: "security",
      label: "الأمان والحظر",
      icon: "shield",
      count: unknownDevices.length + blockedCount || undefined,
      tone: unknownDevices.length > 0 || state?.rogueDhcp?.detected ? "warn" : undefined,
    },
    { id: "activity", label: "السجل والأحداث", icon: "activity", count: (state?.alerts || []).length || undefined },
  ];

  return {
    password,
    setPassword,
    authed,
    setAuthed,
    authError,
    setAuthError,
    attemptsLeft,
    lockedUntil,
    setLockedUntil,
    state,
    setState,
    theme,
    setTheme,
    view,
    setView,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    portFilter,
    setPortFilter,
    sortCol,
    setSortCol,
    sortDir,
    setSortDir,
    selected,
    setSelected,
    busyMac,
    setBusyMac,
    toast,
    setToast,
    inspectItem,
    setInspectItem,
    drawerTab,
    setDrawerTab,
    history,
    setHistory,
    showRx,
    setShowRx,
    showTx,
    setShowTx,
    modalDevice,
    setModalDevice,
    confirmReboot,
    setConfirmReboot,
    activeProxyIframe,
    setActiveProxyIframe,
    searchRef,
    toastTimerRef,
    lastHistoryKey,
    showToast,
    toggleTheme,
    fetchStatus,
    blockedRuleMap,
    allDevices,
    cableDevices,
    wifiClients,
    unknownDevices,
    blockedRules,
    offlineCable,
    onlineCableCount,
    blockedCount,
    portRates,
    totalRx,
    cablePortCounts,
    categoryFilter,
    setCategoryFilter,
    categoryCounts,
    sortedCable,
    webEquipment,
    statusCounts,
    handleLogin,
    handleLogout,
    sendCommand,
    saveModalDevice,
    removeDevice,
    clearAlerts,
    handleSort,
    sortIndicator,
    goTo,
    openInspect,
    toggleSelected,
    toggleAllVisible,
    bulkBlock,
    bulkUnblock,
    copyProxyLink,
    isFresh,
    segDevices,
    availability,
    lastPing,
    titles,
    navItems,
  };
}

export type DashboardContextType = ReturnType<typeof useDashboardState>;
