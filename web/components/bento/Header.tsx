"use client";

import React, { useState, useEffect } from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import type { View } from "@/features/dashboard/types";

export function Header() {
  const {
    view,
    setView,
    cableDevices,
    wifiClients,
    webEquipment,
    unknownDevices,
    blockedRules,
    state,
    sendCommand,
    showToast,
  } = useDashboard();

  const [clock, setClock] = useState<string>("23:14:35");
  const [isScanning, setIsScanning] = useState(false);

  // Keep clock ticking every second
  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const updateTime = () => {
      const now = new Date();
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalSecurityCount = (unknownDevices?.length || 0) + (blockedRules?.length || 0);
  const totalActivityCount =
    (state?.alerts?.length || 0) + (state?.blackoutHistory?.length || 0);

  const tabs: Array<{ id: View; name: string; count?: number }> = [
    { id: "overview", name: "نظرة عامة" },
    { id: "cable", name: "أجهزة الكابل", count: cableDevices.length },
    { id: "wifi", name: "الويفي", count: wifiClients.length },
    { id: "gateway", name: "البوابة", count: webEquipment.length },
    { id: "security", name: "الأمان", count: totalSecurityCount },
    { id: "activity", name: "السجل", count: totalActivityCount },
  ];

  const handleDeepScan = async () => {
    setIsScanning(true);
    showToast("جاري فحص جودة الاتصال وتحديث كابلات الشبكة...");
    try {
      await sendCommand("run_diagnostics");
      await sendCommand("rescan_network");
      showToast("اكتمل الفحص العميق بنجاح ✓");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <header className="flex flex-col lg:flex-row items-center justify-between gap-4 w-full">
      {/* Right / Start (RTL): Logo + Router Info */}
      <div className="flex items-center gap-3 w-full lg:w-auto flex-shrink-0">
        <div className="w-12 h-12 rounded-[16px] bg-[#5B3DF5] flex items-center justify-center flex-shrink-0 shadow-sm">
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
        </div>
        <div>
          <h1 className="text-[18px] font-[800] text-[#14121F] leading-tight">
            مراقبة الشبكة
          </h1>
          <p className="text-[12px] font-[600] text-[#6B6880] ltr-num">
            ZTE F680 · 192.168.1.1
          </p>
        </div>
      </div>

      {/* Center: White Pill Navigation Tabs */}
      <nav
        aria-label="أقسام لوحة التحكم"
        className="bg-white p-[5px] rounded-[999px] flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar flex-shrink min-w-0"
      >
        {tabs.map((tab) => {
          const isActive = view === tab.id;
          if (isActive) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className="bg-[#14121F] text-white font-[800] text-[13px] sm:text-[14px] px-3.5 sm:px-[16px] py-[8px] sm:py-[10px] rounded-[999px] flex items-center gap-1.5 transition-all flex-shrink-0 cursor-pointer shadow-sm"
              >
                <span>{tab.name}</span>
                {tab.count !== undefined && (
                  <span className="bg-[#D7F25C] text-[#14121F] text-[10px] sm:text-[11px] font-[900] px-2 py-0.5 rounded-[999px] ltr-num">
                    {tab.count}
                  </span>
                )}
                {tab.id === "overview" && (
                  <span className="bg-[#D7F25C] text-[#14121F] text-[10px] sm:text-[11px] font-[900] px-2 py-0.5 rounded-[999px] ltr-num">
                    حي
                  </span>
                )}
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className="text-[#14121F] font-[700] text-[13px] sm:text-[14px] px-3.5 sm:px-[16px] py-[8px] sm:py-[10px] rounded-[999px] flex items-center gap-1.5 hover:bg-[#F6F6FA] transition-all flex-shrink-0 cursor-pointer"
            >
              <span>{tab.name}</span>
              {tab.count !== undefined && (
                <span className="bg-[#14121F] text-white text-[10px] sm:text-[11px] font-[800] px-1.5 sm:px-2 py-0.5 rounded-[999px] ltr-num">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Left / End (RTL): Live clock pill + Deep scan button */}
      <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-shrink-0">
        <div className="bg-white px-4 py-2.5 rounded-[999px] flex items-center gap-2 text-[#14121F] font-[800] text-[13px] sm:text-[14px]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-live-dot flex-shrink-0" />
          <span>مباشر</span>
          <span className="ltr-num font-[800]">{clock}</span>
        </div>
        <button
          type="button"
          onClick={handleDeepScan}
          disabled={isScanning}
          className={`bg-[#14121F] text-white font-[800] h-[44px] px-5 sm:px-6 rounded-[999px] hover:bg-[#2A2740] transition-colors flex items-center justify-center flex-shrink-0 text-[13px] sm:text-[14px] cursor-pointer ${
            isScanning ? "opacity-75 cursor-wait" : ""
          }`}
        >
          {isScanning ? "جاري الفحص..." : "فحص عميق"}
        </button>
      </div>
    </header>
  );
}
