"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { DashboardIcon as Icon } from "@/components/dashboard/DashboardIcon";

export function GatewayView() {
  const { webEquipment, setActiveProxyIframe, copyProxyLink } = useDashboard();

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <div className="card-title">بوابة إدارة الرواتر والأجهزة عن بعد</div>
          <div className="card-sub">الدخول لإعدادات الرواتر والكاميرات من أي مكان عبر البروكسي الداخلي</div>
        </div>
        <span className="badge badge-accent">وصول مباشر من 4G</span>
      </div>
      <div className="router-grid">
        {webEquipment.map((eq) => (
          <div key={eq.ip} className="router-card">
            <div className="router-head">
              <div className="router-title">
                <div className="tile">{eq.type === "ont" ? "⚡" : eq.type === "camera" ? "📹" : "📡"}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="dev-name">{eq.name}</div>
                  <div className="dev-sub ltr">
                    {eq.model} · {eq.ip}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <span className={`badge ${eq.online ? "badge-ok" : "badge-bad"}`}>
                  <span className={`dot ${eq.online ? "dot-ok" : "dot-bad"}`} />
                  {eq.online ? "متصل" : "منقطع"}
                </span>
                {eq.pingMs != null && <span className="badge ltr">{eq.pingMs} ms</span>}
              </div>
            </div>

            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {eq.ports.map((p) => (
                <span key={p} className="badge ltr">
                  {p}
                </span>
              ))}
            </div>

            <div className="router-cred">
              <span>الدخول الافتراضي</span>
              <code className="ltr" style={{ fontWeight: 600, color: "var(--text)" }}>
                {eq.credentialsHint}
              </code>
            </div>

            <div className="router-actions">
              <a
                href={`/api/proxy/${eq.ip}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                title="فتح صفحة الروتور عن بعد عبر البروكسي الداخلي (يعمل حتى لو كنت خارج الدار على 4G)"
              >
                <Icon name="external" size={14} /> دخول عن بعد
              </a>
              <button
                type="button"
                className="btn"
                onClick={() => setActiveProxyIframe({ ip: eq.ip, name: eq.name })}
                title="فتح صفحة الروتور داخل نافذة مدمجة"
              >
                <Icon name="devices" size={14} /> مدمجة
              </button>
              <a
                href={`http://${eq.ip}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                title="فتح مباشر (يعمل فقط عندما تكون متصلاً بواي فاي الدار)"
              >
                محلي
              </a>
              <button
                type="button"
                className="icon-btn"
                title="نسخ رابط الدخول عن بعد"
                onClick={() => copyProxyLink(eq.ip)}
              >
                <Icon name="copy" size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
