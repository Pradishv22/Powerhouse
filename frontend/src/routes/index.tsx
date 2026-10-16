import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Zap,
  IndianRupee,
  Activity,
  Leaf,
  Users,
  Gauge,
  TrendingUp,
  TrendingDown,
  Database,
} from "lucide-react";
import { consumptionRecords, recommendations } from "@/data/mockData";
import { sumBy, lastNDays, previousNDays, totalKwh, monthKey } from "@/utils/aggregate";
import { percentChange, formatKwh, formatRupees } from "@/utils/energyCalculations";
import {
  PageHeader,
  MetricCard,
  ChartCard,
  Card,
  Segmented,
  tooltipStyle,
  CHART_COLORS,
} from "@/components/ui-kit";
import { getAnalyticsSummary, type DashboardMetrics } from "@/services/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PowerWise" },
      {
        name: "description",
        content:
          "Overview of electricity consumption, cost and savings from the PowerWise dataset.",
      },
      { property: "og:title", content: "PowerWise Dashboard" },
      {
        property: "og:description",
        content: "Smart electricity consumption overview powered by Big Data concepts.",
      },
    ],
  }),
  component: Dashboard,
});

type Range = "7" | "30" | "90";

function Dashboard() {
  const [range, setRange] = useState<Range>("30");
  const days = Number(range);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    getAnalyticsSummary(8)
      .then(setMetrics)
      .catch(() => null);
  }, []);

  // Filter records to the selected date range
  const current = useMemo(() => lastNDays(consumptionRecords, days), [days]);
  const previous = useMemo(() => previousNDays(consumptionRecords, days), [days]);
  const daily = useMemo(
    () => sumBy(current, (r) => r.date.slice(5)).sort((a, b) => a.name.localeCompare(b.name)),
    [current],
  );
  const monthly = useMemo(() => sumBy(consumptionRecords, (r) => monthKey(r.date)), []);
  const byAppliance = useMemo(
    () => sumBy(current, (r) => r.appliance).sort((a, b) => b.kwh - a.kwh),
    [current],
  );
  const change = previous.length ? percentChange(totalKwh(current), totalKwh(previous)) : 0;
  const recent = current.slice(-6).reverse();

  const totalKwhDisplay = metrics ? metrics.total_consumption : totalKwh(current);
  const expenditureDisplay = metrics ? metrics.expenditure : totalKwhDisplay * 8;
  const avgDailyDisplay = metrics ? metrics.avg_daily : totalKwhDisplay / days;
  const executionMode = metrics?.execution_mode || "Local demo (Flask Analytics Engine)";

  return (
    <>
      <PageHeader
        title="Energy Consumption Dashboard"
        subtitle="Historical household electricity usage, expenditure, and energy-saving insights."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
          <Database className="h-3.5 w-3.5 text-primary" /> {executionMode}
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total consumption"
          value={`${Math.round(totalKwhDisplay).toLocaleString("en-IN")} kWh`}
          icon={Zap}
        />
        <MetricCard
          label="Est. expenditure"
          value={formatRupees(expenditureDisplay)}
          hint="@ ₹8 / kWh"
          icon={IndianRupee}
        />
        <MetricCard
          label="Avg daily"
          value={`${avgDailyDisplay.toFixed(1)} kWh`}
          hint="Across dataset"
          icon={Activity}
        />
        <MetricCard
          label="Potential savings"
          value={`${metrics?.potential_savings ?? 15}%`}
          icon={Leaf}
          tone="success"
        />
        <MetricCard
          label="Households"
          value={String(metrics?.households ?? 5)}
          hint={`${metrics?.record_count ?? consumptionRecords.length} records`}
          icon={Users}
        />
        <MetricCard
          label="Efficiency score"
          value={`${metrics?.efficiency_score ?? 78}/100`}
          icon={Gauge}
          tone="success"
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 90 days" },
          ]}
        />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${
            change <= 0 ? "bg-success-soft text-success" : "bg-warning-soft text-foreground"
          }`}
        >
          {change <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
          {previous.length
            ? `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs previous ${days} days`
            : "No earlier period to compare"}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Daily consumption"
          subtitle={`Selected dataset · ${formatKwh(totalKwh(current))}`}
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Line
                type="monotone"
                dataKey="kwh"
                name="kWh"
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By appliance" subtitle="Share of selected range">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={byAppliance}
                dataKey="kwh"
                nameKey="name"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={2}
              >
                {byAppliance.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard title="Monthly consumption" subtitle="All dataset months">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="kwh" name="kWh" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top 5 appliances">
          <ol className="space-y-3">
            {byAppliance.slice(0, 5).map((a, i) => (
              <li key={a.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="text-sm text-muted-foreground">{formatKwh(a.kwh)}</span>
              </li>
            ))}
          </ol>
        </ChartCard>
        <ChartCard
          title="Saving tips"
          action={
            <Link to="/recommendations" className="text-xs font-semibold text-success">
              View all
            </Link>
          }
        >
          <ul className="space-y-3">
            {recommendations.slice(0, 3).map((r) => (
              <li key={r.id} className="rounded-xl bg-success-soft p-3">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.savings}</p>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 text-base font-semibold">Recent consumption records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th>Household</th>
                <th>Appliance</th>
                <th className="text-right">kWh</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">{r.date}</td>
                  <td>{r.household}</td>
                  <td>{r.appliance}</td>
                  <td className="text-right font-medium">{r.kwh}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
