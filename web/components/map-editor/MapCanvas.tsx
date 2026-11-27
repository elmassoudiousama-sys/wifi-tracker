"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  MapDevice,
  MapSwitch,
  MapNode,
  PaletteItem,
  getPortColor,
} from "@/lib/map-data";
import { EditorTool } from "./Toolbar";

export interface MapTelemetry {
  routerName?: string;
  routerIp?: string;
  internetPing: number | null;
  totalDl: string;
  lanRates: Record<string, { rx: number; tx: number; total: number }>;
  lan3Device?: { name: string; type: string };
  lan4Device?: { name: string; type: string };
  wifiCount: number;
  wifiClients: Array<{ name: string; ip: string; mac: string; vendor?: string }>;
  disconnectedDevices: Array<{ name: string; ip: string; mac: string }>;
  lastUpdated?: string | null;
  isRouterOnline?: boolean;
}

interface MapCanvasProps {
  nodes?: MapNode[];
  tool: EditorTool;
  zoom: number;
  switches: MapSwitch[];
  onSelectSwitch: (sw: MapSwitch) => void;
  onUpdateSwitchPos: (switchId: string, x: number, y: number, devices?: MapDevice[]) => void;
  onUpdateDevicePos?: (switchId: string, deviceId: string, x: number, y: number) => void;
  onUpdateNodePos?: (id: string, x: number, y: number) => void;
  onDragStart?: () => void;
  onDragEnd?: (id: string) => void;
  onDropNewItem: (item: PaletteItem, x: number, y: number, targetHub?: string) => void;
  onSelectDevice: (deviceId: string, switchId?: string) => void;
  selectedDeviceId?: string;
  telemetry?: MapTelemetry;
  onConnectCable?: (sourceId: string, targetId: string, portIndex?: number) => void;
  onDisconnectCable?: (deviceId: string) => void;
}

export function MapCanvas({
  nodes = [],
  tool,
  zoom,
  switches,
  onSelectSwitch,
  onUpdateSwitchPos,
  onUpdateDevicePos,
  onUpdateNodePos,
  onDragStart,
  onDragEnd,
  onDropNewItem,
  onSelectDevice,
  selectedDeviceId = "",
  telemetry,
  onConnectCable,
  onDisconnectCable,
}: MapCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    type: "switch" | "device" | "node" | "pan";
    id: string;
    switchId?: string;
    pointerId: number;
    startSvgX: number;
    startSvgY: number;
    origSwitchX: number;
    origSwitchY: number;
    minRelX: number;
    maxRelX: number;
    minRelY: number;
    maxRelY: number;
    deviceOffsets: Array<{ id: string; offsetX: number; offsetY: number }>;
    origDevX?: number;
    origDevY?: number;
    origNodeX?: number;
    origNodeY?: number;
    startPanX?: number;
    startPanY?: number;
  } | null>(null);

  const [connectingCable, setConnectingCable] = useState<{
    sourceType: "port" | "device";
    switchId: string;
    portIndex?: number;
    deviceId?: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    pointerId?: number;
  } | null>(null);

  const [hoveredPort, setHoveredPort] = useState<{ switchId: string; portNumber: number } | null>(null);
  const [hoveredDeviceId, setHoveredDeviceId] = useState<string | null>(null);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dropTargetHubId, setDropTargetHubId] = useState<string | null>(null);

  // Auto-fit viewBox dynamically around all active nodes so ANY router size renders cleanly
  const { viewWidth, viewHeight, viewX, viewY } = useMemo(() => {
    const effectiveZoom = zoom || 1;
    if (nodes.length === 0) {
      const vw = Math.round(1180 / effectiveZoom);
      const vh = Math.round(640 / effectiveZoom);
      return {
        viewWidth: vw,
        viewHeight: vh,
        viewX: Math.round(panOffset.x + 600 - vw / 2),
        viewY: Math.round(panOffset.y + 300 - vh / 2),
      };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    nodes.forEach((n) => {
      const padX = n.type === "switch" ? 24 + (n.ports || 8) * 6 : n.type === "wan" ? 115 : 85;
      const padY = n.type === "switch" ? 65 : 55;
      minX = Math.min(minX, n.x - padX);
      maxX = Math.max(maxX, n.x + padX);
      minY = Math.min(minY, n.y - padY);
      maxY = Math.max(maxY, n.y + padY);
    });

    // Ensure AP node beside Wi-Fi hub is inside bounds
    const wifiHub = nodes.find((n) => n.id === "hub-wifi");
    const routerNode = nodes.find((n) => n.id === "node-router");
    if (wifiHub) {
      const dir = routerNode && wifiHub.x < routerNode.x ? -1 : 1;
      maxX = Math.max(maxX, wifiHub.x + dir * 135 + 75);
      minX = Math.min(minX, wifiHub.x + dir * 135 - 75);
    }

    const contentW = Math.max(1020, maxX - minX + 120);
    const contentH = Math.max(580, maxY - minY + 110);
    const vw = Math.round(contentW / effectiveZoom);
    const vh = Math.round(contentH / effectiveZoom);
    const cx = Math.round((minX + maxX) / 2);
    const cy = Math.round((minY + maxY) / 2);

    return {
      viewWidth: vw,
      viewHeight: vh,
      viewX: Math.round(panOffset.x + cx - vw / 2),
      viewY: Math.round(panOffset.y + cy - vh / 2),
    };
  }, [nodes, zoom, panOffset]);

  const viewDimsRef = useRef({ viewWidth, viewHeight });
  viewDimsRef.current = { viewWidth, viewHeight };

  const getSvgCoordinates = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const ctm = svgRef.current.getScreenCTM();
    if (ctm) {
      const pt = svgRef.current.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: Math.round(svgPt.x), y: Math.round(svgPt.y) };
    }
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * viewDimsRef.current.viewWidth + viewX;
    const y = ((clientY - rect.top) / rect.height) * viewDimsRef.current.viewHeight + viewY;
    return { x: Math.round(x), y: Math.round(y) };
  };

  const handleSwitchPointerDown = (e: React.PointerEvent, sw: MapSwitch) => {
    if (tool === "cable") return;
    e.stopPropagation();
    e.preventDefault();
    onSelectSwitch(sw);
    onDragStart?.();

    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    const switchHalfWidth = (24 + sw.ports * 11) / 2;

    let minRelX = -switchHalfWidth - 10;
    let maxRelX = switchHalfWidth + 10;
    let minRelY = -50;
    let maxRelY = 25;

    const deviceOffsets = sw.devices.map((d) => {
      const offsetX = d.x - sw.x;
      const offsetY = d.y - sw.y;
      minRelX = Math.min(minRelX, offsetX - 25);
      maxRelX = Math.max(maxRelX, offsetX + 25);
      minRelY = Math.min(minRelY, offsetY - 10);
      maxRelY = Math.max(maxRelY, offsetY + 35);
      return { id: d.id, offsetX, offsetY };
    });

    setActiveDrag({
      type: "switch",
      id: sw.id,
      pointerId: e.pointerId,
      startSvgX: coords.x,
      startSvgY: coords.y,
      origSwitchX: sw.x,
      origSwitchY: sw.y,
      minRelX,
      maxRelX,
      minRelY,
      maxRelY,
      deviceOffsets,
    });
  };

  const handleDevicePointerDown = (e: React.PointerEvent, sw: MapSwitch, dev: MapDevice) => {
    if (tool === "cable") {
      e.stopPropagation();
      e.preventDefault();
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      setConnectingCable({
        sourceType: "device",
        switchId: sw.id,
        deviceId: dev.id,
        startX: dev.x,
        startY: dev.y,
        currentX: coords.x,
        currentY: coords.y,
        pointerId: e.pointerId,
      });
      if (svgRef.current) {
        try {
          svgRef.current.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    onSelectDevice(dev.id, sw.id);
    onDragStart?.();

    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    setActiveDrag({
      type: "device",
      id: dev.id,
      switchId: sw.id,
      pointerId: e.pointerId,
      startSvgX: coords.x,
      startSvgY: coords.y,
      origSwitchX: sw.x,
      origSwitchY: sw.y,
      minRelX: 0,
      maxRelX: 0,
      minRelY: 0,
      maxRelY: 0,
      deviceOffsets: [],
      origDevX: dev.x,
      origDevY: dev.y,
    });
  };

  const handleNodePointerDown = (
    e: React.PointerEvent,
    nodeId: string,
    currentX: number,
    currentY: number,
    selectableDevice = false,
    parentId?: string
  ) => {
    if (tool === "cable") {
      e.stopPropagation();
      e.preventDefault();
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      setConnectingCable({
        sourceType: "device",
        switchId: nodeId,
        deviceId: nodeId,
        startX: currentX,
        startY: currentY,
        currentX: coords.x,
        currentY: coords.y,
        pointerId: e.pointerId,
      });
      if (svgRef.current) {
        try {
          svgRef.current.setPointerCapture(e.pointerId);
        } catch {}
      }
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    if (selectableDevice) {
      onSelectDevice(nodeId, parentId);
    }
    onDragStart?.();

    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }

    const coords = getSvgCoordinates(e.clientX, e.clientY);
    setActiveDrag({
      type: "node",
      id: nodeId,
      pointerId: e.pointerId,
      startSvgX: coords.x,
      startSvgY: coords.y,
      origSwitchX: 0,
      origSwitchY: 0,
      minRelX: 0,
      maxRelX: 0,
      minRelY: 0,
      maxRelY: 0,
      deviceOffsets: [],
      origNodeX: currentX,
      origNodeY: currentY,
    });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (connectingCable) {
      setConnectingCable(null);
      return;
    }
    if (svgRef.current) {
      try {
        svgRef.current.setPointerCapture(e.pointerId);
      } catch {}
    }
    setActiveDrag({
      type: "pan",
      id: "canvas-pan",
      pointerId: e.pointerId,
      startSvgX: e.clientX,
      startSvgY: e.clientY,
      origSwitchX: 0,
      origSwitchY: 0,
      minRelX: 0,
      maxRelX: 0,
      minRelY: 0,
      maxRelY: 0,
      deviceOffsets: [],
      startPanX: panOffset.x,
      startPanY: panOffset.y,
    });
  };

  const handleWheel = (e: React.WheelEvent) => {
    setPanOffset((prev) => ({
      x: Math.round(prev.x + (e.shiftKey ? e.deltaY : e.deltaX)),
      y: Math.round(prev.y + (e.shiftKey ? 0 : e.deltaY)),
    }));
  };

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (connectingCable) {
        const coords = getSvgCoordinates(e.clientX, e.clientY);
        setConnectingCable((prev) =>
          prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null
        );
        return;
      }
      if (!activeDrag) return;

      if (activeDrag.type === "pan") {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const dx =
          ((e.clientX - activeDrag.startSvgX) / rect.width) * viewDimsRef.current.viewWidth;
        const dy =
          ((e.clientY - activeDrag.startSvgY) / rect.height) * viewDimsRef.current.viewHeight;
        setPanOffset({
          x: Math.round((activeDrag.startPanX ?? 0) - dx),
          y: Math.round((activeDrag.startPanY ?? 0) - dy),
        });
        return;
      }

      const coords = getSvgCoordinates(e.clientX, e.clientY);
      const dx = coords.x - activeDrag.startSvgX;
      const dy = coords.y - activeDrag.startSvgY;

      if (activeDrag.type === "switch" && activeDrag.id) {
        const targetX = Math.round(activeDrag.origSwitchX + dx);
        const targetY = Math.round(activeDrag.origSwitchY + dy);

        const targetSw = switches.find((s) => s.id === activeDrag.id);
        if (targetSw) {
          const updatedDevices = targetSw.devices.map((d) => {
            const offset = activeDrag.deviceOffsets.find((o) => o.id === d.id);
            return {
              ...d,
              x: offset ? targetX + offset.offsetX : d.x,
              y: offset ? targetY + offset.offsetY : d.y,
            };
          });
          onUpdateSwitchPos(activeDrag.id, targetX, targetY, updatedDevices);
        }
      } else if (
        activeDrag.type === "device" &&
        activeDrag.id &&
        activeDrag.switchId &&
        onUpdateDevicePos
      ) {
        const targetX = Math.round((activeDrag.origDevX ?? 0) + dx);
        const targetY = Math.round((activeDrag.origDevY ?? 0) + dy);
        onUpdateDevicePos(activeDrag.switchId, activeDrag.id, targetX, targetY);
      } else if (activeDrag.type === "node" && activeDrag.id && onUpdateNodePos) {
        const targetX = Math.round((activeDrag.origNodeX ?? 0) + dx);
        const targetY = Math.round((activeDrag.origNodeY ?? 0) + dy);
        onUpdateNodePos(activeDrag.id, targetX, targetY);
      }
    };

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (connectingCable) {
        const coords = getSvgCoordinates(e.clientX, e.clientY);
        const sourceEntityId = connectingCable.deviceId || connectingCable.switchId;

        let targetSwId: string | null = null;
        let targetPortNum: number | null = null;
        for (const sw of switches) {
          const swWidth = 24 + sw.ports * 11;
          const swX = sw.x - swWidth / 2;
          const swY = sw.y - 17;
          for (let i = 0; i < sw.ports; i++) {
            const pNum = i + 1;
            const portPinX = swX + 19 + i * 11;
            const portPinY = swY + 20;
            if (Math.hypot(portPinX - coords.x, portPinY - coords.y) < 22) {
              targetSwId = sw.id;
              targetPortNum = pNum;
              break;
            }
          }
          if (targetSwId) break;
        }

        if (targetSwId && targetPortNum) {
          onConnectCable?.(sourceEntityId, targetSwId, targetPortNum);
          setConnectingCable(null);
          return;
        }

        let targetSwitchUplink: string | null = null;
        for (const sw of switches) {
          if (sw.id === sourceEntityId) continue;
          const swWidth = 24 + sw.ports * 11;
          const swLeft = sw.x - swWidth / 2 - 15;
          const swRight = sw.x + swWidth / 2 + 15;
          const swTop = sw.y - 30;
          const swBottom = sw.y + 40;
          if (
            coords.x >= swLeft &&
            coords.x <= swRight &&
            coords.y >= swTop &&
            coords.y <= swBottom
          ) {
            targetSwitchUplink = sw.id;
            break;
          }
        }
        if (targetSwitchUplink) {
          onConnectCable?.(sourceEntityId, targetSwitchUplink, connectingCable.portIndex);
          setConnectingCable(null);
          return;
        }

        if (nodes) {
          let targetNodeId: string | null = null;
          for (const n of nodes) {
            if (n.id === sourceEntityId) continue;
            const threshold = n.type === "hub" ? 55 : n.type === "router" ? 65 : 45;
            if (Math.hypot(n.x - coords.x, n.y - coords.y) < threshold) {
              targetNodeId = n.id;
              break;
            }
          }
          if (targetNodeId) {
            onConnectCable?.(sourceEntityId, targetNodeId, connectingCable.portIndex);
            setConnectingCable(null);
            return;
          }
        }

        const dragDist = Math.hypot(
          coords.x - connectingCable.startX,
          coords.y - connectingCable.startY
        );
        if (dragDist > 25) {
          setConnectingCable(null);
        }

        if (svgRef.current && connectingCable.pointerId) {
          try {
            svgRef.current.releasePointerCapture(connectingCable.pointerId);
          } catch {}
        }
      }

      if (activeDrag) {
        if (svgRef.current) {
          try {
            svgRef.current.releasePointerCapture(activeDrag.pointerId);
          } catch {}
        }
        if (
          activeDrag.type === "switch" ||
          activeDrag.type === "device" ||
          activeDrag.type === "node"
        ) {
          onDragEnd?.(activeDrag.id);
        }
        setActiveDrag(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setConnectingCable(null);
      }
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    activeDrag,
    connectingCable,
    switches,
    nodes,
    onUpdateSwitchPos,
    onUpdateDevicePos,
    onUpdateNodePos,
    onDragEnd,
    onConnectCable,
    panOffset,
  ]);

  // Dynamic proximity hub target when dragging new items from Palette
  const findClosestHub = (x: number, y: number): MapNode | null => {
    let best: MapNode | null = null;
    let bestDist = 115;
    nodes
      .filter((n) => n.type === "hub" && n.id !== "hub-offline")
      .forEach((h) => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bestDist) {
          bestDist = d;
          best = h;
        }
      });
    return best;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    const closest = findClosestHub(coords.x, coords.y);
    setDropTargetHubId(closest ? closest.id : null);
  };

  const handleDragLeave = () => {
    setDropTargetHubId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetHubId(null);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const item: PaletteItem = JSON.parse(dataStr);
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      const snapX = Math.round(coords.x / 10) * 10;
      const snapY = Math.round(coords.y / 10) * 10;
      const closest = findClosestHub(coords.x, coords.y);
      onDropNewItem(item, snapX, snapY, closest?.uplinkHub || closest?.name);
    } catch {}
  };

  // Extract node groups dynamically
  const wanNode = nodes.find((n) => n.id === "node-wan") || {
    id: "node-wan",
    name: "الإنترنت",
    type: "wan" as const,
    x: 620,
    y: 40,
  };
  const routerNode = nodes.find((n) => n.id === "node-router") || {
    id: "node-router",
    name: telemetry?.routerName || "ZTE Router",
    type: "router" as const,
    x: 620,
    y: 230,
    ip: telemetry?.routerIp || "192.168.1.1",
  };
  const routerDisplayName = routerNode.name || telemetry?.routerName || "ZTE Router";
  const routerDisplayIp = routerNode.ip || telemetry?.routerIp || "192.168.1.1";

  const hubNodes = nodes.filter((n) => n.type === "hub");
  const wifiHubNode = hubNodes.find((h) => h.id === "hub-wifi");
  const wifiPhoneNodes = nodes.filter((n) => n.type === "device" && n.parentId === "hub-wifi");

  const switchIdSet = new Set(switches.map((s) => s.id));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Direct-to-hub (excluding Wi-Fi), direct-to-router, offline, or orphan devices
  const directAndOfflineDevices = nodes.filter((n) => {
    if (n.type !== "device") return false;
    if (n.parentId === "hub-wifi") return false;
    if (n.parentId && switchIdSet.has(n.parentId)) return false;
    if (n.parentId && nodeById.get(n.parentId)?.type === "device") return false;
    return true;
  });

  // Peer child devices (attached under another router/AP device)
  const peerChildDevices = nodes.filter((n) => {
    if (n.type !== "device" || !n.parentId) return false;
    if (switchIdSet.has(n.parentId)) return false;
    return nodeById.get(n.parentId)?.type === "device";
  });

  // Compute real device count inside each hub's branch dynamically
  const countBranchDevices = (hubId: string): number => {
    const branchSwitchIds = new Set<string>();
    const queue = switches.filter((s) => s.parentId === hubId).map((s) => s.id);
    while (queue.length > 0) {
      const sid = queue.shift()!;
      if (branchSwitchIds.has(sid)) continue;
      branchSwitchIds.add(sid);
      switches
        .filter((s) => s.parentId === sid)
        .forEach((child) => queue.push(child.id));
    }
    return nodes.filter(
      (n) =>
        n.type === "device" &&
        (n.parentId === hubId || (n.parentId && branchSwitchIds.has(n.parentId)))
    ).length;
  };

  // Compute router attachment Y offsets cleanly per side
  const leftSideHubs = hubNodes
    .filter((h) => h.id !== "hub-offline" && h.x < routerNode.x)
    .sort((a, b) => a.y - b.y);
  const rightSideHubs = hubNodes
    .filter((h) => h.id !== "hub-offline" && h.x >= routerNode.x)
    .sort((a, b) => a.y - b.y);
  const offlineHub = hubNodes.find((h) => h.id === "hub-offline");

  const getAttachOffset = (idx: number, total: number) => {
    if (total <= 1) return 0;
    const span = Math.min(52, (total - 1) * 24);
    return -span / 2 + (idx / (total - 1)) * span;
  };

  const renderDeviceGlyph = (
    subType: string | undefined,
    strokeColor: string,
    isSelected: boolean,
    isOffline: boolean
  ) => {
    if (subType === "phone") {
      return (
        <g transform="translate(8, 0)">
          <rect
            width="20"
            height="30"
            rx="5"
            fill={isOffline ? "#F1F0F6" : isSelected ? "#FFEDE5" : "#FFFFFF"}
            stroke={strokeColor}
            strokeWidth={isSelected ? "2.5" : "2"}
          />
          <circle cx="10" cy="24" r="1.8" fill={strokeColor} />
        </g>
      );
    }
    if (subType === "camera") {
      return (
        <>
          <rect x="0" y="3" width="36" height="20" rx="5" fill={isOffline ? "#6B6880" : "#272B52"} />
          <circle cx="18" cy="13" r="5" fill="none" stroke="#D7F25C" strokeWidth="1.8" />
          <circle cx="18" cy="13" r="2" fill="#D7F25C" />
        </>
      );
    }
    if (subType === "pc") {
      return (
        <>
          <rect
            x="2"
            y="3"
            width="32"
            height="19"
            rx="4"
            fill={isOffline ? "#F1F0F6" : "#F6F6FA"}
            stroke={strokeColor}
            strokeWidth="2"
          />
          <rect x="13" y="22" width="10" height="4" fill="#9A98AD" />
          <line
            x1="9"
            y1="26"
            x2="27"
            y2="26"
            stroke="#9A98AD"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      );
    }
    // Router / AP / Default
    return (
      <>
        <line
          x1="10"
          y1="5"
          x2="4"
          y2="0"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <line
          x1="26"
          y1="5"
          x2="32"
          y2="0"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <rect
          x="0"
          y="5"
          width="36"
          height="17"
          rx="6"
          fill={isOffline ? "#F1F0F6" : isSelected ? "#FF7A45" : "#FFFFFF"}
          stroke={isSelected ? "#14121F" : strokeColor}
          strokeWidth={isSelected ? "2.5" : "2"}
        />
        <circle cx="10" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : strokeColor} />
        <circle cx="18" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : strokeColor} />
        <circle cx="26" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : strokeColor} />
      </>
    );
  };

  return (
    <div className="relative w-full overflow-hidden bg-white rounded-b-[24px] min-h-[640px] h-[72vh] max-h-[850px]">
      {tool === "cable" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#14121F]/95 backdrop-blur-md text-white px-5 py-2.5 rounded-full text-[12px] font-[800] shadow-2xl border border-white/10 flex items-center gap-3 animate-fade-in pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-[#D7F25C] animate-pulse" />
          <span>
            {connectingCable
              ? connectingCable.sourceType === "port"
                ? `⚡ جاري توصيل المنفذ #${connectingCable.portIndex}: انقر أو أفلت الكابل فوق أي جهاز للربط`
                : `⚡ جاري توصيل الجهاز: انقر أو أفلت الكابل فوق أي منفذ في السويتش للربط`
              : "وضع وصل الكابلات: اسحب من أي منفذ في السويتش إلى أي جهاز (أو العكس) لربطهما معاً"}
          </span>
          {connectingCable && (
            <button
              type="button"
              onClick={() => setConnectingCable(null)}
              className="bg-white/15 hover:bg-white/25 text-[#D7F25C] text-[11px] px-2.5 py-0.5 rounded-full cursor-pointer transition-all mr-2"
            >
              إلغاء (Esc)
            </button>
          )}
        </div>
      )}

      {(panOffset.x !== 0 || panOffset.y !== 0) && (
        <button
          type="button"
          onClick={() => setPanOffset({ x: 0, y: 0 })}
          className="absolute bottom-4 left-4 z-20 bg-white/95 hover:bg-white text-[#14121F] px-4 py-2 rounded-full text-[12px] font-[800] shadow-lg border border-[#EEF0F5] flex items-center gap-2 transition-all cursor-pointer backdrop-blur-md animate-fade-in"
          title="إعادة الخريطة إلى المركز"
        >
          <span className="text-[#5B3DF5] font-black">⛶</span>
          <span>توسيط الخريطة (Center)</span>
        </button>
      )}

      <svg
        ref={svgRef}
        viewBox={`${viewX} ${viewY} ${viewWidth} ${viewHeight}`}
        className="w-full h-full select-none block"
        preserveAspectRatio="xMidYMid meet"
        style={{
          touchAction: "none",
          cursor:
            tool === "pan"
              ? activeDrag?.type === "pan"
                ? "grabbing"
                : "grab"
              : tool === "cable"
              ? "crosshair"
              : activeDrag?.type === "pan"
              ? "grabbing"
              : "default",
        }}
        aria-label="خريطة طوبولوجيا الشبكة ومحرر التوصيلات"
        onPointerDown={handleCanvasPointerDown}
        onWheel={handleWheel}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <defs>
          <pattern id="dotted-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <circle cx="12" cy="12" r="1.4" fill="#DAD8E8" />
          </pattern>
        </defs>

        {/* 1. Boundless Canvas Background */}
        <rect
          x={panOffset.x - 6000}
          y={panOffset.y - 6000}
          width={13000}
          height={13000}
          fill="#F8F8FC"
        />
        <rect
          x={panOffset.x - 6000}
          y={panOffset.y - 6000}
          width={13000}
          height={13000}
          fill="url(#dotted-grid)"
        />

        {/* 2. INTERNET PILL & DOWNWARD CABLE TO ROUTER */}
        {(() => {
          const wanBottomY = wanNode.y + 22;
          const routerTopY = routerNode.y - 42;
          const midX = (wanNode.x + routerNode.x) / 2;
          const midY = (wanBottomY + routerTopY) / 2;

          return (
            <g>
              <line
                x1={wanNode.x}
                y1={wanBottomY}
                x2={routerNode.x}
                y2={routerTopY}
                stroke="#5B3DF5"
                strokeWidth="6"
                opacity="0.12"
                strokeLinecap="round"
              />
              <line
                x1={wanNode.x}
                y1={wanBottomY}
                x2={routerNode.x}
                y2={routerTopY}
                stroke="#14121F"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect
                  width="92"
                  height="24"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#EEF0F5"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="2.5" fill="#34D399" />
                <text
                  x="50"
                  y="16"
                  textAnchor="middle"
                  fill="#14121F"
                  fontSize="11.5"
                  fontWeight="900"
                  className="ltr-num"
                >
                  {telemetry?.totalDl ?? "0.0"} Mbps
                </text>
              </g>

              <g
                transform={`translate(${wanNode.x - 105}, ${wanNode.y - 22})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handleNodePointerDown(e, "node-wan", wanNode.x, wanNode.y)}
                onClick={() => {
                  if (connectingCable) {
                    onConnectCable?.(
                      connectingCable.deviceId || connectingCable.switchId,
                      "node-wan"
                    );
                    setConnectingCable(null);
                  }
                }}
              >
                <rect width="210" height="44" rx="22" fill="#14121F" />
                <circle cx="28" cy="22" r="10" fill="none" stroke="#D7F25C" strokeWidth="2" />
                <ellipse
                  cx="28"
                  cy="22"
                  rx="4.5"
                  ry="10"
                  fill="none"
                  stroke="#D7F25C"
                  strokeWidth="1.5"
                />
                <line x1="18" y1="22" x2="38" y2="22" stroke="#D7F25C" strokeWidth="1.5" />
                <text x="118" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800">
                  الإنترنت{" "}
                  {telemetry?.internetPing !== null && telemetry?.internetPing !== undefined
                    ? `· ${telemetry.internetPing} ms`
                    : "· متصل"}
                </text>
              </g>
            </g>
          );
        })()}

        {/* 3. DYNAMIC ROUTER -> HUB CABLES & SPEED/COUNT PILLS */}
        {leftSideHubs.map((hub, idx) => {
          const rX = routerNode.x - 72;
          const rY = routerNode.y + getAttachOffset(idx, leftSideHubs.length);
          const hX = hub.x + 62;
          const hY = hub.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          const portKey = (hub.uplinkHub || hub.name || "").toUpperCase();
          const lineColor = hub.uplinkColor || getPortColor(portKey).color;
          const strokeColor = lineColor === "#D7F25C" ? "#B7D633" : lineColor;
          const pillTextColor = lineColor === "#D7F25C" ? "#2F6B0F" : strokeColor;
          const rx = telemetry?.lanRates?.[portKey]?.rx ?? 0;

          return (
            <g key={`link-${hub.id}`}>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3.5" fill={strokeColor} />
              <circle cx={hX} cy={hY} r="3.5" fill={strokeColor} />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect
                  width="92"
                  height="24"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#EEF0F5"
                  strokeWidth="1.5"
                />
                <circle cx="12" cy="12" r="2.5" fill={strokeColor} />
                <text
                  x="50"
                  y="16"
                  textAnchor="middle"
                  fill={pillTextColor}
                  fontSize="11.5"
                  fontWeight="900"
                  className="ltr-num"
                >
                  {rx} Mbps
                </text>
              </g>
            </g>
          );
        })}

        {rightSideHubs.map((hub, idx) => {
          const rX = routerNode.x + 72;
          const rY = routerNode.y + getAttachOffset(idx, rightSideHubs.length);
          const hX = hub.x - 62;
          const hY = hub.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          const isWifi = hub.id === "hub-wifi";
          const portKey = (hub.uplinkHub || hub.name || "").toUpperCase();
          const lineColor = hub.uplinkColor || getPortColor(portKey).color;
          const strokeColor = lineColor === "#D7F25C" ? "#B7D633" : lineColor;
          const pillTextColor = lineColor === "#D7F25C" ? "#2F6B0F" : strokeColor;
          const count = countBranchDevices(hub.id);
          const rx = telemetry?.lanRates?.[portKey]?.rx ?? 0;

          return (
            <g key={`link-${hub.id}`}>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3.5" fill={strokeColor} />
              <circle cx={hX} cy={hY} r="3.5" fill={strokeColor} />
              <g transform={`translate(${midX - 50}, ${midY - 12})`}>
                <rect
                  width="100"
                  height="24"
                  rx="12"
                  fill="#FFFFFF"
                  stroke="#EEF0F5"
                  strokeWidth="1.5"
                />
                {!isWifi && <circle cx="12" cy="12" r="2.5" fill={strokeColor} />}
                <text
                  x={isWifi ? "50" : "54"}
                  y="16"
                  textAnchor="middle"
                  fill={pillTextColor}
                  fontSize="11"
                  fontWeight="900"
                  className={isWifi ? undefined : "ltr-num"}
                >
                  {isWifi ? `Wi-Fi ${count} أجهزة` : `${rx} Mbps`}
                </text>
              </g>
            </g>
          );
        })}

        {offlineHub && (
          <path
            d={`M ${routerNode.x} ${routerNode.y + 42} C ${routerNode.x} ${
              (routerNode.y + 42 + offlineHub.y - 26) / 2
            }, ${offlineHub.x} ${(routerNode.y + 42 + offlineHub.y - 26) / 2}, ${offlineHub.x} ${
              offlineHub.y - 26
            }`}
            fill="none"
            stroke="#9A98AD"
            strokeWidth="2"
            strokeDasharray="4 5"
            strokeLinecap="round"
          />
        )}

        {/* 4. DYNAMIC GATEWAY ROUTER */}
        <g
          transform={`translate(${routerNode.x - 72}, ${routerNode.y - 42})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) =>
            handleNodePointerDown(e, "node-router", routerNode.x, routerNode.y)
          }
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(
                connectingCable.deviceId || connectingCable.switchId,
                "node-router"
              );
              setConnectingCable(null);
            }
          }}
        >
          <rect width="144" height="84" rx="24" fill="#5B3DF5" />
          <circle cx="72" cy="14" r="4.5" fill="#D7F25C" />
          <text x="72" y="44" textAnchor="middle" fill="#FFFFFF" fontSize="15.5" fontWeight="900">
            {routerDisplayName.length > 14
              ? routerDisplayName.slice(0, 14) + "…"
              : routerDisplayName}
          </text>
          <text
            x="72"
            y="65"
            textAnchor="middle"
            fill="#FFFFFF"
            opacity="0.82"
            fontSize="11.5"
            fontWeight="600"
            className="ltr-num"
          >
            {routerDisplayIp}
          </text>
        </g>

        {/* 5. DYNAMIC HUB PILLS */}
        {hubNodes.map((hub) => {
          const isWifi = hub.id === "hub-wifi";
          const isOffline = hub.id === "hub-offline";
          const count = countBranchDevices(hub.id);
          const portKey = (hub.uplinkHub || hub.name || "").toUpperCase();
          const theme = getPortColor(portKey);
          const bgFill = isWifi || isOffline ? "#FFFFFF" : hub.uplinkColor || theme.color;
          const textFill = isWifi
            ? "#5B3DF5"
            : isOffline
            ? "#6B6880"
            : theme.textColor;
          const subText = isOffline
            ? `${count} منقطع`
            : count === 0
            ? "فارغ"
            : count === 1
            ? "1 جهاز"
            : `${count} أجهزة`;
          const isDropHot = dropTargetHubId === hub.id;

          return (
            <g key={hub.id}>
              {isDropHot && (
                <circle
                  cx={hub.x}
                  cy={hub.y}
                  r="48"
                  fill="rgba(91,61,245,0.12)"
                  stroke="#5B3DF5"
                  strokeWidth="2.5"
                  strokeDasharray="4 4"
                  className="pointer-events-none animate-pulse"
                />
              )}
              <g
                transform={`translate(${hub.x - 62}, ${hub.y - 26})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handleNodePointerDown(e, hub.id, hub.x, hub.y)}
                onClick={() => {
                  if (connectingCable) {
                    onConnectCable?.(
                      connectingCable.deviceId || connectingCable.switchId,
                      hub.id
                    );
                    setConnectingCable(null);
                  }
                }}
              >
                <rect
                  width="124"
                  height="52"
                  rx="26"
                  fill={bgFill}
                  stroke={isWifi ? "#5B3DF5" : isOffline ? "#9A98AD" : undefined}
                  strokeWidth={isWifi ? "3" : isOffline ? "2.5" : undefined}
                  strokeDasharray={isOffline ? "6 6" : undefined}
                />
                <text
                  x="62"
                  y="27"
                  textAnchor="middle"
                  fill={textFill}
                  fontSize={isOffline ? "14" : "16"}
                  fontWeight="900"
                >
                  {hub.name}
                </text>
                <text
                  x="62"
                  y="43"
                  textAnchor="middle"
                  fill={isWifi ? "#6B6880" : textFill}
                  opacity={isWifi ? 1 : 0.85}
                  fontSize="11"
                  fontWeight="700"
                >
                  {subText}
                </text>
              </g>
            </g>
          );
        })}

        {/* 6. DYNAMIC SWITCHES & THEIR PORT-TRACED DEVICES */}
        {switches.map((sw) => {
          const swWidth = 24 + sw.ports * 11;
          const swX = sw.x - swWidth / 2;
          const swY = sw.y - 17;

          const isParentSwitch = Boolean(sw.parentId && sw.parentId.startsWith("switch-"));
          const parentSw = isParentSwitch ? switches.find((s) => s.id === sw.parentId) : null;

          let sourceAttachX = routerNode.x;
          let sourceAttachY = routerNode.y;
          let swAttachX = swX;
          let swAttachY = swY + 17;
          let cableColor = sw.uplinkColor || "#5B3DF5";

          if (parentSw) {
            cableColor = "#8B6CFF";
            const parentSwWidth = 24 + parentSw.ports * 11;
            const parentSwX = parentSw.x - parentSwWidth / 2;
            const parentSwY = parentSw.y - 17;
            const isChildLeft = sw.x < parentSw.x;

            if (typeof sw.portIndex === "number" && sw.portIndex > 0) {
              const pIdx = Math.min(sw.portIndex, parentSw.ports);
              sourceAttachX = parentSwX + 18 + (pIdx - 1) * 11;
              sourceAttachY = parentSwY + 26;
            } else {
              sourceAttachX = isChildLeft ? parentSwX : parentSwX + parentSwWidth;
              sourceAttachY = parentSwY + 17;
            }
            swAttachX = isChildLeft ? swX + swWidth : swX;
            swAttachY = swY + 17;
          } else {
            const parentNode =
              (sw.parentId && nodeById.get(sw.parentId)) ||
              hubNodes.find((h) => h.uplinkHub === sw.uplinkHub) ||
              routerNode;
            const isSwitchLeft = sw.x < parentNode.x;
            const halfW = parentNode.type === "router" ? 72 : 62;
            sourceAttachX = isSwitchLeft ? parentNode.x - halfW : parentNode.x + halfW;
            sourceAttachY = parentNode.y;
            swAttachX = isSwitchLeft ? swX + swWidth : swX;
            swAttachY = swY + 17;
            cableColor = sw.uplinkColor || getPortColor(sw.uplinkHub || "").color;
          }

          if (cableColor === "#D7F25C") cableColor = "#8FB000";
          const midX = (sourceAttachX + swAttachX) / 2;
          const isDraggingThis = activeDrag?.id === sw.id;

          return (
            <g key={sw.id}>
              <path
                d={`M ${sourceAttachX} ${sourceAttachY} C ${midX} ${sourceAttachY}, ${midX} ${swAttachY}, ${swAttachX} ${swAttachY}`}
                fill="none"
                stroke={cableColor}
                strokeWidth={parentSw ? "3.2" : "2.8"}
                strokeLinecap="round"
              />
              <circle cx={sourceAttachX} cy={sourceAttachY} r="3.5" fill={cableColor} />
              <circle cx={swAttachX} cy={swAttachY} r="3.5" fill={cableColor} />

              {sw.selected && !isDraggingThis && (
                <g
                  transform={`translate(${swX + swWidth / 2 - 80}, ${swY - 84})`}
                  className="transition-opacity pointer-events-none"
                >
                  <rect width="160" height="28" rx="14" fill="#14121F" />
                  <text x="80" y="18" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="800">
                    تسمية · نسخ · حذف
                  </text>
                </g>
              )}

              <g
                transform={`translate(${swX + swWidth / 2 - 74}, ${swY - 44})`}
                className="cursor-pointer"
                onClick={() => onSelectSwitch(sw)}
              >
                <rect
                  width="148"
                  height="30"
                  rx="9"
                  fill="#FFFFFF"
                  stroke="#EEF0F5"
                  strokeWidth="1.8"
                />
                <text x="74" y="14" textAnchor="middle" fill="#14121F" fontSize="10.5" fontWeight="900">
                  {sw.name.length > 22 ? sw.name.slice(0, 22) + "…" : sw.name}
                </text>
                <text x="74" y="24" textAnchor="middle" fill="#6B6880" fontSize="8.5" fontWeight="700">
                  {sw.ports} منافذ · {sw.uplinkHub}
                </text>
              </g>

              {sw.selected && (
                <g className="pointer-events-none">
                  <rect
                    x={swX - 6}
                    y={swY - 6}
                    width={swWidth + 12}
                    height={34 + 12}
                    rx="12"
                    fill="none"
                    stroke={cableColor}
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                  <rect x={swX - 10} y={swY - 10} width="8" height="8" fill="#FFFFFF" stroke={cableColor} strokeWidth="2" rx="2" />
                  <rect x={swX + swWidth + 2} y={swY - 10} width="8" height="8" fill="#FFFFFF" stroke={cableColor} strokeWidth="2" rx="2" />
                  <rect x={swX - 10} y={swY + 34 + 2} width="8" height="8" fill="#FFFFFF" stroke={cableColor} strokeWidth="2" rx="2" />
                  <rect x={swX + swWidth + 2} y={swY + 34 + 2} width="8" height="8" fill="#FFFFFF" stroke={cableColor} strokeWidth="2" rx="2" />
                </g>
              )}

              <g
                transform={`translate(${swX}, ${swY})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handleSwitchPointerDown(e, sw)}
              >
                <rect width={swWidth} height="34" rx="10" fill="#272B52" />
                <circle cx="8" cy="17" r="2.5" fill="#34D399" />
                {Array.from({ length: sw.ports }).map((_, i) => {
                  const portNumber = i + 1;
                  const assignedDev = sw.devices.find((d) => d.portIndex === portNumber);
                  const isOccupied = Boolean(assignedDev);
                  const ledColor = i === 0 ? "#8B6CFF" : isOccupied ? "#34D399" : "#4A507E";
                  const portPinX = swX + 19 + i * 11;
                  const portPinY = swY + 26;
                  const isPortHovered =
                    hoveredPort?.switchId === sw.id && hoveredPort?.portNumber === portNumber;
                  const isConnectingSource =
                    connectingCable?.sourceType === "port" &&
                    connectingCable.switchId === sw.id &&
                    connectingCable.portIndex === portNumber;

                  return (
                    <g
                      key={i}
                      className="cursor-pointer"
                      onPointerEnter={() => setHoveredPort({ switchId: sw.id, portNumber })}
                      onPointerLeave={() => setHoveredPort(null)}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const coords = getSvgCoordinates(e.clientX, e.clientY);
                        setConnectingCable({
                          sourceType: "port",
                          switchId: sw.id,
                          portIndex: portNumber,
                          startX: portPinX,
                          startY: portPinY,
                          currentX: coords.x,
                          currentY: coords.y,
                          pointerId: e.pointerId,
                        });
                        if (svgRef.current) {
                          try {
                            svgRef.current.setPointerCapture(e.pointerId);
                          } catch {}
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          connectingCable &&
                          connectingCable.sourceType === "device" &&
                          connectingCable.deviceId
                        ) {
                          onConnectCable?.(sw.id, connectingCable.deviceId, portNumber);
                          setConnectingCable(null);
                        }
                      }}
                    >
                      <title>
                        {i === 0
                          ? "Uplink"
                          : `منفذ #${portNumber}: ${
                              assignedDev
                                ? `${assignedDev.name} (${assignedDev.ip || ""}) - اسحب لإعادة التوصيل`
                                : "فارغ (انقر أو اسحب للربط بجهاز)"
                            }`}
                      </title>
                      <circle
                        cx={19 + i * 11}
                        cy="8"
                        r={isPortHovered || isConnectingSource ? "3" : "2"}
                        fill={isConnectingSource ? "#D7F25C" : ledColor}
                      />
                      <rect
                        x={15.5 + i * 11}
                        y="15"
                        width="7"
                        height="11"
                        rx="3"
                        fill={isOccupied ? "#1a2256" : "#12153A"}
                        stroke={
                          isPortHovered || isConnectingSource
                            ? "#D7F25C"
                            : isOccupied
                            ? "#34D399"
                            : "none"
                        }
                        strokeWidth={isPortHovered || isConnectingSource ? "1.8" : "1"}
                      />
                      {(isPortHovered || isConnectingSource) && (
                        <rect
                          x={13.5 + i * 11}
                          y="13"
                          width="11"
                          height="15"
                          rx="4"
                          fill="none"
                          stroke="#D7F25C"
                          strokeWidth="1.5"
                          strokeDasharray="2 2"
                        />
                      )}
                    </g>
                  );
                })}
              </g>

              {sw.devices.map((dev) => {
                const isSelected = selectedDeviceId === dev.id || dev.selected;
                const isAssigned = typeof dev.portIndex === "number" && dev.portIndex > 0;
                const devPort = isAssigned ? Math.min(dev.portIndex!, sw.ports) : 0;
                const portPinX = swX + 18 + (devPort > 0 ? devPort - 1 : 0) * 11;
                const portPinY = swY + 26;
                const devCableColor = isSelected ? "#FF7A45" : cableColor;
                const dyDist = Math.max(25, Math.abs(dev.y - portPinY) * 0.45);

                return (
                  <g key={dev.id}>
                    {isAssigned && (
                      <g className="group/cable">
                        <path
                          d={`M ${portPinX} ${portPinY} C ${portPinX} ${
                            portPinY + dyDist
                          }, ${dev.x} ${dev.y - dyDist}, ${dev.x} ${dev.y}`}
                          fill="none"
                          stroke={devCableColor}
                          strokeWidth={isSelected ? "3" : "2.2"}
                          strokeLinecap="round"
                        />
                        <circle cx={dev.x} cy={dev.y} r="2.5" fill={devCableColor} />

                        {(isSelected || tool === "cable") && (
                          <g
                            transform={`translate(${dev.x - 12}, ${(portPinY + dev.y) / 2 - 10})`}
                            className="cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDisconnectCable?.(dev.id);
                            }}
                          >
                            <title>فصل الكابل عن هذا الجهاز</title>
                            <rect
                              width="24"
                              height="20"
                              rx="6"
                              fill="#14121F"
                              stroke="#FF7A45"
                              strokeWidth="1.5"
                            />
                            <text x="12" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">
                              ✂️
                            </text>
                          </g>
                        )}
                      </g>
                    )}

                    {!isAssigned && (
                      <g transform={`translate(${dev.x - 22}, ${dev.y - 18})`}>
                        <rect
                          width="44"
                          height="15"
                          rx="7.5"
                          fill="#FFF4D5"
                          stroke="#E2B120"
                          strokeWidth="1"
                          strokeDasharray="2 2"
                        />
                        <text x="22" y="11" textAnchor="middle" fill="#8C6B00" fontSize="8" fontWeight="800">
                          غير معين
                        </text>
                      </g>
                    )}

                    {dev.cableQuality !== undefined && isAssigned && (
                      <g transform={`translate(${dev.x - 16}, ${dev.y - 28})`}>
                        <title>{`جودة الكابل: ${dev.cableQuality}%`}</title>
                        <rect
                          width="32"
                          height="16"
                          rx="8"
                          fill={isSelected ? "#FF7A45" : "#FFFFFF"}
                          stroke={isSelected ? "#FF7A45" : "#EEF0F5"}
                          strokeWidth="1.2"
                        />
                        <text
                          x="16"
                          y="11.5"
                          textAnchor="middle"
                          fill={isSelected ? "#FFFFFF" : "#14121F"}
                          fontSize="9.5"
                          fontWeight="900"
                          className="ltr-num"
                        >
                          {dev.cableQuality}%
                        </text>
                      </g>
                    )}

                    <g
                      transform={`translate(${dev.x - 18}, ${dev.y})`}
                      className={
                        tool === "cable" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
                      }
                      onPointerEnter={() => setHoveredDeviceId(dev.id)}
                      onPointerLeave={() => setHoveredDeviceId(null)}
                      onPointerDown={(e) => handleDevicePointerDown(e, sw, dev)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          connectingCable &&
                          connectingCable.sourceType === "port" &&
                          connectingCable.portIndex
                        ) {
                          onConnectCable?.(
                            connectingCable.switchId,
                            dev.id,
                            connectingCable.portIndex
                          );
                          setConnectingCable(null);
                          return;
                        }
                        onSelectDevice(dev.id, sw.id);
                      }}
                    >
                      <title>{`${dev.name} (${dev.ip || "-"} · ${dev.mac || ""})`}</title>
                      {connectingCable && hoveredDeviceId === dev.id && (
                        <rect
                          x="-8"
                          y="-8"
                          width="52"
                          height="52"
                          rx="14"
                          fill="none"
                          stroke="#34D399"
                          strokeWidth="3"
                          strokeDasharray="4 3"
                          className="animate-pulse"
                        />
                      )}
                      {isSelected && (
                        <rect
                          x="-4"
                          y="-4"
                          width="44"
                          height="44"
                          rx="10"
                          fill="none"
                          stroke="#FF7A45"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                      )}
                      {renderDeviceGlyph(dev.type, devCableColor, Boolean(isSelected), false)}
                      <text
                        x="18"
                        y="36"
                        textAnchor="middle"
                        fill={isSelected ? "#FF7A45" : "#14121F"}
                        fontSize="9.5"
                        fontWeight={isSelected ? "900" : "800"}
                      >
                        {dev.name.length > 9 ? dev.name.slice(0, 9) + "…" : dev.name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 6.5 PEER / CASCADED CHILD DEVICES (e.g. phones behind an AP/Router) */}
        {peerChildDevices.map((dev) => {
          const parentNode = nodeById.get(dev.parentId || "");
          const isSelected = selectedDeviceId === dev.id || dev.selected;
          const devCableColor = isSelected ? "#FF7A45" : "#8B6CFF";
          const pX = parentNode ? parentNode.x : dev.x;
          const pY = parentNode ? parentNode.y + 24 : dev.y - 40;
          const cX = dev.x;
          const cY = dev.y;
          const midY = (pY + cY) / 2;

          return (
            <g key={dev.id}>
              {parentNode && (
                <g>
                  <path
                    d={`M ${pX} ${pY} C ${pX} ${midY}, ${cX} ${midY}, ${cX} ${cY}`}
                    fill="none"
                    stroke={devCableColor}
                    strokeWidth={isSelected ? "2.8" : "2"}
                    strokeDasharray="4 3"
                    strokeLinecap="round"
                  />
                  <circle cx={pX} cy={pY} r="2.5" fill={devCableColor} />
                  <circle cx={cX} cy={cY} r="2.5" fill={devCableColor} />

                  {(isSelected || tool === "cable") && (
                    <g
                      transform={`translate(${cX - 12}, ${midY - 10})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDisconnectCable?.(dev.id);
                      }}
                    >
                      <title>فصل الجهاز عن {parentNode.name}</title>
                      <rect
                        width="24"
                        height="20"
                        rx="6"
                        fill="#14121F"
                        stroke="#FF7A45"
                        strokeWidth="1.2"
                      />
                      <text x="12" y="14" textAnchor="middle" fill="#FF7A45" fontSize="11" fontWeight="bold">
                        ✂
                      </text>
                    </g>
                  )}
                </g>
              )}

              <g
                transform={`translate(${dev.x - 18}, ${dev.y})`}
                className={tool === "cable" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
                onPointerDown={(e) =>
                  handleNodePointerDown(e, dev.id, dev.x, dev.y, true, dev.parentId)
                }
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(dev.id, dev.parentId);
                  if (connectingCable && connectingCable.deviceId && connectingCable.deviceId !== dev.id) {
                    onConnectCable?.(connectingCable.deviceId, dev.id);
                    setConnectingCable(null);
                  }
                }}
              >
                <title>{`${dev.name} (${dev.ip || "Wi-Fi"}) · ${parentNode?.name || ""}`}</title>
                {isSelected && (
                  <rect
                    x="-4"
                    y="-4"
                    width="44"
                    height="44"
                    rx="10"
                    fill="none"
                    stroke="#FF7A45"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}
                {renderDeviceGlyph(dev.subType, devCableColor, Boolean(isSelected), false)}
                <text
                  x="18"
                  y="36"
                  textAnchor="middle"
                  fill={isSelected ? "#FF7A45" : "#14121F"}
                  fontSize="9.5"
                  fontWeight={isSelected ? "900" : "800"}
                >
                  {dev.name.length > 9 ? dev.name.slice(0, 9) + "…" : dev.name}
                </text>
              </g>
            </g>
          );
        })}

        {/* 7. DYNAMIC WI-FI ACCESS POINT & ALL WI-FI CLIENTS */}
        {wifiHubNode &&
          (() => {
            const dir = wifiHubNode.x < routerNode.x ? -1 : 1;
            const apX = wifiHubNode.x + dir * 135;
            const apY = wifiHubNode.y;
            const hubEdgeX = wifiHubNode.x + dir * 62;
            const apEdgeX = apX - dir * 24;

            return (
              <g>
                <line
                  x1={hubEdgeX}
                  y1={apY}
                  x2={apEdgeX}
                  y2={apY}
                  stroke="#5B3DF5"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <text x={apX} y={apY - 32} textAnchor="middle" fill="#6B6880" fontSize="11" fontWeight="800">
                  {wifiPhoneNodes.length} أجهزة ويفي
                </text>

                <g
                  transform={`translate(${apX - 24}, ${apY - 24})`}
                  className="cursor-pointer"
                  onClick={() => {
                    if (connectingCable) {
                      onConnectCable?.(
                        connectingCable.deviceId || connectingCable.switchId,
                        "hub-wifi"
                      );
                      setConnectingCable(null);
                    }
                  }}
                >
                  <rect width="48" height="48" rx="14" fill="#5B3DF5" />
                  <circle cx="24" cy="34" r="2.8" fill="#FFFFFF" />
                  <path
                    d="M16 26 A11 11 0 0 1 32 26"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M10 19 A19 19 0 0 1 38 19"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                  />
                </g>

                {wifiPhoneNodes.length === 0 ? (
                  <text x={apX} y={apY + 45} textAnchor="middle" fill="#9A98AD" fontSize="11" fontWeight="700">
                    لا توجد أجهزة ويفي متصلة حالياً
                  </text>
                ) : (
                  wifiPhoneNodes.map((phone) => {
                    const isSelected = selectedDeviceId === phone.id || phone.selected;
                    const strokeColor = isSelected ? "#FF7A45" : "#5B3DF5";
                    return (
                      <g key={phone.id}>
                        <path
                          d={`M ${apX} ${apY + 24} C ${apX} ${(apY + 24 + phone.y) / 2}, ${
                            phone.x
                          } ${(apY + 24 + phone.y) / 2}, ${phone.x} ${phone.y}`}
                          fill="none"
                          stroke={strokeColor}
                          strokeWidth={isSelected ? "2.4" : "1.8"}
                          strokeDasharray="3 3"
                        />
                        <g
                          transform={`translate(${phone.x - 10}, ${phone.y}) scale(0.9)`}
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) =>
                            handleNodePointerDown(e, phone.id, phone.x, phone.y, true, "hub-wifi")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (connectingCable) {
                              onConnectCable?.(
                                connectingCable.deviceId || connectingCable.switchId,
                                phone.id
                              );
                              setConnectingCable(null);
                              return;
                            }
                            onSelectDevice(phone.id, "hub-wifi");
                          }}
                        >
                          {isSelected && (
                            <rect
                              x="-4"
                              y="-4"
                              width="28"
                              height="40"
                              rx="8"
                              fill="none"
                              stroke="#FF7A45"
                              strokeWidth="2"
                              strokeDasharray="3 3"
                            />
                          )}
                          <rect
                            width="20"
                            height="32"
                            rx="6"
                            fill={isSelected ? "#FFEDE5" : "#FFFFFF"}
                            stroke={strokeColor}
                            strokeWidth="2.5"
                          />
                          <circle cx="10" cy="25" r="2" fill={strokeColor} />
                          <title>
                            {`${phone.name} (${phone.ip || "Wi-Fi"} · ${phone.mac || ""}${
                              phone.band ? ` · ${phone.band}` : ""
                            })`}
                          </title>
                        </g>
                        <text
                          x={phone.x}
                          y={phone.y + 39}
                          textAnchor="middle"
                          fill={isSelected ? "#FF7A45" : "#14121F"}
                          fontSize="9"
                          fontWeight="800"
                          className="pointer-events-none select-none"
                        >
                          {phone.name.length > 8 ? phone.name.slice(0, 8) + "…" : phone.name}
                        </text>
                      </g>
                    );
                  })
                )}
              </g>
            );
          })()}

        {/* 8. DIRECT-TO-HUB, DIRECT-TO-ROUTER, OFFLINE & UNASSIGNED DEVICES */}
        {directAndOfflineDevices.map((dev) => {
          const parentNode = dev.parentId ? nodeById.get(dev.parentId) : undefined;
          const isOffline = dev.parentId === "hub-offline" || dev.online === false;
          const isSelected = selectedDeviceId === dev.id || dev.selected;
          const baseColor = isOffline
            ? "#9A98AD"
            : parentNode?.uplinkColor === "#D7F25C"
            ? "#8FB000"
            : parentNode?.uplinkColor || "#5B3DF5";
          const strokeColor = isSelected ? "#FF7A45" : baseColor;

          let pX = dev.x;
          let pY = dev.y - 30;
          let dAttachX = dev.x;
          let dAttachY = dev.y - 12;

          if (parentNode) {
            if (parentNode.id === "hub-offline" || parentNode.id === "node-router") {
              pX = parentNode.x;
              pY = parentNode.y + (parentNode.id === "node-router" ? 42 : 26);
              dAttachX = dev.x;
              dAttachY = dev.y - 14;
            } else {
              const isDevLeft = dev.x < parentNode.x;
              pX = parentNode.x + (isDevLeft ? -62 : 62);
              pY = parentNode.y;
              dAttachX = dev.x + (isDevLeft ? 20 : -20);
              dAttachY = dev.y;
            }
          }
          const midX = (pX + dAttachX) / 2;

          return (
            <g key={dev.id}>
              {parentNode && (
                <g>
                  <path
                    d={
                      parentNode.id === "hub-offline" || parentNode.id === "node-router"
                        ? `M ${pX} ${pY} C ${pX} ${(pY + dAttachY) / 2}, ${dAttachX} ${
                            (pY + dAttachY) / 2
                          }, ${dAttachX} ${dAttachY}`
                        : `M ${pX} ${pY} C ${midX} ${pY}, ${midX} ${dAttachY}, ${dAttachX} ${dAttachY}`
                    }
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isSelected ? "2.8" : "2.2"}
                    strokeDasharray={isOffline ? "4 4" : undefined}
                    strokeLinecap="round"
                  />
                  <circle cx={pX} cy={pY} r="3" fill={strokeColor} />
                  <circle cx={dAttachX} cy={dAttachY} r="3" fill={strokeColor} />
                </g>
              )}

              {!isOffline && dev.cableQuality !== undefined && (
                <g transform={`translate(${dev.x - 16}, ${dev.y - 32})`}>
                  <rect
                    width="32"
                    height="15"
                    rx="7.5"
                    fill="#FFFFFF"
                    stroke="#EEF0F5"
                    strokeWidth="1.2"
                  />
                  <text
                    x="16"
                    y="10.5"
                    textAnchor="middle"
                    fill="#14121F"
                    fontSize="9"
                    fontWeight="900"
                    className="ltr-num"
                  >
                    {dev.cableQuality}%
                  </text>
                </g>
              )}

              <g
                transform={`translate(${dev.x - 18}, ${dev.y - 13})`}
                className={tool === "cable" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
                onPointerDown={(e) =>
                  handleNodePointerDown(e, dev.id, dev.x, dev.y, true, dev.parentId)
                }
                onClick={(e) => {
                  e.stopPropagation();
                  if (connectingCable) {
                    onConnectCable?.(
                      connectingCable.deviceId || connectingCable.switchId,
                      dev.id
                    );
                    setConnectingCable(null);
                    return;
                  }
                  onSelectDevice(dev.id, dev.parentId);
                }}
              >
                <title>{`${dev.name} (${dev.ip || "-"} · ${dev.mac || ""})`}</title>
                {isSelected && (
                  <rect
                    x="-4"
                    y="-4"
                    width="44"
                    height="44"
                    rx="10"
                    fill="none"
                    stroke="#FF7A45"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                )}
                {renderDeviceGlyph(dev.subType, strokeColor, Boolean(isSelected), isOffline)}
                <text
                  x="18"
                  y="39"
                  textAnchor="middle"
                  fill={isOffline ? "#6B6880" : isSelected ? "#FF7A45" : "#14121F"}
                  fontSize="10"
                  fontWeight="800"
                >
                  {dev.name.length > 13 ? dev.name.slice(0, 13) + "…" : dev.name}
                </text>
                {dev.ip && (
                  <text
                    x="18"
                    y="50"
                    textAnchor="middle"
                    fill="#9A98AD"
                    fontSize="8"
                    fontWeight="600"
                    className="ltr-num"
                  >
                    {dev.ip}
                  </text>
                )}
              </g>
            </g>
          );
        })}

        {/* 9. ACTIVE CONNECTING CABLE */}
        {connectingCable && (
          <g className="pointer-events-none">
            <path
              d={`M ${connectingCable.startX} ${connectingCable.startY} C ${
                connectingCable.startX
              } ${
                connectingCable.startY +
                Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${
                connectingCable.currentY -
                Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${connectingCable.currentY}`}
              fill="none"
              stroke="rgba(215, 242, 92, 0.45)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <path
              d={`M ${connectingCable.startX} ${connectingCable.startY} C ${
                connectingCable.startX
              } ${
                connectingCable.startY +
                Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${
                connectingCable.currentY -
                Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${connectingCable.currentY}`}
              fill="none"
              stroke="#D7F25C"
              strokeWidth="3.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            <circle
              cx={connectingCable.startX}
              cy={connectingCable.startY}
              r="4.5"
              fill="#5B3DF5"
              stroke="#FFFFFF"
              strokeWidth="2"
            />
            <circle
              cx={connectingCable.currentX}
              cy={connectingCable.currentY}
              r="7"
              fill="#D7F25C"
              stroke="#14121F"
              strokeWidth="2.5"
            />
            <circle cx={connectingCable.currentX} cy={connectingCable.currentY} r="2.5" fill="#14121F" />
          </g>
        )}
      </svg>

      {/* SVG Footer Legend & Live Router Status */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3.5 bg-[#F8F8FC] border-t border-[#EEF0F5] text-[12px] font-[700] text-[#6B6880]">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
            <span>منفذ مستعمل (معين)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4A507E]" />
            <span>منفذ فارغ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8B6CFF]" />
            <span>Uplink</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-white border border-[#EEF0F5] text-[10px] font-[900] text-[#14121F]">
              100%
            </span>
            <span>جودة الكابل (Ping Loss 0%)</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {telemetry?.isRouterOnline ? (
            <span className="flex items-center gap-1.5 text-[#22C55E] font-[800]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              متصل بالروتر حياً ({routerDisplayName})
              {telemetry.lastUpdated ? (
                <span className="text-[#6B6880] font-[600]">· {telemetry.lastUpdated}</span>
              ) : (
                ""
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#FF7A45] font-[800]">
              <span className="w-2 h-2 rounded-full bg-[#FF7A45]" />
              غير متصل بالروتر ({routerDisplayName})
              {telemetry?.lastUpdated ? (
                <span className="text-[#6B6880] font-[600]">· آخر فحص: {telemetry.lastUpdated}</span>
              ) : (
                ""
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
