"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";
import { formatClock } from "@/features/dashboard/utils";

export function Topbar() {
  const {
    view,
    titles,
    sortedCable,
    wifiClients,
    isFresh,
    state,
    sendCommand,
    offlineCable,
    unknownDevices,
    setStatusFilter,
    goTo,
  } = useDashboard();

  return (
    <>
      <header className="topbar">
        <h1 className="page-title">
          {titles[view]}
          {view === "cable" && <small className="ltr">{sortedCable.length}</small>}
          {view === "wifi" && <small className="ltr">{wifiClients.length}</small>}
        </h1>
        <div className="top-actions">
          <span className="live-pill">
            <span className={`live-dot ${isFresh ? "" : "stale"}`} />
            <span>
              {isFresh ? "مباشر" : "متوقف"} · <span className="ltr">{formatClock(state?.updatedAt)}</span>
            </span>
          </span>
          <button
            type="button"
            className="btn"
            onClick={() => sendCommand("rescan_network", "ALL", "Deep Rescan")}
            title="إعادة فحص عميق وشامل لجميع أجهزة الشبكة وقياس جودة الكابلات وتحديث الأسماء"
          >
            <Icon name="refresh" size={15} /> فحص عميق
          </button>
        </div>
      </header>

      {(offlineCable.length > 0 || unknownDevices.length > 0) && (
        <div className="attention">
          {offlineCable.length > 0 && (
            <button
              type="button"
              className="attn-chip attn-bad"
              onClick={() => {
                setStatusFilter("offline");
                goTo("cable");
              }}
            >
              <span className="dot dot-bad dot-pulse" />
              <span>
                <span className="ltr">{offlineCable.length}</span> منقطع في الكابل:{" "}
                <span className="ltr">
                  {offlineCable.slice(0, 3).map((d) => d.name).join("، ")}
                  {offlineCable.length > 3 ? ` +${offlineCable.length - 3}` : ""}
                </span>
              </span>
            </button>
          )}
          {unknownDevices.length > 0 && (
            <button type="button" className="attn-chip attn-warn" onClick={() => goTo("security")}>
              <span className="dot dot-warn" />
              <span>
                <span className="ltr">{unknownDevices.length}</span> جهاز جديد غير مسجل · مراجعة
              </span>
            </button>
          )}
        </div>
      )}
    </>
  );
}
