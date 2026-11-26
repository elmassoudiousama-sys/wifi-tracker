"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function BentoActivityView() {
  const { state, clearAlerts } = useDashboard();

  const blackouts = state?.blackoutHistory || [];
  const alerts = state?.alerts || [];

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header Card */}
      <div className="bento-card bg-white text-[#14121F]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-[900]">سجل الاستقرار والتنبيهات اللحظية</h2>
            <p className="text-[13px] font-[600] text-[#6B6880] mt-0.5">
              تتبع فترات الانقطاع (Outages)، أحداث انقطاع الكابلات، ورسائل النظام
            </p>
          </div>
          <button
            type="button"
            onClick={clearAlerts}
            className="btn-outline px-4 py-2 rounded-[999px] text-[12px] font-[800] transition-colors"
          >
            مسح كل التنبيهات
          </button>
        </div>
      </div>

      {/* 2. Grid of 2 Cards: Blackouts & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        {/* Blackout Outages History */}
        <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[18px] font-[800]">سجل الانقطاعات (Blackouts)</h3>
                <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
                  أجهزة الكابل التي شهدت فترات انقطاع مؤقت
                </p>
              </div>
              <span className="bg-[#FFF1EA] text-[#FF7A45] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
                {blackouts.length} حدث
              </span>
            </div>

            {blackouts.length === 0 ? (
              <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                استقرار ممتاز! لا توجد سجلات انقطاع مسجلة مؤخراً ✓
              </div>
            ) : (
              <div className="divide-y divide-[#EEF0F5]">
                {blackouts.slice(0, 10).map((b) => (
                  <div
                    key={b.id || `${b.mac}-${b.startedAt}`}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          b.active ? "bg-[#FF7A45] animate-live-dot" : "bg-[#6B6880]"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-[800] text-[14px] text-[#14121F]">
                            {b.name || "جهاز كابل"}
                          </span>
                          <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-2 py-0.5 rounded-[999px] ltr-num">
                            {b.port || "LAN"}
                          </span>
                        </div>
                        <span className="text-[11px] font-[600] text-[#6B6880] ltr-num block mt-0.5">
                          بدأ: {b.startedAt}
                        </span>
                      </div>
                    </div>

                    <div className="text-left flex-shrink-0">
                      <span className="text-[12px] font-[800] text-[#FF7A45] ltr-num block">
                        {b.duration || "مستمر"}
                      </span>
                      <span className="text-[10px] font-[700] text-[#6B6880]">
                        {b.active ? "منقطع الآن" : "تمت الاستعادة"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[18px] font-[800]">تنبيهات النظام اللحظية</h3>
                <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
                  إشعارات الاتصال، إعادة الفحص، وتغييرات الشبكة
                </p>
              </div>
              <span className="bg-[#14121F] text-white text-[12px] font-[800] px-3 py-1 rounded-[999px] ltr-num">
                {alerts.length} تنبيه
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                لا توجد تنبيهات جديدة معلقة.
              </div>
            ) : (
              <div className="divide-y divide-[#EEF0F5]">
                {alerts.slice(0, 10).map((a, i) => (
                  <div key={i} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#5B3DF5] mt-1.5 flex-shrink-0" />
                      <div>
                        <span className="font-[800] text-[13px] text-[#14121F] block">
                          {a.name || a.message}
                        </span>
                        <span className="text-[11px] font-[600] text-[#6B6880] block mt-0.5 ltr-num">
                          {a.message}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] font-[700] text-[#6B6880] ltr-num flex-shrink-0">
                      {a.at || "الآن"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
