"use client";

import { useDashboard } from "@/features/dashboard/DashboardContext";
import { LoginView } from "./auth/LoginView";
import { Sidebar } from "./layout/Sidebar";
import { Topbar } from "./layout/Topbar";
import { OverviewView } from "./views/OverviewView";
import { CableView } from "./views/CableView";
import { WifiView } from "./views/WifiView";
import { GatewayView } from "./views/GatewayView";
import { SecurityView } from "./views/SecurityView";
import { ActivityView } from "./views/ActivityView";
import { DeviceDrawer } from "./modals/DeviceDrawer";
import { DeviceModal } from "./modals/DeviceModal";
import { RebootModal } from "./modals/RebootModal";
import { ProxyModal } from "./modals/ProxyModal";

export function DashboardView() {
  const { authed, view, toast } = useDashboard();

  if (!authed) {
    return <LoginView />;
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        {view === "overview" && <OverviewView />}
        {view === "cable" && <CableView />}
        {view === "wifi" && <WifiView />}
        {view === "gateway" && <GatewayView />}
        {view === "security" && <SecurityView />}
        {view === "activity" && <ActivityView />}
      </main>

      <DeviceDrawer />
      <DeviceModal />
      <RebootModal />
      <ProxyModal />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
