"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";
import type { CableHealthInfo, StatusFilter } from "@/features/dashboard/types";
import { formatPortLabel, hasWebAdmin, healthClass } from "@/features/dashboard/utils";

export function CableView() {
  const {
    statusFilter,
    setStatusFilter,
    statusCounts,
    search,
    setSearch,
    portFilter,
    setPortFilter,
    cableDevices,
    cablePortCounts,
    selected,
    setSelected,
    bulkBlock,
    bulkUnblock,
    sortedCable,
    toggleAllVisible,
    handleSort,
    sortIndicator,
    openInspect,
    toggleSelected,
    setActiveProxyIframe,
    setModalDevice,
    busyMac,
    sendCommand,
  } = useDashboard();

  return (
    <section className="card card-flush">
      <div className="tabs">
        {(
          [
            ["all", "الكل"],
            ["online", "متصل"],
            ["offline", "منقطع"],
            ["blocked", "محظور"],
          ] as Array<[StatusFilter, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`tab ${statusFilter === id ? "active" : ""}`}
            onClick={() => setStatusFilter(id)}
          >
            {label}
            <span className="tab-count ltr">{statusCounts[id]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <label className="search-field">
            <Icon name="search" size={15} />
            <input
              type="text"
              placeholder="بحث بالاسم، IP، الشركة…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="toolbar-group">
          <button
            type="button"
            className={`chip ${portFilter === "ALL" ? "active" : ""}`}
            onClick={() => setPortFilter("ALL")}
          >
            كل المنافذ ({cableDevices.length})
          </button>
          {cablePortCounts.map(([port, cnt]) => (
            <button
              key={port}
              type="button"
              className={`chip ${portFilter === port ? "active" : ""}`}
              onClick={() => setPortFilter(portFilter === port ? "ALL" : port)}
            >
              <span className="ltr">{port}</span> · <span className="ltr">{cnt}</span>
            </button>
          ))}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>
            تم تحديد <strong className="ltr">{selected.size}</strong> جهاز
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-sm btn-danger" onClick={bulkBlock}>
              <Icon name="ban" size={13} /> إيقاف المحدد
            </button>
            <button type="button" className="btn btn-sm" onClick={bulkUnblock}>
              <Icon name="power" size={13} /> تشغيل المحدد
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>
              إلغاء التحديد
            </button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  className="check"
                  aria-label="تحديد الكل"
                  checked={sortedCable.length > 0 && sortedCable.every((d) => selected.has(d.mac))}
                  onChange={toggleAllVisible}
                />
              </th>
              <th className="sortable" onClick={() => handleSort("status")}>
                الحالة{sortIndicator("status")}
              </th>
              <th className="sortable" onClick={() => handleSort("name")}>
                الجهاز والشركة{sortIndicator("name")}
              </th>
              <th className="sortable" onClick={() => handleSort("ip")}>
                عنوان IP{sortIndicator("ip")}
              </th>
              <th className="sortable" onClick={() => handleSort("port")}>
                المنفذ{sortIndicator("port")}
              </th>
              <th>الاستجابة والكابل</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {sortedCable.map((d) => (
              <tr
                key={d.mac}
                className={`${!d.online ? "row-offline" : ""} ${selected.has(d.mac) ? "row-selected" : ""}`}
                onClick={() => openInspect(d as unknown as Record<string, unknown>)}
              >
                <td className="check-col" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="check"
                    aria-label={`تحديد ${d.name}`}
                    checked={selected.has(d.mac)}
                    onChange={() => toggleSelected(d.mac)}
                  />
                </td>
                <td>
                  <span className={`status ${d.blocked ? "status-warn" : d.online ? "status-ok" : "status-bad"}`}>
                    <span
                      className={`dot ${d.blocked ? "dot-warn" : d.online ? "dot-ok" : "dot-bad dot-pulse"}`}
                    />
                    {d.blocked ? "محظور" : d.online ? "متصل" : "منقطع"}
                  </span>
                </td>
                <td>
                  <div className="dev-cell">
                    <div className={`tile ${!d.online ? "bad" : ""}`} title={d.catName || "جهاز شبكي"}>
                      {d.catIcon || "🔌"}
                    </div>
                    <div>
                      <div className="dev-name ltr">{d.name}</div>
                      <div className="dev-sub ltr">
                        {d.vendor || "—"}
                        {d.httpTitle
                          ? ` · ${d.httpTitle}`
                          : d.hostname && !d.vendor?.includes(d.hostname)
                          ? ` · ${d.hostname}`
                          : ""}
                      </div>
                      {Boolean(d.friendlyName) && (
                        <span className="friendly">
                          <span className="ltr">{d.friendlyName}</span>
                          <span>[{d.friendlySource || "كشف"}]</span>
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className="ltr">{d.ip}</span>
                </td>
                <td>
                  <span className="badge ltr">{formatPortLabel(d.port)}</span>
                </td>
                <td>
                  <div className="ltr" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {d.latencyMs !== null && d.latencyMs !== undefined ? (
                      <span className="badge" title="زمن الاستجابة الحقيقي (Live Ping)">
                        {d.latencyMs} ms
                      </span>
                    ) : d.online && d.medium === "LAN" ? (
                      <span
                        className="badge badge-warn"
                        title="الروتور متصل وشغال ولكن حاجب البينغ بجدار الحماية الافتراضي للـ WAN (TP-Link)"
                      >
                        جدار WAN
                      </span>
                    ) : (
                      <span className="badge">—</span>
                    )}
                    {d.cableHealth && (
                      <span
                        className={`badge ${healthClass(d.cableHealth.score)}`}
                        title={
                          (d.cableHealth as CableHealthInfo).source === "icmp_live"
                            ? `فحص حي: Jitter ${d.cableHealth.jitter} ms | فقدان الحزم: ${d.cableHealth.loss}%`
                            : `فحص عتادي من بورت الراوتر (${d.port})`
                        }
                      >
                        كابل {d.cableHealth.score}%
                      </span>
                    )}
                  </div>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="row-actions">
                    {hasWebAdmin(d) && (
                      <button
                        type="button"
                        className="icon-btn sm"
                        title="فتح صفحة إعدادات الجهاز"
                        onClick={() => setActiveProxyIframe({ ip: d.ip, name: d.name })}
                      >
                        <Icon name="globe" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="icon-btn sm"
                      title="تعديل الاسم"
                      onClick={() =>
                        setModalDevice({
                          mac: d.mac,
                          name: d.name,
                          ip: d.ip,
                          port: d.port,
                          medium: d.medium,
                          isNew: false,
                        })
                      }
                    >
                      <Icon name="pencil" size={14} />
                    </button>
                    {d.blocked ? (
                      <button
                        type="button"
                        className="icon-btn sm"
                        title="تشغيل"
                        disabled={busyMac === d.mac}
                        onClick={() => sendCommand("unblock", d.mac, d.name, d.blockInstId)}
                      >
                        <Icon name="power" size={14} />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="icon-btn sm danger"
                        title="إيقاف"
                        disabled={busyMac === d.mac}
                        onClick={() => sendCommand("block", d.mac, d.name)}
                      >
                        <Icon name="ban" size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {sortedCable.length === 0 && (
              <tr>
                <td colSpan={7} className="empty">
                  لا توجد أجهزة كابل مطابقة.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
