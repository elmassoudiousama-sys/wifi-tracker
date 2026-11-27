"use client";

import React, { useState, useEffect } from "react";
import { MapDevice, MapSwitch, MapNode } from "@/lib/map-data";
import { CorrelationInsight } from "@/lib/store";

interface DevicePanelProps {
  device: MapDevice | null;
  parentSwitch: MapSwitch | null;
  allNodes?: MapNode[];
  correlationInsights?: CorrelationInsight[];
  onUpdateDevice: (switchId: string, deviceId: string, updated: Partial<MapDevice>) => void;
  onChangeDeviceParent?: (deviceId: string, newParentId: string) => void;
  onDeleteDevice?: (deviceId: string) => void;
  onToggleBlock?: (mac: string, currentlyBlocked: boolean, name: string) => void;
  onSelectSwitch?: (switchId: string) => void;
}

export function DevicePanel({
  device,
  parentSwitch,
  allNodes = [],
  correlationInsights = [],
  onUpdateDevice,
  onChangeDeviceParent,
  onDeleteDevice,
  onToggleBlock,
  onSelectSwitch,
}: DevicePanelProps) {
  const [name, setName] = useState(device?.name || "");
  const [type, setType] = useState<MapDevice["type"]>(device?.type || "router");
  const [cableQuality, setCableQuality] = useState<number>(device?.cableQuality ?? 100);

  useEffect(() => {
    if (device) {
      setName(device.name);
      setType(device.type);
      setCableQuality(device.cableQuality ?? 100);
    }
  }, [device]);

  if (!device) {
    return (
      <div className="bento-card bg-white text-[#14121F] flex flex-col items-center justify-center p-8 text-center text-[#6B6880]">
        <span className="text-[32px] mb-2">📱</span>
        <h3 className="text-[16px] font-[800] text-[#14121F]">حدد جهازاً أو Switch</h3>
        <p className="text-[12px] font-[600] mt-1">
          كليكي على أي جهاز أو سويتش فالخريطة باش تعدل معلوماته، مساره، أو تحركو.
        </p>
      </div>
    );
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateDevice(parentSwitch?.id || device.parentId || "node-router", device.id, {
      name,
      type,
      cableQuality,
    });
  };

  const isBlocked = !!device.blocked;

  // Find parent node details if not a direct switch
  const parentNode = allNodes.find((n) => n.id === device.parentId);
  const parentTitle = parentSwitch
    ? parentSwitch.name
    : parentNode
    ? parentNode.name
    : device.parentId === "hub-wifi"
    ? "الويفي الرئيسي"
    : device.parentId === "hub-lan3"
    ? "منفذ LAN3 (مباشر)"
    : device.parentId === "hub-lan4"
    ? "منفذ LAN4 (كاميرات)"
    : "غير محدد";

  // Available switches and router devices for parent selection
  const switchOptions = allNodes.filter((n) => n.type === "switch");
  const routerOptions = allNodes.filter(
    (n) => n.type === "device" && (n.subType === "router" || n.subType === "ap") && n.id !== device.id
  );

  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col gap-4 shadow-sm border border-[#EEF0F5]">
      {/* Header + Device Type Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EEF0F5]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#5B3DF5]/10 text-[#5B3DF5] flex items-center justify-center font-bold text-sm">
            {type === "phone" ? "📱" : type === "camera" ? "📹" : type === "pc" ? "💻" : "📡"}
          </div>
          <div>
            <h2 className="text-[16px] font-[900] text-[#14121F] leading-tight">خصائص الجهاز</h2>
            <span className="text-[11px] font-[700] text-[#6B6880]">
              متصل بـ {parentTitle}
            </span>
          </div>
        </div>
        <span className="bg-[#5B3DF5] text-white text-[10.5px] font-[800] px-2.5 py-0.5 rounded-[999px]">
          محدد
        </span>
      </div>

      <form onSubmit={handleApply} className="flex flex-col gap-3.5">
        {/* Name input */}
        <div>
          <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
            اسم الجهاز
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-[40px] px-3.5 bg-[#F6F6FA] text-[#14121F] rounded-[12px] border border-[#E2E0EE] font-[700] text-[13px] outline-none focus:border-[#5B3DF5] focus:bg-white transition-all"
            placeholder="اسم الجهاز..."
          />
        </div>

        {/* Device Parent Connection Selector (منين شاد هاد الجهاز) */}
        <div>
          <label className="text-[12px] font-[800] text-[#5B3DF5] block mb-1 flex items-center justify-between">
            <span>🔌 منين شاد هاد الجهاز (متصل بـ):</span>
            <span className="text-[10px] text-[#6B6880] font-normal">حدد المصدر بدقة</span>
          </label>
          <select
            value={device.parentId || ""}
            onChange={(e) => {
              const newParent = e.target.value;
              onChangeDeviceParent?.(device.id, newParent);
            }}
            className="w-full h-[42px] px-3 bg-[#F0EEFF] text-[#14121F] rounded-[12px] border-2 border-[#5B3DF5]/40 font-[800] text-[12.5px] outline-none focus:border-[#5B3DF5] cursor-pointer"
          >
            <option value="">-- غير متصل (مفصول) --</option>
            <optgroup label="🔀 السويتشات المتاحة">
              {switchOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.ports || 8} منافذ)
                </option>
              ))}
            </optgroup>
            <optgroup label="📡 أجهزة التوزيع والروترات (APs / Routers)">
              {routerOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.ip ? `(${r.ip})` : ""}
                </option>
              ))}
            </optgroup>
            <optgroup label="🌐 المنافذ المباشرة بالروتر الرئيسي">
              {allNodes
                .filter((n) => n.type === "hub" && n.id !== "hub-offline")
                .map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.id === "hub-wifi" ? "الويفي الرئيسي (Wi-Fi)" : `منفذ ${h.name} (مباشر)`}
                  </option>
                ))}
              <option value="node-router">مباشرة بالروتور الرئيسي</option>
            </optgroup>
          </select>
        </div>

        {/* Temporal Correlation / Network Tomography Insights */}
        {(() => {
          const upperMac = (device.mac || "").toUpperCase();
          const deviceInsights = upperMac
            ? correlationInsights.filter(
                (ins) => ins.targetMac === upperMac || ins.sourceMac === upperMac
              )
            : [];

          if (deviceInsights.length === 0) {
            return (
              <div className="bg-[#F6F6FA] px-3 py-2 rounded-[10px] border border-[#EEF0F5] text-[11px] font-[700] text-[#6B6880] flex items-center gap-2">
                <span>🧠</span>
                <span>محلل التزامن يراقب الانقطاعات والتقطيع لاكتشاف المسار تلقائياً.</span>
              </div>
            );
          }

          return (
            <div className="bg-[#F0EEFF] p-3 rounded-[12px] border border-[#5B3DF5]/30 flex flex-col gap-2">
              <div className="text-[11.5px] font-[900] text-[#5B3DF5] flex items-center gap-1.5">
                <span>🧠</span>
                <span>اكتشاف التزامن التلقائي (Network Tomography)</span>
              </div>
              {deviceInsights.slice(0, 2).map((ins) => {
                const isTarget = ins.targetMac === upperMac;
                const peerMac = isTarget ? ins.sourceMac : ins.targetMac;
                const peerName = isTarget ? ins.sourceName : ins.targetName;
                const peerNode = allNodes.find((n) => (n.mac || "").toUpperCase() === peerMac);

                return (
                  <div key={ins.id} className="bg-white p-2.5 rounded-[10px] border border-[#E2E0EE] flex flex-col gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-[800] text-[#14121F]">
                        {ins.type === "ap_child"
                          ? isTarget
                            ? `شاد مع ${peerName}`
                            : `مرتبط به ${peerName}`
                          : `نفس فرع/سويتش ${peerName}`}
                      </span>
                      <span className="text-[10px] font-[900] bg-[#E5F8D0] text-[#2F6B0F] px-1.5 py-0.5 rounded-[5px]">
                        ثقة {ins.confidence}%
                      </span>
                    </div>
                    <span className="text-[10.5px] font-[700] text-[#6B6880]">{ins.reason}</span>
                    {ins.type === "ap_child" && isTarget && peerNode && device.parentId !== peerNode.id && (
                      <button
                        type="button"
                        onClick={() => onChangeDeviceParent?.(device.id, peerNode.id)}
                        className="mt-0.5 py-1 px-2.5 bg-[#5B3DF5] hover:bg-[#492ed4] text-white text-[11px] font-[800] rounded-[8px] transition-colors cursor-pointer self-start"
                      >
                        تطبيق الربط مع {peerName}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Device Type Segmented Buttons */}
        <div>
          <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
            نوع الجهاز
          </label>
          <div className="grid grid-cols-4 gap-1 p-1 bg-[#F6F6FA] rounded-[12px] border border-[#EEF0F5]">
            {[
              { id: "router", label: "روتور", icon: "📡" },
              { id: "phone", label: "هاتف", icon: "📱" },
              { id: "pc", label: "حاسوب", icon: "💻" },
              { id: "camera", label: "كاميرا", icon: "📹" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setType(t.id as any)}
                className={`py-1.5 px-1 rounded-[8px] text-[11px] font-[800] flex flex-col items-center gap-0.5 transition-all cursor-pointer ${
                  type === t.id
                    ? "bg-[#14121F] text-white shadow-xs"
                    : "text-[#6B6880] hover:text-[#14121F]"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Port Assignment selector (if on a Switch) */}
        {parentSwitch && (
          <div>
            <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
              المنفذ في {parentSwitch.name}
            </label>
            <select
              value={device.portIndex ?? ""}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : undefined;
                onUpdateDevice(parentSwitch.id, device.id, { portIndex: val });
              }}
              className="w-full h-[40px] px-3 bg-[#F6F6FA] text-[#14121F] rounded-[12px] border border-[#E2E0EE] font-[800] text-[12.5px] outline-none focus:border-[#5B3DF5] cursor-pointer"
            >
              <option value="">غير معين لمنفذ (معلق بجانب السويتش)</option>
              {Array.from({ length: parentSwitch.ports }).map((_, idx) => {
                const p = idx + 1;
                const otherDev = parentSwitch.devices.find((d) => d.portIndex === p && d.id !== device.id);
                return (
                  <option key={p} value={p}>
                    منفذ #{p} {otherDev ? `(مشغول بـ ${otherDev.name})` : "(فارغ)"}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Network Info Pills */}
        <div className="bg-[#F6F6FA] p-3 rounded-[14px] flex flex-col gap-2 border border-[#EEF0F5]">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-[700] text-[#6B6880]">عنوان IP:</span>
            <span className="font-[800] text-[#14121F] ltr-num bg-white px-2 py-0.5 rounded-[6px] border border-[#EEF0F5]">
              {device.ip || "192.168.1.X"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-[700] text-[#6B6880]">عنوان MAC:</span>
            <span className="font-[800] text-[#14121F] ltr-num bg-white px-2 py-0.5 rounded-[6px] border border-[#EEF0F5] text-[10.5px]">
              {device.mac || "غير متوفر"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-[700] text-[#6B6880]">المنفذ بالسويتش:</span>
            <span className="font-[800] text-[#5B3DF5] bg-white px-2 py-0.5 rounded-[6px] border border-[#EEF0F5]">
              {device.portIndex ? `منفذ #${device.portIndex}` : "غير معين"}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-[700] text-[#6B6880]">جودة الكابل:</span>
            <span
              className={`font-[900] px-2 py-0.5 rounded-[6px] text-[11px] ltr-num ${
                cableQuality >= 80
                  ? "bg-[#E5F8D0] text-[#2F6B0F]"
                  : cableQuality >= 60
                  ? "bg-[#FFF4D5] text-[#8C6B00]"
                  : "bg-[#FFEDE5] text-[#FF7A45]"
              }`}
            >
              {cableQuality}%
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#EEF0F5]">
          <button
            type="submit"
            className="flex-1 h-[42px] bg-[#14121F] hover:bg-[#2A2740] text-white font-[800] text-[12.5px] rounded-[999px] transition-colors cursor-pointer"
          >
            تطبيق التغييرات
          </button>

          {device.mac && onToggleBlock && (
            <button
              type="button"
              onClick={() => onToggleBlock(device.mac!, isBlocked, device.name)}
              className={`h-[42px] px-4 font-[800] text-[12px] rounded-[999px] transition-colors cursor-pointer ${
                isBlocked
                  ? "bg-[#22C55E] text-white hover:bg-[#1ea34d]"
                  : "bg-[#FF7A45] text-white hover:bg-[#e66835]"
              }`}
            >
              {isBlocked ? "تشغيل" : "إيقاف"}
            </button>
          )}

          {parentSwitch && onSelectSwitch && (
            <button
              type="button"
              onClick={() => onSelectSwitch(parentSwitch.id)}
              className="h-[42px] px-3.5 border border-[#EEF0F5] hover:bg-[#F6F6FA] text-[#6B6880] hover:text-[#14121F] font-[800] text-[12px] rounded-[999px] transition-colors cursor-pointer"
              title="خصائص السويتش المتصل به"
            >
              🔀
            </button>
          )}

          {onDeleteDevice && (
            <button
              type="button"
              onClick={() => onDeleteDevice(device.id)}
              className="h-[42px] px-4 border border-[#FF7A45]/40 hover:border-[#FF7A45] text-[#FF7A45] hover:bg-[#FFF1EA] font-[800] text-[12px] rounded-[999px] transition-colors cursor-pointer"
              title="حذف الجهاز من الخريطة"
            >
              حذف
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
