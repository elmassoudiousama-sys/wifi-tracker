"use client";

import { useDashboardState } from "./useDashboardState";
import { DashboardProvider } from "./DashboardContext";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default function DashboardPage() {
  const dashboard = useDashboardState();

  return (
    <DashboardProvider value={dashboard}>
      <DashboardView />
    </DashboardProvider>
  );
}
