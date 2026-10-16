// Simple, readable energy formulas used across PowerWise.

export const DEFAULT_RATE = 8; // ₹ per kWh (illustrative)

/** Daily energy (kWh) = Wattage × Daily usage hours ÷ 1000 */
export function dailyEnergyKwh(watts: number, hoursPerDay: number): number {
  return (watts * hoursPerDay) / 1000;
}

/** Monthly energy (kWh) = Daily energy × 30 */
export function monthlyEnergyKwh(dailyKwh: number): number {
  return dailyKwh * 30;
}

/** Estimated cost (₹) = Energy (kWh) × Rate per unit */
export function energyCost(kwh: number, rate: number = DEFAULT_RATE): number {
  return kwh * rate;
}

/** Bill estimator: monthly, daily (÷30) and yearly (×12) cost. */
export function estimateBill(monthlyKwh: number, rate: number) {
  const monthly = monthlyKwh * rate;
  return { monthly, daily: monthly / 30, yearly: monthly * 12 };
}

/** Percent share of a value in a total (0 when total is 0). */
export function percentOf(value: number, total: number): number {
  return total === 0 ? 0 : (value / total) * 100;
}

/** Percent change from previous to current period. */
export function percentChange(current: number, previous: number): number {
  return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export const formatKwh = (n: number) =>
  `${n.toLocaleString("en-IN", { maximumFractionDigits: 1 })} kWh`;
export const formatRupees = (n: number) =>
  `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
