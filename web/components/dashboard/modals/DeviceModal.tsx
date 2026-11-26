"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function DeviceModal() {
  const { modalDevice, setModalDevice, saveModalDevice, removeDevice } = useDashboard();

  if (!modalDevice) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={() => setModalDevice(null)}
    >
      <form
        className="bento-card bg-white text-[#14121F] w-full max-w-[440px] shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
        onSubmit={saveModalDevice}
      >
        <h3 className="text-[18px] font-[900] mb-1">
          {modalDevice.isNew ? "تسجيل جهاز جديد في الشبكة" : "تعديل اسم الجهاز"}
        </h3>
        <p className="text-[12px] font-[600] text-[#6B6880] mb-4 ltr-num">
          {modalDevice.ip} · {modalDevice.mac}
        </p>

        <div className="mb-4">
          <label className="text-[12px] font-[800] text-[#14121F] block mb-1.5">
            اسم الجهاز (مثلاً: PC 1 أو SALON)
          </label>
          <input
            type="text"
            className="w-full h-[46px] bg-[#F6F6FA] text-[#14121F] font-[700] text-[14px] rounded-[16px] px-4 border border-[#EEF0F5] outline-none focus:ring-2 focus:ring-[#5B3DF5]"
            placeholder="أدخل اسم الجهاز..."
            value={modalDevice.name}
            onChange={(e) => setModalDevice({ ...modalDevice, name: e.target.value })}
            autoFocus
            required
          />
        </div>

        {/* Device Category Selector */}
        <div className="mb-5">
          <label className="text-[12px] font-[800] text-[#14121F] block mb-1.5">
            نوع وتصنيف الجهاز (تحديد 100%):
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "router", name: "روتور / موزع", icon: "📡" },
              { id: "phone", name: "هاتف ذكي", icon: "📱" },
              { id: "camera", name: "كاميرا / DVR", icon: "📹" },
              { id: "pc", name: "كمبيوتر", icon: "💻" },
              { id: "tv", name: "تلفاز / رسيفر", icon: "📺" },
              { id: "device", name: "جهاز شبكي", icon: "🔌" },
            ].map((cat) => {
              const currentCat = modalDevice.category || "device";
              const isSelected = currentCat === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() =>
                    setModalDevice({
                      ...modalDevice,
                      category: cat.id,
                      catName: cat.name,
                      catIcon: cat.icon,
                    })
                  }
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-[14px] text-[12px] font-[800] border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-[#5B3DF5] text-white border-[#5B3DF5] shadow-sm"
                      : "bg-[#F6F6FA] text-[#14121F] border-[#EEF0F5] hover:bg-[#EEF0F5]"
                  }`}
                >
                  <span className="text-[15px]">{cat.icon}</span>
                  <span className="truncate">{cat.name.split("/")[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#EEF0F5]">
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-[#5B3DF5] hover:bg-[#4a2ee0] text-white font-[800] text-[13px] px-5 py-2.5 rounded-[999px] transition-colors"
            >
              حفظ التغييرات
            </button>
            <button
              type="button"
              className="bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] font-[800] text-[13px] px-4 py-2.5 rounded-[999px] transition-colors"
              onClick={() => setModalDevice(null)}
            >
              إلغاء
            </button>
          </div>

          {!modalDevice.isNew && (
            <button
              type="button"
              className="text-[#FF7A45] hover:bg-[#FFF1EA] font-[800] text-[12px] px-3 py-2 rounded-[999px] transition-colors"
              onClick={() => removeDevice(modalDevice.mac, modalDevice.name)}
            >
              حذف
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
