"use client";

import React, { useState, useEffect } from "react";
import { MapSwitch } from "@/lib/map-data";

interface SwitchPanelProps {
  switchData: MapSwitch | null;
  onUpdate: (updated: Partial<MapSwitch>) => void;
  onDelete: (switchId: string) => void;
  onSelectDevice?: (deviceId: string) => void;
  selectedDeviceId?: string;
  onAssignDevicePort?: (switchId: string, deviceId: string, portIndex?: number) => void;
}

export function SwitchPanel({
  switchData,
  onUpdate,
  onDelete,
  onSelectDevice,
  selectedDeviceId,
  onAssignDevicePort,
}: SwitchPanelProps) {
  const [name, setName] = useState(switchData?.name || "Switch 1");
  const [uplink, setUplink] = useState<MapSwitch["uplinkHub"]>(
    switchData?.uplinkHub || "LAN1"
  );
  const [ports, setPorts] = useState<number>(switchData?.ports || 8);
  const [activePortIndex, setActivePortIndex] = useState<number>(1);

  useEffect(() => {
    if (switchData) {
      setName(switchData.name);
      setUplink(switchData.uplinkHub);
      setPorts(switchData.ports);
    }
  }, [switchData]);

  if (!switchData) {
    return (
      <div className="bento-card bg-white text-[#14121F] flex flex-col items-center justify-center p-8 text-center text-[#6B6880]">
        <span className="text-[32px] mb-2">🔀</span>
        <h3 className="text-[16px] font-[800] text-[#14121F]">حدد Switch في الخريطة</h3>
        <p className="text-[12px] font-[600] mt-1">
          كليكي على أي Switch باش تعدل الاسم، عدد المنافذ، وتوزيع الأجهزة عليه.
        </p>
      </div>
    );
  }

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      name,
      uplinkHub: uplink,
      ports,
      uplinkColor:
        uplink === "LAN1"
          ? "#5B3DF5"
          : uplink === "LAN2"
          ? "#FF7A45"
          : uplink === "LAN3"
          ? "#D7F25C"
          : uplink === "WIFI"
          ? "#5B3DF5"
          : "#14121F",
    });
  };

  // Generate port slots dynamically from real assigned devices only!
  const portSlots = Array.from({ length: Math.min(ports, 16) }).map((_, i) => {
    if (i === 0) {
      return { index: 0, portNumber: 1, type: "uplink", label: "Uplink", sub: uplink, devId: "uplink" };
    }
    const portNumber = i + 1;
    const dev = (switchData.devices || []).find((d) => d.portIndex === portNumber);
    if (dev) {
      const isSelected = activePortIndex === portNumber || dev.id === selectedDeviceId;
      const typeLabel =
        dev.type === "router"
          ? "روتور"
          : dev.type === "phone"
          ? "هاتف"
          : dev.type === "camera"
          ? "كاميرا"
          : "جهاز";
      return {
        index: i,
        portNumber,
        type: isSelected ? "selected" : "used",
        label: dev.name,
        sub: `${typeLabel}${dev.cableQuality ? ` · ${dev.cableQuality}%` : ""}`,
        devId: dev.id,
      };
    }
    return {
      index: i,
      portNumber,
      type: "empty",
      label: "فارغ",
      sub: `منفذ ${portNumber}`,
      devId: undefined,
    };
  });

  const unassignedDevices = (switchData.devices || []).filter((d) => !d.portIndex);

  return (
    <div className="bento-card bg-white text-[#14121F] flex flex-col gap-4">
      {/* Header + Violet "محدد" Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-[#EEF0F5]">
        <div className="flex items-center gap-2">
          <h2 className="text-[18px] font-[900] text-[#14121F]">خصائص Switch</h2>
          <span className="bg-[#5B3DF5] text-white text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px]">
            محدد
          </span>
        </div>
        <span className="text-[11px] font-[700] text-[#6B6880] ltr-num">
          {switchData.id}
        </span>
      </div>

      <form onSubmit={handleApply} className="flex flex-col gap-4">
        {/* Name input */}
        <div>
          <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
            اسم Switch
          </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم السويتش..."
              className="w-full h-[42px] bg-[#F6F6FA] text-[#14121F] font-[700] text-[13px] rounded-[14px] px-3.5 border border-[#EEF0F5] outline-none focus:ring-2 focus:ring-[#5B3DF5]"
            />
        </div>

        {/* Select "متوصل بـ" */}
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
              متوصل بـ (Uplink)
            </label>
            <select
              value={uplink}
              onChange={(e) => setUplink(e.target.value as any)}
              className="w-full h-[42px] bg-[#F6F6FA] text-[#14121F] font-[700] text-[13px] rounded-[14px] px-3 border border-[#EEF0F5] outline-none focus:ring-2 focus:ring-[#5B3DF5]"
            >
              <option value="LAN1">منفذ LAN1 (فايبر)</option>
              <option value="LAN2">منفذ LAN2 (فايبر)</option>
              <option value="LAN3">منفذ LAN3 (فايبر)</option>
              <option value="LAN4">منفذ LAN4 (فايبر)</option>
              <option value="WIFI">شبكة Wi-Fi</option>
            </select>
          </div>

          {/* Segmented "عدد المنافذ" 5|8|16|24 (8 active = dark) */}
          <div>
            <label className="text-[12px] font-[800] text-[#14121F] block mb-1">
              عدد المنافذ
            </label>
            <div className="h-[42px] bg-[#F6F6FA] p-1 rounded-[14px] flex items-center gap-1 border border-[#EEF0F5]">
              {[5, 8, 16, 24].map((pCount) => (
                <button
                  key={pCount}
                  type="button"
                  onClick={() => setPorts(pCount)}
                  className={`flex-1 h-full rounded-[10px] text-[12px] font-[800] transition-all cursor-pointer ltr-num ${
                    ports === pCount
                      ? "bg-[#14121F] text-white shadow-xs"
                      : "text-[#6B6880] hover:text-[#14121F]"
                  }`}
                >
                  {pCount}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* "خريطة المنافذ (كل منفذ = جهاز)" 4x2 grid */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[12px] font-[800] text-[#14121F]">
              خريطة المنافذ (كل منفذ = جهاز):
            </label>
            <span className="text-[10px] font-[700] text-[#6B6880]">
              {switchData.devices.length + 1}/{ports} مستعمل
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {portSlots.slice(0, Math.min(ports, 8)).map((slot) => {
              if (slot.type === "uplink") {
                return (
                  <div
                    key={slot.index}
                    className="h-[58px] rounded-[14px] p-2 bg-[#5B3DF5] text-white flex flex-col justify-between text-right shadow-xs select-none"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-[800] bg-white/20 px-1 rounded ltr-num">
                        #1
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D7F25C]" />
                    </div>
                    <span className="text-[11px] font-[900] truncate">
                      Uplink
                    </span>
                  </div>
                );
              }

              if (slot.type === "selected") {
                return (
                  <div
                    key={slot.index}
                    onClick={() => {
                      setActivePortIndex(slot.index);
                      if (slot.devId && onSelectDevice) onSelectDevice(slot.devId);
                    }}
                    className="h-[58px] rounded-[14px] p-2 bg-[#FFEDE5] border-2 border-[#FF7A45] text-[#FF7A45] flex flex-col justify-between text-right cursor-pointer shadow-xs select-none transition-transform hover:scale-105"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-[900] ltr-num">
                        #{slot.index + 1}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A45]" />
                    </div>
                    <span className="text-[11px] font-[900] truncate text-[#14121F]">
                      {slot.label}
                    </span>
                  </div>
                );
              }

              if (slot.type === "used") {
                return (
                  <div
                    key={slot.index}
                    onClick={() => {
                      setActivePortIndex(slot.index);
                      if (slot.devId && onSelectDevice) onSelectDevice(slot.devId);
                    }}
                    className="h-[58px] rounded-[14px] p-2 bg-[#E5F8D0] text-[#2F6B0F] flex flex-col justify-between text-right cursor-pointer select-none transition-transform hover:scale-105"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-[800] ltr-num">
                        #{slot.index + 1}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                    </div>
                    <span className="text-[11px] font-[900] truncate">
                      {slot.label}
                    </span>
                  </div>
                );
              }

              // Empty slot
              return (
                <div
                  key={slot.index}
                  className="h-[58px] rounded-[14px] p-2 border-2 border-dashed border-[#EEF0F5] bg-[#F6F6FA]/50 text-[#6B6880] flex flex-col justify-between text-right select-none"
                >
                  <span className="text-[10px] font-[700] ltr-num">
                    #{slot.index + 1}
                  </span>
                  <span className="text-[10px] font-[700] text-center">
                    فارغ
                  </span>
                </div>
              );
            })}
          </div>

          {/* Unassigned devices section */}
          {unassignedDevices.length > 0 && (
            <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-[#EEF0F5]">
              <div className="flex items-center justify-between text-[12px] font-[800]">
                <span className="text-[#FF7A45]">أجهزة غير معينة لمنفذ ({unassignedDevices.length})</span>
                <span className="text-[10.5px] font-[600] text-[#6B6880]">حدد المنفذ للربط</span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                {unassignedDevices.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between p-2 bg-[#F6F6FA] hover:bg-[#EEF0F5] rounded-[10px] text-[12px] transition-colors"
                  >
                    <span className="font-[800] truncate max-w-[130px] text-[#14121F]">
                      {d.name}
                    </span>
                    <select
                      value=""
                      onChange={(e) => {
                        const p = Number(e.target.value);
                        if (p > 0) onAssignDevicePort?.(switchData.id, d.id, p);
                      }}
                      className="text-[11px] font-[800] bg-white text-[#14121F] border border-[#E2E0EE] rounded-[8px] px-2 py-1 outline-none cursor-pointer"
                    >
                      <option value="">+ تعيين للمنفذ...</option>
                      {Array.from({ length: ports }).map((_, idx) => {
                        const p = idx + 1;
                        const occ = switchData.devices.some((dev) => dev.portIndex === p);
                        return (
                          <option key={p} value={p} disabled={occ}>
                            منفذ #{p} {occ ? "(مشغول)" : "(فارغ)"}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Buttons "تطبيق" and "حذف" */}
        <div className="flex items-center gap-2 pt-2 border-t border-[#EEF0F5]">
          <button
            type="submit"
            className="flex-1 h-[46px] bg-[#14121F] hover:bg-[#2A2740] text-white font-[800] text-[13px] rounded-[999px] transition-colors cursor-pointer"
          >
            تطبيق التغييرات
          </button>
          <button
            type="button"
            onClick={() => onDelete(switchData.id)}
            className="h-[46px] px-5 border border-[#FF7A45]/40 hover:border-[#FF7A45] text-[#FF7A45] hover:bg-[#FFF1EA] font-[800] text-[13px] rounded-[999px] transition-colors cursor-pointer"
          >
            حذف
          </button>
        </div>
      </form>
    </div>
  );
}
