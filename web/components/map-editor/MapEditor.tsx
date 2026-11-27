"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MapDevice,
  MapSwitch,
  MapNode,
  PaletteItem,
  AutoTopologyInput,
  buildAutoTopologyNodes,
  buildCablesFromNodes,
  clearAutoLayoutOverrides,
  clearAllMapOverrides,
  nodesToSwitches,
  savePositionsBatch,
  savePortAssignment,
  saveDeviceParent,
  loadDeviceParents,
  saveCustomNode,
  removeCustomNode,
  markNodeDeleted,
  saveSwitchMeta,
} from "@/lib/map-data";
import { Palette } from "./Palette";
import { SwitchPanel } from "./SwitchPanel";
import { DevicePanel } from "./DevicePanel";
import { Toolbar, EditorTool } from "./Toolbar";
import { MapCanvas, MapTelemetry } from "./MapCanvas";
import { useOptionalDashboard } from "@/features/dashboard/DashboardContext";

export interface MapEditorProps {
  onBackToMap?: () => void;
  onBackToTable?: () => void;
  isEmbedded?: boolean;
}

export function MapEditor({
  onBackToMap,
  onBackToTable,
  isEmbedded = false,
}: MapEditorProps = {}) {
  // 1. Live telemetry & devices from Dashboard Context (if available)
  const dashboard = useOptionalDashboard();
  const state = dashboard?.state;
  const cableDevices = dashboard?.cableDevices ?? [];
  const unknownDevices = dashboard?.unknownDevices ?? [];
  const wifiClients = dashboard?.wifiClients ?? [];
  const offlineCable = dashboard?.offlineCable ?? [];
  const portRates = dashboard?.portRates ?? [];

  const routerModelRaw = state?.routerHealth?.model?.trim() || "";
  const routerDisplayName = routerModelRaw
    ? routerModelRaw.toUpperCase().startsWith("ZTE")
      ? routerModelRaw
      : `ZTE ${routerModelRaw}`
    : "ZTE Router";
  const routerIp = state?.routerHealth?.ip?.trim() || "192.168.1.1";

  // Real port rates
  const lanRates = useMemo(() => {
    const map: Record<string, { rx: number; tx: number; total: number }> = {};
    (state?.lanPorts || []).forEach((lp) => {
      if (lp.port) map[lp.port.toUpperCase()] = { rx: 0, tx: 0, total: 0 };
    });
    (portRates || []).forEach((p) => {
      const key = (p.port || "").toUpperCase();
      if (!key) return;
      map[key] = {
        rx: Math.round((p.rxMbps || 0) * 100) / 100,
        tx: Math.round((p.txMbps || 0) * 100) / 100,
        total: Math.round((p.totalMbps || 0) * 100) / 100,
      };
    });
    return map;
  }, [portRates, state?.lanPorts]);

  const totalDl = useMemo(() => {
    return Object.values(lanRates).reduce((acc, curr) => acc + curr.rx, 0).toFixed(1);
  }, [lanRates]);

  const disconnectedDevices = useMemo(() => {
    return (offlineCable || []).map((d) => ({
      name: d.name,
      ip: d.ip,
      mac: d.mac,
    }));
  }, [offlineCable]);

  const formattedWifiClients = useMemo(() => {
    return (wifiClients || []).map((w) => ({
      name:
        w.friendlyName ||
        (w.hostname && w.hostname !== "Wi-Fi Device"
          ? w.hostname
          : w.vendor || w.ip || (w.mac ? w.mac.slice(-5) : "هاتف")),
      ip: w.ip,
      mac: w.mac,
      vendor: w.vendor,
      band: w.band,
      ssidName: w.ssidName,
      category: w.category,
      blocked: w.blocked,
    }));
  }, [wifiClients]);

  const telemetry: MapTelemetry = useMemo(
    () => ({
      routerName: routerDisplayName,
      routerIp,
      internetPing: state?.diagnostics?.internetPing ?? null,
      totalDl,
      lanRates,
      wifiCount: wifiClients.length,
      wifiClients: formattedWifiClients,
      disconnectedDevices,
      lastUpdated: state?.updatedAt
        ? new Date(state.updatedAt).toLocaleTimeString("ar-MA", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })
        : null,
      isRouterOnline: Boolean(
        state?.updatedAt && Date.now() - new Date(state.updatedAt).getTime() < 20000
      ),
    }),
    [
      routerDisplayName,
      routerIp,
      state?.diagnostics?.internetPing,
      state?.updatedAt,
      totalDl,
      lanRates,
      wifiClients.length,
      formattedWifiClients,
      disconnectedDevices,
    ]
  );

  const topologyInput: AutoTopologyInput = useMemo(
    () => ({
      routerModel: state?.routerHealth?.model,
      routerIp: state?.routerHealth?.ip,
      cableDevices,
      unknownDevices,
      wifiClients: formattedWifiClients,
      offlineCable,
      lanPorts: state?.lanPorts,
      lanPortRates: portRates,
      correlationInsights: state?.correlationInsights,
      hasActiveWifi: Boolean(
        formattedWifiClients.length > 0 || (state?.wlanSsids || []).some((s) => s.enable)
      ),
      serverCanvas: state?.canvas,
      serverTopology: state?.topology,
    }),
    [
      state?.routerHealth,
      state?.lanPorts,
      state?.correlationInsights,
      state?.wlanSsids,
      state?.canvas,
      state?.topology,
      cableDevices,
      unknownDevices,
      formattedWifiClients,
      offlineCable,
      portRates,
    ]
  );

  // 2. UNIFIED NODE & CABLE DATA MODEL (Single Source of Truth)
  const [nodes, setNodes] = useState<MapNode[]>(() => buildAutoTopologyNodes(topologyInput));
  const [history, setHistory] = useState<MapNode[][]>([]);

  // Derived switches and cables for component consumers
  const switches = useMemo(() => nodesToSwitches(nodes), [nodes]);
  const cables = useMemo(() => buildCablesFromNodes(nodes), [nodes]);

  const [selectedType, setSelectedType] = useState<"switch" | "device">("device");
  const [selectedSwitchId, setSelectedSwitchId] = useState<string>("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [tool, setTool] = useState<EditorTool>("select");
  const [zoom, setZoom] = useState<number>(1.0);
  const [toast, setToast] = useState<string | null>(null);

  // Merge live telemetry smoothly without overwriting user positions, manual port assignments, or user-added nodes
  useEffect(() => {
    const hasAnyData =
      cableDevices.length > 0 ||
      unknownDevices.length > 0 ||
      formattedWifiClients.length > 0 ||
      (state?.lanPorts?.length ?? 0) > 0;
    if (!hasAnyData) return;

    setNodes((currentNodes) => {
      const freshNodes = buildAutoTopologyNodes(topologyInput);
      const freshMap = new Map(freshNodes.map((fn) => [fn.id, fn]));
      const savedParents = loadDeviceParents();

      const updatedExisting = currentNodes
        .map((cur) => {
          const fresh = freshMap.get(cur.id);
          if (!fresh) {
            if (cur.id.startsWith("switch-1") || cur.id.startsWith("dev-1")) {
              return cur;
            }
            return null;
          }
          const upperMac = (cur.mac || "").toUpperCase();
          const savedParentEntry = savedParents[upperMac] || savedParents[cur.id];
          const resolvedParentId = savedParentEntry
            ? savedParentEntry.parentId
            : fresh.parentId ?? cur.parentId;

          freshMap.delete(cur.id);
          return {
            ...cur,
            name: fresh.name || cur.name,
            ip: fresh.ip ?? cur.ip,
            mac: fresh.mac ?? cur.mac,
            cableQuality: fresh.cableQuality ?? cur.cableQuality,
            blocked: fresh.blocked ?? cur.blocked,
            vendor: fresh.vendor ?? cur.vendor,
            online: fresh.online ?? cur.online,
            ports: cur.ports || fresh.ports,
            parentId: resolvedParentId,
            portIndex: cur.portIndex !== undefined ? cur.portIndex : fresh.portIndex,
          };
        })
        .filter(Boolean) as MapNode[];

      const brandNew = Array.from(freshMap.values());
      return [...updatedExisting, ...brandNew];
    });
  }, [topologyInput, cableDevices.length, unknownDevices.length, formattedWifiClients.length, state?.lanPorts]);

  // Load persisted layout if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem("network-map-layout");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const isMock = parsed.some((s: any) =>
            Array.isArray(s.devices) &&
            s.devices.some((d: any) => d.name === "Galaxy-A07" || d.name === "A53-de-tarik")
          );
          if (isMock) {
            localStorage.removeItem("network-map-layout");
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const pushHistory = (newNodes: MapNode[]) => {
    setHistory((prev) => [...prev.slice(-10), nodes]);
    setNodes(newNodes);
  };

  const handleUndo = () => {
    if (history.length === 0) {
      showToast("لا توجد حركات سابقة للتراجع عنها");
      return;
    }
    const previous = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setNodes(previous);
    showToast("تم التراجع بنجاح ↩");
  };

  const handleAutoLayout = () => {
    clearAutoLayoutOverrides();
    const freshNodes = buildAutoTopologyNodes({ ...topologyInput, serverCanvas: null });
    pushHistory(freshNodes);
    showToast("تمت إعادة الترتيب التلقائي للشبكة والأجهزة الحية ✨");
  };

  const handleRebuildFromRouter = async () => {
    clearAllMapOverrides();
    try {
      await fetch("/api/topology", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password":
            (typeof window !== "undefined" ? localStorage.getItem("fiber_admin_pw") : null) || "",
        },
        body: JSON.stringify({ reset: true }),
      });
    } catch {}
    const freshNodes = buildAutoTopologyNodes({
      ...topologyInput,
      serverCanvas: null,
      serverTopology: null,
    });
    pushHistory(freshNodes);
    showToast("✨ تم إعادة رسم الخريطة أوتوماتيكياً من بيانات الروتر الحية");
  };

  const handleSaveLayout = async () => {
    try {
      savePositionsBatch(nodes.map((n) => ({ id: n.id, x: n.x, y: n.y })));
      localStorage.setItem("network-map-layout", JSON.stringify(switches));
      await fetch("/api/topology", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password":
            (typeof window !== "undefined" ? localStorage.getItem("fiber_admin_pw") : null) || "",
        },
        body: JSON.stringify({
          canvas: {
            schemaVersion: "v2-auto",
            routerSignature: `${routerDisplayName}|${routerIp}`,
            switches: switches.map((s) => ({
              id: s.id,
              name: s.name,
              kind: "switch",
              portCount: s.ports,
            })),
            positions: nodes.reduce((acc, n) => {
              acc[n.id] = { x: n.x, y: n.y };
              return acc;
            }, {} as Record<string, { x: number; y: number }>),
            edges: cables,
          },
        }),
      });
      showToast("✓ تم حفظ تخطيط الخريطة بنجاح في السيرفر والمتصفح");
    } catch {
      showToast("✓ تم حفظ تخطيط الخريطة بنجاح في المتصفح");
    }
  };

  const handleSelectSwitch = (swOrId: MapSwitch | string) => {
    const id = typeof swOrId === "string" ? swOrId : swOrId.id;
    setSelectedSwitchId(id);
    setSelectedType("switch");
    setNodes((prev) =>
      prev.map((s) => ({ ...s, selected: s.id === id }))
    );
  };

  const handleSelectDevice = (deviceId: string, switchId?: string) => {
    setSelectedDeviceId(deviceId);
    setSelectedType("device");
    if (switchId) {
      setSelectedSwitchId(switchId);
    }
    setNodes((prev) =>
      prev.map((n) => ({ ...n, selected: n.id === deviceId }))
    );
  };

  // Single source of truth ref for always-fresh state in async callbacks & drag handlers
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const handleDragStart = () => {
    setHistory((prev) => [...prev.slice(-15), nodesRef.current]);
  };

  const handleDragEnd = useCallback((nodeId: string) => {
    console.log(`[DRAG_END] ${nodeId} position saved`);
    if (nodesRef.current) {
      savePositionsBatch(nodesRef.current.map((n) => ({ id: n.id, x: n.x, y: n.y })));
    }
  }, []);

  const handleUpdateSwitchPos = (
    switchId: string,
    x: number,
    y: number
  ) => {
    setNodes((prev) => {
      const sw = prev.find((n) => n.id === switchId);
      if (!sw) return prev;
      const dx = x - sw.x;
      const dy = y - sw.y;
      console.log(`[DRAG_SWITCH] ${switchId} moving to (${x}, ${y}), dx=${dx}, dy=${dy}`);
      const updated = prev.map((n) => {
        if (n.id === switchId) {
          return { ...n, x, y };
        }
        if (n.parentId === switchId) {
          return { ...n, x: n.x + dx, y: n.y + dy };
        }
        return n;
      });
      // Synchronously write to localStorage to eliminate race conditions
      savePositionsBatch(
        updated
          .filter((n) => n.id === switchId || n.parentId === switchId)
          .map((n) => ({ id: n.id, x: n.x, y: n.y }))
      );
      return updated;
    });
  };

  const handleUpdateDevicePos = (
    switchId: string,
    deviceId: string,
    x: number,
    y: number
  ) => {
    console.log(`[DRAG_DEVICE] ${deviceId} moving to (${x}, ${y})`);
    setNodes((prev) => {
      const updated = prev.map((n) => (n.id === deviceId ? { ...n, x, y } : n));
      savePositionsBatch([{ id: deviceId, x, y }]);
      return updated;
    });
  };

  const handleConnectCable = (
    sourceId: string,
    targetId: string,
    portIndex?: number
  ) => {
    setNodes((prev) => {
      const src = prev.find((n) => n.id === sourceId);
      const tgt = prev.find((n) => n.id === targetId);
      if (!src || !tgt) return prev;

      // 1. Switch <-> Switch (Daisy chain / cascading: Switch connected to another Switch)
      if (src.type === "switch" && tgt.type === "switch") {
        const childSwitch = portIndex !== undefined ? tgt : src;
        const parentSwitch = portIndex !== undefined ? src : tgt;
        saveDeviceParent(childSwitch.id, parentSwitch.id, portIndex);
        return prev.map((n) => {
          if (n.id === childSwitch.id) {
            return {
              ...n,
              parentId: parentSwitch.id,
              portIndex: portIndex,
              uplinkHub: undefined,
            };
          }
          return n;
        });
      }

      // 2. Switch <-> Hub (connecting switch uplink to hub, e.g. LAN1, LAN2, LAN3, LAN4, Wi-Fi)
      if ((src.type === "switch" && tgt.type === "hub") || (src.type === "hub" && tgt.type === "switch")) {
        const swNode = src.type === "switch" ? src : tgt;
        const hubNode = src.type === "hub" ? src : tgt;
        saveDeviceParent(swNode.id, hubNode.id);
        return prev.map((n) => {
          if (n.id === swNode.id) {
            return {
              ...n,
              parentId: hubNode.id,
              uplinkHub: hubNode.name as any,
              portIndex: undefined,
            };
          }
          return n;
        });
      }

      // 3. Switch Port <-> Device (or Device <-> Switch Port)
      const switchNode = src.type === "switch" ? src : tgt.type === "switch" ? tgt : null;
      const deviceNode = src.type === "device" ? src : tgt.type === "device" ? tgt : null;

      if (switchNode && deviceNode) {
        const assignedPort = portIndex ?? 1;
        saveDeviceParent(deviceNode.mac || deviceNode.id, switchNode.id, assignedPort);
        return prev.map((n) => {
          if (n.parentId === switchNode.id && n.portIndex === assignedPort && n.id !== deviceNode.id) {
            if (n.mac) savePortAssignment(n.mac, undefined);
            return { ...n, portIndex: undefined };
          }
          if (n.id === deviceNode.id) {
            if (n.mac) savePortAssignment(n.mac, assignedPort);
            return { ...n, parentId: switchNode.id, portIndex: assignedPort };
          }
          return n;
        });
      }

      // 4. Hub <-> Device (e.g. LAN3, LAN4, Wi-Fi direct connection)
      const hubNode = src.type === "hub" ? src : tgt.type === "hub" ? tgt : null;
      if (hubNode && deviceNode) {
        saveDeviceParent(deviceNode.mac || deviceNode.id, hubNode.id);
        return prev.map((n) => {
          if (n.id === deviceNode.id) {
            if (n.mac) savePortAssignment(n.mac, undefined);
            return { ...n, parentId: hubNode.id, portIndex: undefined };
          }
          return n;
        });
      }

      // 5. Router <-> Switch or Router <-> Device
      const routerNode = src.type === "router" ? src : tgt.type === "router" ? tgt : null;
      const otherNode = src.type !== "router" ? src : tgt;
      if (routerNode && otherNode) {
        saveDeviceParent(otherNode.mac || otherNode.id, routerNode.id);
        return prev.map((n) => {
          if (n.id === otherNode.id) {
            return {
              ...n,
              parentId: routerNode.id,
              portIndex: portIndex,
              uplinkHub: undefined,
            };
          }
          return n;
        });
      }

      // 6. Device <-> Device (e.g. Phone/Device connecting to Router/AP)
      if (src.type === "device" && tgt.type === "device") {
        const isSrcRouter = src.subType === "router" || src.subType === "ap";
        const isTgtRouter = tgt.subType === "router" || tgt.subType === "ap";
        const parentDev = isSrcRouter && !isTgtRouter ? src : isTgtRouter && !isSrcRouter ? tgt : src;
        const childDev = parentDev === src ? tgt : src;
        saveDeviceParent(childDev.mac || childDev.id, parentDev.id);
        return prev.map((n) => {
          if (n.id === childDev.id) {
            if (n.mac) savePortAssignment(n.mac, undefined);
            return {
              ...n,
              parentId: parentDev.id,
              portIndex: undefined,
            };
          }
          return n;
        });
      }

      return prev;
    });

    const src = nodesRef.current.find((n) => n.id === sourceId);
    const tgt = nodesRef.current.find((n) => n.id === targetId);
    showToast(`⚡ تم ربط ${src?.name || sourceId} بـ ${tgt?.name || targetId}`);
  };

  const handleUpdateNodePos = (id: string, x: number, y: number) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    savePositionsBatch([{ id, x, y }]);
  };

  const handleDisconnectCable = (nodeId: string) => {
    setNodes((prev) => {
      const target = prev.find((n) => n.id === nodeId);
      if (target?.mac) {
        savePortAssignment(target.mac, 0);
      }
      return prev.map((n) =>
        n.id === nodeId
          ? { ...n, portIndex: undefined, parentId: n.type === "switch" ? undefined : n.parentId }
          : n
      );
    });
    showToast("✂️ تم فصل الكابل بنجاح");
  };

  const handleAssignDevicePort = (
    switchId: string,
    deviceId: string,
    portIndex?: number
  ) => {
    if (portIndex) {
      handleConnectCable(switchId, deviceId, portIndex);
    } else {
      handleDisconnectCable(deviceId);
    }
  };

  const handleUpdateDeviceData = (
    switchId: string,
    deviceId: string,
    updated: Partial<MapDevice>
  ) => {
    const { type: devType, ...rest } = updated;
    const dev = nodes.find((n) => n.id === deviceId);
    if (rest.portIndex !== undefined && dev?.mac) {
      savePortAssignment(dev.mac, rest.portIndex);
    }
    if (rest.name && dev?.mac) {
      fetch("/api/devices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password":
            (typeof window !== "undefined" ? localStorage.getItem("fiber_admin_pw") : null) || "",
        },
        body: JSON.stringify({
          action: "update",
          mac: dev.mac,
          name: rest.name,
        }),
      }).catch(() => {});
    }
    pushHistory(
      nodes.map((n) => {
        if (n.id !== deviceId) return n;
        const merged = {
          ...n,
          ...rest,
          subType: (devType as any) || n.subType,
        };
        if (n.id.startsWith("dev-1")) {
          saveCustomNode(merged);
        }
        return merged;
      })
    );
    showToast("✓ تم تطبيق إعدادات الجهاز بنجاح");
  };

  const handleToggleBlockDevice = async (
    mac: string,
    currentlyBlocked: boolean,
    name: string
  ) => {
    if (dashboard?.sendCommand) {
      await dashboard.sendCommand(currentlyBlocked ? "unblock" : "block", mac, name);
      showToast(
        currentlyBlocked
          ? `✓ تم إلغاء حظر ${name} بنجاح`
          : `✓ تم حظر اتصال ${name} بالشبكة`
      );
    }
  };

  const handleUpdateSwitchData = (updated: Partial<MapSwitch>) => {
    if (selectedSwitchId) {
      saveSwitchMeta(selectedSwitchId, {
        name: updated.name,
        ports: updated.ports,
        uplinkHub: updated.uplinkHub as any,
        uplinkColor: updated.uplinkColor,
      });
    }
    const nextNodes = nodes.map((n) => {
      if (n.id !== selectedSwitchId) return n;
      const merged = { ...n, ...updated, uplinkHub: updated.uplinkHub as any } as MapNode;
      if (n.id.startsWith("switch-1")) {
        saveCustomNode(merged);
      }
      return merged;
    });
    pushHistory(nextNodes);
    showToast("✓ تم تطبيق إعدادات Switch بنجاح");
  };

  const handleDeleteSwitch = (switchId: string) => {
    console.log(`[DELETE_SWITCH] ${switchId}`);
    removeCustomNode(switchId);
    markNodeDeleted(switchId);
    pushHistory(
      nodes
        .filter((n) => n.id !== switchId)
        .map((n) => (n.parentId === switchId ? { ...n, parentId: undefined } : n))
    );
    setSelectedSwitchId("");
    showToast("🗑 تم حذف Switch من الخريطة");
  };

  const handleDeleteDevice = (deviceId: string) => {
    console.log(`[DELETE_DEVICE] ${deviceId}`);
    const dev = nodes.find((n) => n.id === deviceId);
    removeCustomNode(deviceId);
    markNodeDeleted(deviceId);
    if (dev?.mac) {
      savePortAssignment(dev.mac, undefined);
      saveDeviceParent(dev.mac, undefined);
    }
    pushHistory(
      nodes
        .filter((n) => n.id !== deviceId)
        .map((n) => (n.parentId === deviceId ? { ...n, parentId: undefined } : n))
    );
    setSelectedDeviceId("");
    showToast("🗑 تم حذف الجهاز من الخريطة");
  };

  const handleDropNewItem = (
    item: PaletteItem,
    x: number,
    y: number,
    targetHub?: string
  ) => {
    console.log(`[ADD_ITEM] Dropped ${item.name} (${item.type}) at (${x}, ${y}) targetHub=${targetHub}`);
    if (item.type === "switch") {
      const firstHub = nodes.find((n) => n.type === "hub" && n.id !== "hub-offline");
      const hubId = targetHub
        ? `hub-${targetHub.toLowerCase()}`
        : firstHub?.id || "node-router";
      const hubName = targetHub || firstHub?.uplinkHub || "LAN1";
      const newSwNode: MapNode = {
        id: `switch-${Date.now()}`,
        name: item.name,
        type: "switch",
        x,
        y,
        parentId: hubId,
        ports: item.ports || 8,
        uplinkHub: hubName,
        uplinkColor: hubName === "LAN4" ? "#14121F" : hubName === "LAN2" ? "#FF7A45" : "#5B3DF5",
        selected: true,
      };
      savePositionsBatch([{ id: newSwNode.id, x, y }]);
      saveCustomNode(newSwNode);
      pushHistory([...nodes.map((n) => ({ ...n, selected: false })), newSwNode]);
      setSelectedSwitchId(newSwNode.id);
      setSelectedType("switch");
      showToast(`✓ تم إضافة ${item.name} وتوصيله بـ ${newSwNode.uplinkHub}`);
    } else {
      const targetParent = selectedSwitchId || switches[0]?.id || "node-router";
      const newDevNode: MapNode = {
        id: `dev-${Date.now()}`,
        name: item.name,
        type: "device",
        subType: item.type === "ap" ? "ap" : item.type === "camera" ? "camera" : "router",
        x,
        y,
        parentId: targetParent,
        selected: true,
        cableQuality: 100,
      };
      savePositionsBatch([{ id: newDevNode.id, x, y }]);
      saveCustomNode(newDevNode);
      pushHistory([...nodes.map((n) => ({ ...n, selected: false })), newDevNode]);
      setSelectedDeviceId(newDevNode.id);
      setSelectedType("device");
      showToast(`✓ تم إضافة ${item.name} وتوصيله بالسويتش`);
    }
  };

  const currentSelectedSwitch =
    switches.find((s) => s.id === selectedSwitchId) || switches[0] || null;

  const handleChangeDeviceParent = (deviceId: string, newParentId: string) => {
    setNodes((prev) => {
      const dev = prev.find((n) => n.id === deviceId);
      if (!dev) return prev;
      const key = dev.mac || dev.id;
      if (newParentId) {
        saveDeviceParent(key, newParentId);
        if (!newParentId.startsWith("switch-")) {
          if (dev.mac) savePortAssignment(dev.mac, undefined);
        }
      } else {
        saveDeviceParent(key, undefined);
        if (dev.mac) savePortAssignment(dev.mac, undefined);
      }
      return prev.map((n) =>
        n.id === deviceId
          ? {
              ...n,
              parentId: newParentId || undefined,
              portIndex: newParentId && newParentId.startsWith("switch-") ? n.portIndex : undefined,
            }
          : n
      );
    });

    const dev = nodesRef.current.find((n) => n.id === deviceId);
    const parent = nodesRef.current.find((n) => n.id === newParentId);
    showToast(`🔌 تم توصيل ${dev?.name || deviceId} بـ ${parent?.name || newParentId || "لا شيء"}`);
  };

  const currentSelectedDevice = useMemo(() => {
    // 1. Search directly in all nodes first (ensures ANY device on canvas is selectable)
    const nodeDev = nodes.find((n) => n.id === selectedDeviceId && n.type === "device");
    if (!nodeDev) return null;

    const parentSwitch = switches.find((s) => s.id === nodeDev.parentId) || null;
    const mapDev: MapDevice = {
      id: nodeDev.id,
      name: nodeDev.name,
      type: (nodeDev.subType as any) || "router",
      x: nodeDev.x,
      y: nodeDev.y,
      selected: nodeDev.selected,
      cableQuality: nodeDev.cableQuality,
      portIndex: nodeDev.portIndex,
      ip: nodeDev.ip,
      mac: nodeDev.mac,
      blocked: nodeDev.blocked,
      vendor: nodeDev.vendor,
      parentId: nodeDev.parentId,
    };
    return { device: mapDev, parentSwitch };
  }, [nodes, switches, selectedDeviceId]);

  return (
    <div
      className={
        isEmbedded
          ? "flex flex-col gap-5 w-full"
          : "min-h-screen bg-[#ECEBF3] text-[#14121F] p-[28px_20px] sm:p-[28px_40px] flex flex-col gap-[22px] max-w-[1440px] mx-auto"
      }
    >
      {/* 1. Full Header (only shown if standalone page) */}
      {!isEmbedded && (
        <header className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
          {/* Right / Start (RTL): Violet 48px Logo tile + Titles */}
          <div className="flex items-center gap-3 w-full lg:w-auto flex-shrink-0">
            <Link
              href="/"
              className="w-12 h-12 rounded-[16px] bg-[#5B3DF5] flex items-center justify-center flex-shrink-0 shadow-sm hover:scale-105 transition-transform"
              title="الرئيسية"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
              </svg>
            </Link>
            <div>
              <h1 className="text-[18px] font-[800] text-[#14121F] leading-tight">
                مراقبة الشبكة
              </h1>
              <p className="text-[12px] font-[600] text-[#6B6880] ltr-num">
                {routerDisplayName} · {routerIp}
              </p>
            </div>
          </div>

          {/* Center: White Pill Nav */}
          <nav
            aria-label="أقسام الموقع"
            className="bg-white p-[5px] rounded-[999px] flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar flex-shrink min-w-0"
          >
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] transition-all"
            >
              نظرة عامة
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] bg-[#14121F] text-white flex items-center gap-1.5 shadow-sm"
            >
              <span>أجهزة الكابل</span>
              <span className="bg-[#D7F25C] text-[#14121F] text-[10px] font-[900] px-2 py-0.2 rounded-full ltr-num">
                {cableDevices.length}
              </span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] flex items-center gap-1.5 transition-all"
            >
              <span>الويفي</span>
              <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-1.5 py-0.2 rounded-full ltr-num">
                {wifiClients.length}
              </span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] flex items-center gap-1.5 transition-all"
            >
              <span>البوابة</span>
              <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-1.5 py-0.2 rounded-full ltr-num">
                22
              </span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] flex items-center gap-1.5 transition-all"
            >
              <span>الأمان</span>
              <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-1.5 py-0.2 rounded-full ltr-num">
                7
              </span>
            </Link>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] flex items-center gap-1.5 transition-all"
            >
              <span>السجل</span>
              <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-1.5 py-0.2 rounded-full ltr-num">
                81
              </span>
            </Link>
          </nav>

          {/* Left / End (RTL): Violet Pill Button "حفظ التخطيط" */}
          <button
            type="button"
            onClick={handleSaveLayout}
            className="h-[46px] px-6 rounded-[999px] bg-[#5B3DF5] hover:bg-[#4a2ee0] text-white text-[13px] font-[800] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
          >
            <span>💾</span>
            <span>حفظ التخطيط</span>
          </button>
        </header>
      )}

      {/* ======================================================== */}
      {/* 2. TITLE ROW                                             */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 w-full">
        <div>
          <h1 className="text-[28px] sm:text-[34px] font-[900] text-[#14121F] leading-tight">
            تعديل الخريطة
          </h1>
          <p className="text-[13px] sm:text-[14px] font-[600] text-[#6B6880] mt-1">
            حط Switch أو أي جهاز فين بغيتي باش الخريطة تشبه الشبكة الحقيقية ديالك
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented Control: خريطة | جدول | تعديل */}
          <div className="bg-white p-1 rounded-[999px] shadow-sm flex items-center gap-1 border border-[#EEF0F5]">
            {onBackToMap ? (
              <button
                type="button"
                onClick={onBackToMap}
                className="px-4 py-2 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] transition-all cursor-pointer"
              >
                خريطة
              </button>
            ) : (
              <Link
                href="/"
                className="px-4 py-2 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] transition-all"
              >
                خريطة
              </Link>
            )}

            {onBackToTable ? (
              <button
                type="button"
                onClick={onBackToTable}
                className="px-4 py-2 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] transition-all cursor-pointer"
              >
                جدول
              </button>
            ) : (
              <Link
                href="/"
                className="px-4 py-2 rounded-[999px] text-[13px] font-[800] text-[#14121F] hover:bg-[#F6F6FA] transition-all"
              >
                جدول
              </Link>
            )}

            <span className="px-5 py-2 rounded-[999px] text-[13px] font-[800] bg-[#5B3DF5] text-white shadow-xs">
              تعديل
            </span>
          </div>

          {/* Embedded Rebuild & Save buttons */}
          <button
            type="button"
            onClick={handleRebuildFromRouter}
            className="h-[42px] px-4 rounded-[999px] bg-[#EFEBFF] hover:bg-[#E1DAFF] text-[#5B3DF5] text-[12.5px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            title="مسح التعديلات اليدوية وإعادة رسم الخريطة تلقائياً من الروتر"
          >
            <span>✨</span>
            <span>رسم تلقائي من الروتر</span>
          </button>

          {isEmbedded && (
            <button
              type="button"
              onClick={handleSaveLayout}
              className="h-[42px] px-5 rounded-[999px] bg-[#14121F] hover:bg-[#272B52] text-white text-[12.5px] font-[800] transition-all shadow-sm flex items-center gap-2 cursor-pointer flex-shrink-0"
            >
              <span>💾</span>
              <span>حفظ التخطيط</span>
            </button>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. MAIN GRID: 340px 1fr (Right Column is on the RIGHT in RTL) */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-[22px] items-start w-full">
        {/* Right Column: Two Stacked Bento Cards */}
        <div className="flex flex-col gap-[22px] w-full">
          {/* Card a: مكتبة الأجهزة */}
          <Palette
            onAddCustom={() => {
              showToast("جهاز مخصص: تقدر تسحب أي Switch وتبدل ليه الاسم والنوع");
            }}
          />

          {/* Card b: خصائص (Switch أو الجهاز المحدد) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-[16px] shadow-xs border border-[#EEF0F5]">
            <button
              type="button"
              onClick={() => setSelectedType("switch")}
              className={`flex-1 py-1.5 rounded-[12px] text-[12px] font-[800] transition-all cursor-pointer ${
                selectedType === "switch"
                  ? "bg-[#14121F] text-white shadow-xs"
                  : "text-[#6B6880] hover:text-[#14121F]"
              }`}
            >
              🔀 خصائص Switch
            </button>
            <button
              type="button"
              onClick={() => setSelectedType("device")}
              className={`flex-1 py-1.5 rounded-[12px] text-[12px] font-[800] transition-all cursor-pointer ${
                selectedType === "device"
                  ? "bg-[#5B3DF5] text-white shadow-xs"
                  : "text-[#6B6880] hover:text-[#14121F]"
              }`}
            >
              📱 خصائص الجهاز
            </button>
          </div>

          {selectedType === "device" && currentSelectedDevice ? (
            <DevicePanel
              device={currentSelectedDevice.device}
              parentSwitch={currentSelectedDevice.parentSwitch}
              allNodes={nodes}
              correlationInsights={state?.correlationInsights || []}
              onChangeDeviceParent={handleChangeDeviceParent}
              onDeleteDevice={handleDeleteDevice}
              onUpdateDevice={handleUpdateDeviceData}
              onToggleBlock={handleToggleBlockDevice}
              onSelectSwitch={(swId) => {
                setSelectedSwitchId(swId);
                setSelectedType("switch");
              }}
            />
          ) : (
            <SwitchPanel
              switchData={currentSelectedSwitch}
              onUpdate={handleUpdateSwitchData}
              onDelete={handleDeleteSwitch}
              onSelectDevice={(id) => {
                setSelectedDeviceId(id);
                setSelectedType("device");
              }}
              selectedDeviceId={selectedDeviceId}
              onAssignDevicePort={handleAssignDevicePort}
            />
          )}
        </div>

        {/* Left Column: Canvas Card */}
        <div className="bento-card bg-white p-0 overflow-hidden flex flex-col w-full shadow-lg">
          {/* Toolbar */}
          <Toolbar
            currentTool={tool}
            onSelectTool={(t) => setTool(t)}
            onUndo={handleUndo}
            onAutoLayout={handleAutoLayout}
            zoom={zoom}
            onZoomIn={() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 10) / 10))}
            onZoomOut={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
          />

          {/* SVG Map Canvas */}
          <MapCanvas
            nodes={nodes}
            tool={tool}
            zoom={zoom}
            switches={switches}
            onSelectSwitch={handleSelectSwitch}
            onUpdateSwitchPos={handleUpdateSwitchPos}
            onUpdateDevicePos={handleUpdateDevicePos}
            onUpdateNodePos={handleUpdateNodePos}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDropNewItem={handleDropNewItem}
            onSelectDevice={handleSelectDevice}
            selectedDeviceId={selectedDeviceId}
            telemetry={telemetry}
            onConnectCable={handleConnectCable}
            onDisconnectCable={handleDisconnectCable}
          />
        </div>
      </div>

      {/* ======================================================== */}
      {/* 4. FLOATING TOAST NOTIFICATION                           */}
      {/* ======================================================== */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#14121F] text-white px-6 py-3 rounded-full text-[13px] font-[800] shadow-2xl border border-white/10 flex items-center gap-2 pointer-events-none transition-all">
          <span className="w-2 h-2 rounded-full bg-[#D7F25C] animate-live-dot" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
