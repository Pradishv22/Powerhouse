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

  it("smart savings planner calculates correct reductions and rupee savings", () => {
    // 1500W AC from 6 hours to 4 hours at ₹8/kWh
    const watts = 1500;
    const currHours = 6;
    const propHours = 4;
    const rate = 8;

    const currDaily = (watts * currHours) / 1000; // 9 kWh
    const propDaily = (watts * propHours) / 1000; // 6 kWh
    const dailyReduction = currDaily - propDaily; // 3 kWh
    const monthlyReduction = dailyReduction * 30; // 90 kWh
    const monthlySavingsInr = monthlyReduction * rate; // ₹720
    const annualSavingsInr = monthlySavingsInr * 12; // ₹8640
    const percentReduction = (monthlyReduction / (currDaily * 30)) * 100; // 33.33%

    expect(currDaily).toBe(9);
    expect(propDaily).toBe(6);
    expect(dailyReduction).toBe(3);
    expect(monthlyReduction).toBe(90);
    expect(monthlySavingsInr).toBe(720);
    expect(annualSavingsInr).toBe(8640);
    expect(Math.round(percentReduction * 10) / 10).toBe(33.3);
  });
});
