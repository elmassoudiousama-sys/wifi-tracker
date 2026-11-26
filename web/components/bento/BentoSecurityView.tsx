"use client";

import React, { useState } from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";

export function BentoSecurityView() {
  const {
    state,
    unknownDevices,
    blockedRules,
    sendCommand,
    setModalDevice,
    busyMac,
  } = useDashboard();

  const isRogue = state?.rogueDhcp?.detected;
  const wlanAclRules = state?.wlanAclRules || [];
  const bannedIdentities = state?.bannedIdentities || [];
  const portMirror = state?.portMirror;
  const [mirrorDest, setMirrorDest] = useState("DEV.BRIDGING.BR1.BRPORT5");

  const exposedDevices = (state?.devices || [])
    .concat(
      (state?.unknownDevices || []).map((u) => ({
        ...u,
        name: u.friendlyName || u.hostname || u.ip,
        group: "",
        expectedIp: u.ip,
        online: true,
      }))
    )
    .filter((d) => (d.openPorts || []).length > 0);

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Rogue DHCP Status Card (Full Width) */}
      <div
        className={`bento-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${
          isRogue ? "bg-[#FF7A45] text-white" : "bg-[#14121F] text-white"
        }`}
      >
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-[20px] flex items-center justify-center flex-shrink-0 ${
              isRogue ? "bg-white/20 text-white" : "bg-white/10 text-[#D7F25C]"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-8 h-8"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              {isRogue ? (
                <path d="M12 8v4m0 4h.01" />
              ) : (
                <path d="m9 12 2 2 4-4" />
              )}
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-[20px] font-[900]">
                {isRogue ? "تحذير أمني: تم اكتشاف روتور مقلوب (Rogue DHCP)" : "المصيدة الأمنية: الشبكة محمية 100%"}
              </h2>
              <span
                className={`text-[11px] font-[900] px-2.5 py-0.5 rounded-[999px] ${
                  isRogue ? "bg-white text-[#FF7A45]" : "bg-[#D7F25C] text-[#14121F]"
                }`}
              >
                {isRogue ? "خطر تضارب" : "مؤمن ✓"}
              </span>
            </div>
            <p className="text-[13px] font-[600] opacity-80 leading-relaxed ltr-num">
              {isRogue
                ? state?.rogueDhcp?.message
                : "الراوتر الرئيسي 192.168.1.1 هو المزود الوحيد لعناوين IP. لا توجد خوادم DHCP مقلوبة أو تسرب IPv6."}
            </p>
            {((state?.rogueDhcp?.foreignSubnets?.length || 0) > 0 ||
              (state?.rogueDhcp?.ipv6Rogues?.length || 0) > 0) && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {state?.rogueDhcp?.foreignSubnets?.map((fs) => (
                  <span key={fs.ip + fs.mac} className="bg-black/25 text-white text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px] ltr-num">
                    Foreign IP: {fs.ip} ({fs.mac}) on {fs.port}
                  </span>
                ))}
                {state?.rogueDhcp?.ipv6Rogues?.map((ir) => (
                  <span key={ir.ipv6 + ir.mac} className="bg-black/25 text-white text-[11px] font-[800] px-2.5 py-0.5 rounded-[999px] ltr-num">
                    IPv6 RA Leak: {ir.ipv6} ← {ir.mac} ({ir.vendor})
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => sendCommand("run_diagnostics")}
          className="bg-white text-[#14121F] font-[800] text-[13px] px-5 py-2.5 rounded-[999px] hover:bg-white/90 transition-colors flex-shrink-0 cursor-pointer shadow-sm"
        >
          فحص الـ DHCP الآن
        </button>
      </div>

      {/* 2. Grid of 2 Cards: Unregistered Devices & Blocked Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        {/* Unregistered / New Devices */}
        <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[18px] font-[800]">الأجهزة الجديدة غير المسجلة</h3>
                <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
                  أجهزة غريبة اتصلت بالشبكة دون تسجيل اسمها في النظام
                </p>
              </div>
              <span className="bg-[#FFF1EA] text-[#FF7A45] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
                {unknownDevices.length} جديد
              </span>
            </div>

            {unknownDevices.length === 0 ? (
              <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                جميع الأجهزة المتصلة مسجلة ومعروفة بالكامل ✓
              </div>
            ) : (
              <div className="divide-y divide-[#EEF0F5]">
                {unknownDevices.map((u) => {
                  const isBusy = busyMac === u.mac;
                  return (
                    <div
                      key={u.mac}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-[800] text-[14px]">
                            {u.hostname || u.vendor || "جهاز غير معروف"}
                          </span>
                          <span className="bg-[#F6F6FA] text-[#6B6880] text-[10px] font-[800] px-2 py-0.5 rounded-[999px] ltr-num">
                            {u.port || "LAN"}
                          </span>
                          {u.identity?.likelySameAsName && (
                            <span
                              className="bg-[#D7F25C] text-[#14121F] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]"
                              title={u.identity.matchReason}
                            >
                              نفس الجهاز؟ ← {u.identity.likelySameAsName} ({u.identity.matchConfidence}%)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] font-[600] text-[#6B6880] ltr-num mt-0.5">
                          {u.ip} · {u.mac}
                        </p>
                        {u.identity?.dnaTag && (
                          <p className="text-[10px] font-[700] text-[#5B3DF5] ltr-num mt-0.5">
                            DNA: {u.identity.dnaTag}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setModalDevice({
                              mac: u.mac,
                              name: u.hostname || "",
                              ip: u.ip,
                              port: u.port,
                              medium: "cable",
                              isNew: true,
                            })
                          }
                          className="bg-[#D7F25C] text-[#14121F] text-[11px] font-[800] px-3 py-1.5 rounded-[999px] hover:bg-[#cbf03e] transition-colors"
                        >
                          تسجيل كجهاز
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => sendCommand("block", u.mac, u.hostname || "جهاز جديد")}
                          className="bg-[#FF7A45] text-white text-[11px] font-[800] px-3 py-1.5 rounded-[999px] hover:bg-[#e66835] transition-colors"
                        >
                          {isBusy ? "..." : "حظر فوري"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Blocked Rules */}
        <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[18px] font-[800]">لائحة الأجهزة المحظورة (Blacklist)</h3>
                <p className="text-[12px] font-[600] text-[#6B6880] mt-0.5">
                  قواعد منع الاتصال النشطة في جدار حماية الراوتر
                </p>
              </div>
              <span className="bg-[#14121F] text-white text-[12px] font-[800] px-3 py-1 rounded-[999px] ltr-num">
                {blockedRules.length} محظور
              </span>
            </div>

            {blockedRules.length === 0 ? (
              <div className="py-8 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
                لا توجد أجهزة محظورة حالياً في الراوتر.
              </div>
            ) : (
              <div className="divide-y divide-[#EEF0F5]">
                {blockedRules.map((r) => {
                  const isBusy = busyMac === r.mac;
                  return (
                    <div
                      key={r.instId || r.mac}
                      className="py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <span className="font-[800] text-[14px] text-[#14121F] block">
                          {r.name || "جهاز محظور"}
                        </span>
                        <span className="text-[11px] font-[600] text-[#6B6880] ltr-num block mt-0.5">
                          {r.mac}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => sendCommand("unblock", r.mac, r.name, r.instId)}
                        className="bg-[#14121F] text-white hover:bg-[#2A2740] text-[11px] font-[800] px-3.5 py-1.5 rounded-[999px] transition-colors"
                      >
                        {isBusy ? "..." : "إلغاء الحظر"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. WLAN L2 ACL & ZTE Port Mirroring + Exposed Ports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[22px]">
        {/* ZTE Port Mirroring Control */}
        <div className="bento-card bg-white text-[#14121F]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[18px] font-[800]">نسخ الترافيك (ZTE Port Mirroring)</h3>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                نسخ حركة WAN للإنترنت إلى منفذ كابل (لتحليل DNS/SNI عبر Wireshark)
              </p>
            </div>
            <span
              className={`text-[11px] font-[900] px-3 py-1 rounded-[999px] ${
                portMirror?.enable ? "bg-[#E5F8D0] text-[#2F6B0F]" : "bg-[#F6F6FA] text-[#6B6880]"
              }`}
            >
              {portMirror?.enable ? "مفعّل" : "معطّل"}
            </span>
          </div>
          <p className="text-[11px] font-[700] text-[#FF7A45] bg-[#FFF1EA] p-2.5 rounded-[14px] mb-3">
            تحذير: لا تقم بالنسخ نحو منفذ مملوء بالروتورات (مثل LAN1 أو LAN2)؛ استعمل منفذاً مخصصاً موصولاً مباشرة بكابل الحاسوب.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mirrorDest}
              onChange={(e) => setMirrorDest(e.target.value)}
              className="bg-[#F6F6FA] text-[#14121F] text-[12px] font-[700] px-3 py-2 rounded-[999px] border border-[#EEF0F5]"
            >
              <option value="DEV.BRIDGING.BR1.BRPORT2">LAN1</option>
              <option value="DEV.BRIDGING.BR1.BRPORT3">LAN2</option>
              <option value="DEV.BRIDGING.BR1.BRPORT4">LAN3</option>
              <option value="DEV.BRIDGING.BR1.BRPORT5">LAN4</option>
            </select>
            <button
              type="button"
              onClick={() =>
                sendCommand("set_port_mirror", "MIRROR", mirrorDest, undefined, {
                  enable: !portMirror?.enable,
                  mirrorSrc: "IGD.WANALL",
                  mirrorDest,
                })
              }
              className={`text-[12px] font-[800] px-4 py-2 rounded-[999px] transition-colors ${
                portMirror?.enable
                  ? "bg-[#FF7A45] text-white"
                  : "bg-[#14121F] text-white hover:bg-[#2A2740]"
              }`}
            >
              {portMirror?.enable ? "إيقاف النسخ" : "تفعيل النسخ (WAN_All)"}
            </button>
          </div>

          {exposedDevices.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#EEF0F5]">
              <div className="text-[12px] font-[800] text-[#6B6880] mb-2">
                منافذ مفتوحة مكتشفة (DVR / ADB / HTTP):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {exposedDevices.slice(0, 8).map((ed) => (
                  <span key={ed.mac + ed.ip} className="bg-[#F6F6FA] text-[#14121F] text-[11px] font-[700] px-2.5 py-1 rounded-[999px] ltr-num">
                    {ed.name} ({ed.ip}): {(ed.openPorts || []).join(", ")}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* WLAN L2 ACL Rules */}
        <div className="bento-card bg-white text-[#14121F]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[18px] font-[800]">حظر الواي فاي المباشر (WLAN L2 ACL)</h3>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                منع الاتصال بنقطة الوصول اللاسلكية قبل أخذ عنوان IP
              </p>
            </div>
            <span className="bg-[#F0EFF8] text-[#5B3DF5] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
              {wlanAclRules.length} قاعدة
            </span>
          </div>
          {wlanAclRules.length === 0 ? (
            <div className="py-6 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
              لا توجد قواعد L2 ACL مسجلة.
            </div>
          ) : (
            <div className="divide-y divide-[#EEF0F5]">
              {wlanAclRules.map((r) => (
                <div key={r.instId + r.mac} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="font-[800] text-[13px] block">{r.name || "Wi-Fi ACL"}</span>
                    <span className="text-[11px] font-[600] text-[#6B6880] ltr-num">
                      {r.mac} · {r.interface}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => sendCommand("wifi_acl_unblock", r.mac, r.name, r.instId)}
                    className="bg-[#14121F] text-white text-[11px] font-[800] px-3 py-1 rounded-[999px]"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Persistent Auto-Reblock DNA Bans */}
      <div className="bento-card bg-white text-[#14121F]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[18px] font-[800]">الحظر الذكي الدائم (Auto-Reblock ضد تغيير MAC)</h3>
            <p className="text-[12px] font-[600] text-[#6B6880]">
              يتذكر الأجهزة المحظورة ببصمتها الثابتة (mDNS / الاسم الفريد) ويعيد حظر الـ MAC الجديد تلقائياً في الراوتر
            </p>
          </div>
          <span className="bg-[#14121F] text-[#D7F25C] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
            {bannedIdentities.length} متعقَّب
          </span>
        </div>

        {bannedIdentities.length === 0 ? (
          <div className="py-6 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
            أي جهاز كتحظرو بـ «إيقاف» أو «طرد L2» كيتسجل هنا تلقائياً لحظر أي MAC جديد يستعملو مستقبلاً.
          </div>
        ) : (
          <div className="divide-y divide-[#EEF0F5]">
            {bannedIdentities.map((b) => (
              <div key={b.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-[900] text-[14px]">{b.name}</span>
                    <span
                      className={`text-[10px] font-[900] px-2.5 py-0.5 rounded-[999px] ${
                        b.autoProtected
                          ? "bg-[#E5F8D0] text-[#2F6B0F]"
                          : "bg-[#FFF1EA] text-[#FF7A45]"
                      }`}
                    >
                      {b.autoProtected ? "حظر تلقائي مفعّل ✓" : "اسم عام (تنبيه فقط)"}
                    </span>
                    {(b.reblockCount || 0) > 0 && (
                      <span className="bg-[#5B3DF5] text-white text-[10px] font-[900] px-2.5 py-0.5 rounded-[999px] ltr-num">
                        تم صيد {b.reblockCount} MAC جديد
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-[600] text-[#6B6880] ltr-num mt-1">
                    DNA: {[b.uniqueHostname, ...(b.stableIds || [])].filter(Boolean).join(" · ") || "بدون معرف فريد"} ·
                    MACs ({b.bannedMacs.length}): {b.bannedMacs.join(", ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => sendCommand("unban_identity", b.sourceMac, b.name, b.id)}
                  className="bg-[#14121F] text-white hover:bg-[#2A2740] text-[11px] font-[800] px-3.5 py-1.5 rounded-[999px] flex-shrink-0"
                >
                  فك الحظر الدائم
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
