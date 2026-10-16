// ILLUSTRATIVE SAMPLE DATA — not real measurements.
// Replace with JSON from the Flask API once the backend is connected.

export type ConsumptionRecord = {
  date: string; // YYYY-MM-DD
  household: string;
  appliance: string;
  kwh: number;
};

export const APPLIANCE_NAMES = [
  "Air conditioner",
  "Refrigerator",
  "Water heater",
  "Lights and fans",
  "Washing machine",
  "Television",
];
// Average share of daily usage per appliance (sums to 1)
const APPLIANCE_SHARE = [0.38, 0.2, 0.15, 0.14, 0.08, 0.05];
export const HOUSEHOLDS = ["HH-01", "HH-02", "HH-03", "HH-04", "HH-05"];

// Deterministic pseudo-random generator so the demo looks the same every time
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

/** 90 days × 5 households × 6 appliances of sample records, ending 30 Sep 2026. */
function generateRecords(): ConsumptionRecord[] {
  const rand = seeded(42);
  const records: ConsumptionRecord[] = [];
  const end = new Date(Date.UTC(2026, 8, 30));
  for (let d = 89; d >= 0; d--) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - d);
    const date = day.toISOString().slice(0, 10);
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    HOUSEHOLDS.forEach((household, h) => {
      const householdTotal = (11 + h * 2.2) * (weekend ? 1.15 : 1) * (0.85 + rand() * 0.3);
      APPLIANCE_NAMES.forEach((appliance, a) => {
        const kwh = householdTotal * (APPLIANCE_SHARE[a] ?? 0) * (0.8 + rand() * 0.4);
        records.push({ date, household, appliance, kwh: Math.round(kwh * 100) / 100 });
      });
    });
  }
  return records;
}

export const consumptionRecords = generateRecords();

// Headline dashboard values from the project brief (illustrative)
export const dashboardSummary = {
  totalConsumption: 2450,
  expenditure: 19600,
  avgDaily: 81.7,
  potentialSavings: 15,
  households: 100,
  efficiencyScore: 78,
};

export type Appliance = {
  id: string;
  name: string;
  category: string;
  watts: number;
  hours: number;
};

export const defaultAppliances: Appliance[] = [
  { id: "ac", name: "Air conditioner", category: "Cooling", watts: 1500, hours: 6 },
  { id: "fridge", name: "Refrigerator", category: "Kitchen", watts: 200, hours: 24 },
  { id: "tv", name: "Television", category: "Entertainment", watts: 120, hours: 5 },
  { id: "wm", name: "Washing machine", category: "Laundry", watts: 500, hours: 1 },
  { id: "lights", name: "Lights and fans", category: "Lighting", watts: 300, hours: 8 },
  { id: "geyser", name: "Water heater", category: "Heating", watts: 2000, hours: 1 },
];

// Simulated K-means output (k = 3). Structure matches what PySpark MLlib could return.
export type ClusteredHousehold = {
  id: string;
  avgDaily: number;
  monthly: number;
  peakUsage: boolean;
  cluster: "Low" | "Medium" | "High";
};

function generateHouseholds(): ClusteredHousehold[] {
  const rand = seeded(7);
  const list: ClusteredHousehold[] = [];
  for (let i = 1; i <= 100; i++) {
    const r = rand();
    const cluster = r < 0.42 ? "Low" : r < 0.8 ? "Medium" : "High";
    const base = cluster === "Low" ? 6 : cluster === "Medium" ? 13 : 22;
    const avgDaily = Math.round((base + rand() * 5) * 10) / 10;
    list.push({
      id: `HH-${String(i).padStart(3, "0")}`,
      avgDaily,
      monthly: Math.round(avgDaily * 30),
      peakUsage:
        cluster === "High" ? rand() > 0.2 : cluster === "Medium" ? rand() > 0.6 : rand() > 0.9,
      cluster,
    });
  }
  return list;
}

export const clusteredHouseholds = generateHouseholds();

export const mapReduceInput = [
  { household: "Household A", appliance: "AC", kwh: 3 },
  { household: "Household A", appliance: "Fan", kwh: 1 },
  { household: "Household B", appliance: "AC", kwh: 4 },
];

export type Recommendation = {
  id: string;
  title: string;
  explanation: string;
  savings: string;
  savingsPct: number;
  difficulty: "Easy" | "Medium" | "Hard";
  icon: "snowflake" | "refrigerator" | "lightbulb" | "plug" | "washing" | "star";
};

export const recommendations: Recommendation[] = [
  {
    id: "ac",
    title: "Set the AC to 24–26°C",
    explanation:
      "Each degree higher cuts cooling energy noticeably. Use the timer and keep doors and windows closed.",
    savings: "Up to 6% per °C raised",
    savingsPct: 20,
    difficulty: "Easy",
    icon: "snowflake",
  },
  {
    id: "fridge",
    title: "Keep the refrigerator efficient",
    explanation:
      "Leave space behind for airflow, check door seals and avoid putting hot food inside.",
    savings: "5–10% of fridge energy",
    savingsPct: 8,
    difficulty: "Easy",
    icon: "refrigerator",
  },
  {
    id: "lights",
    title: "Switch to LED lights and BLDC fans",
    explanation:
      "LEDs use far less power than CFL or tube lights; BLDC fans use about half the power of regular fans.",
    savings: "Up to 50% on lighting & fans",
    savingsPct: 25,
    difficulty: "Medium",
    icon: "lightbulb",
  },
  {
    id: "standby",
    title: "Cut standby power",
    explanation: "Turn off set-top boxes, chargers and TVs at the switch when not in use.",
    savings: "3–5% of total bill",
    savingsPct: 4,
    difficulty: "Easy",
    icon: "plug",
  },
  {
    id: "wm",
    title: "Run full washing machine loads",
    explanation: "Wash full loads in cold water; heating water uses most of the machine’s energy.",
    savings: "Up to 30% of washing energy",
    savingsPct: 10,
    difficulty: "Easy",
    icon: "washing",
  },
  {
    id: "star",
    title: "Buy 5-star rated appliances",
    explanation:
      "When replacing an AC, fridge or geyser, choose a BEE 5-star model for long-term savings.",
    savings: "20–30% per appliance",
    savingsPct: 25,
    difficulty: "Hard",
    icon: "star",
  },
];
