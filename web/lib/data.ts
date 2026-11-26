export interface TrafficBar {
  download: number; // in Mbps (0 - 50)
  upload: number;   // in Mbps (0 - 5)
}

export interface DeviceDot {
  type: "connected" | "disconnected" | "new" | "blocked";
}

export interface LanPort {
  id: string;
  name: string;
  download: number;
  upload: number;
  totalGb: number;
}

export interface NetworkEvent {
  id: string;
  time: string;
  device: string;
  tag: string;
  ip: string;
  mac: string;
  port: string;
}

export interface DashboardData {
  router: {
    model: string;
    ip: string;
  };
  tabs: Array<{ id: string; name: string; count?: number; active?: boolean }>;
  traffic: {
    currentDownload: number;
    peakDownload: number;
    currentUpload: number;
    peakUpload: number;
    bars: TrafficBar[];
    timeLabels: string[];
  };
  devices: {
    connected: number;
    total: number;
    percent: number;
    dots: DeviceDot[];
  };
  disconnected: {
    count: number;
    names: string[];
  };
  latency: {
    routerMs: number;
    routerMaxMs: number;
    wanMs: number;
    wanMaxMs: number;
    badge: string;
    fiberStatus: string;
  };
  lanPorts: LanPort[];
  security: {
    percentage: number;
    title: string;
    description: string;
    unregisteredCount: number;
  };
  events: NetworkEvent[];
}

// Generate initial 44 traffic bars with realistic data
const initialBars: TrafficBar[] = Array.from({ length: 44 }, (_, i) => {
  // Wave pattern with some randomness
  const factor = Math.sin(i / 5) * 10 + 25;
  const jitter = (Math.random() - 0.5) * 8;
  const dl = Math.max(8, Math.min(48, Math.round((factor + jitter) * 100) / 100));
  const ul = Math.max(0.4, Math.min(4.2, Math.round(((dl / 12) + (Math.random() * 0.8)) * 100) / 100));
  return { download: dl, upload: ul };
});
// Set the last one to match the current download/upload
initialBars[43] = { download: 39.78, upload: 2.45 };

// 34 total dots: 21 black (connected), 2 orange (disconnected), 10 white (new), 1 olive (blocked)
const initialDots: DeviceDot[] = [
  ...Array(21).fill({ type: "connected" as const }),
  ...Array(2).fill({ type: "disconnected" as const }),
  ...Array(10).fill({ type: "new" as const }),
  { type: "blocked" as const },
];

export const initialDashboardData: DashboardData = {
  router: {
    model: "ZTE F680",
    ip: "192.168.1.1",
  },
  tabs: [
    { id: "overview", name: "نظرة عامة", active: true },
    { id: "cable", name: "أجهزة الكابل", count: 23 },
    { id: "wifi", name: "الويفي", count: 7 },
    { id: "gateway", name: "البوابة", count: 21 },
    { id: "security", name: "الأمان", count: 12 },
    { id: "activity", name: "السجل", count: 60 },
  ],
  traffic: {
    currentDownload: 39.78,
    peakDownload: 43.23,
    currentUpload: 2.45,
    peakUpload: 4.5,
    bars: initialBars,
    timeLabels: ["22:53:34", "23:03:23", "23:14:35 · مباشر"],
  },
  devices: {
    connected: 21,
    total: 23,
    percent: 91,
    dots: initialDots,
  },
  disconnected: {
    count: 2,
    names: ["PC 1", "PC 2"],
  },
  latency: {
    routerMs: 3.49,
    routerMaxMs: 20,
    wanMs: 36.5,
    wanMaxMs: 100,
    badge: "جيد جداً",
    fiberStatus: "ممتاز",
  },
  lanPorts: [
    { id: "LAN1", name: "LAN1", download: 14.14, upload: 0.99, totalGb: 149.95 },
    { id: "LAN2", name: "LAN2", download: 15.38, upload: 1.24, totalGb: 100.25 },
    { id: "LAN3", name: "LAN3", download: 9.35, upload: 0.32, totalGb: 18.34 },
    { id: "LAN4", name: "LAN4", download: 0, upload: 0, totalGb: 0.01 },
  ],
  security: {
    percentage: 100,
    title: "الشبكة محمية",
    description: "192.168.1.1 هو مزود DHCP الوحيد في الشبكة",
    unregisteredCount: 10,
  },
  events: [
    {
      id: "ev1",
      time: "22:22:33",
      device: "Galaxy-A07",
      tag: "جهاز جديد",
      ip: "192.168.1.19",
      mac: "CA:49:F0:85:7E:31",
      port: "LAN1",
    },
    {
      id: "ev2",
      time: "21:10:01",
      device: "TLWR844N",
      tag: "جهاز جديد",
      ip: "192.168.1.6",
      mac: "A8:42:A1:FE:1A:F3",
      port: "LAN2",
    },
    {
      id: "ev3",
      time: "19:28:01",
      device: "A53-de-tarik",
      tag: "جهاز جديد",
      ip: "192.168.1.18",
      mac: "72:6B:D6:06:6B:E8",
      port: "LAN1",
    },
    {
      id: "ev4",
      time: "19:21:13",
      device: "Unknown",
      tag: "جهاز جديد",
      ip: "192.168.8.1",
      mac: "F4:B8:A7:E1:AF:99",
      port: "LAN1",
    },
  ],
};
