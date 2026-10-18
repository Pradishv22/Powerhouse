import { useState, useEffect, useId } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calculator,
  Leaf,
  PiggyBank,
  TrendingDown,
  Save,
  Download,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { PageHeader, Card, tooltipStyle } from "@/components/ui-kit";
import {
  getAppliances,
  calculateSavings,
  getSavingsScenarios,
  saveSavingsScenario,
  deleteSavingsScenario,
  type Appliance,
  type SavingsCalculation,
  type SavingsScenario,
} from "@/services/api";
import { formatRupees, DEFAULT_RATE, estimateBill } from "@/utils/energyCalculations";

export const Route = createFileRoute("/bill-estimator")({
  head: () => ({
    meta: [
      { title: "Smart Savings Planner & Bill Estimator — PowerWise" },
      {
        name: "description",
        content:
          "Plan hypothetical energy reductions, calculate monthly rupee savings, and estimate electricity bills with accurate wattage formulas.",
      },
    ],
  }),
  component: BillAndSavingsHub,
});

function BillAndSavingsHub() {
  const [activeTab, setActiveTab] = useState<"planner" | "saved" | "calculator">("planner");

  // Appliances list for dropdown
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [selectedApplianceId, setSelectedApplianceId] = useState<string>("custom");

  // Planner inputs
  const [applianceName, setApplianceName] = useState("Air conditioner");
  const [wattage, setWattage] = useState<number>(1500);
  const [currentHours, setCurrentHours] = useState<number>(6.0);
  const [proposedHours, setProposedHours] = useState<number>(4.0);
  const [tariff, setTariff] = useState<number>(DEFAULT_RATE);
  const [fixedCharges, setFixedCharges] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  // Live calculation results
  const [projection, setProjection] = useState<SavingsCalculation | null>(null);
  const [savedScenarios, setSavedScenarios] = useState<SavingsScenario[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");
  const [saveErrorMsg, setSaveErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Quick estimator state
  const [units, setUnits] = useState("300");
  const [quickRate, setQuickRate] = useState(String(DEFAULT_RATE));

  // Load user appliances & saved scenarios on mount
  useEffect(() => {
    getAppliances(tariff).then((data) => {
      setAppliances(data);
      if (data.length > 0) {
        const first = data[0];
        setSelectedApplianceId(first.id);
        setApplianceName(first.name);
        setWattage(first.watts);
        setCurrentHours(first.hours);
        setProposedHours(Math.max(0.5, Math.round(first.hours * 0.7 * 10) / 10));
      }
    });

    getSavingsScenarios().then(setSavedScenarios);
  }, []);

  // Recalculate savings whenever inputs change
  useEffect(() => {
    if (wattage <= 0 || currentHours < 0 || proposedHours < 0 || tariff <= 0) return;

    calculateSavings({
      wattage_w: wattage,
      current_daily_hours: currentHours,
      proposed_daily_hours: proposedHours,
      tariff_inr: tariff,
      fixed_charges_inr: fixedCharges,
      quantity,
      billing_days: 30,
    })
      .then((res) => setProjection(res.projection))
      .catch(() => {
        // Fallback local calculation
        const currDaily = (wattage * currentHours * quantity) / 1000.0;
        const propDaily = (wattage * proposedHours * quantity) / 1000.0;
        const currMo = currDaily * 30;
        const propMo = propDaily * 30;
        const currCost = currMo * tariff + fixedCharges;
        const propCost = propMo * tariff + fixedCharges;
        setProjection({
          is_hypothetical_projection: true,
          disclaimer: "Hypothetical projection based on assumed reduction.",
          assumptions: {
            billing_days: 30,
            tariff_inr_per_kwh: tariff,
            fixed_charges_inr: fixedCharges,
            formula: "kWh = watts × hours × quantity ÷ 1000",
          },
          current_scenario: {
            daily_hours: currentHours,
            daily_kwh: roundVal(currDaily, 3),
            monthly_kwh: roundVal(currMo, 2),
            monthly_cost_inr: roundVal(currCost, 2),
          },
          proposed_scenario: {
            daily_hours: proposedHours,
            daily_kwh: roundVal(propDaily, 3),
            monthly_kwh: roundVal(propMo, 2),
            monthly_cost_inr: roundVal(propCost, 2),
          },
          reductions: {
            daily_kwh: roundVal(Math.max(0, currDaily - propDaily), 3),
            monthly_kwh: roundVal(Math.max(0, currMo - propMo), 2),
            monthly_savings_inr: roundVal(Math.max(0, currCost - propCost), 2),
            annual_savings_inr: roundVal(Math.max(0, currCost - propCost) * 12, 2),
            percent_reduction: currMo > 0 ? roundVal(((currMo - propMo) / currMo) * 100, 1) : 0,
          },
        });
      });
  }, [wattage, currentHours, proposedHours, tariff, fixedCharges, quantity]);

  function roundVal(n: number, d: number) {
    const f = Math.pow(10, d);
    return Math.round(n * f) / f;
  }

  const handleApplianceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedApplianceId(id);
    if (id === "custom") {
      setApplianceName("Custom Appliance");
      return;
    }
    const found = appliances.find((a) => a.id === id);
    if (found) {
      setApplianceName(found.name);
      setWattage(found.watts);
      setCurrentHours(found.hours);
      setProposedHours(Math.max(0.5, Math.round(found.hours * 0.7 * 10) / 10));
    }
  };

  const handleSaveScenario = async () => {
    setSaveSuccessMsg("");
    setSaveErrorMsg("");
    setIsSaving(true);
    try {
      const defaultName = `${applianceName} Saver (${currentHours}h → ${proposedHours}h)`;
      const res = await saveSavingsScenario({
        name: defaultName,
        appliance_name: applianceName,
        wattage_w: wattage,
        current_daily_hours: currentHours,
        proposed_daily_hours: proposedHours,
        tariff_inr: tariff,
        fixed_charges_inr: fixedCharges,
        quantity,
      });
      setSavedScenarios((prev) => [res.scenario, ...prev]);
      setSaveSuccessMsg(`Saved simulation scenario "${defaultName}" successfully!`);
    } catch (err: unknown) {
      setSaveErrorMsg(err instanceof Error ? err.message : "Failed to save scenario.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteScenario = async (id: string) => {
    try {
      await deleteSavingsScenario(id);
      setSavedScenarios((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // ignore
    }
  };

  const handleExportJson = () => {
    if (!projection) return;
    const blob = new Blob(
      [
        JSON.stringify(
          {
            scenario_name: `${applianceName} Simulation`,
            timestamp: new Date().toISOString(),
            inputs: {
              appliance: applianceName,
              wattage_w: wattage,
              current_daily_hours: currentHours,
              proposed_daily_hours: proposedHours,
              tariff_inr: tariff,
              fixed_charges_inr: fixedCharges,
              quantity,
            },
            projection,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `powerwise_savings_simulation_${applianceName.toLowerCase().replace(/\s+/g, "_")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Chart data comparing Current vs Proposed
  const chartData = projection
    ? [
        {
          metric: "Daily Energy (kWh)",
          Current: projection.current_scenario.daily_kwh,
          Proposed: projection.proposed_scenario.daily_kwh,
        },
        {
          metric: "Monthly Energy (kWh)",
          Current: projection.current_scenario.monthly_kwh,
          Proposed: projection.proposed_scenario.monthly_kwh,
        },
      ]
    : [];

  const costChartData = projection
    ? [
        {
          metric: "Monthly Cost (₹)",
          Current: projection.current_scenario.monthly_cost_inr,
          Proposed: projection.proposed_scenario.monthly_cost_inr,
        },
      ]
    : [];

  // Quick estimator calculations
  const kwhNum = Number(units);
  const rateNum = Number(quickRate);
  const quickError =
    units === "" || quickRate === ""
      ? "Please fill in both fields."
      : !(kwhNum >= 0)
        ? "Monthly consumption must be 0 or more."
        : !(rateNum > 0 && rateNum <= 100)
          ? "Rate must be between ₹0 and ₹100 per kWh."
          : "";
  const quickBill = quickError ? null : estimateBill(kwhNum, rateNum);

  return (
    <>
      <PageHeader
        title="Smart Savings Planner & Bill Estimator"
        subtitle="Simulate appliance usage adjustments, verify scientific energy formulas (kWh = W × h ÷ 1000), and plan measurable electricity bill reductions."
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("planner")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "planner"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Smart Savings Planner
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "saved"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Saved Scenarios ({savedScenarios.length})
          </button>
          <button
            onClick={() => setActiveTab("calculator")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === "calculator"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Quick Bill Estimator
          </button>
        </div>
      </PageHeader>

      {/* Assumptions & Integrity Notice */}
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground">
        <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <div>
          <p className="font-semibold text-primary">
            Explicit Calculation Assumptions & Trust Notice
          </p>
          <p className="mt-0.5 text-muted-foreground leading-relaxed">
            Standard Energy Formula:{" "}
            <b>Energy (kWh) = Rated Power (Watts) × Operating Hours (h) ÷ 1,000</b>. Billing Cycle:{" "}
            <b>30 days/month</b>. Projections represent hypothetical scenarios based on assumed
            usage reductions, distinguished from historical meter readings.
          </p>
        </div>
      </div>

      {activeTab === "planner" && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Controls Column */}
          <div className="space-y-4 lg:col-span-5">
            <Card>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-energy" /> 1. Select & Configure Appliance
                </h3>
                <span className="text-xs text-muted-foreground">Hypothetical Simulation</span>
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="text-xs font-medium text-foreground">Choose Appliance</label>
                  <select
                    value={selectedApplianceId}
                    onChange={handleApplianceSelect}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
                  >
                    <option value="custom">Custom Appliance</option>
                    {appliances.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.watts} W · {a.hours}h/day)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Appliance Name</label>
                    <input
                      type="text"
                      value={applianceName}
                      onChange={(e) => setApplianceName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">
                      Rated Power (Watts)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={15000}
                      value={wattage}
                      onChange={(e) => setWattage(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-semibold text-foreground focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Current Daily Hours */}
                <div>
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-foreground">Current Daily Usage</span>
                    <span className="font-bold text-foreground">{currentHours} hours/day</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    step={0.5}
                    value={currentHours}
                    onChange={(e) => setCurrentHours(Number(e.target.value))}
                    className="mt-2 w-full accent-primary"
                  />
                </div>

                {/* Proposed Reduced Daily Hours */}
                <div className="rounded-xl border border-success/30 bg-success-soft/20 p-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-success flex items-center gap-1">
                      <TrendingDown className="h-3.5 w-3.5" /> Proposed Lower Usage
                    </span>
                    <span className="font-bold text-success">{proposedHours} hours/day</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={currentHours}
                    step={0.5}
                    value={proposedHours}
                    onChange={(e) => setProposedHours(Number(e.target.value))}
                    className="mt-2 w-full accent-success"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Target reduction: <b>{Math.max(0, currentHours - proposedHours)} hours/day</b>
                  </p>
                </div>

                {/* Tariff & Billing Options */}
                <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Tariff (₹ / kWh)</label>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={100}
                      value={tariff}
                      onChange={(e) => setTariff(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">
                      Fixed Charges (₹/mo)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={fixedCharges}
                      onChange={(e) => setFixedCharges(Number(e.target.value))}
                      className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveScenario}
                    disabled={isSaving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" /> {isSaving ? "Saving..." : "Save Simulation"}
                  </button>
                  <button
                    onClick={handleExportJson}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80"
                    title="Export simulation summary as JSON"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>

                {saveSuccessMsg && (
                  <p className="text-xs text-success flex items-center gap-1 mt-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {saveSuccessMsg}
                  </p>
                )}
                {saveErrorMsg && (
                  <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {saveErrorMsg}
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Results & Visuals Column */}
          <div className="space-y-4 lg:col-span-7">
            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Daily Reduction
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-foreground">
                  {projection ? `${projection.reductions.daily_kwh} kWh` : "—"}
                </p>
                <span className="text-[10px] text-muted-foreground">per 24-hr cycle</span>
              </div>
              <div className="rounded-2xl border border-border bg-card p-4 text-card-foreground">
                <span className="text-[11px] font-medium text-muted-foreground uppercase">
                  Monthly Energy Saved
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-success">
                  {projection ? `${projection.reductions.monthly_kwh} kWh` : "—"}
                </p>
                <span className="text-[10px] text-muted-foreground">30-day billing cycle</span>
              </div>
              <div className="rounded-2xl border border-success/30 bg-success-soft/30 p-4">
                <span className="text-[11px] font-medium text-success uppercase">
                  Monthly Rupee Savings
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-success">
                  {projection ? formatRupees(projection.reductions.monthly_savings_inr) : "—"}
                </p>
                <span className="text-[10px] text-success/80">at ₹{tariff}/kWh</span>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
                <span className="text-[11px] font-medium text-primary uppercase">
                  Annual Projected Savings
                </span>
                <p className="mt-1 font-display text-2xl font-bold text-primary">
                  {projection ? formatRupees(projection.reductions.annual_savings_inr) : "—"}
                </p>
                <span className="text-[10px] text-primary/80">
                  {projection?.reductions.percent_reduction}% reduction
                </span>
              </div>
            </div>

            {/* Before-and-After Comparison Card */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">
                    Scenario Comparison: Current vs Proposed
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Direct comparison of energy units (kWh) and bill expenditure
                  </p>
                </div>
                <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                  -{projection?.reductions.percent_reduction}% Energy
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Energy Chart */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Energy Consumption (kWh)
                  </p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Proposed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cost Chart */}
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground">
                    Estimated Monthly Cost (₹)
                  </p>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={costChartData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar dataKey="Current" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Proposed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Numerical breakdown table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Dimension</th>
                      <th>Current Scenario</th>
                      <th>Proposed Scenario</th>
                      <th className="text-success">Net Savings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <tr>
                      <td className="py-2 font-medium">Daily Operating Hours</td>
                      <td>{projection?.current_scenario.daily_hours} hrs/day</td>
                      <td>{projection?.proposed_scenario.daily_hours} hrs/day</td>
                      <td className="font-semibold text-success">
                        -{roundVal(Math.max(0, currentHours - proposedHours), 1)} hrs/day
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Daily Energy (kWh)</td>
                      <td>{projection?.current_scenario.daily_kwh} kWh</td>
                      <td>{projection?.proposed_scenario.daily_kwh} kWh</td>
                      <td className="font-semibold text-success">
                        -{projection?.reductions.daily_kwh} kWh/day
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Monthly Energy (kWh)</td>
                      <td>{projection?.current_scenario.monthly_kwh} kWh</td>
                      <td>{projection?.proposed_scenario.monthly_kwh} kWh</td>
                      <td className="font-semibold text-success">
                        -{projection?.reductions.monthly_kwh} kWh/mo
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 font-medium">Monthly Bill (₹)</td>
                      <td>{formatRupees(projection?.current_scenario.monthly_cost_inr || 0)}</td>
                      <td>{formatRupees(projection?.proposed_scenario.monthly_cost_inr || 0)}</td>
                      <td className="font-bold text-success">
                        {formatRupees(projection?.reductions.monthly_savings_inr || 0)} / mo
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "saved" && (
        <Card>
          <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground">
                Saved Simulation Scenarios ({savedScenarios.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Persistent scenarios saved for your household account
              </p>
            </div>
            <button
              onClick={() => setActiveTab("planner")}
              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              + Create New Scenario
            </button>
          </div>

          {savedScenarios.length === 0 ? (
            <div className="py-12 text-center">
              <PiggyBank className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-foreground">No saved scenarios yet</p>
              <p className="text-xs text-muted-foreground">
                Adjust usage hours in the planner and click "Save Simulation" to preserve
                recommendations.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedScenarios.map((scen) => (
                <div
                  key={scen.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{scen.name}</span>
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {scen.appliance_name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {scen.inputs.wattage_w} W · {scen.inputs.current_daily_hours}h →{" "}
                      {scen.inputs.proposed_daily_hours}h daily · Tariff: ₹{scen.inputs.tariff_inr}
                      /kWh
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Created: {new Date(scen.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Projected Savings</p>
                      <p className="font-display text-lg font-bold text-success">
                        {formatRupees(scen.projection.reductions.monthly_savings_inr)} / mo
                      </p>
                      <span className="text-[10px] text-success">
                        ({scen.projection.reductions.monthly_kwh} kWh/mo reduction)
                      </span>
                    </div>
                    <button
                      aria-label="Delete scenario"
                      onClick={() => handleDeleteScenario(scen.id)}
                      className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === "calculator" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-semibold text-foreground">Standard Flat Bill Estimator</h3>
            <label className="text-sm font-medium">Monthly consumption (kWh)</label>
            <input
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
              type="number"
              min={0}
              value={units}
              onChange={(e) => setUnits(e.target.value)}
            />
            <label className="mt-4 block text-sm font-medium">Rate per unit (₹ / kWh)</label>
            <input
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-lg font-semibold outline-none focus:ring-2 focus:ring-ring"
              type="number"
              min={0}
              step="0.1"
              value={quickRate}
              onChange={(e) => setQuickRate(e.target.value)}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Default ₹{DEFAULT_RATE}/kWh is illustrative for standard residential consumers.
            </p>
            {quickError && <p className="mt-3 text-sm text-destructive">{quickError}</p>}
          </Card>
          <div className="fade-up rounded-2xl bg-hero p-6 text-primary-foreground shadow-card">
            <p className="text-sm opacity-80">Estimated monthly bill</p>
            <p className="mt-1 font-display text-5xl font-semibold">
              {quickBill ? formatRupees(quickBill.monthly) : "—"}
            </p>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-xs opacity-80">Per day</p>
                <p className="font-display text-2xl font-semibold">
                  {quickBill ? formatRupees(quickBill.daily) : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-primary-foreground/10 p-4">
                <p className="text-xs opacity-80">Per year</p>
                <p className="font-display text-2xl font-semibold">
                  {quickBill ? formatRupees(quickBill.yearly) : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
