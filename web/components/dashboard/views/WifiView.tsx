"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

export function WifiView() {
  const { wifiClients, openInspect, busyMac, sendCommand } = useDashboard();

  return (
    <section className="card card-flush">
      <div className="toolbar">
        <div className="card-sub">الأجهزة المتصلة بالويفي حالياً — معزولة عن جدول الكابل</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الحالة</th>
              <th>الجهاز والشركة</th>
              <th>عنوان IP</th>
              <th>الإشارة والسرعة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {wifiClients.map((w) => (
              <tr key={w.mac} onClick={() => openInspect(w as unknown as Record<string, unknown>)}>
                <td>
                  <span className={`status ${w.blocked ? "status-warn" : "status-ok"}`}>
                    <span className={`dot ${w.blocked ? "dot-warn" : "dot-ok"}`} />
                    {w.blocked ? "محظور" : "متصل"}
                  </span>
                </td>
                <td>
                  <div className="dev-cell">
                    <div className="tile">{w.catIcon || "📱"}</div>
                    <div>
                      <div className="dev-name ltr">{w.hostname}</div>
                      <div className="dev-sub ltr">
                        {w.vendor || "—"}
                        {w.randomizedMac ? " · MAC عشوائي" : ""}
                      </div>
                      {Boolean(w.friendlyName) && (
                        <span className="friendly">
                          <span className="ltr">{w.friendlyName}</span>
                          <span>[{w.friendlySource || "كشف"}]</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="ltr">{w.ip}</span>
                </td>
                <td>
                  <div className="ltr" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {w.rssi && <span className="badge">{w.rssi} dBm</span>}
                    {w.txRate && <span className="badge">{Math.round(Number(w.txRate) / 1000)}M</span>}
                    {w.latencyMs !== null && w.latencyMs !== undefined && (
                      <span className="badge">{w.latencyMs} ms</span>
                    )}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    {w.blocked ? (
                      <button
                        type="button"
                        className="icon-btn sm"
                        title="تشغيل"
                        disabled={busyMac === w.mac}
                        onClick={() => sendCommand("unblock", w.mac, w.hostname, w.blockInstId)}
                      >
                        <Icon name="power" size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn sm danger"
                        title="حظر"
                        disabled={busyMac === w.mac}
                        onClick={() => sendCommand("block", w.mac, w.hostname)}
                      >
                        <Icon name="ban" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {wifiClients.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  لا توجد أجهزة متصلة بالويفي حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
