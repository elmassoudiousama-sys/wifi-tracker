"use client";

import React from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function BentoGatewayView() {
  const { state, webEquipment, setActiveProxyIframe, showToast } = useDashboard();
  const rh = state?.routerHealth;
  const dhcpLeases = state?.dhcpLeases || [];

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header Card */}
      <div className="bento-card bg-white text-[#14121F]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-[22px] font-[900]">بوابة الرواتر والكاميرات (Gateway & DVR)</h2>
            <p className="text-[13px] font-[600] text-[#6B6880] mt-0.5">
              الدخول المباشر لإدارة أجهزة التوزيع، الرواتر الفرعية، وأنظمة المراقبة (حتى عبر 4G)
            </p>
          </div>
          <span className="bg-[#14121F] text-white text-[12px] font-[800] px-4 py-2 rounded-[999px]">
            {webEquipment.length} أجهزة شبكية
          </span>
        </div>

        {rh && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4 pt-4 border-t border-[#EEF0F5]">
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">إشارة الفايبر (RX)</span>
              <span className="text-[14px] font-[900] ltr-num">{rh.rxPowerDbm || "--"} dBm</span>
            </div>
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">الإرسال (TX)</span>
              <span className="text-[14px] font-[900] ltr-num">{rh.txPowerDbm || "--"} dBm</span>
            </div>
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">حرارة الليزر</span>
              <span className="text-[14px] font-[900] ltr-num">{rh.tempC || "--"} °C</span>
            </div>
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">المعالج / الذاكرة</span>
              <span className="text-[14px] font-[900] ltr-num">{rh.cpuUsage}% / {rh.memUsage}%</span>
            </div>
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">مدة التشغيل</span>
              <span className="text-[14px] font-[900] ltr-num">{Math.round(rh.uptimeSec / 3600)}h</span>
            </div>
            <div className="bg-[#F6F6FA] p-2.5 rounded-[14px]">
              <span className="text-[10px] font-[700] text-[#6B6880] block">إصدار النظام</span>
              <span className="text-[12px] font-[900] ltr-num truncate block">{rh.softwareVer || rh.model}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Grid of Equipment Bento Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[22px]">
        {webEquipment.map((eq) => {
          const isOnt = eq.type === "ont";
          const isCamera = eq.type === "camera";

          return (
            <div
              key={eq.ip}
              className={`bento-card flex flex-col justify-between transition-all ${
                isOnt
                  ? "bg-[#5B3DF5] text-white"
                  : isCamera
                  ? "bg-[#14121F] text-white"
                  : "bg-white text-[#14121F]"
              }`}
            >
              {/* Top row: Type badge + Status dot */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[11px] font-[900] px-3 py-1 rounded-[999px] ${
                      isOnt
                        ? "bg-[#D7F25C] text-[#14121F]"
                        : isCamera
                        ? "bg-[#FF7A45] text-white"
                        : "bg-[#F6F6FA] text-[#14121F]"
                    }`}
                  >
                    {isOnt
                      ? "روتور الفايبر الرئيسي"
                      : isCamera
                      ? "كاميرات المراقبة (DVR)"
                      : "روتور فرعي"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-live-dot" />
                    <span className="text-[12px] font-[700] opacity-80">نشط</span>
                  </div>
                </div>

                {/* Name & Model */}
                <h3 className="text-[18px] font-[900] leading-snug mb-1">{eq.name}</h3>
                <p
                  className={`text-[12px] font-[600] mb-4 ${
                    isOnt || isCamera ? "text-white/70" : "text-[#6B6880]"
                  }`}
                >
                  {eq.model}
                </p>

                {/* IP & Ping info */}
                <div
                  className={`p-3 rounded-[18px] mb-4 flex items-center justify-between ${
                    isOnt
                      ? "bg-white/10"
                      : isCamera
                      ? "bg-[#2A2740]"
                      : "bg-[#F6F6FA]"
                  }`}
                >
                  <div>
                    <span
                      className={`text-[11px] font-[700] block ${
                        isOnt || isCamera ? "text-white/70" : "text-[#6B6880]"
                      }`}
                    >
                      عنوان الـ IP
                    </span>
                    <span className="text-[14px] font-[900] ltr-num">{eq.ip}</span>
                  </div>
                  {eq.pingMs !== undefined && eq.pingMs !== null && (
                    <div className="text-left">
                      <span
                        className={`text-[11px] font-[700] block ${
                          isOnt || isCamera ? "text-white/70" : "text-[#6B6880]"
                        }`}
                      >
                        الاستجابة
                      </span>
                      <span className="text-[14px] font-[900] ltr-num">
                        {eq.pingMs.toFixed(1)} ms
                      </span>
                    </div>
                  )}
                </div>

                {/* Open Ports */}
                <div className="mb-4">
                  <span
                    className={`text-[11px] font-[700] block mb-1.5 ${
                      isOnt || isCamera ? "text-white/70" : "text-[#6B6880]"
                    }`}
                  >
                    المنافذ المفتوحة
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {eq.ports.map((p) => (
                      <span
                        key={p}
                        className={`text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px] ltr-num ${
                          isOnt
                            ? "bg-white/20 text-white"
                            : isCamera
                            ? "bg-white/15 text-[#D7F25C]"
                            : "bg-[#EEF0F5] text-[#14121F]"
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Credentials hint */}
                <div
                  className={`p-2.5 rounded-[14px] text-[12px] font-[700] mb-5 ${
                    isOnt
                      ? "bg-white/10 text-white/90"
                      : isCamera
                      ? "bg-[#2A2740] text-white/90"
                      : "bg-[#FFF1EA] text-[#FF7A45]"
                  }`}
                >
                  <span className="opacity-75">معلومات الدخول: </span>
                  <span className="ltr-num">{eq.credentialsHint}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-current/10">
                <button
                  type="button"
                  onClick={() => setActiveProxyIframe({ ip: eq.ip, name: eq.name })}
                  className={`flex-1 h-[42px] rounded-[999px] font-[800] text-[13px] transition-colors flex items-center justify-center cursor-pointer ${
                    isOnt
                      ? "bg-white text-[#5B3DF5] hover:bg-white/90"
                      : isCamera
                      ? "bg-[#D7F25C] text-[#14121F] hover:bg-[#cbf03e]"
                      : "bg-[#14121F] text-white hover:bg-[#2A2740]"
                  }`}
                >
                  فتح لوحة التحكم
                </button>
                <a
                  href={`/api/proxy/${eq.ip}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`h-[42px] px-3.5 rounded-[999px] text-[12px] font-[800] transition-colors flex items-center justify-center ${
                    isOnt || isCamera
                      ? "bg-white/15 text-white hover:bg-white/25"
                      : "bg-[#F6F6FA] text-[#14121F] hover:bg-[#EEF0F5]"
                  }`}
                  title="فتح في تبويب مستقل"
                >
                  تبويب خارجي ↗
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. Live ZTE DHCP Leases Table */}
      {dhcpLeases.length > 0 && (
        <div className="bento-card bg-white text-[#14121F] overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[18px] font-[900]">جدول توزيع العناوين الحقيقي (ZTE DHCP Leases)</h3>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                الأسماء الفعلية المستخرجة من خادم DHCP في الراوتر الرئيسي ({dhcpLeases.length} عنوان نشط)
              </p>
            </div>
          </div>
          <table className="w-full text-right border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-[#EEF0F5] text-[#6B6880] font-[800]">
                <th className="py-2 px-2">الاسم (HostName)</th>
                <th className="py-2 px-2">IP</th>
                <th className="py-2 px-2">MAC</th>
                <th className="py-2 px-2">المنفذ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF0F5]">
              {dhcpLeases.map((dl) => (
                <tr key={dl.mac + dl.ip} className="hover:bg-[#F6F6FA]">
                  <td className="py-2 px-2 font-[800]">{dl.hostname || "بدون اسم"}</td>
                  <td className="py-2 px-2 ltr-num font-[700]">{dl.ip}</td>
                  <td className="py-2 px-2 ltr-num text-[#6B6880]">{dl.mac}</td>
                  <td className="py-2 px-2 ltr-num">{dl.port || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
