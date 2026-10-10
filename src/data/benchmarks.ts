// SIMULATED benchmark table: what other Pakistani SMEs reportedly paid for the demo machine.
// Not real transactions. Labelled "Simulated benchmark" in the UI and README.
// Deterministic: 60 hardcoded prices (Rs 65,200–74,700, median exactly Rs 68,700, close to the real web
// median of Rs 70,000 for the Jack F5); city, company size and date rotate by row index so every run
// produces the same table.
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

// Unit prices in hundreds of rupees (687 = Rs 68,700). 28 below the median, 3 at it, 29 above.
const PRICES_H = [
  680, 712, 652, 693, 700, 720, 667, 690, 677, 747,
  685, 657, 701, 682, 687, 705, 662, 695, 678, 727,
  670, 691, 683, 710, 675, 697, 655, 732, 686, 692,
  681, 715, 660, 688, 687, 702, 672, 696, 680, 737,
  685, 665, 700, 682, 687, 707, 667, 690, 677, 722,
  675, 692, 686, 717, 682, 695, 685, 742, 657, 697,
];

const CITIES = ["Faisalabad", "Lahore", "Karachi", "Sialkot", "Gujranwala", "Multan", "Rawalpindi"];
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];

export const benchmarkRows: BenchmarkRow[] = PRICES_H.map((h, i) => ({
  item: DEMO_ITEM,
  model: DEMO_MODEL,
  city: CITIES[(i * 3) % CITIES.length],
  unitPrice: h * 100,
  companySize: i % 3 === 0 ? "medium" : "small",
  date: `${MONTHS[i % MONTHS.length]}-${String(((i * 7) % 27) + 1).padStart(2, "0")}`,
}));

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// "Jack F5", "JACK F5-7" and "F5" all map to the same benchmark rows.
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
