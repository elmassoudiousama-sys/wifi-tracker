import type { ReactNode } from "react";
import { DashboardIcon } from "./DashboardIcon";

export function DetailRow({ icon, label, children }: { icon: string; label: string; children: ReactNode }) {
  return <div className="kv-row"><DashboardIcon name={icon} size={15} /><span className="kv-label">{label}</span><span className="kv-val">{children}</span></div>;
}

