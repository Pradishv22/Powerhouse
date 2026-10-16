import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Download, IndianRupee, Leaf, FileSpreadsheet } from "lucide-react";
import { consumptionRecords, clusteredHouseholds, dashboardSummary } from "@/data/mockData";
import { sumBy, monthKey, totalKwh, toCsv } from "@/utils/aggregate";
import { energyCost, formatRupees, formatKwh } from "@/utils/energyCalculations";
import { PageHeader, ChartCard, MetricCard, tooltipStyle, CHART_COLORS } from "@/components/ui-kit";
import { getExportCsvUrl } from "@/services/api";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — PowerWise" },
      {
        name: "description",
        content: "Consumption reports with charts and CSV export ready for Tableau.",
      },
      { property: "og:title", content: "Reports — PowerWise" },
      { property: "og:description", content: "Download electricity consumption reports as CSV." },
    ],
  }),
  component: Reports,
});

function sanitizeCell(v: string | number) {
  const s = String(v);
  if (s && (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@"))) {
    return `'${s}`;
  }
  return s;
}

function Reports() {
  const daily = useMemo(
    () =>
      sumBy(consumptionRecords, (r) => r.date.slice(5)).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );
  const monthly = useMemo(() => sumBy(consumptionRecords, (r) => monthKey(r.date)), []);
  const byAppliance = useMemo(() => sumBy(consumptionRecords, (r) => r.appliance), []);

  const distribution = useMemo(() => {
    const buckets: Record<string, number> = {};
    for (const h of clusteredHouseholds) {
      const b = Math.floor(h.avgDaily / 5) * 5;
      buckets[`${b}-${b + 5}`] = (buckets[`${b}-${b + 5}`] ?? 0) + 1;
    }
    return Object.entries(buckets)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, []);
  const total = totalKwh(consumptionRecords);

  function downloadCsv() {
    // Attempt download via backend endpoint
    const exportUrl = getExportCsvUrl(8);
    const link = document.createElement("a");
    link.href = exportUrl;
    link.target = "_blank";
    link.download = "powerwise_analytics_export.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <PageHeader
        title="Reports & Tableau Visualization"
        subtitle="Export historical electricity datasets with sanitized CSV schema ready for Tableau analysis."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
            <FileSpreadsheet className="h-3.5 w-3.5 text-success" /> Tableau-Ready Schema
          </span>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" /> Download Export CSV
          </button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Records"
          value={consumptionRecords.length.toLocaleString("en-IN")}
          hint={formatKwh(total)}
          icon={Download}
        />
        <MetricCard
          label="Estimated expenditure"
          value={formatRupees(energyCost(total))}
          hint="@ ₹8 / kWh"
          icon={IndianRupee}
        />
        <MetricCard
          label="Saving opportunity"
          value={formatRupees(energyCost(total) * (dashboardSummary.potentialSavings / 100))}
          hint={`${dashboardSummary.potentialSavings}% potential`}
          icon={Leaf}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Daily consumption trend">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={10} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Line dataKey="kwh" name="kWh" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Monthly comparison">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="kwh" name="kWh" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Appliance-wise consumption">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={byAppliance}
                dataKey="kwh"
                nameKey="name"
                outerRadius={90}
                label={({ name }: { name: string }) => name.split(" ")[0] ?? name}
                fontSize={11}
              >
                {byAppliance.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Household distribution" subtitle="100 households by avg kWh/day">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={distribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" name="Households" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Note: The exported CSV features sanitization against CSV Formula Injection (prefixing
        formula characters with a quote) and is formatted for drag-and-drop ingestion into Tableau.
      </p>
    </>
  );
}
