"use client";

import { useState, useEffect } from "react";
import { DashboardData, initialDashboardData, TrafficBar } from "@/lib/data";

export function useLiveDashboard() {
  const [data, setData] = useState<DashboardData>(initialDashboardData);
  const [clock, setClock] = useState<string>("23:14:35");
  const [selectedPortId, setSelectedPortId] = useState<string>("LAN3");

  // Keep clock ticking every second
  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const updateTime = () => {
      const now = new Date();
      setClock(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // Shift traffic bars every 2s with new random download (15-45) and upload (0.5-4)
  useEffect(() => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    const trafficInterval = setInterval(() => {
      const now = new Date();
      const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

      const newDl = Math.round((15 + Math.random() * 30) * 100) / 100;
      const newUl = Math.round((0.5 + Math.random() * 3.5) * 100) / 100;

      setData((prev) => {
        const nextBars: TrafficBar[] = [...prev.traffic.bars.slice(1), { download: newDl, upload: newUl }];
        const peakDl = Math.max(prev.traffic.peakDownload, newDl);
        const peakUl = Math.max(prev.traffic.peakUpload, newUl);

        return {
          ...prev,
          traffic: {
            ...prev.traffic,
            currentDownload: newDl,
            currentUpload: newUl,
            peakDownload: peakDl,
            peakUpload: peakUl,
            bars: nextBars,
            timeLabels: [
              prev.traffic.timeLabels[0],
              prev.traffic.timeLabels[1],
              `${timeStr} · مباشر`,
            ],
          },
        };
      });
    }, 2000);

    return () => clearInterval(trafficInterval);
  }, []);

  return {
    data,
    clock,
    selectedPortId,
    setSelectedPortId,
  };
}
