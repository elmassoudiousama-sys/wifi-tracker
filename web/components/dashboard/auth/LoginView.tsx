"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

export function LoginView() {
  const { password, setPassword, authError, theme, toggleTheme, handleLogin } = useDashboard();

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="brand">
            <div className="brand-mark">
              <Icon name="wifi" size={18} />
            </div>
            <div>
              <div className="brand-name">مراقبة الشبكة</div>
              <div className="brand-sub">Fiber Monitor</div>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={toggleTheme} title="تبديل المظهر">
            <Icon name={theme === "dark" ? "sun" : "moon"} />
          </button>
        </div>
        <p className="muted" style={{ fontSize: 13 }}>
          أدخل كلمة السر لعرض تفاصيل الأجهزة والتحكم في الراوتر.
        </p>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="password"
            className="field"
            placeholder="كلمة السر"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {authError && <div className="error-text">{authError}</div>}
          <button type="submit" className="btn btn-primary btn-block" style={{ height: 38 }}>
            دخول
          </button>
        </form>
      </div>
    </div>
  );
}
