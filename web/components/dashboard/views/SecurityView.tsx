"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";
import { formatPortLabel } from "@/features/dashboard/utils";

export function SecurityView() {
  const {
    state,
    blockedRules,
    busyMac,
    sendCommand,
    unknownDevices,
    setModalDevice,
  } = useDashboard();

  return (
    <>
      {state?.rogueDhcp?.detected ? (
        <div className="banner banner-bad">
          <div className="banner-row">
            <span className="dot dot-bad dot-pulse" style={{ width: 12, height: 12 }} />
            <div>
              <strong>إنذار أمني: تم رصد روتور مقلوب أو تعارض DHCP في الشبكة!</strong>
              <div style={{ fontSize: 12, marginTop: 2 }}>{state.rogueDhcp.message}</div>
            </div>
          </div>
          <span className="badge badge-bad ltr">{state.rogueDhcp.serverIp}</span>
        </div>
      ) : (
        <div className="banner banner-ok">
          <div className="banner-row">
            <Icon name="shield" size={18} />
            <span>
              <strong>المصيدة الأمنية:</strong> الشبكة مؤمنة بالكامل — لا يوجد أي روتور مقلوب أو خادم DHCP غريب.
            </span>
          </div>
          <span style={{ fontSize: 12 }}>الروتور الرئيسي 192.168.1.1 هو المزود الوحيد ✓</span>
        </div>
      )}

      <div className="grid-even">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">
                قائمة المحظورين <span className="ltr muted">({blockedRules.length} / 32)</span>
              </div>
              <div className="card-sub">
                الحد الأقصى للروتور: 32 جهاز (متبقي {Math.max(0, 32 - blockedRules.length)})
              </div>
            </div>
          </div>
          {blockedRules.length === 0 ? (
            <div className="empty">لا يوجد أي جهاز محظور حالياً ✓</div>
          ) : (
            <div className="list">
              {blockedRules.map((r) => (
                <div key={r.mac} className="list-item">
                  <div className="list-item-main">
                    <strong className="ltr">{r.name}</strong>
                    <span className="dev-sub ltr">{r.mac}</span>
                  </div>
                  <div className="list-item-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-ink"
                      disabled={busyMac === r.mac}
                      onClick={() => sendCommand("unblock", r.mac, r.name, r.instId)}
                    >
                      فك الحظر
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <div className="card-title">
              أجهزة جديدة <span className="ltr muted">({unknownDevices.length})</span>
            </div>
          </div>
          {unknownDevices.length === 0 ? (
            <div className="empty">لا توجد أجهزة جديدة ✓</div>
          ) : (
            <div className="list">
              {unknownDevices.map((u) => (
                <div key={u.mac} className="list-item">
                  <div className="list-item-main">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <strong className="ltr">{u.hostname || "Unknown"}</strong>
                      <span className="badge ltr">{formatPortLabel(u.port)}</span>
                    </div>
                    <span className="dev-sub ltr">
                      {u.ip} · {u.mac}
                    </span>
                    <span className="dev-sub ltr">
                      {u.vendor || "—"}
                      {u.httpTitle ? ` · ${u.httpTitle}` : ""}
                      {u.openPorts && u.openPorts.length > 0 ? ` · ${u.openPorts.join(", ")}` : ""}
                    </span>
                  </div>
                  <div className="list-item-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      onClick={() =>
                        setModalDevice({
                          mac: u.mac,
                          name: u.hostname && u.hostname !== "Unknown" ? u.hostname : "",
                          ip: u.ip,
                          port: u.port,
                          medium: u.medium,
                          isNew: true,
                        })
                      }
                    >
                      حفظ بالاسم
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      disabled={busyMac === u.mac}
                      onClick={() => sendCommand("block", u.mac, u.hostname || "New")}
                    >
                      حظر
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
