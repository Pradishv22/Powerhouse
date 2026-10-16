import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Info, Play, CheckCircle2 } from "lucide-react";
import { clusteredHouseholds as defaultHouseholds, type ClusteredHousehold } from "@/data/mockData";
import { PageHeader, Card, ChartCard, tooltipStyle } from "@/components/ui-kit";
import { getClusters, triggerJob } from "@/services/api";

export const Route = createFileRoute("/clustering")({
  head: () => ({
    meta: [
      { title: "Consumption Clustering (K-means) — PowerWise" },
      {
        name: "description",
        content: "Group households into low, medium and high consumption patterns using K-means.",
      },
      { property: "og:title", content: "K-means Clustering — PowerWise" },
      { property: "og:description", content: "K-means clustering of household electricity use." },
    ],
  }),
  component: Clustering,
});

const CLUSTERS = [
  { name: "Low", color: "var(--chart-2)" },
  { name: "Medium", color: "var(--chart-3)" },
  { name: "High", color: "var(--chart-1)" },
] as const;

function Clustering() {
  const [households, setHouseholds] = useState<ClusteredHousehold[]>(defaultHouseholds);
  const [executionMode, setExecutionMode] = useState("Local demo (explainable Python fallback)");
  const [running, setRunning] = useState(false);
  const [lastRunMessage, setLastRunMessage] = useState("");

  const loadClusters = async () => {
    try {
      const data = await getClusters();
      if (data && data.length > 0) {
        setHouseholds(data);
      }
    } catch {
      // Fallback to defaults
    }
  };

  useEffect(() => {
    loadClusters();
  }, []);

  const handleRunKMeans = async () => {
    setRunning(true);
    setLastRunMessage("");
    try {
      const res = await triggerJob("clustering", "pyspark");
      setExecutionMode(res.job.execution_mode);
      const clusters = res.job.result_summary?.clusters as
        | {
            household_id: string;
            avg_daily: number;
            monthly_kwh: number;
            peak_usage: boolean;
            cluster: "Low" | "Medium" | "High";
          }[]
        | undefined;
      if (clusters) {
        setHouseholds(
          clusters.map((c) => ({
            id: c.household_id,
            avgDaily: c.avg_daily,
            monthly: c.monthly_kwh,
            peakUsage: c.peak_usage,
            cluster: c.cluster,
          })),
        );
      }
      setLastRunMessage(`Job completed: ${res.job.execution_mode}`);
    } catch (err: unknown) {
      setLastRunMessage(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(false);
    }
  };

  // Summarise each cluster (count + average)
  const summary = CLUSTERS.map((c) => {
    const members = households.filter((h) => h.cluster === c.name);
    const avg = members.reduce((s, h) => s + h.avgDaily, 0) / (members.length || 1);
    const peak = members.filter((h) => h.peakUsage).length;
    return { ...c, members, count: members.length, avg, peak };
  });

  return (
    <>
      <PageHeader
        title="Consumption Clustering (K-means)"
        subtitle="Unsupervised machine learning (k = 3) groups households by average daily and estimated monthly consumption."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
            {executionMode}
          </span>
          <button
            onClick={handleRunKMeans}
            disabled={running}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> {running ? "Running Model..." : "Run K-means Model"}
          </button>
        </div>
      </PageHeader>

      {lastRunMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-success-soft p-3 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" />
          <span>{lastRunMessage}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((c) => (
          <Card key={c.name}>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
              <p className="font-semibold">{c.name} consumption</p>
            </div>
            <p className="mt-3 font-display text-3xl font-semibold">
              {c.count}
              <span className="ml-1 text-sm font-normal text-muted-foreground">households</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Avg {c.avg.toFixed(1)} kWh/day · {c.peak} with peak usage
            </p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Household comparison"
          subtitle="Avg daily vs monthly kWh"
          className="lg:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="avgDaily"
                name="Avg daily"
                unit=" kWh"
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                type="number"
                dataKey="monthly"
                name="Monthly"
                unit=" kWh"
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <ZAxis range={[50, 50]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {summary.map((c) => (
                <Scatter key={c.name} name={c.name} data={c.members} fill={c.color} />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cluster distribution">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={summary}
                dataKey="count"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
              >
                {summary.map((c) => (
                  <Cell key={c.name} fill={c.color} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="mt-4">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              <b className="text-foreground">How K-means works:</b> The algorithm aggregates raw
              records into a two-dimensional feature vector per household:{" "}
              <code>[Average Daily kWh, Monthly kWh]</code>. It initializes k=3 cluster centroids,
              assigns each household to the nearest centroid using Euclidean distance, and updates
              centroids iteratively until convergence.
            </p>
            <p>
              <b className="text-foreground">Classroom Viva Note:</b> Raw cluster IDs (0, 1, 2)
              generated by MLlib are arbitrary geometric partitions. PowerWise sorts the resulting
              centroids by average daily consumption before mapping them to human-readable tiers:{" "}
              <b>Low</b>, <b>Medium</b>, and <b>High</b>.
            </p>
            <p>
              Cluster assignments describe usage patterns, not moral judgments; a household in the
              High tier is not necessarily wasteful, but may have higher occupancy or essential
              cooling requirements.
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}
