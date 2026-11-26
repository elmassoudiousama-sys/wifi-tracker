"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { formatPortLabel, hasWebAdmin } from "@/features/dashboard/utils";
import type { CableHealthInfo, DrawerTab } from "@/features/dashboard/types";

export function DeviceDrawer() {
  const {
    inspectItem,
    setInspectItem,
    drawerTab,
    setDrawerTab,
    setActiveProxyIframe,
    copyProxyLink,
    setModalDevice,
    busyMac,
    sendCommand,
  } = useDashboard();

  if (!inspectItem) return null;

  const inspectCable = inspectItem.cableHealth as CableHealthInfo | undefined;
  const inspectIp = String(inspectItem.ip || "");
  const inspectMac = String(inspectItem.mac || "");
  const inspectName = String(
    inspectItem.name || inspectItem.friendlyName || inspectItem.hostname || inspectIp || "—"
  );
  const inspectBlocked = Boolean(inspectItem.blocked);
  const inspectKnown = inspectItem.expectedIp !== undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      onClick={() => setInspectItem(null)}
    >
      <aside
        className="w-full max-w-[480px] h-full bg-white text-[#14121F] shadow-2xl flex flex-col p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="تفاصيل الجهاز"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#EEF0F5] mb-5">
          <span className="text-[18px] font-[900]">تفاصيل وفحص الجهاز</span>
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-[#F6F6FA] hover:bg-[#EEF0F5] flex items-center justify-center text-[#14121F] font-bold text-[16px] transition-colors"
            onClick={() => setInspectItem(null)}
            aria-label="إغلاق"
          >
            ✕
          </button>
        </div>

        {/* Hero Info */}
        <div className="bg-[#F6F6FA] p-5 rounded-[22px] mb-5 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-[20px] bg-white text-[#5B3DF5] shadow-sm flex items-center justify-center text-[28px] mb-3">
            {String(inspectItem.catIcon || "💻")}
          </div>
          <h3 className="text-[18px] font-[900] text-[#14121F] mb-1">{inspectName}</h3>
          <p className="text-[12px] font-[600] text-[#6B6880] mb-3">
            {String(inspectItem.vendor || "جهاز شبكي")}
            {inspectItem.catName ? ` · ${String(inspectItem.catName)}` : ""}
          </p>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-[999px] text-[11px] font-[800] flex items-center gap-1.5 ${
                inspectBlocked
                  ? "bg-[#FFF1EA] text-[#FF7A45]"
                  : inspectItem.online === false
                  ? "bg-[#FFF1EA] text-[#FF7A45]"
                  : "bg-[#E5F8D0] text-[#2F6B0F]"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  inspectBlocked
                    ? "bg-[#FF7A45]"
                    : inspectItem.online === false
                    ? "bg-[#FF7A45]"
                    : "bg-[#22C55E] animate-live-dot"
                }`}
              />
              {inspectBlocked ? "محظور" : inspectItem.online === false ? "منقطع" : "متصل"}
            </span>

            <span className="bg-[#14121F] text-white px-3 py-1 rounded-[999px] text-[11px] font-[800] ltr-num">
              {formatPortLabel(String(inspectItem.port || ""))}
            </span>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 mb-6">
          {hasWebAdmin(inspectItem) ? (
            <button
              type="button"
              className="flex-1 bg-[#5B3DF5] hover:bg-[#4a2ee0] text-white font-[800] text-[13px] h-[44px] rounded-[999px] transition-colors"
              onClick={() => {
                const ip = inspectIp;
                const nm = inspectName;
                setInspectItem(null);
                setActiveProxyIframe({ ip, name: nm });
              }}
            >
              تحكم عن بعد (Proxy)
            </button>
          ) : (
            <button
              type="button"
              className="flex-1 bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] font-[800] text-[13px] h-[44px] rounded-[999px] transition-colors"
              onClick={() => copyProxyLink(inspectIp)}
              disabled={!inspectIp}
            >
              نسخ رابط البروكسي
            </button>
          )}

          {inspectKnown && (
            <button
              type="button"
              className="h-[44px] px-4 bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] font-[800] text-[13px] rounded-[999px] transition-colors"
              title="تعديل الاسم"
              onClick={() => {
                setModalDevice({
                  mac: inspectMac,
                  name: String(inspectItem.name || ""),
                  ip: inspectIp,
                  port: String(inspectItem.port || ""),
                  medium: String(inspectItem.medium || "LAN"),
                  isNew: false,
                });
                setInspectItem(null);
              }}
            >
              تعديل
            </button>
          )}

          <button
            type="button"
            className={`h-[44px] px-4 font-[800] text-[13px] rounded-[999px] transition-colors ${
              inspectBlocked
                ? "bg-[#14121F] text-white hover:bg-[#2A2740]"
                : "bg-[#FF7A45] text-white hover:bg-[#e66835]"
            }`}
            disabled={busyMac === inspectMac}
            onClick={async () => {
              await sendCommand(
                inspectBlocked ? "unblock" : "block",
                inspectMac,
                inspectName,
                String(inspectItem.blockInstId || "")
              );
              setInspectItem({ ...inspectItem, blocked: !inspectBlocked });
            }}
          >
            {inspectBlocked ? "تشغيل" : "إيقاف"}
          </button>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F6F6FA] rounded-[999px] mb-5">
          {[
            { id: "info", label: "معلومات" },
            { id: "network", label: "جودة الكابل" },
            { id: "actions", label: "المنافذ" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setDrawerTab(t.id as DrawerTab)}
              className={`flex-1 py-2 text-[12px] font-[800] rounded-[999px] transition-all ${
                drawerTab === t.id
                  ? "bg-white text-[#14121F] shadow-sm"
                  : "text-[#6B6880] hover:text-[#14121F]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="flex-1">
          {drawerTab === "info" && (
            <div className="space-y-3">
              <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between items-center text-[13px]">
                <span className="font-[700] text-[#6B6880]">عنوان IP الحقيقي:</span>
                <span className="font-[800] text-[#14121F] ltr-num">{inspectIp}</span>
              </div>
              <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between items-center text-[13px]">
                <span className="font-[700] text-[#6B6880]">عنوان MAC:</span>
                <span className="font-[800] text-[#14121F] ltr-num">{inspectMac}</span>
              </div>
              <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between items-center text-[13px]">
                <span className="font-[700] text-[#6B6880]">المنفذ المتصل:</span>
                <span className="font-[800] text-[#14121F] ltr-num">
                  {formatPortLabel(String(inspectItem.port || ""))}
                </span>
              </div>
              {inspectItem.latencyMs !== undefined && inspectItem.latencyMs !== null && (
                <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between items-center text-[13px]">
                  <span className="font-[700] text-[#6B6880]">زمن الاستجابة (Ping):</span>
                  <span className="font-[800] text-[#14121F] ltr-num">
                    {Number(inspectItem.latencyMs).toFixed(1)} ms
                  </span>
                </div>
              )}
            </div>
          )}

          {drawerTab === "network" && (
            <div className="space-y-3">
              {inspectCable ? (
                <>
                  <div className="p-4 bg-[#E5F8D0] text-[#2F6B0F] rounded-[18px] text-center">
                    <span className="text-[28px] font-[900] block ltr-num">
                      {inspectCable.score}%
                    </span>
                    <span className="text-[13px] font-[800]">حالة الكابل: {inspectCable.quality}</span>
                  </div>
                  <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between text-[13px]">
                    <span className="text-[#6B6880] font-[700]">تذبذب الإشارة (Jitter):</span>
                    <span className="font-[800] ltr-num">{inspectCable.jitter} ms</span>
                  </div>
                  <div className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between text-[13px]">
                    <span className="text-[#6B6880] font-[700]">فقدان الحزم (Packet Loss):</span>
                    <span className="font-[800] ltr-num">{inspectCable.loss}%</span>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                  لا تتوفر قياسات فحص الكابل لهذا الجهاز حالياً.
                </div>
              )}
            </div>
          )}

          {drawerTab === "actions" && (
            <div className="space-y-2">
              {Array.isArray(inspectItem.openPorts) && inspectItem.openPorts.length > 0 ? (
                inspectItem.openPorts.map((p: any) => (
                  <div
                    key={p}
                    className="p-3 bg-[#F6F6FA] rounded-[16px] flex justify-between items-center text-[13px]"
                  >
                    <span className="font-[800] text-[#14121F] ltr-num">{p}</span>
                    <span className="bg-[#E5F8D0] text-[#2F6B0F] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]">
                      مفتوح
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                  لم يتم اكتشاف منافذ مفتوحة غير قياسية.
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
