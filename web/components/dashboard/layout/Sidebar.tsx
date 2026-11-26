"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

export function Sidebar() {
  const {
    view,
    search,
    setSearch,
    setView,
    searchRef,
    navItems,
    goTo,
    state,
    lastPing,
    theme,
    toggleTheme,
    handleLogout,
  } = useDashboard();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <Icon name="wifi" size={18} />
        </div>
        <div>
          <div className="brand-name">مراقبة الشبكة</div>
          <div className="brand-sub ltr">ZTE F680 · 192.168.1.1</div>
        </div>
      </div>

      <label className="side-search">
        <Icon name="search" size={15} />
        <input
          ref={searchRef}
          type="text"
          placeholder="بحث عن جهاز…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (view !== "cable") setView("cable");
          }}
        />
        <span className="kbd">/</span>
      </label>

      <div>
        <div className="nav-label">المراقبة</div>
        <nav className="nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${view === item.id ? "active" : ""}`}
              onClick={() => goTo(item.id)}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
              {item.count !== undefined && (
                <span className={`nav-count ltr ${item.tone || ""}`}>{item.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="side-foot">
        <div className="side-status">
          <div className="side-status-row">
            <span className="muted">بينغ الراوتر</span>
            <strong className="ltr">
              {state?.diagnostics?.gatewayPing != null ? `${state.diagnostics.gatewayPing} ms` : "—"}
            </strong>
          </div>
          <div className="side-status-row">
            <span className="muted">بينغ الإنترنت</span>
            <strong className="ltr">{lastPing != null ? `${lastPing} ms` : "—"}</strong>
          </div>
        </div>
        <div className="side-actions">
          <button type="button" className="icon-btn" onClick={toggleTheme} title="تبديل المظهر">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
          <button type="button" className="icon-btn" title="خروج" onClick={handleLogout}>
            <Icon name="logout" />
          </button>
        </div>
      </div>
    </aside>
  );
}
