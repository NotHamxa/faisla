// SIMULATED benchmark table: what other Pakistani SMEs reportedly paid for the demo machine.
// Not real transactions. Labelled "Simulated benchmark" in the UI and README.
// Deterministic: 60 hardcoded prices (Rs 12.9–14.8 lakh, median exactly Rs 13,60,000);
// city, company size and date rotate by row index so every run produces the same table.
import { DEMO_ITEM, DEMO_MODEL } from "@/lib/demoData";

export const BENCHMARK_SIMULATED = true;

export type BenchmarkRow = {
  item: string;
  model: string;
  city: string;
  unitPrice: number;
  companySize: "small" | "medium";
  date: string; // YYYY-MM-DD
};

// Unit prices in thousands of rupees (1360 = Rs 13,60,000). 29 below the median, 2 at it, 29 above.
const PRICES_K = [
  1345, 1410, 1290, 1372, 1385, 1425, 1320, 1365, 1340, 1480,
  1355, 1300, 1388, 1350, 1360, 1395, 1310, 1375, 1342, 1440,
  1325, 1368, 1352, 1405, 1335, 1380, 1295, 1450, 1357, 1370,
  1348, 1415, 1305, 1362, 1359, 1390, 1330, 1378, 1345, 1460,
  1355, 1315, 1385, 1350, 1360, 1400, 1320, 1365, 1340, 1430,
  1335, 1370, 1358, 1420, 1350, 1375, 1355, 1470, 1300, 1380,
];

const CITIES = ["Faisalabad", "Lahore", "Karachi", "Sialkot", "Gujranwala", "Multan", "Rawalpindi"];
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

export const benchmarkRows: BenchmarkRow[] = PRICES_K.map((k, i) => ({
  item: DEMO_ITEM,
  model: DEMO_MODEL,
  city: CITIES[(i * 3) % CITIES.length],
  unitPrice: k * 1000,
  companySize: i % 3 === 0 ? "medium" : "small",
  date: `${MONTHS[i % MONTHS.length]}-${String(((i * 7) % 27) + 1).padStart(2, "0")}`,
}));

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// "JUKI AMS-221F", "Juki AMS 221F-2516" and "AMS-221F" all map to the same benchmark rows.
function modelKey(model: string): string {
  return model.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function benchmarkFor(model: string | null | undefined): { median: number | null; count: number } {
  const key = modelKey(model ?? "");
  if (!key) return { median: null, count: 0 };
  const rows = benchmarkRows.filter((r) => {
    const rowKey = modelKey(r.model);
    return rowKey.includes(key) || key.includes(rowKey.replace(/^juki/, ""));
  });
  return { median: median(rows.map((r) => r.unitPrice)), count: rows.length };
}
