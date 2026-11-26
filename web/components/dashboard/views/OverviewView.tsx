"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";
import { LiveChart, Sparkline } from "@/components/dashboard/NetworkCharts";
import { formatClock } from "@/features/dashboard/utils";

export function OverviewView() {
  const {
    state,
    history,
    onlineCableCount,
    cableDevices,
    availability,
    offlineCable,
    lastPing,
    totalRx,
    portRates,
    showRx,
    setShowRx,
    showTx,
    setShowTx,
    portFilter,
    setPortFilter,
    goTo,
    segDevices,
    unknownDevices,
    blockedCount,
    sendCommand,
    setConfirmReboot,
  } = useDashboard();

  return (
    <div className="overview-container">
      {/* ================================================================== */}
      {/* 1. Modern Glass KPI Grid (4 High-Impact Metrics)                   */}
      {/* ================================================================== */}
      <section className="kpi-grid">
        {/* Card 1: Connected Cable Devices */}
        <div className="kpi-card kpi-card-emerald">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-emerald">
              <Icon name="devices" size={18} />
            </div>
            <span className="kpi-title">أجهزة الكابل المتصلة</span>
            <span
              className={`kpi-pill ltr ${
                availability >= 90 ? "pill-emerald" : availability >= 70 ? "pill-amber" : "pill-rose"
              }`}
            >
              {availability}% متصل
            </span>
          </div>

          <div className="kpi-body">
            <div className="kpi-val ltr">
              <span className="kpi-num">{onlineCableCount}</span>
              <span className="kpi-total">/ {cableDevices.length}</span>
            </div>
            <div className="kpi-progress-track">
              <div
                className="kpi-progress-fill kpi-fill-emerald"
                style={{ width: `${Math.min(100, availability)}%` }}
              />
            </div>
          </div>

          <div className="kpi-footer">
            <Sparkline values={history.map((h) => h.online)} color="var(--ok)" />
          </div>
        </div>

        {/* Card 2: Stability & Outages */}
        <div className={`kpi-card ${offlineCable.length > 0 ? "kpi-card-rose" : "kpi-card-neutral"}`}>
          <div className="kpi-header">
            <div
              className={`kpi-icon-wrap ${
                offlineCable.length > 0 ? "kpi-icon-rose" : "kpi-icon-neutral"
              }`}
            >
              <Icon name="alert" size={18} />
            </div>
            <span className="kpi-title">الأجهزة المنقطعة</span>
            {offlineCable.length > 0 ? (
              <span className="kpi-pill pill-rose">
                <span className="dot dot-bad dot-pulse" /> يتطلب فحص
              </span>
            ) : (
              <span className="kpi-pill pill-emerald">
                <span className="dot dot-ok" /> مستقر 100%
              </span>
            )}
          </div>

          <div className="kpi-body">
            <div className="kpi-val ltr">
              <span className={`kpi-num ${offlineCable.length > 0 ? "text-rose" : ""}`}>
                {offlineCable.length}
              </span>
              <span className="kpi-total">جهاز منقطع</span>
            </div>
            <div className="kpi-meta-sub">
              {offlineCable.length > 0 ? (
                <span className="ltr text-rose">
                  {offlineCable.slice(0, 2).map((d) => d.name).join(" · ")}
                  {offlineCable.length > 2 ? ` +${offlineCable.length - 2}` : ""}
                </span>
              ) : (
                <span>جميع الأجهزة موصولة وشغالة ✓</span>
              )}
            </div>
          </div>

          <div className="kpi-footer">
            <Sparkline values={history.map((h) => h.offline)} color="var(--bad)" />
          </div>
        </div>

        {/* Card 3: Internet WAN Ping */}
        <div className="kpi-card kpi-card-cyan">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-cyan">
              <Icon name="globe" size={18} />
            </div>
            <span className="kpi-title">بينغ الإنترنت (WAN)</span>
            <span
              className={`kpi-pill ${
                lastPing == null
                  ? "pill-rose"
                  : lastPing > 90
                  ? "pill-rose"
                  : lastPing > 45
                  ? "pill-amber"
                  : "pill-cyan"
              }`}
            >
              {lastPing == null
                ? "غير متوفر"
                : lastPing <= 35
                ? "ممتاز ⚡"
                : lastPing <= 65
                ? "جيد جداً"
                : "تأخير"}
            </span>
          </div>

          <div className="kpi-body">
            <div className="kpi-val ltr">
              <span className="kpi-num">{lastPing != null ? lastPing : "—"}</span>
              <span className="kpi-unit">ms</span>
            </div>
            <div className="kpi-meta-sub">
              <span>راوتر الفايبر: </span>
              <strong style={{ color: "var(--ok-text)" }}>
                {state?.diagnostics?.gatewayPing != null ? `${state.diagnostics.gatewayPing} ms` : "—"}
              </strong>
            </div>
          </div>

          <div className="kpi-footer">
            <Sparkline
              values={history.filter((h) => h.ping != null).map((h) => h.ping as number)}
              color="var(--blue)"
            />
          </div>
        </div>

        {/* Card 4: Total Live Throughput */}
        <div className="kpi-card kpi-card-orange">
          <div className="kpi-header">
            <div className="kpi-icon-wrap kpi-icon-orange">
              <Icon name="activity" size={18} />
            </div>
            <span className="kpi-title">إجمالي الصبيب اللحظي</span>
            {portRates.some((r) => r.isHog) ? (
              <span className="kpi-pill pill-rose">
                <span className="dot dot-bad dot-pulse" /> استهلاك عالي
              </span>
            ) : (
              <span className="kpi-pill pill-orange">سرعة حية</span>
            )}
          </div>

          <div className="kpi-body">
            <div className="kpi-val ltr">
              <span className="kpi-num text-orange">{totalRx}</span>
              <span className="kpi-unit">Mbps</span>
            </div>
            <div className="kpi-meta-sub">
              <span>أعلى منفذ: </span>
              <strong className="ltr">
                {portRates.reduce((max, r) => (r.rxMbps > max.rxMbps ? r : max), {
                  port: "—",
                  rxMbps: 0,
                }).port}
              </strong>
            </div>
          </div>

          <div className="kpi-footer">
            <Sparkline values={history.map((h) => h.rx)} color="var(--accent)" />
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* 2. Main Analytics & Speedometer Columns                            */}
      {/* ================================================================== */}
      <div className="overview-main-grid">
        {/* Left Column: Live Throughput Chart + LAN Port Speedometers */}
        <div className="overview-stack">
          {/* Live Throughput Radar Card */}
          <section className="modern-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon-badge">
                  <Icon name="dashboard" size={17} />
                </div>
                <div>
                  <h3 className="panel-title">رادار الصبيب الحي للشبكة</h3>
                  <p className="panel-desc">تتبع مباشر لسرعة التحميل (Download) والرفع (Upload) لحظة بلحظة</p>
                </div>
              </div>

              <div className="chart-toggles">
                <button
                  type="button"
                  className={`chart-pill-btn ${showRx ? "rx-active" : ""}`}
                  onClick={() => setShowRx((v) => !v)}
                >
                  <span className="pill-color-indicator rx-indicator" />
                  <span>تحميل (Rx)</span>
                </button>
                <button
                  type="button"
                  className={`chart-pill-btn ${showTx ? "tx-active" : ""}`}
                  onClick={() => setShowTx((v) => !v)}
                >
                  <span className="pill-color-indicator tx-indicator" />
                  <span>رفع (Tx)</span>
                </button>
              </div>
            </div>

            <div className="panel-body">
              <LiveChart data={history} showRx={showRx} showTx={showTx} />
            </div>
          </section>

          {/* LAN Speedometer & Port Distribution */}
          <section className="modern-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon-badge">
                  <Icon name="cable" size={17} />
                </div>
                <div>
                  <h3 className="panel-title">استهلاك منافذ الراوتر (LAN Speedometers)</h3>
                  <p className="panel-desc">اضغط على أي منفذ لعرض وتصفية الأجهزة المرتبطة به مباشرة</p>
                </div>
              </div>
              <span className="badge badge-accent">4 منافذ LAN جيجابت</span>
            </div>

            <div className="panel-body">
              <div className="modern-ports-grid">
                {portRates.length === 0 && (
                  <div className="empty">جاري قراءة إحصائيات المنافذ من راوتر الفايبر…</div>
                )}
                {portRates.map((r) => {
                  const pct = Math.min(100, Math.round((r.rxMbps / 80) * 100));
                  const isSelected = portFilter === r.port;

                  return (
                    <div
                      key={r.port}
                      className={`port-speed-card ${r.isHog ? "is-hog" : ""} ${
                        isSelected ? "is-selected" : ""
                      }`}
                      onClick={() => {
                        setPortFilter(isSelected ? "ALL" : r.port);
                        goTo("cable");
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="port-speed-top">
                        <div className="port-title-wrap">
                          <span className="port-chip-tag ltr">{r.port}</span>
                          {r.isHog ? (
                            <span className="port-alert-tag">استهلاك مرتفع</span>
                          ) : (
                            <span className="port-sub-meta ltr">
                              {r.totalOutGB != null ? `${r.totalOutGB} GB إجمالي` : "نشط"}
                            </span>
                          )}
                        </div>
                        <div className="port-speed-readout ltr">
                          <span className="rx-val">↓ {r.rxMbps}</span>
                          <span className="speed-unit">Mbps</span>
                        </div>
                      </div>

                      {/* Animated Gradient Speed Progress Bar */}
                      <div className="port-bar-track">
                        <div
                          className={`port-bar-fill ${r.isHog ? "fill-hog" : "fill-gradient"}`}
                          style={{ width: `${Math.max(6, pct)}%` }}
                        />
                      </div>

                      <div className="port-speed-footer ltr">
                        <span>↑ {r.txMbps} Mbps رفع</span>
                        <span className="filter-hint">
                          {isSelected ? "محدد حالياً ✓" : "عرض الأجهزة ←"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Device Matrix + Security Sentinel + Recent Events */}
        <div className="overview-stack">
          {/* Device Availability Matrix Card */}
          <section className="modern-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon-badge">
                  <Icon name="wifi" size={17} />
                </div>
                <div>
                  <h3 className="panel-title">مصفوفة استقرار الأجهزة</h3>
                  <p className="panel-desc">كل خانة تمثل جهاز كابل مع قياس الاتصال اللحظي</p>
                </div>
              </div>
            </div>

            <div className="panel-body">
              {/* Segmented Micro Blocks with Tooltip */}
              {segDevices.length > 0 && (
                <div className="matrix-strip">
                  {segDevices.map((d, i) => (
                    <div
                      key={d.mac}
                      className={`matrix-node ${d.online ? "node-online" : "node-offline"}`}
                      style={{ animationDelay: `${Math.min(i * 15, 300)}ms` }}
                      title={`${d.name} (${d.online ? "متصل" : "منقطع"}) · ${d.ip}`}
                    />
                  ))}
                </div>
              )}

              {/* Status Breakdown Chips */}
              <div className="matrix-legend">
                <div className="legend-chip">
                  <span className="dot dot-ok" />
                  <span>متصل:</span>
                  <strong className="ltr">{onlineCableCount}</strong>
                </div>
                <div className="legend-chip">
                  <span className="dot dot-bad" />
                  <span>منقطع:</span>
                  <strong className="ltr">{offlineCable.length}</strong>
                </div>
                <div className="legend-chip">
                  <span className="dot dot-warn" />
                  <span>جديد:</span>
                  <strong className="ltr">{unknownDevices.length}</strong>
                </div>
                <div className="legend-chip">
                  <span className="dot dot-ink" />
                  <span>محظور:</span>
                  <strong className="ltr">{blockedCount}</strong>
                </div>
              </div>

              {/* Side-by-Side Ping Metrics */}
              <div className="dual-metric-box">
                <div className="dual-metric-card">
                  <span className="dual-metric-label">بينغ الراوتر الداخلي</span>
                  <div className="dual-metric-value ltr text-emerald">
                    {state?.diagnostics?.gatewayPing != null
                      ? `${state.diagnostics.gatewayPing} ms`
                      : "—"}
                  </div>
                </div>
                <div className="dual-metric-card">
                  <span className="dual-metric-label">بينغ الإنترنت المباشر</span>
                  <div className="dual-metric-value ltr text-blue">
                    {lastPing != null ? `${lastPing} ms` : "—"}
                  </div>
                </div>
              </div>

              {/* Quick Actions Bar */}
              <div className="matrix-actions-bar">
                <div className="fiber-status-tag">
                  <span className="status-label">حالة الفايبر:</span>
                  <strong className="status-val text-emerald">
                    {state?.diagnostics?.status || "مستقر ✓"}
                  </strong>
                </div>
                <div className="matrix-btn-group">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => sendCommand("run_diagnostics")}
                    title="فحص فوري للاستجابة والبينغ"
                  >
                    <Icon name="activity" size={13} /> فحص البينغ
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-danger"
                    onClick={() => setConfirmReboot(true)}
                    title="إعادة تشغيل الراوتر عن بعد"
                  >
                    <Icon name="power" size={13} /> إعادة تشغيل
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Rogue DHCP & Security Sentinel Banner */}
          {state?.rogueDhcp?.detected ? (
            <div className="sentinel-banner banner-danger">
              <div className="banner-content">
                <span className="dot dot-bad dot-pulse" style={{ width: 14, height: 14 }} />
                <div>
                  <h4 className="banner-heading">إنذار أمني خطير: روتور مقلوب أو تعارض DHCP!</h4>
                  <p className="banner-subtext">{state.rogueDhcp.message}</p>
                </div>
              </div>
              <span className="badge badge-bad ltr">{state.rogueDhcp.serverIp}</span>
            </div>
          ) : (
            <div className="sentinel-banner banner-safe">
              <div className="banner-content">
                <div className="shield-icon-badge">
                  <Icon name="shield" size={18} />
                </div>
                <div>
                  <h4 className="banner-heading">المصيدة الأمنية: الشبكة محمية 100%</h4>
                  <p className="banner-subtext">الراوتر الرئيسي 192.168.1.1 هو مزود DHCP الوحيد في الشبكة.</p>
                </div>
              </div>
              <span className="status-badge-safe">مؤمن ✓</span>
            </div>
          )}

          {/* Recent Events & Timeline */}
          <section className="modern-panel">
            <div className="panel-header">
              <div className="panel-title-group">
                <div className="panel-icon-badge">
                  <Icon name="activity" size={17} />
                </div>
                <div>
                  <h3 className="panel-title">شريط الأحداث اللحظية</h3>
                  <p className="panel-desc">تنبيهات الاتصال، الانقطاع، وإجراءات الأمان</p>
                </div>
              </div>
              <button type="button" className="btn btn-sm" onClick={() => goTo("activity")}>
                عرض السجل الكامل
              </button>
            </div>

            <div className="panel-body">
              {!state?.alerts || state.alerts.length === 0 ? (
                <div className="empty">لا توجد أحداث مسجلة بعد — الشبكة في حالة هدوء واستقرار.</div>
              ) : (
                <div className="modern-timeline">
                  {state.alerts.slice(0, 5).map((a, idx) => {
                    const dotClass =
                      a.type === "device_online"
                        ? "dot-ok"
                        : a.type === "device_offline"
                        ? "dot-bad"
                        : "dot-warn";

                    return (
                      <div key={idx} className="timeline-entry">
                        <span className={`dot ${dotClass} timeline-bullet`} />
                        <div className="timeline-text">{a.message}</div>
                        <div className="timeline-timestamp ltr">
                          {a.at ? formatClock(a.at) : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
