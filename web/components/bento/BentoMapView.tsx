"use client";

import React, { useState, useMemo } from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { MapCanvas, MapTelemetry } from "@/components/map-editor/MapCanvas";
import {
  buildAutoTopologyNodes,
  clearAutoLayoutOverrides,
  nodesToSwitches,
} from "@/lib/map-data";

interface BentoMapViewProps {
  onSwitchToEdit?: () => void;
}

export function BentoMapView({ onSwitchToEdit }: BentoMapViewProps) {
  const {
    state,
    cableDevices,
    unknownDevices,
    wifiClients,
    offlineCable,
    portRates,
    setInspectItem,
  } = useDashboard();

  const [zoom, setZoom] = useState<number>(0.95);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [layoutTick, setLayoutTick] = useState<number>(0);

  const routerModelRaw = state?.routerHealth?.model?.trim() || "";
  const routerDisplayName = routerModelRaw
    ? routerModelRaw.toUpperCase().startsWith("ZTE")
      ? routerModelRaw
      : `ZTE ${routerModelRaw}`
    : "ZTE Router";
  const routerIp = state?.routerHealth?.ip?.trim() || "192.168.1.1";

  const internetPing = state?.diagnostics?.internetPing ?? null;
  const netStatus = state?.diagnostics?.status ?? "ممتاز";

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
    return Object.values(lanRates)
      .reduce((acc, curr) => acc + curr.rx, 0)
      .toFixed(1);
  }, [lanRates]);

  const formattedWifiClients = useMemo(() => {
    return (wifiClients || []).map((w) => ({
      name:
        w.friendlyName ||
        (w.hostname && w.hostname !== "Wi-Fi Device" ? w.hostname : w.vendor || w.ip || w.mac),
      ip: w.ip,
      mac: w.mac,
      vendor: w.vendor,
      band: w.band,
      ssidName: w.ssidName,
      category: w.category,
      blocked: w.blocked,
    }));
  }, [wifiClients]);

  const disconnectedDevices = useMemo(() => {
    return offlineCable.map((d) => ({
      name: d.name,
      ip: d.ip,
      mac: d.mac,
    }));
  }, [offlineCable]);

  const telemetry: MapTelemetry = useMemo(
    () => ({
      routerName: routerDisplayName,
      routerIp,
      internetPing,
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
      internetPing,
      state?.updatedAt,
      totalDl,
      lanRates,
      wifiClients.length,
      formattedWifiClients,
      disconnectedDevices,
    ]
  );

  // Build topology dynamically from ALL live router data + user edits
  const nodes = useMemo(
    () =>
      buildAutoTopologyNodes({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      layoutTick,
    ]
  );

  const handleAutoArrange = () => {
    clearAutoLayoutOverrides();
    setLayoutTick((t) => t + 1);
    setZoom(0.95);
  };

  const switches = useMemo(() => nodesToSwitches(nodes), [nodes]);

  const handleSelectDevice = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    const node = nodes.find((n) => n.id === deviceId);
    if (node?.mac && setInspectItem) {
      const liveDev =
        cableDevices.find((d) => d.mac.toUpperCase() === node.mac?.toUpperCase()) ||
        unknownDevices.find((d) => d.mac.toUpperCase() === node.mac?.toUpperCase()) ||
        wifiClients.find((d) => d.mac.toUpperCase() === node.mac?.toUpperCase());
      if (liveDev) {
        setInspectItem(liveDev as unknown as Record<string, unknown>);
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="relative w-full bg-white rounded-[24px] shadow-[0_18px_40px_-28px_rgba(40,24,120,0.45)] border border-[#E2E0EE] overflow-hidden">
        {/* Top Control Bar inside Map Canvas */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EEF0F5] bg-[#FDFDFE] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#22C55E] animate-pulse" />
            <h3 className="text-[16px] font-[900] text-[#14121F]">
              خريطة الشبكة التفاعلية الحية
            </h3>
            <span className="text-[12px] font-[700] px-2.5 py-0.5 rounded-[999px] bg-[#EFEBFF] text-[#5B3DF5]">
              مباشر من {routerDisplayName}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="text-[12px] font-[800] text-[#6B6880] items-center gap-4 hidden lg:flex">
              <span>
                ● بينغ الإنترنت:{" "}
                <strong className="text-[#14121F] font-[900] ltr-num">
                  {internetPing !== null ? `${internetPing} ms` : "--"}
                </strong>
              </span>
              <span>
                ● صبيب مباشر:{" "}
                <strong className="text-[#5B3DF5] font-[900] ltr-num">{totalDl} Mbps</strong>
              </span>
              <span>
                ● جودة الاتصال:{" "}
                <strong className="text-[#22C55E] font-[900]">{netStatus}</strong>
              </span>
            </div>

            <div className="flex items-center gap-1 bg-[#F6F6FA] px-2 py-1 rounded-[999px] border border-[#E2E0EE]">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.4, Math.round((z - 0.1) * 10) / 10))}
                className="w-6 h-6 rounded-full hover:bg-white text-[13px] font-bold text-[#14121F] cursor-pointer"
                title="تصغير"
              >
                -
              </button>
              <span className="text-[11px] font-[800] text-[#6B6880] ltr-num px-1">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.0, Math.round((z + 0.1) * 10) / 10))}
                className="w-6 h-6 rounded-full hover:bg-white text-[13px] font-bold text-[#14121F] cursor-pointer"
                title="تكبير"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAutoArrange}
              className="px-3 py-1.5 rounded-[999px] bg-[#F0EFF8] hover:bg-[#E4E1F6] text-[#5B3DF5] text-[12px] font-[800] flex items-center gap-1.5 transition-all cursor-pointer"
              title="إعادة الترتيب التلقائي وتوصيل المنافذ الذكي"
            >
              <span>🔄</span>
              <span>ترتيب تلقائي</span>
            </button>

            {onSwitchToEdit && (
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="px-3.5 py-1.5 rounded-[999px] bg-[#5B3DF5] hover:bg-[#492ed4] text-white text-[12px] font-[800] flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                title="تعديل مواضع السويتشات والمنافذ"
              >
                <span>✏️</span>
                <span>تعديل التخطيط</span>
              </button>
            )}
          </div>
        </div>

        <MapCanvas
          nodes={nodes}
          tool="pan"
          zoom={zoom}
          switches={switches}
          onSelectSwitch={() => {}}
          onUpdateSwitchPos={() => {}}
          onDropNewItem={() => {}}
          onSelectDevice={(devId) => handleSelectDevice(devId)}
          selectedDeviceId={selectedDeviceId}
          telemetry={telemetry}
        />
      </div>
    </div>
  );
}
