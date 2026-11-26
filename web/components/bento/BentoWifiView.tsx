"use client";

import React, { useMemo } from "react";
import { useDashboard } from "@/features/dashboard/DashboardContext";
import { WifiClient } from "@/lib/store";

export function BentoWifiView() {
  const { state, wifiClients, blockedRules, sendCommand, setInspectItem, busyMac } = useDashboard();

  // Stats calculation
  const totalWifi = wifiClients.length;
  const band5G = useMemo(
    () => wifiClients.filter((w) => (w.band || w.port || "").includes("5G")).length,
    [wifiClients]
  );
  const band24G = totalWifi - band5G;
  const avgRssi = useMemo(() => {
    const vals = wifiClients
      .map((w) => (w.rssi ? parseInt(w.rssi, 10) : NaN))
      .filter((n) => !Number.isNaN(n));
    if (vals.length === 0) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  }, [wifiClients]);

  const wlanSsids = state?.wlanSsids || [];
  const wlanAclRules = state?.wlanAclRules || [];
  const bannedIdentities = state?.bannedIdentities || [];
  const aclByMac = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of wlanAclRules) {
      if (r.mac) map.set(r.mac.toUpperCase(), r.instId);
    }
    return map;
  }, [wlanAclRules]);

  const formatRate = (raw?: string) => {
    if (!raw) return "-";
    const num = parseInt(raw, 10);
    if (Number.isNaN(num)) return raw;
    return num >= 1000 ? `${Math.round(num / 1000)}M` : `${num}K`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Top Bento KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[22px]">
        {/* Total Wifi Card */}
        <div className="bento-card bg-[#5B3DF5] text-white flex flex-col justify-between">
          <span className="text-[14px] font-[700] text-white/80">أجهزة الويفي النشطة</span>
          <div className="my-2">
            <span className="text-[56px] font-[900] leading-none ltr-num tracking-tight">
              {totalWifi}
            </span>
          </div>
          <p className="text-[12px] font-[600] text-white/80">
            أجهزة متصلة بالشبكات اللاسلكية 2.4G و 5G
          </p>
        </div>

        {/* 5GHz vs 2.4GHz Card */}
        <div className="bento-card bg-[#D7F25C] text-[#14121F] flex flex-col justify-between">
          <span className="text-[14px] font-[800]">توزيع الترددات (Bands)</span>
          <div className="flex items-baseline gap-4 my-2">
            <div>
              <span className="text-[36px] font-[900] ltr-num">{band5G}</span>
              <span className="text-[12px] font-[800] mr-1 block">نطاق 5GHz</span>
            </div>
            <div className="h-8 w-px bg-[#14121F]/20" />
            <div>
              <span className="text-[36px] font-[900] ltr-num">{band24G}</span>
              <span className="text-[12px] font-[800] mr-1 block">نطاق 2.4GHz</span>
            </div>
          </div>
          <p className="text-[12px] font-[700] opacity-80">
            توزيع متوازن لسرعة قصوى وتقليل التشويش
          </p>
        </div>

        {/* Signal Quality Card */}
        <div className="bento-card bg-white text-[#14121F] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-[800]">جودة الإشارة اللاسلكية</span>
            <span
              className={`text-[11px] font-[800] px-2.5 py-1 rounded-[999px] ${
                avgRssi !== null && avgRssi < -72
                  ? "bg-[#FFF1EA] text-[#FF7A45]"
                  : "bg-[#E5F8D0] text-[#2F6B0F]"
              }`}
            >
              {avgRssi === null ? "بانتظار القياس" : avgRssi >= -65 ? "تغطية ممتازة" : avgRssi >= -75 ? "تغطية متوسطة" : "إشارة ضعيفة"}
            </span>
          </div>
          <div className="my-2">
            <span className="text-[40px] font-[900] leading-none ltr-num">
              {avgRssi !== null ? avgRssi : "--"}{" "}
              <span className="text-[16px] font-[700] text-[#6B6880]">dBm</span>
            </span>
          </div>
          <p className="text-[12px] font-[600] text-[#6B6880]">
            متوسط قوة الإشارة الحقيقي (RSSI) للأجهزة المتصلة الآن
          </p>
        </div>
      </div>

      {/* 1.5 SSIDs & Isolation Controls */}
      {wlanSsids.length > 0 && (
        <div className="bento-card bg-white text-[#14121F]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[18px] font-[900]">إدارة شبكات الويفي والعزل (SSIDs & Isolation)</h2>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                تشغيل/إيقاف الشبكات (2.4GHz و 5GHz) وتفعيل عزل الأجهزة (Client Isolation)
              </p>
            </div>
            <span className="bg-[#F6F6FA] text-[#14121F] text-[12px] font-[800] px-3 py-1 rounded-[999px] ltr-num">
              {wlanSsids.filter((s) => s.enable).length}/{wlanSsids.length} نشط
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {wlanSsids.map((s) => (
              <div
                key={s.instId}
                className={`p-3.5 rounded-[18px] border transition-colors ${
                  s.enable ? "bg-[#F6F6FA] border-[#5B3DF5]/30" : "bg-[#FAFAFC] border-[#EEF0F5] opacity-75"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-[900] text-[14px] truncate">{s.essid || s.alias}</span>
                  <span className="bg-white text-[#5B3DF5] text-[10px] font-[900] px-2 py-0.5 rounded-[999px] ltr-num">
                    {s.band || s.alias}
                  </span>
                </div>
                <div className="text-[11px] font-[600] text-[#6B6880] mb-3 ltr-num">
                  {s.alias} · Max {s.maxUsers} · {s.hidden ? "مخفي" : "ظاهر"}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      sendCommand("set_ssid_config", s.instId, s.essid || s.alias, s.instId, {
                        enable: !s.enable,
                      })
                    }
                    className={`text-[11px] font-[800] px-2.5 py-1 rounded-[999px] transition-colors ${
                      s.enable
                        ? "bg-[#E5F8D0] text-[#2F6B0F] hover:bg-[#d5f3b6]"
                        : "bg-[#14121F] text-white hover:bg-[#2A2740]"
                    }`}
                  >
                    {s.enable ? "شغال ✓" : "مطفي"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      sendCommand("set_ssid_config", s.instId, s.essid || s.alias, s.instId, {
                        isolation: !s.isolation,
                      })
                    }
                    className={`text-[11px] font-[800] px-2.5 py-1 rounded-[999px] transition-colors ${
                      s.isolation
                        ? "bg-[#5B3DF5] text-white"
                        : "bg-white text-[#6B6880] border border-[#EEF0F5]"
                    }`}
                    title="منع الأجهزة المتصلة من رؤية بعضها البعض"
                  >
                    {s.isolation ? "معزول 🔒" : "عزل"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Wifi Clients Table */}
      <div className="bento-card bg-white text-[#14121F] overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[20px] font-[900]">لائحة عملاء الويفي</h2>
            <p className="text-[13px] font-[600] text-[#6B6880] mt-0.5">
              قياس قوة الإشارة (RSSI)، معدلات البث وسرعة الاتصال
            </p>
          </div>
          <span className="bg-[#F6F6FA] text-[#14121F] text-[12px] font-[800] px-3.5 py-1.5 rounded-[999px]">
            {totalWifi} جهاز
          </span>
        </div>

        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="border-b border-[#EEF0F5] text-[12px] font-[800] text-[#6B6880]">
              <th className="py-3 px-3">الجهاز</th>
              <th className="py-3 px-3">العنوان (IP & MAC)</th>
              <th className="py-3 px-3">التردد</th>
              <th className="py-3 px-3">قوة الإشارة (RSSI)</th>
              <th className="py-3 px-3">السرعة (TX / RX)</th>
              <th className="py-3 px-3">مدة الاتصال</th>
              <th className="py-3 px-3 text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF0F5]">
            {wifiClients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-[#6B6880] font-[700]">
                  لا توجد أجهزة متصلة بالويفي حالياً.
                </td>
              </tr>
            ) : (
              wifiClients.map((client) => {
                const isBusy = busyMac === client.mac;
                const rssiNum = client.rssi ? parseInt(client.rssi, 10) : -60;
                const isSignalGood = rssiNum >= -65;

                return (
                  <tr key={client.mac} className="hover:bg-[#F6F6FA] transition-colors">
                    {/* Device Name */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-live-dot flex-shrink-0" />
                        <span
                          className="w-8 h-8 rounded-[12px] bg-[#F6F6FA] flex items-center justify-center text-[17px] flex-shrink-0 border border-[#EEF0F5]"
                          title={client.catName || "هاتف ذكي"}
                        >
                          {client.catIcon || "📱"}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-[800] text-[14px] text-[#14121F]">
                              {client.hostname || "جهاز ويفي"}
                            </span>
                            {client.catName && (
                              <span className="bg-[#F0EFF8] text-[#5B3DF5] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                {client.catName}
                              </span>
                            )}
                            <span className="bg-[#E5F8D0] text-[#2F6B0F] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                              ويفي ZTE مباشر
                            </span>
                            {client.blocked && (
                              <span className="bg-[#14121F] text-[#D7F25C] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]">
                                محظور
                              </span>
                            )}
                            {client.identity?.likelySameAsName && (
                              <span
                                className="bg-[#D7F25C] text-[#14121F] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]"
                                title={client.identity.matchReason}
                              >
                                نفس الجهاز؟ ← {client.identity.likelySameAsName} ({client.identity.matchConfidence}%)
                              </span>
                            )}
                            {client.identity?.sameNameConflict && (
                              <span className="bg-[#FFF1EA] text-[#FF7A45] text-[10px] font-[800] px-2 py-0.5 rounded-[999px]">
                                اسم متشابه
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] font-[600] text-[#6B6880] block">
                            {client.vendor || "هاتف / حاسوب لاسلكي"}
                          </span>
                          {client.identity?.dnaTag && (
                            <span className="text-[10px] font-[700] text-[#5B3DF5] ltr-num block mt-0.5">
                              DNA: {client.identity.dnaTag}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* IP & MAC */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col">
                        <span className="text-[13px] font-[700] text-[#14121F] ltr-num">
                          {client.ip}
                        </span>
                        <span className="text-[11px] font-[600] text-[#6B6880] ltr-num">
                          {client.mac}
                        </span>
                      </div>
                    </td>

                    {/* Band */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className="bg-[#F6F6FA] text-[#14121F] text-[11px] font-[800] px-2.5 py-1 rounded-[999px] ltr-num">
                          {client.ssidName || client.port || "Wi-Fi"}
                        </span>
                        {(client.band || client.mode) && (
                          <span className="text-[10px] font-[700] text-[#6B6880] ltr-num">
                            {[client.band, client.mode, client.mcs ? `MCS${client.mcs}` : ""].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Signal */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[11px] font-[800] px-2.5 py-1 rounded-[999px] ltr-num ${
                            isSignalGood
                              ? "bg-[#E5F8D0] text-[#2F6B0F]"
                              : "bg-[#FFF1EA] text-[#FF7A45]"
                          }`}
                        >
                          {client.rssi ? `${client.rssi} dBm` : "--"}
                        </span>
                        {client.snr && (
                          <span className="text-[10px] font-[700] text-[#6B6880] ltr-num">
                            SNR {client.snr}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Speeds */}
                    <td className="py-3.5 px-3">
                      <span className="text-[12px] font-[700] text-[#14121F] ltr-num">
                        {formatRate(client.txRate)} / {formatRate(client.rxRate)}
                      </span>
                    </td>

                    {/* Link time */}
                    <td className="py-3.5 px-3">
                      <span className="text-[12px] font-[600] text-[#6B6880] ltr-num">
                        {client.linkTime ? `${client.linkTime}s` : "متصل الآن"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setInspectItem(client as unknown as Record<string, unknown>)}
                          className="bg-[#F6F6FA] hover:bg-[#EEF0F5] text-[#14121F] text-[11px] font-[800] px-3 py-1.5 rounded-[999px] transition-colors"
                        >
                          فحص
                        </button>
                        {(() => {
                          const aclInst = aclByMac.get(client.mac.toUpperCase());
                          return (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                aclInst
                                  ? sendCommand("wifi_acl_unblock", client.mac, client.hostname, aclInst)
                                  : sendCommand("wifi_acl_block", client.mac, client.hostname, undefined, {
                                      interface: client.port || "DEV.WIFI.AP1",
                                    })
                              }
                              className={`text-[11px] font-[800] px-2.5 py-1.5 rounded-[999px] transition-colors ${
                                aclInst
                                  ? "bg-[#5B3DF5] text-white"
                                  : "bg-[#F0EFF8] text-[#5B3DF5] hover:bg-[#e4e1f6]"
                              }`}
                              title="حظر على مستوى Wi-Fi L2 ACL مباشرة"
                            >
                              {aclInst ? "فك ACL" : "طرد L2"}
                            </button>
                          );
                        })()}
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            sendCommand(
                              client.blocked ? "unblock" : "block",
                              client.mac,
                              client.hostname,
                              client.blockInstId
                            )
                          }
                          className={`text-[11px] font-[800] px-3 py-1.5 rounded-[999px] transition-colors ${
                            client.blocked
                              ? "bg-[#14121F] text-white hover:bg-[#2A2740]"
                              : "bg-[#FF7A45] text-white hover:bg-[#e66835]"
                          }`}
                        >
                          {isBusy ? "..." : client.blocked ? "تشغيل" : "إيقاف"}
                        </button>
                        {(() => {
                          const tracked = bannedIdentities.find(
                            (b) =>
                              b.sourceMac.toUpperCase() === client.mac.toUpperCase() ||
                              b.bannedMacs.some((m) => m.toUpperCase() === client.mac.toUpperCase())
                          );
                          return (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                tracked
                                  ? sendCommand("unban_identity", tracked.sourceMac, tracked.name, tracked.id)
                                  : sendCommand("auto_track_ban", client.mac, client.hostname, undefined, {
                                      interface: client.port || "DEV.WIFI.AP1",
                                    })
                              }
                              className={`text-[11px] font-[800] px-2.5 py-1.5 rounded-[999px] transition-colors ${
                                tracked
                                  ? "bg-[#14121F] text-[#D7F25C]"
                                  : "bg-[#D7F25C] text-[#14121F] hover:bg-[#cbe849]"
                              }`}
                              title="طرد نهائي + تتبع تلقائي لإعادة حظر أي MAC جديد"
                            >
                              {isBusy ? "..." : tracked ? "متعقَّب ⚡" : "حظر تلقائي ⚡"}
                            </button>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 4. Blocked Wi-Fi L2 ACL & Auto-Reblock Management (visible even when banned devices are offline) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bento-card bg-white text-[#14121F]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[17px] font-[800]">قائمة المطرودين من الويفي (طرد L2 / إيقاف)</h3>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                الأجهزة المحظورة حالياً في الراوتر — يمكنك فك الحظر عن أي جهاز حتى لو كان غير متصل
              </p>
            </div>
            <span className="bg-[#F0EFF8] text-[#5B3DF5] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
              {wlanAclRules.length + blockedRules.length} محظور
            </span>
          </div>

          {wlanAclRules.length === 0 && blockedRules.length === 0 ? (
            <div className="py-6 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
              لا يوجد أي جهاز مطرود أو محظور حالياً في الراوتر.
            </div>
          ) : (
            <div className="divide-y divide-[#EEF0F5]">
              {wlanAclRules.map((r) => {
                const isRowBusy = busyMac === r.mac;
                return (
                  <div key={`acl-${r.instId}-${r.mac}`} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-[800] text-[13px]">{r.name || "Wi-Fi ACL"}</span>
                        <span className="bg-[#F0EFF8] text-[#5B3DF5] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]">
                          طرد L2
                        </span>
                      </div>
                      <span className="text-[11px] font-[600] text-[#6B6880] ltr-num">
                        {r.mac} · {r.interface}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => sendCommand("wifi_acl_unblock", r.mac, r.name, r.instId)}
                      className="bg-[#14121F] hover:bg-[#2A2740] disabled:opacity-50 text-white text-[11px] font-[800] px-3.5 py-1.5 rounded-[999px]"
                    >
                      {isRowBusy ? "..." : "فك الطرد"}
                    </button>
                  </div>
                );
              })}
              {blockedRules.map((r) => {
                const isRowBusy = busyMac === r.mac;
                return (
                  <div key={`fw-${r.instId}-${r.mac}`} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-[800] text-[13px]">{r.name || "Firewall"}</span>
                        <span className="bg-[#FFF1EA] text-[#FF7A45] text-[10px] font-[900] px-2 py-0.5 rounded-[999px]">
                          إيقاف MAC
                        </span>
                      </div>
                      <span className="text-[11px] font-[600] text-[#6B6880] ltr-num">
                        {r.mac}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => sendCommand("unblock", r.mac, r.name, r.instId)}
                      className="bg-[#14121F] hover:bg-[#2A2740] disabled:opacity-50 text-white text-[11px] font-[800] px-3.5 py-1.5 rounded-[999px]"
                    >
                      {isRowBusy ? "..." : "إلغاء الإيقاف"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bento-card bg-white text-[#14121F]">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[17px] font-[800]">التعقب الذكي (Auto-Reblock)</h3>
              <p className="text-[12px] font-[600] text-[#6B6880]">
                يتتبع الأجهزة المحظورة ويعيد حظر الـ MAC الجديد في نفس القاعدة تلقائياً
              </p>
            </div>
            <span className="bg-[#14121F] text-[#D7F25C] text-[12px] font-[900] px-3 py-1 rounded-[999px] ltr-num">
              {bannedIdentities.length} متعقَّب
            </span>
          </div>

          {bannedIdentities.length === 0 ? (
            <div className="py-6 text-center text-[#6B6880] text-[13px] font-[700] bg-[#F6F6FA] rounded-[18px]">
              لا توجد أجهزة متعقبة حالياً. أي جهاز تمنعه بـ «طرد L2» أو «إيقاف» يُحفظ هنا.
            </div>
          ) : (
            <div className="divide-y divide-[#EEF0F5]">
              {bannedIdentities.map((b) => {
                const isRowBusy = busyMac === b.sourceMac;
                return (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-[800] text-[13px]">{b.name}</span>
                        <span
                          className={`text-[10px] font-[900] px-2 py-0.5 rounded-[999px] ${
                            b.autoProtected
                              ? "bg-[#E5F8D0] text-[#2F6B0F]"
                              : "bg-[#FFF1EA] text-[#FF7A45]"
                          }`}
                        >
                          {b.autoProtected ? "حظر تلقائي مفعّل" : "اسم عام"}
                        </span>
                      </div>
                      <span className="text-[11px] font-[600] text-[#6B6880] ltr-num block mt-0.5">
                        MACs: {b.bannedMacs.join(", ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isRowBusy}
                      onClick={() => sendCommand("unban_identity", b.sourceMac, b.name, b.id)}
                      className="bg-[#14121F] hover:bg-[#2A2740] disabled:opacity-50 text-white text-[11px] font-[800] px-3.5 py-1.5 rounded-[999px] flex-shrink-0"
                    >
                      {isRowBusy ? "..." : "حذف نهائي"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
