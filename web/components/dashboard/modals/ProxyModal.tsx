"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function ProxyModal() {
  const { activeProxyIframe, setActiveProxyIframe } = useDashboard();

  if (!activeProxyIframe) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md"
      onClick={() => setActiveProxyIframe(null)}
    >
      <div
        className="bento-card bg-white text-[#14121F] w-full max-w-[1200px] h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 px-6 bg-[#F6F6FA] border-b border-[#EEF0F5] flex items-center justify-between gap-3 flex-wrap flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-live-dot" />
            <span className="font-[900] text-[16px] text-[#14121F]">
              التحكم المدمج: {activeProxyIframe.name}
            </span>
            <span className="bg-[#14121F] text-white text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px] ltr-num">
              {activeProxyIframe.ip}
            </span>
            <span className="text-[12px] font-[600] text-[#6B6880] hidden sm:inline">
              (عبر البروكسي الداخلي — يعمل حتى لو كنت على 4G)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/proxy/${activeProxyIframe.ip}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-[#EEF0F5] text-[#14121F] font-[800] text-[12px] px-3.5 py-2 rounded-[999px] transition-colors border border-[#EEF0F5]"
            >
              فتح في تبويب جديد ↗
            </a>
            <button
              type="button"
              className="bg-[#14121F] hover:bg-[#2A2740] text-white font-[800] text-[12px] px-4 py-2 rounded-[999px] transition-colors"
              onClick={() => setActiveProxyIframe(null)}
            >
              إغلاق
            </button>
          </div>
        </div>

        {/* Body Iframe */}
        <div className="flex-1 w-full h-full bg-[#ECEBF3]">
          <iframe
            src={`/api/proxy/${activeProxyIframe.ip}`}
            className="w-full h-full border-none"
            title={activeProxyIframe.name}
          />
        </div>
      </div>
    </div>
  );
}
