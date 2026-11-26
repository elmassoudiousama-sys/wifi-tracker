"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { formatClock } from "@/features/dashboard/utils";

export function ActivityView() {
  const { state, clearAlerts } = useDashboard();

  return (
    <div className="grid-even">
      <section className="card">
        <div className="card-head">
          <div>
            <div className="card-title">
              سجل الاستقرار والانقطاعات <span className="ltr muted">({(state?.blackoutHistory || []).length})</span>
            </div>
            <div className="card-sub">تتبع انقطاع الأجهزة</div>
          </div>
        </div>
        {!state?.blackoutHistory || state.blackoutHistory.length === 0 ? (
          <div className="empty">جميع أجهزة الكابل مستقرة 100% ✓</div>
        ) : (
          <div className="list">
            {state.blackoutHistory.slice(0, 15).map((ev) => (
              <div key={ev.id} className={`outage ${ev.active ? "active" : ""}`}>
                <div>
                  <div className="dev-name ltr">{ev.name}</div>
                  <div className="dev-sub ltr">
                    {formatClock(ev.startedAt)}
                    {ev.endedAt ? ` → ${formatClock(ev.endedAt)}` : " (حالياً)"}
                    {ev.port ? ` · ${ev.port}` : ""}
                  </div>
                </div>
                <span className={`status ${ev.active ? "status-bad" : "status-ok"}`}>
                  <span className={`dot ${ev.active ? "dot-bad dot-pulse" : "dot-ok"}`} />
                  {ev.duration}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div className="card-title">آخر الأحداث</div>
          {state?.alerts && state.alerts.length > 0 && (
            <button type="button" className="btn btn-sm" onClick={clearAlerts}>
              مسح
            </button>
          )}
        </div>
        {!state?.alerts || state.alerts.length === 0 ? (
          <div className="empty">لا توجد أحداث مسجلة بعد.</div>
        ) : (
          <div className="timeline">
            {state.alerts.slice(0, 30).map((a, idx) => {
              const dotCls =
                a.type === "device_online" ? "dot-ok" : a.type === "device_offline" ? "dot-bad" : "dot-warn";
              return (
                <div key={idx} className="tl-item">
                  <span className={`dot ${dotCls} tl-dot`} />
                  <div className="tl-msg">{a.message}</div>
                  <div className="tl-time ltr">{a.at ? formatClock(a.at) : ""}</div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
