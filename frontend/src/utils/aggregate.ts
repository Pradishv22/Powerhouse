import type { ConsumptionRecord } from "@/data/mockData";

/** Sum kWh grouped by any key of a record. */
export function sumBy(records: ConsumptionRecord[], getKey: (r: ConsumptionRecord) => string) {
  const totals: Record<string, number> = {};
  for (const r of records) totals[getKey(r)] = (totals[getKey(r)] ?? 0) + r.kwh;
  return Object.entries(totals).map(([name, kwh]) => ({ name, kwh: Math.round(kwh * 10) / 10 }));
}

/** Week label = Monday of that week (YYYY-MM-DD). */
export function weekKey(date: string) {
  const d = new Date(date + "T00:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}
export const monthKey = (date: string) => date.slice(0, 7);

/** Keep only records in the last N days of the dataset. */
export function lastNDays(records: ConsumptionRecord[], days: number) {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const keep = new Set(dates.slice(-days));
  return records.filter((r) => keep.has(r.date));
}

/** Records in the N days just before the last N days (for comparison). */
export function previousNDays(records: ConsumptionRecord[], days: number) {
  const dates = [...new Set(records.map((r) => r.date))].sort();
  const keep = new Set(dates.slice(-days * 2, -days));
  return records.filter((r) => keep.has(r.date));
}

export function totalKwh(records: ConsumptionRecord[]) {
  return records.reduce((s, r) => s + r.kwh, 0);
}

/** Turn rows into CSV text. */
export function toCsv(rows: Record<string, string | number>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  const lines = rows.map((row) =>
    headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(","),
  );
  return [headers.join(","), ...lines].join("\n");
}
