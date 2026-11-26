"use client";

import { useDashboardState } from "@/features/dashboard/useDashboardState";
import { DashboardProvider } from "@/features/dashboard/DashboardContext";
import { MapEditor } from "@/components/map-editor/MapEditor";

export default function MapEditorPage() {
  const dashboard = useDashboardState();

  return (
    <DashboardProvider value={dashboard}>
      <MapEditor />
    </DashboardProvider>
  );
}
