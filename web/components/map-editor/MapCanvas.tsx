"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MapDevice,
  MapSwitch,
  MapNode,
  PaletteItem,
} from "@/lib/map-data";
import { EditorTool } from "./Toolbar";

export interface MapTelemetry {
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
  nodes,
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
  selectedDeviceId = "dev-abdelmnan",
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
  const [isDropTargetLAN4, setIsDropTargetLAN4] = useState(false);

  // Convert client coordinates to SVG viewBox coords using inverse CTM matrix
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
    const x = ((clientX - rect.left) / rect.width) * 1100 + panOffset.x;
    const y = ((clientY - rect.top) / rect.height) * 600 + panOffset.y;
    return { x: Math.round(x), y: Math.round(y) };
  };

  // Pointer drag for switches on SVG (Group drag: switch + all connected devices)
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

  // Pointer drag for individual devices on SVG
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

  // Pointer drag for arbitrary nodes (Router, Hubs, WAN, LAN3/4 devices, Wi-Fi phones)
  const handleNodePointerDown = (e: React.PointerEvent, nodeId: string, currentX: number, currentY: number) => {
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

  // Pointer drag on background for pan tool or clicking empty space
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (connectingCable) {
      setConnectingCable(null);
      return;
    }
    // Any click on the canvas background (left click, middle click) starts free panning
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
    // Normal wheel pans canvas vertically; Shift+wheel pans horizontally
    setPanOffset((prev) => ({
      x: Math.round(prev.x + (e.shiftKey ? e.deltaY : e.deltaX)),
      y: Math.round(prev.y + (e.shiftKey ? 0 : e.deltaY)),
    }));
  };

  // Global window listeners for drag & drop stability with pointer capture
  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      if (connectingCable) {
        const coords = getSvgCoordinates(e.clientX, e.clientY);
        setConnectingCable((prev) => (prev ? { ...prev, currentX: coords.x, currentY: coords.y } : null));
        return;
      }
      if (!activeDrag) return;

      if (activeDrag.type === "pan") {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const effectiveZoom = zoom || 1;
        const dx = ((e.clientX - activeDrag.startSvgX) / rect.width) * (1100 / effectiveZoom);
        const dy = ((e.clientY - activeDrag.startSvgY) / rect.height) * (600 / effectiveZoom);
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
      } else if (activeDrag.type === "device" && activeDrag.id && activeDrag.switchId && onUpdateDevicePos) {
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

        // 1. Check if dropped near any switch port
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

        // 2. Check if dropped near any switch body/uplink (cascading / daisy chain)
        let targetSwitchUplink: string | null = null;
        for (const sw of switches) {
          if (sw.id === sourceEntityId) continue;
          const swWidth = 24 + sw.ports * 11;
          const swLeft = sw.x - swWidth / 2 - 15;
          const swRight = sw.x + swWidth / 2 + 15;
          const swTop = sw.y - 30;
          const swBottom = sw.y + 40;
          if (coords.x >= swLeft && coords.x <= swRight && coords.y >= swTop && coords.y <= swBottom) {
            targetSwitchUplink = sw.id;
            break;
          }
        }
        if (targetSwitchUplink) {
          onConnectCable?.(sourceEntityId, targetSwitchUplink, connectingCable.portIndex);
          setConnectingCable(null);
          return;
        }

        // 3. Check if dropped near any node (device, hub, router)
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

        const dragDist = Math.hypot(coords.x - connectingCable.startX, coords.y - connectingCable.startY);
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
        if (activeDrag.type === "switch" || activeDrag.type === "device" || activeDrag.type === "node") {
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
  }, [activeDrag, connectingCable, switches, onUpdateSwitchPos, onUpdateDevicePos, onDragEnd, onConnectCable, panOffset]);

  // HTML5 Drag & Drop from Palette to SVG canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    const coords = getSvgCoordinates(e.clientX, e.clientY);
    const inLan4 = coords.x >= 880 && coords.x <= 1085 && coords.y >= 380 && coords.y <= 530;
    setIsDropTargetLAN4(inLan4);
  };

  const handleDragLeave = () => {
    setIsDropTargetLAN4(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTargetLAN4(false);
    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;
      const item: PaletteItem = JSON.parse(dataStr);
      const coords = getSvgCoordinates(e.clientX, e.clientY);
      const snapX = Math.round(coords.x / 10) * 10;
      const snapY = Math.round(coords.y / 10) * 10;
      const inLan4 = coords.x >= 880 && coords.x <= 1085 && coords.y >= 380 && coords.y <= 530;
      onDropNewItem(item, snapX, snapY, inLan4 ? "LAN4" : undefined);
    } catch {
      // ignore invalid drag data
    }
  };

  const wanPos = nodes?.find((n) => n.id === "node-wan") || { x: 550, y: 40 };
  const routerPos = nodes?.find((n) => n.id === "node-router") || { x: 550, y: 270 };
  const lan1Pos = nodes?.find((n) => n.id === "hub-lan1") || { x: 335, y: 130 };
  const lan2Pos = nodes?.find((n) => n.id === "hub-lan2") || { x: 335, y: 425 };
  const wifiPos = nodes?.find((n) => n.id === "hub-wifi") || { x: 790, y: 95 };
  const lan3Pos = nodes?.find((n) => n.id === "hub-lan3") || { x: 805, y: 285 };
  const lan4Pos = nodes?.find((n) => n.id === "hub-lan4") || { x: 805, y: 455 };

  const lan3Dev = nodes?.find((n) => n.id === "dev-lan3" || (n.parentId === "hub-lan3" && n.type === "device"));
  const lan4Dev = nodes?.find((n) => n.id === "dev-lan4" || (n.parentId === "hub-lan4" && n.type === "device"));
  const wifiPhoneNodes = nodes?.filter((n) => n.parentId === "hub-wifi" && n.type === "device") || [];

  const lan1Count = switches.find((s) => s.uplinkHub === "LAN1")?.devices.length ?? 0;
  const lan2Count = switches.find((s) => s.uplinkHub === "LAN2")?.devices.length ?? 0;

  const effectiveZoom = zoom || 1;
  const viewWidth = Math.round(1260 / effectiveZoom);
  const viewHeight = Math.round(700 / effectiveZoom);
  const viewX = Math.round(panOffset.x + 515 - viewWidth / 2);
  const viewY = Math.round(panOffset.y + 325 - viewHeight / 2);

  return (
    <div
      className="relative w-full overflow-hidden bg-white rounded-b-[24px] min-h-[640px] h-[72vh] max-h-[850px]"
    >
      {/* Floating Instruction Banner for Cable Connection Tool */}
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

      {/* Floating Center View Button */}
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
          {/* Dotted grid pattern: 24px, dot r=1.4 */}
          <pattern
            id="dotted-grid"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="12" cy="12" r="1.4" fill="#DAD8E8" />
          </pattern>
        </defs>

        {/* 1. Boundless Canvas Background with dotted pattern */}
        <rect x={panOffset.x - 6000} y={panOffset.y - 6000} width={13000} height={13000} fill="#F8F8FC" />
        <rect x={panOffset.x - 6000} y={panOffset.y - 6000} width={13000} height={13000} fill="url(#dotted-grid)" />

        {/* ======================================================== */}
        {/* 2. INTERNET PILL & DOWNWARD CABLE TO ROUTER              */}
        {/* ======================================================== */}
        {(() => {
          const wanBottomY = wanPos.y + 22;
          const routerTopY = routerPos.y - 42;
          const midX = (wanPos.x + routerPos.x) / 2;
          const midY = (wanBottomY + routerTopY) / 2;

          return (
            <g>
              <line
                x1={wanPos.x}
                y1={wanBottomY}
                x2={routerPos.x}
                y2={routerTopY}
                stroke="#5B3DF5"
                strokeWidth="6"
                opacity="0.12"
                strokeLinecap="round"
              />
              <line
                x1={wanPos.x}
                y1={wanBottomY}
                x2={routerPos.x}
                y2={routerTopY}
                stroke="#14121F"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              {/* Midpoint Pill: Real WAN Throughput */}
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect width="92" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.5" fill="#34D399" />
                <text x="50" y="16" textAnchor="middle" fill="#14121F" fontSize="11.5" fontWeight="900" className="ltr-num">
                  {telemetry?.totalDl ?? "0.0"} Mbps
                </text>
              </g>

              {/* Internet pill: Real WAN Ping (Draggable) */}
              <g
                transform={`translate(${wanPos.x - 105}, ${wanPos.y - 22})`}
                className="cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => handleNodePointerDown(e, "node-wan", wanPos.x, wanPos.y)}
                onClick={() => {
                  if (connectingCable) {
                    onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "node-wan");
                    setConnectingCable(null);
                  }
                }}
              >
                <rect width="210" height="44" rx="22" fill="#14121F" />
                <circle cx="28" cy="22" r="10" fill="none" stroke="#D7F25C" strokeWidth="2" />
                <ellipse cx="28" cy="22" rx="4.5" ry="10" fill="none" stroke="#D7F25C" strokeWidth="1.5" />
                <line x1="18" y1="22" x2="38" y2="22" stroke="#D7F25C" strokeWidth="1.5" />
                <text x="118" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800">
                  الإنترنت {telemetry?.internetPing !== null && telemetry?.internetPing !== undefined ? `· ${telemetry.internetPing} ms` : "· متصل"}
                </text>
              </g>
            </g>
          );
        })()}

        {/* ======================================================== */}
        {/* 3. ROUTER → HUB CABLES & SPEED PILLS (REAL TELEMETRY)    */}
        {/* ======================================================== */}

        {/* Line to LAN1 */}
        {(() => {
          const rX = routerPos.x - 72;
          const rY = routerPos.y - 15;
          const hX = lan1Pos.x + 62;
          const hY = lan1Pos.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          return (
            <g>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke="#5B3DF5"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3.5" fill="#5B3DF5" />
              <circle cx={hX} cy={hY} r="3.5" fill="#5B3DF5" />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect width="92" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.5" fill="#5B3DF5" />
                <text x="50" y="16" textAnchor="middle" fill="#5B3DF5" fontSize="11.5" fontWeight="900" className="ltr-num">
                  {telemetry?.lanRates?.LAN1?.rx ?? 0} Mbps
                </text>
              </g>
            </g>
          );
        })()}

        {/* Line to LAN2 */}
        {(() => {
          const rX = routerPos.x - 72;
          const rY = routerPos.y + 15;
          const hX = lan2Pos.x + 62;
          const hY = lan2Pos.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          return (
            <g>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke="#FF7A45"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3.5" fill="#FF7A45" />
              <circle cx={hX} cy={hY} r="3.5" fill="#FF7A45" />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect width="92" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2.5" fill="#FF7A45" />
                <text x="50" y="16" textAnchor="middle" fill="#FF7A45" fontSize="11.5" fontWeight="900" className="ltr-num">
                  {telemetry?.lanRates?.LAN2?.rx ?? 0} Mbps
                </text>
              </g>
            </g>
          );
        })()}

        {/* Line to Wi-Fi */}
        {(() => {
          const rX = routerPos.x + 72;
          const rY = routerPos.y - 25;
          const hX = wifiPos.x - 62;
          const hY = wifiPos.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          return (
            <g>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke="#5B3DF5"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3" fill="#5B3DF5" />
              <circle cx={hX} cy={hY} r="3" fill="#5B3DF5" />
              <g transform={`translate(${midX - 51}, ${midY - 12})`}>
                <rect width="102" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <text x="51" y="16" textAnchor="middle" fill="#5B3DF5" fontSize="11" fontWeight="800">
                  Wi-Fi {telemetry?.wifiCount ?? telemetry?.wifiClients?.length ?? 0} أجهزة
                </text>
              </g>
            </g>
          );
        })()}

        {/* Line to LAN3 */}
        {(() => {
          const rX = routerPos.x + 72;
          const rY = routerPos.y;
          const hX = lan3Pos.x - 62;
          const hY = lan3Pos.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          return (
            <g>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke="#B7D633"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3.5" fill="#8FB000" />
              <circle cx={hX} cy={hY} r="3.5" fill="#8FB000" />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect width="92" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <text x="46" y="16" textAnchor="middle" fill="#2F6B0F" fontSize="11.5" fontWeight="900" className="ltr-num">
                  {telemetry?.lanRates?.LAN3?.rx ?? 0} Mbps
                </text>
              </g>
            </g>
          );
        })()}

        {/* Line to LAN4 */}
        {(() => {
          const rX = routerPos.x + 72;
          const rY = routerPos.y + 25;
          const hX = lan4Pos.x - 62;
          const hY = lan4Pos.y;
          const midX = (rX + hX) / 2;
          const midY = (rY + hY) / 2;
          return (
            <g>
              <path
                d={`M ${rX} ${rY} C ${midX} ${rY}, ${midX} ${hY}, ${hX} ${hY}`}
                fill="none"
                stroke="#272B52"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx={rX} cy={rY} r="3" fill="#272B52" />
              <circle cx={hX} cy={hY} r="3" fill="#272B52" />
              <g transform={`translate(${midX - 46}, ${midY - 12})`}>
                <rect width="92" height="24" rx="12" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.5" />
                <text x="46" y="16" textAnchor="middle" fill="#6B6880" fontSize="11.5" fontWeight="900" className="ltr-num">
                  {telemetry?.lanRates?.LAN4?.rx ?? 0} Mbps
                </text>
              </g>
            </g>
          );
        })()}

        {/* Line to Disconnected Hub */}
        <line
          x1={routerPos.x}
          y1={routerPos.y + 42}
          x2={550}
          y2={429}
          stroke="#9A98AD"
          strokeWidth="2"
          strokeDasharray="4 5"
          strokeLinecap="round"
        />

        {/* ======================================================== */}
        {/* 4. MAIN GATEWAY ROUTER: ZTE F680 (Draggable)             */}
        {/* ======================================================== */}
        <g
          transform={`translate(${routerPos.x - 72}, ${routerPos.y - 42})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "node-router", routerPos.x, routerPos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "node-router");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="144" height="84" rx="24" fill="#5B3DF5" />
          <circle cx="72" cy="14" r="4.5" fill="#D7F25C" />
          <text x="72" y="44" textAnchor="middle" fill="#FFFFFF" fontSize="17" fontWeight="900">
            ZTE F680
          </text>
          <text x="72" y="65" textAnchor="middle" fill="#FFFFFF" opacity="0.8" fontSize="12" fontWeight="600" className="ltr-num">
            192.168.1.1
          </text>
        </g>

        {/* ======================================================== */}
        {/* 5. HUBS (LAN1, LAN2, WI-FI, LAN3, LAN4 - All Draggable) */}
        {/* ======================================================== */}

        {/* LAN1 Hub */}
        <g
          transform={`translate(${lan1Pos.x - 62}, ${lan1Pos.y - 26})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "hub-lan1", lan1Pos.x, lan1Pos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-lan1");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="124" height="52" rx="26" fill="#5B3DF5" />
          <text x="62" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900">
            LAN1
          </text>
          <text x="62" y="43" textAnchor="middle" fill="#FFFFFF" opacity="0.85" fontSize="11" fontWeight="700">
            {lan1Count} أجهزة
          </text>
        </g>

        {/* LAN2 Hub */}
        <g
          transform={`translate(${lan2Pos.x - 62}, ${lan2Pos.y - 26})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "hub-lan2", lan2Pos.x, lan2Pos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-lan2");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="124" height="52" rx="26" fill="#FF7A45" />
          <text x="62" y="27" textAnchor="middle" fill="#14121F" fontSize="16" fontWeight="900">
            LAN2
          </text>
          <text x="62" y="43" textAnchor="middle" fill="#14121F" opacity="0.85" fontSize="11" fontWeight="700">
            {lan2Count} أجهزة
          </text>
        </g>

        {/* Wi-Fi Hub */}
        <g
          transform={`translate(${wifiPos.x - 62}, ${wifiPos.y - 26})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "hub-wifi", wifiPos.x, wifiPos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-wifi");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="124" height="52" rx="26" fill="#FFFFFF" stroke="#5B3DF5" strokeWidth="3" />
          <text x="62" y="27" textAnchor="middle" fill="#5B3DF5" fontSize="16" fontWeight="900">
            الويفي
          </text>
          <text x="62" y="43" textAnchor="middle" fill="#6B6880" fontSize="11" fontWeight="700">
            {telemetry?.wifiCount ?? telemetry?.wifiClients?.length ?? 0} أجهزة
          </text>
        </g>

        {/* LAN3 Hub */}
        <g
          transform={`translate(${lan3Pos.x - 62}, ${lan3Pos.y - 26})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "hub-lan3", lan3Pos.x, lan3Pos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-lan3");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="124" height="52" rx="26" fill="#D7F25C" />
          <text x="62" y="27" textAnchor="middle" fill="#14121F" fontSize="16" fontWeight="900">
            LAN3
          </text>
          <text x="62" y="43" textAnchor="middle" fill="#14121F" opacity="0.8" fontSize="11" fontWeight="700">
            {telemetry?.lan3Device ? "1 جهاز" : "0 أجهزة"}
          </text>
        </g>

        {/* LAN4 Hub */}
        <g
          transform={`translate(${lan4Pos.x - 62}, ${lan4Pos.y - 26})`}
          className="cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => handleNodePointerDown(e, "hub-lan4", lan4Pos.x, lan4Pos.y)}
          onClick={() => {
            if (connectingCable) {
              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-lan4");
              setConnectingCable(null);
            }
          }}
        >
          <rect width="124" height="52" rx="26" fill="#14121F" />
          <text x="62" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="16" fontWeight="900">
            LAN4
          </text>
          <text x="62" y="43" textAnchor="middle" fill="#FFFFFF" opacity="0.8" fontSize="11" fontWeight="700">
            {telemetry?.lan4Device ? "1 جهاز" : "0 أجهزة"}
          </text>
        </g>

        {/* Disconnected Hub (Only rendered if real disconnected devices exist) */}
        {telemetry?.disconnectedDevices && telemetry.disconnectedDevices.length > 0 && (
          <g>
            <g transform="translate(488, 429)">
              <rect
                width="124"
                height="52"
                rx="26"
                fill="#FFFFFF"
                stroke="#9A98AD"
                strokeWidth="2.5"
                strokeDasharray="6 6"
              />
              <text x="62" y="27" textAnchor="middle" fill="#6B6880" fontSize="14" fontWeight="800">
                غير متصل
              </text>
              <text x="62" y="43" textAnchor="middle" fill="#9A98AD" fontSize="11" fontWeight="700">
                {telemetry.disconnectedDevices.length} أجهزة
              </text>
            </g>

            {/* Disconnected Devices: Real names from server */}
            {telemetry.disconnectedDevices.map((dev, idx) => {
              const count = telemetry.disconnectedDevices.length;
              const startX = 550 - ((count - 1) * 70) / 2;
              const xPos = startX + idx * 70;
              return (
                <g key={dev.mac || idx} transform={`translate(${xPos - 17}, 508)`}>
                  <rect x="0" y="0" width="34" height="22" rx="5" fill="#F1F0F6" stroke="#9A98AD" strokeWidth="2.5" />
                  <rect x="13" y="22" width="8" height="6" fill="#9A98AD" />
                  <line x1="9" y1="28" x2="25" y2="28" stroke="#9A98AD" strokeWidth="2.5" strokeLinecap="round" />
                  <circle cx="28" cy="6" r="3" fill="#FF7A45" />
                  <text x="17" y="42" textAnchor="middle" fill="#6B6880" fontSize="9.5" fontWeight="700">
                    {dev.name.length > 14 ? dev.name.slice(0, 14) + "…" : dev.name}
                  </text>
                  <text x="17" y="53" textAnchor="middle" fill="#9A98AD" fontSize="8" fontWeight="600" className="ltr-num">
                    {dev.ip}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* ======================================================== */}
        {/* 6. SWITCHES & DYNAMIC CABLES TO REAL DEVICES             */}
        {/* ======================================================== */}
        {switches.map((sw) => {
          const swWidth = 24 + sw.ports * 11;
          const swX = sw.x - swWidth / 2;
          const swY = sw.y - 17;

          // Check if parent is another switch (cascading / daisy chain)
          const isParentSwitch = sw.parentId && sw.parentId.startsWith("switch-");
          const parentSw = isParentSwitch ? switches.find((s) => s.id === sw.parentId) : null;

          let sourceAttachX = 335;
          let sourceAttachY = 130;
          let swAttachX = swX;
          let swAttachY = swY + 17;
          let cableColor = sw.uplinkColor || "#5B3DF5";

          if (parentSw) {
            cableColor = "#8B6CFF"; // Purple for switch-to-switch cascading uplink
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

            // Always attach cleanly at the outer boundary edge facing the source (left edge swX or right edge swX + swWidth)
            swAttachX = isChildLeft ? swX + swWidth : swX;
            swAttachY = swY + 17;
          } else {
            // Uplink to Hub (LAN1, LAN2, LAN3, LAN4, or Wi-Fi)
            const hub =
              (nodes && nodes.find((n) => n.id === sw.parentId)) ||
              (sw.uplinkHub === "LAN2" ? lan2Pos : sw.uplinkHub === "LAN3" ? lan3Pos : sw.uplinkHub === "LAN4" ? lan4Pos : lan1Pos);
            const hubCenterX = hub.x;
            const hubCenterY = hub.y;
            const isSwitchLeft = sw.x < hubCenterX;
            sourceAttachX = isSwitchLeft ? hubCenterX - 62 : hubCenterX + 62;
            sourceAttachY = hubCenterY;
            swAttachX = isSwitchLeft ? swX + swWidth : swX;
            swAttachY = swY + 17;
            cableColor = sw.uplinkColor || (sw.uplinkHub === "LAN2" ? "#FF7A45" : "#5B3DF5");
          }

          const midX = (sourceAttachX + swAttachX) / 2;
          const isDraggingThis = activeDrag?.id === sw.id;

          return (
            <g key={sw.id}>
              {/* Uplink curved cable from Hub or Parent Switch to this Switch */}
              <path
                d={`M ${sourceAttachX} ${sourceAttachY} C ${midX} ${sourceAttachY}, ${midX} ${swAttachY}, ${swAttachX} ${swAttachY}`}
                fill="none"
                stroke={cableColor}
                strokeWidth={parentSw ? "3.2" : "2.8"}
                strokeLinecap="round"
              />
              <circle cx={sourceAttachX} cy={sourceAttachY} r="3.5" fill={cableColor} />
              <circle cx={swAttachX} cy={swAttachY} r="3.5" fill={cableColor} />

              {/* Floating dark toolbar if selected (clean gap above white name tag, hidden during drag) */}
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

              {/* White Name Tag */}
              <g
                transform={`translate(${swX + swWidth / 2 - 62}, ${swY - 44})`}
                className="cursor-pointer"
                onClick={() => onSelectSwitch(sw)}
              >
                <rect width="124" height="30" rx="9" fill="#FFFFFF" stroke="#EEF0F5" strokeWidth="1.8" />
                <text x="62" y="14" textAnchor="middle" fill="#14121F" fontSize="11" fontWeight="900">
                  {sw.name}
                </text>
                <text x="62" y="24" textAnchor="middle" fill="#6B6880" fontSize="8.5" fontWeight="700">
                  {sw.ports} منافذ · {sw.uplinkHub}
                </text>
              </g>

              {/* Selection Border if selected */}
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

              {/* Switch Chassis */}
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
                  const isPortHovered = hoveredPort?.switchId === sw.id && hoveredPort?.portNumber === portNumber;
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
                        if (connectingCable && connectingCable.sourceType === "device" && connectingCable.deviceId) {
                          onConnectCable?.(sw.id, connectingCable.deviceId, portNumber);
                          setConnectingCable(null);
                        }
                      }}
                    >
                      <title>{i === 0 ? "Uplink" : `منفذ #${portNumber}: ${assignedDev ? `${assignedDev.name} (${assignedDev.ip}) - اسحب لإعادة التوصيل` : "فارغ (انقر أو اسحب للربط بجهاز)"}`}</title>
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
                        stroke={isPortHovered || isConnectingSource ? "#D7F25C" : isOccupied ? "#34D399" : "none"}
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

              {/* DYNAMIC CABLES & REAL DEVICES FOR THIS SWITCH */}
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
                    {/* Sleek Curved Cable only if assigned to a port */}
                    {isAssigned && (
                      <g className="group/cable">
                        <path
                          d={`M ${portPinX} ${portPinY} C ${portPinX} ${portPinY + dyDist}, ${dev.x} ${dev.y - dyDist}, ${dev.x} ${dev.y}`}
                          fill="none"
                          stroke={devCableColor}
                          strokeWidth={isSelected ? "3" : "2.2"}
                          strokeLinecap="round"
                        />
                        <circle cx={dev.x} cy={dev.y} r="2.5" fill={devCableColor} />

                        {/* Quick Disconnect Button on Cable */}
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
                            <rect width="24" height="20" rx="6" fill="#14121F" stroke="#FF7A45" strokeWidth="1.5" />
                            <text x="12" y="14" textAnchor="middle" fill="#FFFFFF" fontSize="10" fontWeight="900">
                              ✂️
                            </text>
                          </g>
                        )}
                      </g>
                    )}

                    {/* Unassigned badge if not plugged into a port */}
                    {!isAssigned && (
                      <g transform={`translate(${dev.x - 22}, ${dev.y - 18})`}>
                        <rect width="44" height="15" rx="7.5" fill="#FFF4D5" stroke="#E2B120" strokeWidth="1" strokeDasharray="2 2" />
                        <text x="22" y="11" textAnchor="middle" fill="#8C6B00" fontSize="8" fontWeight="800">
                          غير معين
                        </text>
                      </g>
                    )}

                    {/* Cable Quality Score Badge (only for cable devices with score) */}
                    {dev.cableQuality !== undefined && isAssigned && (
                      <g transform={`translate(${dev.x - 16}, ${dev.y - 28})`}>
                        <title>{`جودة الكابل: ${dev.cableQuality}% (اختبار استقرار الاتصال 0% فقدان حزم)`}</title>
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

                    {/* Device Icon (Draggable & Selectable & Connectable) */}
                    <g
                      transform={`translate(${dev.x - 18}, ${dev.y})`}
                      className={tool === "cable" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
                      onPointerEnter={() => setHoveredDeviceId(dev.id)}
                      onPointerLeave={() => setHoveredDeviceId(null)}
                      onPointerDown={(e) => handleDevicePointerDown(e, sw, dev)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (connectingCable && connectingCable.sourceType === "port" && connectingCable.portIndex) {
                          onConnectCable?.(connectingCable.switchId, dev.id, connectingCable.portIndex);
                          setConnectingCable(null);
                          return;
                        }
                        onSelectDevice(dev.id, sw.id);
                      }}
                    >
                      {/* Highlight when targeted by connecting cable */}
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
                      {dev.type === "phone" ? (
                        <g transform="translate(8, 0)">
                          <rect
                            width="20"
                            height="30"
                            rx="5"
                            fill={isSelected ? "#FFEDE5" : "#FFFFFF"}
                            stroke={devCableColor}
                            strokeWidth={isSelected ? "2.5" : "2"}
                          />
                          <circle cx="10" cy="24" r="1.8" fill={devCableColor} />
                        </g>
                      ) : dev.type === "camera" ? (
                        <>
                          <rect x="0" y="3" width="36" height="20" rx="5" fill="#272B52" />
                          <circle cx="18" cy="13" r="5" fill="none" stroke="#D7F25C" strokeWidth="1.8" />
                          <circle cx="18" cy="13" r="2" fill="#D7F25C" />
                        </>
                      ) : dev.type === "pc" ? (
                        <>
                          <rect x="2" y="3" width="32" height="19" rx="4" fill="#F6F6FA" stroke={devCableColor} strokeWidth="2" />
                          <rect x="13" y="22" width="10" height="4" fill="#9A98AD" />
                          <line x1="9" y1="26" x2="27" y2="26" stroke="#9A98AD" strokeWidth="2" strokeLinecap="round" />
                        </>
                      ) : (
                        <>
                          <line x1="10" y1="5" x2="4" y2="0" stroke={devCableColor} strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="26" y1="5" x2="32" y2="0" stroke={devCableColor} strokeWidth="2.5" strokeLinecap="round" />
                          <rect
                            x="0"
                            y="5"
                            width="36"
                            height="17"
                            rx="6"
                            fill={isSelected ? "#FF7A45" : "#FFFFFF"}
                            stroke={isSelected ? "#14121F" : devCableColor}
                            strokeWidth={isSelected ? "2.5" : "2"}
                          />
                          <circle cx="10" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                          <circle cx="18" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                          <circle cx="26" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                        </>
                      )}

                      <text
                        x="18"
                        y="34"
                        textAnchor="middle"
                        fill={isSelected ? "#FF7A45" : "#14121F"}
                        fontSize="9.5"
                        fontWeight={isSelected ? "900" : "800"}
                      >
                        {dev.name.length > 8 ? dev.name.slice(0, 8) + "…" : dev.name}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* ======================================================== */}
        {/* 6.5 DEVICES CONNECTED TO ROUTERS / APS / PEER DEVICES    */}
        {/* ======================================================== */}
        {(() => {
          const peerChildDevices = (nodes || []).filter((n) => {
            if (n.type !== "device" || !n.parentId) return false;
            if (switches.some((s) => s.id === n.parentId)) return false;
            if (n.parentId.startsWith("hub-") || n.parentId === "node-router" || n.parentId === "node-wan") return false;
            return true;
          });

          return (
            <g>
              {peerChildDevices.map((dev) => {
                const parentNode = nodes?.find((p) => p.id === dev.parentId);
                const isSelected = selectedDeviceId === dev.id || dev.selected;
                const devCableColor = isSelected ? "#FF7A45" : "#8B6CFF";

                // Attachment points: from center of parent to top/center of child
                const pX = parentNode ? parentNode.x + 18 : dev.x;
                const pY = parentNode ? parentNode.y + 13 : dev.y - 40;
                const cX = dev.x + 18;
                const cY = dev.y + 13;
                const midY = (pY + cY) / 2;

                return (
                  <g key={dev.id}>
                    {/* Sleek Dashed Wireless / Sub-link Cable from Parent AP/Router to Device */}
                    {parentNode && (
                      <g className="group/peercable">
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

                        {/* Quick Disconnect Button on Cable */}
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
                            <rect width="24" height="20" rx="6" fill="#14121F" stroke="#FF7A45" strokeWidth="1.2" />
                            <text x="12" y="14" textAnchor="middle" fill="#FF7A45" fontSize="11" fontWeight="bold">
                              ✂
                            </text>
                          </g>
                        )}
                      </g>
                    )}

                    {/* Draggable Device Node */}
                    <g
                      transform={`translate(${dev.x}, ${dev.y})`}
                      className="cursor-pointer"
                      onPointerDown={(e) => handleNodePointerDown(e, dev.id, dev.x, dev.y)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDevice(dev.id, dev.parentId);
                        if (connectingCable && connectingCable.deviceId && connectingCable.deviceId !== dev.id) {
                          onConnectCable?.(connectingCable.deviceId, dev.id);
                          setConnectingCable(null);
                        }
                      }}
                    >
                      <title>{`${dev.name || "جهاز"} (${dev.ip || "No IP"}) - شاد من ${parentNode?.name || "موزع خارجي"}`}</title>

                      {/* Cable Quality / Ping Loss Badge */}
                      {dev.cableQuality !== undefined && dev.cableQuality < 100 && (
                        <g transform="translate(18, -12)">
                          <rect
                            x="-15"
                            y="0"
                            width="30"
                            height="12"
                            rx="3"
                            fill="#FFFFFF"
                            stroke={dev.cableQuality >= 80 ? "#22C55E" : dev.cableQuality >= 50 ? "#EAB308" : "#EF4444"}
                            strokeWidth="1.2"
                          />
                          <text
                            x="0"
                            y="9"
                            textAnchor="middle"
                            fill={dev.cableQuality >= 80 ? "#15803D" : dev.cableQuality >= 50 ? "#A16207" : "#B91C1C"}
                            fontSize="8"
                            fontWeight="800"
                          >
                            {dev.cableQuality}%
                          </text>
                        </g>
                      )}

                      {/* Selection Glow & Ring */}
                      {isSelected && (
                        <rect
                          x="-4"
                          y="-2"
                          width="44"
                          height="38"
                          rx="8"
                          fill="none"
                          stroke="#FF7A45"
                          strokeWidth="2"
                          strokeDasharray="4 3"
                        />
                      )}

                      {/* Icon Rendering */}
                      {dev.subType === "phone" ? (
                        <g transform="translate(8, 0)">
                          <rect
                            width="20"
                            height="30"
                            rx="5"
                            fill={isSelected ? "#FFEDE5" : "#FFFFFF"}
                            stroke={devCableColor}
                            strokeWidth={isSelected ? "2.5" : "2"}
                          />
                          <circle cx="10" cy="24" r="1.8" fill={devCableColor} />
                        </g>
                      ) : dev.subType === "camera" ? (
                        <>
                          <rect x="0" y="3" width="36" height="20" rx="5" fill="#272B52" />
                          <circle cx="18" cy="13" r="5" fill="none" stroke="#D7F25C" strokeWidth="1.8" />
                          <circle cx="18" cy="13" r="2" fill="#D7F25C" />
                        </>
                      ) : dev.subType === "pc" ? (
                        <>
                          <rect x="2" y="3" width="32" height="19" rx="4" fill="#F6F6FA" stroke={devCableColor} strokeWidth="2" />
                          <rect x="13" y="22" width="10" height="4" fill="#9A98AD" />
                          <line x1="9" y1="26" x2="27" y2="26" stroke="#9A98AD" strokeWidth="2" strokeLinecap="round" />
                        </>
                      ) : (
                        <>
                          <line x1="10" y1="5" x2="4" y2="0" stroke={devCableColor} strokeWidth="2.5" strokeLinecap="round" />
                          <line x1="26" y1="5" x2="32" y2="0" stroke={devCableColor} strokeWidth="2.5" strokeLinecap="round" />
                          <rect
                            x="0"
                            y="5"
                            width="36"
                            height="17"
                            rx="6"
                            fill={isSelected ? "#FF7A45" : "#FFFFFF"}
                            stroke={isSelected ? "#14121F" : devCableColor}
                            strokeWidth={isSelected ? "2.5" : "2"}
                          />
                          <circle cx="10" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                          <circle cx="18" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                          <circle cx="26" cy="13" r="1.5" fill={isSelected ? "#FFFFFF" : devCableColor} />
                        </>
                      )}

                      <text
                        x="18"
                        y="34"
                        textAnchor="middle"
                        fill={isSelected ? "#FF7A45" : "#14121F"}
                        fontSize="9.5"
                        fontWeight={isSelected ? "900" : "800"}
                      >
                        {(dev.name || "جهاز").length > 8 ? (dev.name || "جهاز").slice(0, 8) + "…" : (dev.name || "جهاز")}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          );
        })()}

        {/* ======================================================== */}
        {/* 7. WI-FI BRANCH (ACCESS POINT & DRAGGABLE PHONES)        */}
        {/* ======================================================== */}
        {(() => {
          const apX = wifiPos.x + 115;
          const apY = wifiPos.y;
          const maxShow = 10;
          const displayList = wifiPhoneNodes.slice(0, maxShow);
          const moreCount = Math.max(0, wifiPhoneNodes.length - maxShow);

          return (
            <g>
              {/* Uplink line from Wi-Fi Hub to Access Point */}
              <line x1={wifiPos.x + 62} y1={apY} x2={apX - 24} y2={apY} stroke="#5B3DF5" strokeWidth="2.4" strokeLinecap="round" />

              {/* Wi-Fi Count Badge cleanly placed above AP */}
              <text x={apX} y={apY - 32} textAnchor="middle" fill="#6B6880" fontSize="11" fontWeight="800">
                {telemetry?.wifiCount ?? wifiPhoneNodes.length} أجهزة ويفي
              </text>

              {/* Access Point Icon (Clickable/Targetable in Cable Mode) */}
              <g
                transform={`translate(${apX - 24}, ${apY - 24})`}
                className="cursor-pointer"
                onClick={() => {
                  if (connectingCable) {
                    onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, "hub-wifi");
                    setConnectingCable(null);
                  }
                }}
              >
                <rect width="48" height="48" rx="14" fill="#5B3DF5" />
                <circle cx="24" cy="34" r="2.8" fill="#FFFFFF" />
                <path d="M16 26 A11 11 0 0 1 32 26" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
                <path d="M10 19 A19 19 0 0 1 38 19" fill="none" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" />
              </g>

              {/* Wi-Fi Devices */}
              {wifiPhoneNodes.length === 0 ? (
                <text x={apX} y={apY + 45} textAnchor="middle" fill="#9A98AD" fontSize="11" fontWeight="700">
                  لا توجد أجهزة ويفي متصلة حالياً
                </text>
              ) : (
                <g>
                  {displayList.map((phone) => {
                    const phoneName = phone.name || (phone as any).hostname || phone.ip || (phone.mac ? `هاتف ${phone.mac.slice(-5)}` : "هاتف");
                    return (
                      <g key={phone.id}>
                        {/* Curved dashed cable from AP to each Phone */}
                        <path
                          d={`M ${apX} ${apY + 24} C ${apX} ${(apY + 24 + phone.y) / 2}, ${phone.x} ${(apY + 24 + phone.y) / 2}, ${phone.x} ${phone.y}`}
                          fill="none"
                          stroke="#5B3DF5"
                          strokeWidth="1.8"
                          strokeDasharray="3 3"
                        />
                        {/* Draggable Wi-Fi Phone Node */}
                        <g
                          transform={`translate(${phone.x - 9}, ${phone.y}) scale(0.85)`}
                          className="cursor-grab active:cursor-grabbing"
                          onPointerDown={(e) => handleNodePointerDown(e, phone.id, phone.x, phone.y)}
                          onClick={() => {
                            if (connectingCable) {
                              onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, phone.id);
                              setConnectingCable(null);
                            }
                          }}
                        >
                          <rect width="20" height="32" rx="6" fill="#FFFFFF" stroke="#5B3DF5" strokeWidth="2.5" />
                          <circle cx="10" cy="25" r="2" fill="#5B3DF5" />
                        </g>
                        <text
                          x={phone.x}
                          y={phone.y + 36}
                          textAnchor="middle"
                          fill="#14121F"
                          fontSize="9"
                          fontWeight="800"
                          className="pointer-events-none select-none"
                        >
                          {phoneName.length > 7 ? phoneName.slice(0, 7) + "…" : phoneName}
                        </text>
                        <title>{`${phoneName} (${phone.ip || "Wi-Fi"} · ${phone.mac || ""})`}</title>
                      </g>
                    );
                  })}

                  {moreCount > 0 && (
                    <g transform={`translate(${apX + 60}, ${apY + 115})`} className="cursor-pointer">
                      <title>{`يوجد ${moreCount} أجهزة ويفي إضافية`}</title>
                      <rect width="36" height="24" rx="12" fill="#5B3DF5" />
                      <text x="18" y="16" textAnchor="middle" fill="#FFFFFF" fontSize="11" fontWeight="900">
                        +{moreCount}
                      </text>
                    </g>
                  )}
                </g>
              )}
            </g>
          );
        })()}

        {/* ======================================================== */}
        {/* 8. LAN3 & LAN4 REAL DEVICES (DRAGGABLE NODES)            */}
        {/* ======================================================== */}
        {/* LAN3 Device (e.g. lhaj) */}
        {lan3Dev && (
          <g>
            <path
              d={`M ${lan3Pos.x + 62} ${lan3Pos.y} C ${(lan3Pos.x + 62 + lan3Dev.x) / 2} ${lan3Pos.y}, ${(lan3Pos.x + 62 + lan3Dev.x) / 2} ${lan3Dev.y}, ${lan3Dev.x} ${lan3Dev.y}`}
              fill="none"
              stroke="#B7D633"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx={lan3Pos.x + 62} cy={lan3Pos.y} r="3" fill="#B7D633" />
            <circle cx={lan3Dev.x} cy={lan3Dev.y} r="3" fill="#B7D633" />
            <g
              transform={`translate(${lan3Dev.x - 20}, ${lan3Dev.y - 12})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => handleNodePointerDown(e, lan3Dev.id, lan3Dev.x, lan3Dev.y)}
              onClick={() => {
                if (connectingCable) {
                  onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, lan3Dev.id);
                  setConnectingCable(null);
                }
              }}
            >
              <line x1="12" y1="6" x2="6" y2="0" stroke="#8FB000" strokeWidth="3" strokeLinecap="round" />
              <line x1="28" y1="6" x2="34" y2="0" stroke="#8FB000" strokeWidth="3" strokeLinecap="round" />
              <rect x="0" y="6" width="40" height="18" rx="7" fill="#FFFFFF" stroke="#8FB000" strokeWidth="3" />
              <circle cx="12" cy="15" r="1.5" fill="#8FB000" />
              <circle cx="20" cy="15" r="1.5" fill="#8FB000" />
              <circle cx="28" cy="15" r="1.5" fill="#8FB000" />
              <text x="20" y="42" textAnchor="middle" fill="#8FB000" fontSize="11" fontWeight="800">
                {lan3Dev.name}
              </text>
            </g>
          </g>
        )}

        {/* LAN4 Device (e.g. DVR DYALNA) */}
        {lan4Dev && (
          <g>
            <path
              d={`M ${lan4Pos.x + 62} ${lan4Pos.y} C ${(lan4Pos.x + 62 + lan4Dev.x) / 2} ${lan4Pos.y}, ${(lan4Pos.x + 62 + lan4Dev.x) / 2} ${lan4Dev.y}, ${lan4Dev.x} ${lan4Dev.y}`}
              fill="none"
              stroke="#14121F"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx={lan4Pos.x + 62} cy={lan4Pos.y} r="3" fill="#14121F" />
            <circle cx={lan4Dev.x} cy={lan4Dev.y} r="3" fill="#14121F" />
            <g
              transform={`translate(${lan4Dev.x - 22}, ${lan4Dev.y - 13})`}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => handleNodePointerDown(e, lan4Dev.id, lan4Dev.x, lan4Dev.y)}
              onClick={() => {
                if (connectingCable) {
                  onConnectCable?.(connectingCable.deviceId || connectingCable.switchId, lan4Dev.id);
                  setConnectingCable(null);
                }
              }}
            >
              <rect width="44" height="26" rx="7" fill="#272B52" />
              <circle cx="16" cy="13" r="6" fill="none" stroke="#D7F25C" strokeWidth="2" />
              <circle cx="16" cy="13" r="2.5" fill="#D7F25C" />
              <circle cx="34" cy="9" r="2" fill="#34D399" />
              <text x="22" y="44" textAnchor="middle" fill="#14121F" fontSize="11" fontWeight="900">
                {lan4Dev.name}
              </text>
            </g>
          </g>
        )}

        {/* Subtle drop highlight around LAN4 ONLY when actively dragging from palette */}
        {isDropTargetLAN4 && (
          <circle
            cx={lan4Pos.x + 80}
            cy={lan4Pos.y}
            r="45"
            fill="rgba(91,61,245,0.12)"
            stroke="#5B3DF5"
            strokeWidth="2.5"
            strokeDasharray="4 4"
            className="pointer-events-none animate-pulse"
          />
        )}

        {/* 9. ACTIVE CONNECTING CABLE (LIVE INTERACTIVE SVG) */}
        {connectingCable && (
          <g className="pointer-events-none">
            {/* Outer pulsing glow */}
            <path
              d={`M ${connectingCable.startX} ${connectingCable.startY} C ${connectingCable.startX} ${
                connectingCable.startY + Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${
                connectingCable.currentY - Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${connectingCable.currentY}`}
              fill="none"
              stroke="rgba(215, 242, 92, 0.45)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Main dashed interactive cable */}
            <path
              d={`M ${connectingCable.startX} ${connectingCable.startY} C ${connectingCable.startX} ${
                connectingCable.startY + Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${
                connectingCable.currentY - Math.max(30, Math.abs(connectingCable.currentY - connectingCable.startY) * 0.5)
              }, ${connectingCable.currentX} ${connectingCable.currentY}`}
              fill="none"
              stroke="#D7F25C"
              strokeWidth="3.5"
              strokeDasharray="6 4"
              strokeLinecap="round"
            />
            {/* Origin Anchor */}
            <circle cx={connectingCable.startX} cy={connectingCable.startY} r="4.5" fill="#5B3DF5" stroke="#FFFFFF" strokeWidth="2" />
            {/* Target Head / Plug following cursor */}
            <circle cx={connectingCable.currentX} cy={connectingCable.currentY} r="7" fill="#D7F25C" stroke="#14121F" strokeWidth="2.5" />
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

        {/* Live Router Status */}
        <div className="flex items-center gap-2">
          {telemetry?.isRouterOnline ? (
            <span className="flex items-center gap-1.5 text-[#22C55E] font-[800]">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              متصل بالروتر حياً (ZTE F680)
              {telemetry.lastUpdated ? <span className="text-[#6B6880] font-[600]">· {telemetry.lastUpdated}</span> : ""}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[#FF7A45] font-[800]">
              <span className="w-2 h-2 rounded-full bg-[#FF7A45]" />
              غير متصل بالروتر
              {telemetry?.lastUpdated ? <span className="text-[#6B6880] font-[600]">· آخر فحص: {telemetry.lastUpdated}</span> : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
