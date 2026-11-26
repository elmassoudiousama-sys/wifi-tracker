"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { formatPortLabel, healthClass } from "@/features/dashboard/utils";
import type { DeviceState } from "@/lib/store";
import { BentoMapView } from "./BentoMapView";
import { MapEditor } from "@/components/map-editor/MapEditor";

export function BentoCableView() {
  const [viewOption, setViewOption] = useState<"map" | "table" | "edit">("map");

  const {
    sortedCable,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    portFilter,
    setPortFilter,
    categoryFilter,
    setCategoryFilter,
    categoryCounts,
    statusCounts,
    cablePortCounts,
    selected,
    toggleSelected,
    toggleAllVisible,
    bulkBlock,
    bulkUnblock,
    setSelected,
    setInspectItem,
    setModalDevice,
    sendCommand,
    busyMac,
    searchRef,
  } = useDashboard();

  const allVisibleSelected =
    sortedCable.length > 0 && sortedCable.every((d) => selected.has(d.mac));
  const clearSelection = () => setSelected(new Set());

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header & View Option Segmented Control */}
      <div className="bento-card bg-white text-[#14121F]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-[22px] font-[900]">
                {viewOption === "map"
                  ? "خريطة شبكة الكابل الحية"
                  : viewOption === "edit"
                  ? "تعديل وتخطيط خريطة الشبكة"
                  : "جدول أجهزة الكابل (LAN)"}
              </h2>
              <span className="px-2.5 py-0.5 rounded-[999px] bg-[#E5F8D0] text-[#2F6B0F] text-[11px] font-[800] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
                <span>مباشر</span>
              </span>
            </div>
            <p className="text-[13px] font-[600] text-[#6B6880] mt-0.5">
              {viewOption === "map"
                ? "خريطة تفاعلية ترسم مسار الكابلات، السويتشات، سرعة المنافذ وحالة الأجهزة لحظياً من ZTE F680"
                : viewOption === "edit"
                ? "اسحب السويتشات والمنافذ لتطابق التوزيع الفعلي لشبكتك واضغط حفظ التخطيط"
                : "مراقبة سرعة الكابلات، فحص المنافذ والتحكم الفوري في الاتصال"}
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap sm:flex-nowrap">
            {/* View Option 3-Way Toggle: Map vs Table vs Edit */}
            <div className="bg-[#F6F6FA] p-1 rounded-[999px] flex items-center border border-[#E2E0EE]">
              <button
                type="button"
                onClick={() => setViewOption("map")}
                className={`px-3.5 py-1.5 rounded-[999px] text-[12.5px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewOption === "map"
                    ? "bg-[#5B3DF5] text-white shadow-sm"
                    : "text-[#6B6880] hover:text-[#14121F]"
                }`}
              >
                <span>🗺️</span>
                <span>خريطة الشبكة</span>
              </button>
              <button
                type="button"
                onClick={() => setViewOption("table")}
                className={`px-3.5 py-1.5 rounded-[999px] text-[12.5px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewOption === "table"
                    ? "bg-[#14121F] text-white shadow-sm"
                    : "text-[#6B6880] hover:text-[#14121F]"
                }`}
              >
                <span>📋</span>
                <span>جدول الأجهزة</span>
                <span
                  className={`px-2 py-0.2 rounded-full text-[10.5px] font-[900] ${
                    viewOption === "table"
                      ? "bg-white/20 text-white"
                      : "bg-[#E2E0EE] text-[#14121F]"
                  }`}
                >
                  {sortedCable.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setViewOption("edit")}
                className={`px-3.5 py-1.5 rounded-[999px] text-[12.5px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewOption === "edit"
                    ? "bg-[#5B3DF5] text-white shadow-sm"
                    : "text-[#6B6880] hover:text-[#14121F]"
                }`}
              >
                <span>✏️</span>
                <span>تعديل الخريطة</span>
              </button>
            </div>

            {/* Search Input (visible when in Table view) */}
            {viewOption === "table" && (
              <div className="relative w-full lg:w-[260px]">
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="بحث بالاسم، IP، أو MAC (اضغط /)..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-[42px] bg-[#F6F6FA] text-[#14121F] font-[700] text-[13px] rounded-[999px] px-4 pl-10 border-none outline-none focus:ring-2 focus:ring-[#5B3DF5] transition-all"
                />
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-[800] bg-white px-2 py-0.5 rounded-[999px] text-[#6B6880] border border-[#EEF0F5] pointer-events-none">
                  /
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Filters Bar: only show in table mode */}
        {viewOption === "table" && (
          <>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 mt-4 border-t border-[#EEF0F5]">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-[800] text-[#6B6880] ml-1">الحالة:</span>
            {[
              { id: "all", label: "الكل", count: statusCounts.all },
              { id: "online", label: "متصل", count: statusCounts.online },
              { id: "offline", label: "منقطع", count: statusCounts.offline },
              { id: "blocked", label: "محظور", count: statusCounts.blocked },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-[999px] text-[12px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === f.id
                    ? "bg-[#14121F] text-white"
                    : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ltr-num ${
                    statusFilter === f.id ? "bg-[#D7F25C] text-[#14121F]" : "bg-white text-[#6B6880]"
                  }`}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Port Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12px] font-[800] text-[#6B6880] ml-1">المنفذ:</span>
            <button
              type="button"
              onClick={() => setPortFilter("ALL")}
              className={`px-3 py-1.5 rounded-[999px] text-[12px] font-[800] transition-all cursor-pointer ${
                portFilter === "ALL"
                  ? "bg-[#5B3DF5] text-white"
                  : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
              }`}
            >
              الكل
            </button>
            {cablePortCounts.map(([p, count]) => (
              <button
                key={p}
                type="button"
                onClick={() => setPortFilter(p)}
                className={`px-3 py-1.5 rounded-[999px] text-[12px] font-[800] transition-all flex items-center gap-1 cursor-pointer ${
                  portFilter === p
                    ? "bg-[#5B3DF5] text-white"
                    : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
                }`}
              >
                <span>{p}</span>
                <span className="text-[10px] opacity-75 ltr-num">({count})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Filters Bar */}
        <div className="flex items-center gap-1.5 flex-wrap pt-3 border-t border-[#EEF0F5]">
          <span className="text-[12px] font-[800] text-[#6B6880] ml-1">نوع الجهاز:</span>
          {[
            { id: "ALL", label: "الكل", count: categoryCounts.ALL, icon: "🌐" },
            { id: "router", label: "روتورات", count: categoryCounts.router, icon: "📡" },
            { id: "camera", label: "كاميرات / DVR", count: categoryCounts.camera, icon: "📹" },
            { id: "pc", label: "حواسيب", count: categoryCounts.pc, icon: "💻" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-[999px] text-[12px] font-[800] transition-all flex items-center gap-1.5 cursor-pointer ${
                categoryFilter === cat.id
                  ? "bg-[#5B3DF5] text-white"
                  : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ltr-num ${
                  categoryFilter === cat.id ? "bg-[#D7F25C] text-[#14121F]" : "bg-white text-[#6B6880]"
                }`}
              >
                {cat.count || 0}
              </span>
            </button>
          ))}
        </div>

            {/* Bulk Action Ribbon (Shows when items are selected) */}
            {selected.size > 0 && (
              <div className="mt-4 p-3 bg-[#FFF1EA] rounded-[18px] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-[800] text-[#FF7A45]">
                    تم تحديد {selected.size} جهاز
                  </span>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[12px] font-[700] text-[#6B6880] hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={bulkBlock}
                    className="bg-[#FF7A45] text-white text-[12px] font-[800] px-4 py-1.5 rounded-[999px] hover:bg-[#e66835] transition-colors"
                  >
                    إيقاف المحدد
                  </button>
                  <button
                    type="button"
                    onClick={bulkUnblock}
                    className="bg-[#14121F] text-white text-[12px] font-[800] px-4 py-1.5 rounded-[999px] hover:bg-[#2A2740] transition-colors"
                  >
                    تشغيل المحدد
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 2. Main View Content: Live Dynamic Map, Editor, or Devices Table */}
      {viewOption === "map" ? (
        <BentoMapView onSwitchToEdit={() => setViewOption("edit")} />
      ) : viewOption === "edit" ? (
        <MapEditor
          isEmbedded={true}
          onBackToMap={() => setViewOption("map")}
          onBackToTable={() => setViewOption("table")}
        />
      ) : (
        <div className="bento-card bg-white text-[#14121F] overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-[#EEF0F5] text-[12px] font-[800] text-[#6B6880]">
              <th className="py-3 px-3 w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                  className="w-4 h-4 rounded cursor-pointer accent-[#5B3DF5]"
                />
              </th>
              <th className="py-3 px-3">الجهاز</th>
              <th className="py-3 px-3">العنوان (IP & MAC)</th>
              <th className="py-3 px-3">المنفذ</th>
              <th className="py-3 px-3">جودة الكابل</th>
              <th className="py-3 px-3">البينغ</th>
              <th className="py-3 px-3 text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F5]">
            {sortedCable.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6B6880] font-[700]">
                  لا توجد أجهزة مطابقة لخيارات البحث أو الفلترة.
                </td>
              </tr>
            ) : (
              sortedCable.map((device) => {
                const isSelected = selected.has(device.mac);
                const isBusy = busyMac === device.mac;
                const cableHealth = device.cableHealth;

                return (
                  <tr
                    key={device.mac}
                    className={`hover:bg-[#F6F6FA] transition-colors ${
                      isSelected ? "bg-[#FFF1EA]/60" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3.5 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelected(device.mac)}
                        className="w-4 h-4 rounded cursor-pointer accent-[#5B3DF5]"
                      />
                    </td>

                    {/* Device Name + Status Dot + Category Icon & Badge */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            device.online
                              ? "bg-[#22C55E] animate-live-dot"
                              : "bg-[#FF7A45]"
                          }`}
                          title={device.online ? "متصل" : "منقطع"}
                        />
                        <span
                          className="w-8 h-8 rounded-[12px] bg-[#F6F6FA] flex items-center justify-center text-[17px] flex-shrink-0 border border-[#EEF0F5]"
                          title={device.catName || "نوع الجهاز"}
                        >
                          {device.catIcon || "🔌"}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-[800] text-[14px] text-[#14121F]">
                              {device.name}
                            </span>
                            {device.catName && (
                              <span className="bg-[#F0EFF8] text-[#5B3DF5] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                {device.catName}
                              </span>
                            )}
                            {device.online && (
                              device.medium === "WLAN" || device.port?.startsWith("DEV.WIFI") ? (
                                <span className="bg-[#E5F8D0] text-[#2F6B0F] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                  ويفي ZTE مباشر
                                </span>
                              ) : device.category === "router" ? (
                                <span className="bg-[#EDE9FE] text-[#5B3DF5] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                  روتور موزع ({device.port})
                                </span>
                              ) : (
                                <span className="bg-[#FFF1EA] text-[#C2410C] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                  جاي من روتور خارجي ({device.port})
                                </span>
                              )
                            )}
                            {device.blocked && (
                              <span className="bg-[#14121F] text-[#D7F25C] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]">
                                محظور
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] font-[600] text-[#6B6880]">
                            {device.httpTitle || device.vendor || device.hostname || "جهاز سلكي"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* IP & MAC */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-[700] text-[#14121F] ltr-num">
                          {device.ip}
                        </span>
                        <span className="text-[11px] font-[600] text-[#6B6880] ltr-num">
                          {device.mac}
                        </span>
                      </div>
                    </td>

                    {/* LAN Port */}
                    <td className="py-3.5 px-3">
                      <span className="bg-[#14121F] text-white text-[11px] font-[800] px-2.5 py-1 rounded-[999px] ltr-num">
                        {formatPortLabel(device.port)}
                      </span>
                    </td>

                    {/* Cable Health */}
                    <td className="py-3.5 px-3">
                      {cableHealth ? (
                        <span
                          className={`text-[11px] font-[800] px-2.5 py-1 rounded-[999px] inline-block ${
                            cableHealth.score >= 85
                              ? "bg-[#E5F8D0] text-[#2F6B0F]"
                              : "bg-[#FFF1EA] text-[#FF7A45]"
                          }`}
                        >
                          {cableHealth.score}% {cableHealth.quality}
                        </span>
                      ) : (
                        <span className="text-[12px] font-[600] text-[#6B6880]">—</span>
                      )}
                    </td>

                    {/* Ping */}
                    <td className="py-3.5 px-3">
                      {device.latencyMs !== undefined && device.latencyMs !== null ? (
                        <span className="text-[13px] font-[700] text-[#14121F] ltr-num">
                          {device.latencyMs.toFixed(1)} ms
                        </span>
                      ) : (
                        <span className="text-[12px] font-[600] text-[#6B6880]">—</span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-3 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectItem(device as unknown as Record<string, unknown>)}
                          className="bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] text-[11px] font-[800] px-3 py-1.5 rounded-[999px] transition-colors"
                        >
                          فحص
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setModalDevice({
                              mac: device.mac,
                              name: device.name,
                              ip: device.ip,
                              port: device.port,
                              medium: device.medium,
                              isNew: false,
                              category: device.category,
                              catName: device.catName,
                              catIcon: device.catIcon,
                            })
                          }
                          className="bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] text-[11px] font-[800] px-3 py-1.5 rounded-[999px] transition-colors"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            sendCommand(
                              device.blocked ? "unblock" : "block",
                              device.mac,
                              device.name,
                              device.blockInstId
                            )
                          }
                          className={`text-[11px] font-[800] px-3 py-1.5 rounded-[999px] transition-colors ${
                            device.blocked
                              ? "bg-[#14121F] text-white hover:bg-[#2A2740]"
                              : "bg-[#FF7A45] text-white hover:bg-[#e66835]"
                          }`}
                        >
                          {isBusy ? "..." : device.blocked ? "تشغيل" : "إيقاف"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
