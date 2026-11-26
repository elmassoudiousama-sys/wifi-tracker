"use client";

import { useDashboardState } from "@/features/dashboard/useDashboardState";
import { DashboardProvider } from "@/features/dashboard/DashboardContext";
import BentoDashboard from "@/components/bento/BentoDashboard";

export default function Page() {
  const dashboard = useDashboardState();

  return (
    <DashboardProvider value={dashboard}>
      <BentoDashboard />
    </DashboardProvider>
  );
}
