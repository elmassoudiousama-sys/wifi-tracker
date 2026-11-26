"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function RebootModal() {
  const { confirmReboot, setConfirmReboot, sendCommand } = useDashboard();

  if (!confirmReboot) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setConfirmReboot(false)}
    >
      <div
        className="bento-card bg-white text-[#14121F] w-full max-w-[480px] shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-[14px] bg-[#FFF1EA] text-[#FF7A45] flex items-center justify-center flex-shrink-0">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-[18px] font-[900] text-[#FF7A45]">
            تأكيد إعادة تشغيل الراوتر
          </h3>
        </div>

        <p className="text-[13px] font-[600] text-[#6B6880] leading-relaxed mb-6">
          هل أنت متأكد من إعادة تشغيل الراوتر الرئيسي{" "}
          <strong className="text-[#14121F]">ZTE F680</strong> عن بعد؟ سيتم قطع الإنترنت مؤقتاً
          لمدة دقيقة ثم استعادة الاتصال تلقائياً.
        </p>

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-5 py-2.5 rounded-[999px] text-[13px] font-[800] bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] transition-colors"
            onClick={() => setConfirmReboot(false)}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="px-5 py-2.5 rounded-[999px] text-[13px] font-[800] bg-[#FF7A45] hover:bg-[#e66835] text-white transition-colors"
            onClick={() => {
              setConfirmReboot(false);
              sendCommand("reboot_router", "ROUTER", "ZTE F680");
            }}
          >
            تأكيد إعادة التشغيل الآن
          </button>
        </div>
      </div>
    </div>
  );
}
