import { describe, expect, it } from "vitest";
import {
  dailyEnergyKwh,
  monthlyEnergyKwh,
  energyCost,
  estimateBill,
  DEFAULT_RATE,
} from "./energyCalculations";
import { runMapReduce } from "./mapReduce";

describe("energy calculations", () => {
  it("daily energy = watts × hours ÷ 1000", () => {
    expect(dailyEnergyKwh(1500, 8)).toBe(12);
  });
  it("monthly energy = daily × 30", () => {
    expect(monthlyEnergyKwh(12)).toBe(360);
  });
  it("default rate is ₹8 per kWh", () => {
    expect(DEFAULT_RATE).toBe(8);
    expect(energyCost(360)).toBe(2880);
  });
  it("bill estimator gives monthly, daily and yearly cost", () => {
    expect(estimateBill(300, 8)).toEqual({ monthly: 2400, daily: 80, yearly: 28800 });
  });
  it("MapReduce example aggregates per household", () => {
    const { reduced } = runMapReduce([
      { household: "Household A", appliance: "AC", kwh: 3 },
      { household: "Household A", appliance: "Fan", kwh: 1 },
      { household: "Household B", appliance: "AC", kwh: 4 },
    ]);
    expect(reduced).toEqual([
      { key: "Household A", total: 4 },
      { key: "Household B", total: 4 },
    ]);
  });
});
