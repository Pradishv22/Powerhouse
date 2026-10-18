import { useMemo, useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Zap, Activity, ArrowUp, ArrowDown, GitCompare, Database } from "lucide-react";
import { consumptionRecords } from "@/data/mockData";
import { sumBy, weekKey, monthKey } from "@/utils/aggregate";
import { percentChange, formatKwh } from "@/utils/energyCalculations";
import {
  PageHeader,
  DemoBadge,
  MetricCard,
  ChartCard,
  Segmented,
  tooltipStyle,
} from "@/components/ui-kit";
import {
  getConsumptionSeries,
  getDatasets,
  type ConsumptionData,
  type DatasetItem,
} from "@/services/api";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Consumption Analytics — PowerWise" },
      {
        name: "description",
        content: "Daily, weekly and monthly electricity consumption trends and comparisons.",
      },
      { property: "og:title", content: "Consumption Analytics — PowerWise" },
      {
        property: "og:description",
        content: "Explore electricity usage by period, household and appliance.",
      },
    ],
  }),
  component: Analytics,
});

type Period = "daily" | "weekly" | "monthly";
const keyFor: Record<Period, (d: string) => string> = {
  daily: (d) => d,
  weekly: weekKey,
  monthly: monthKey,
};

function Analytics() {
  const [period, setPeriod] = useState<Period>("weekly");
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("demo-dataset-default");
  const [apiData, setApiData] = useState<ConsumptionData | null>(null);

  useEffect(() => {
    getDatasets().then((dList) => {
      setDatasets(dList);
      if (dList.length > 0) {
        setSelectedDatasetId((prev) => (dList.some((d) => d.id === prev) ? prev : dList[0].id));
      }
    });
  }, []);

  useEffect(() => {
    getConsumptionSeries(period, selectedDatasetId)
      .then((data) => {
        if (data && data.series && data.series.length > 0) {
          setApiData(data);
        }
      })
      .catch(() => null);
  }, [period, selectedDatasetId]);

  // Group fallback records by chosen period if API returns empty
  const mockFallbackSeries = useMemo(
    () =>
      sumBy(consumptionRecords, (r) => keyFor[period](r.date)).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [period],
  );

  const series = apiData?.series?.length ? apiData.series : mockFallbackSeries;
  const total = series.reduce((s, r) => s + r.kwh, 0);
  const avg = series.length ? total / series.length : 0;
  const highest = series.reduce(
    (a, b) => (b.kwh > a.kwh ? b : a),
    series[0] ?? { name: "-", kwh: 0 },
  );
  const lowest = series.reduce(
    (a, b) => (b.kwh < a.kwh ? b : a),
    series[0] ?? { name: "-", kwh: 0 },
  );
  const last = series.at(-1)?.kwh ?? 0;
  const prev = series.at(-2)?.kwh ?? 0;
  const change = percentChange(last, prev);

  const byHousehold = apiData?.by_household?.length
    ? apiData.by_household
    : sumBy(consumptionRecords, (r) => r.household);

  // Household × appliance matrix for stacked bars
  const stacked = useMemo(() => {
    if (apiData?.stacked_matrix?.length) {
      return apiData.stacked_matrix;
    }
    const rows: Record<string, Record<string, number | string>> = {};
    for (const r of consumptionRecords) {
      const row = (rows[r.appliance] ??= { name: r.appliance });
      row[r.household] = Math.round(((row[r.household] as number) ?? 0) + r.kwh);
    }
    return Object.values(rows);
  }, [apiData]);

  return (
    <>
      <PageHeader
        title="Consumption Analytics"
        subtitle="Compare electricity usage across time periods, households and appliances on authorized datasets."
      >
        <div className="flex flex-wrap items-center gap-3">
          {datasets.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-xl border border-input bg-card px-2.5 py-1 text-xs">
              <Database className="h-3.5 w-3.5 text-primary" />
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground outline-none"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename} {d.is_demo ? "(Shared Demo)" : `(${d.row_count} rows)`}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Segmented<Period>
            value={period}
            onChange={setPeriod}
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "monthly", label: "Monthly" },
            ]}
          />
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard label="Total Consumption" value={formatKwh(total)} icon={Zap} />
        <MetricCard
          label={`Avg per ${period.replace("ly", "").replace("dai", "day")}`}
          value={formatKwh(avg)}
          icon={Activity}
        />
        <MetricCard
          label="Highest Period"
          value={formatKwh(highest.kwh)}
          hint={highest.name}
          icon={ArrowUp}
          tone="warning"
        />
        <MetricCard
          label="Lowest Period"
          value={formatKwh(lowest.kwh)}
          hint={lowest.name}
          icon={ArrowDown}
          tone="success"
        />
        <MetricCard
          label="Period vs Previous"
          value={`${change > 0 ? "+" : ""}${change.toFixed(1)}%`}
          hint={`${series.at(-1)?.name} vs ${series.at(-2)?.name}`}
          icon={GitCompare}
        />
      </div>

      <ChartCard
        title={`${period.charAt(0).toUpperCase() + period.slice(1)} consumption trend`}
        className="mt-4"
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="fillKwh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
            <YAxis fontSize={11} stroke="var(--muted-foreground)" />
            <Tooltip {...tooltipStyle} />
            <Area
              type="monotone"
              dataKey="kwh"
              name="kWh"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#fillKwh)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Household Comparison" subtitle="Total kWh aggregation by household">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byHousehold} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis
                type="category"
                dataKey="name"
                fontSize={11}
                stroke="var(--muted-foreground)"
                width={50}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="kwh" name="kWh" fill="var(--chart-1)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Appliance × Household Matrix"
          subtitle="Stacked kWh by appliance category"
        >
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stacked}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                fontSize={10}
                stroke="var(--muted-foreground)"
                interval={0}
                tickFormatter={(v: string) => v.split(" ")[0] ?? v}
              />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {["HH-01", "HH-02", "HH-03", "HH-04", "HH-05"].map((h, i) => (
                <Bar key={h} dataKey={h} stackId="a" fill={`var(--chart-${i + 1})`} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </>
  );
}
