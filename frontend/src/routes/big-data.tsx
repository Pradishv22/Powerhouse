import { useState, useEffect, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Database,
  HardDrive,
  Server,
  FileSpreadsheet,
  Cpu,
  BarChart3,
  Globe,
  LayoutDashboard,
  Radio,
  Sparkles,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
} from "lucide-react";
import { consumptionRecords, mapReduceInput } from "@/data/mockData";
import { runMapReduce } from "@/utils/mapReduce";
import { PageHeader, Card, PipelineDiagram } from "@/components/ui-kit";
import {
  getHealth,
  getDatasets,
  uploadDataset,
  updateDataset,
  deleteDataset,
  triggerJob,
  type HealthData,
  type AnalyticsJob,
  type DatasetItem,
} from "@/services/api";

export const Route = createFileRoute("/big-data")({
  head: () => ({
    meta: [
      { title: "Big Data Processing — PowerWise" },
      {
        name: "description",
        content:
          "How HDFS, MapReduce and PySpark process electricity consumption data in PowerWise.",
      },
      { property: "og:title", content: "Big Data Processing — PowerWise" },
      {
        property: "og:description",
        content: "HDFS storage, MapReduce aggregation and PySpark analytics explained.",
      },
    ],
  }),
  component: BigData,
});

function Section({
  letter,
  title,
  children,
}: {
  letter: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="mt-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-hero font-display text-sm font-bold text-primary-foreground">
          {letter}
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

const th = "py-2 text-left text-xs uppercase text-muted-foreground";

function BigData() {
  const { mapped, shuffled, reduced } = runMapReduce(mapReduceInput);
  const sizeKb = Math.round((consumptionRecords.length * 42) / 1024);

  const [health, setHealth] = useState<HealthData | null>(null);
  const [jobStatus, setJobStatus] = useState<AnalyticsJob | { error: string } | null>(null);
  const [jobRunning, setJobRunning] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);

  const refreshDatasets = () => getDatasets().then(setDatasets).catch(() => setDatasets([]));

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => {
        setHealth({
          status: "healthy",
          database: { mode: "local", status: "fallback" },
          big_data_environment: {
            pyspark_available: false,
            spark_master: "Local fallback mode active",
            hdfs_status: "HDFS unavailable — using local dataset storage",
          },
        });
      });
  }, []);

  useEffect(() => {
    refreshDatasets();
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMessage("Validating and uploading CSV...");
    try {
      const res = await uploadDataset(file);
      setUploadMessage(`Success: ${res.dataset.row_count} valid records loaded.`);
      await refreshDatasets();
    } catch (err: unknown) {
      setUploadMessage(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRenameDataset = async (dataset: DatasetItem) => {
    const filename = window.prompt("Dataset filename", dataset.filename);
    if (filename === null) return;
    try {
      await updateDataset(dataset.id, filename);
      await refreshDatasets();
    } catch (err) {
      setUploadMessage(`Rename failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteDataset = async (dataset: DatasetItem) => {
    if (!window.confirm(`Delete ${dataset.filename}? This cannot be undone.`)) return;
    try {
      await deleteDataset(dataset.id);
      await refreshDatasets();
    } catch (err) {
      setUploadMessage(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRunJob = async (engine: string) => {
    setJobRunning(true);
    setJobStatus(null);
    try {
      const res = await triggerJob("aggregation", engine);
      setJobStatus(res.job);
    } catch (err: unknown) {
      setJobStatus({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setJobRunning(false);
    }
  };

  const hdfsStatus =
    health?.big_data_environment?.hdfs_status || "HDFS unavailable — using local dataset storage";
  const sparkAvailable = !!health?.big_data_environment?.pyspark_available;

  return (
    <>
      <PageHeader
        title="Big Data Processing Pipeline"
        subtitle="End-to-end data pipeline: CSV Ingestion → HDFS Distributed Storage → MapReduce & PySpark Processing → Flask API → Tableau/Dashboard."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
          Execution Status: {sparkAvailable ? "PySpark Available" : "Local Python Demo Mode"}
        </span>
      </PageHeader>

      <Section letter="A" title="Dataset Ingestion & HDFS Distributed Storage">
        <p className="mb-4 text-sm text-muted-foreground">
          In an enterprise environment, smart-meter CSV files are partitioned into distributed
          blocks (default 128 MB) across DataNodes in Hadoop HDFS.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Active Dataset", "electricity_usage.csv"],
                ["Records", consumptionRecords.length.toLocaleString("en-IN")],
                ["Format", "Canonical CSV"],
                ["Size (approx.)", `${sizeKb} KB`],
                ["Replication Factor", "3 (configured)"],
                ["HDFS Status", hdfsStatus],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-secondary p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-border p-3.5">
              <label className="block text-xs font-semibold uppercase text-muted-foreground">
                Upload Custom Dataset
              </label>
              <div className="mt-2 flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  <Upload className="h-3.5 w-3.5" /> Select CSV File
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                {uploadMessage && (
                  <span className="text-xs font-medium text-foreground">{uploadMessage}</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-border p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Saved datasets</p>
                <button onClick={refreshDatasets} className="text-xs font-medium text-primary hover:underline">Refresh</button>
              </div>
              {datasets.length === 0 ? (
                <p className="text-xs text-muted-foreground">No saved datasets available.</p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {datasets.map((dataset) => (
                    <li key={dataset.id} className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-2.5 py-2">
                      <span className="min-w-0 truncate"><b>{dataset.filename}</b> · {dataset.row_count} records</span>
                      {!dataset.is_demo && (
                        <span className="flex shrink-0 gap-1">
                          <button aria-label={`Rename ${dataset.filename}`} onClick={() => handleRenameDataset(dataset)} className="p-1 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                          <button aria-label={`Delete ${dataset.filename}`} onClick={() => handleDeleteDataset(dataset)} className="p-1 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              <Server className="h-4 w-4" /> NameNode (Metadata & Block Locations)
            </div>
            <div className="mx-auto mb-3 h-4 w-px bg-border" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <div key={n} className="rounded-lg border bg-secondary p-2 text-center">
                  <HardDrive className="mx-auto h-4 w-4 text-primary" />
                  <p className="text-xs font-semibold">DataNode {n}</p>
                  <div className="mt-1 flex justify-center gap-1">
                    {["B1", "B2", "B3"]
                      .filter((_, i) => i !== n - 1)
                      .map((b) => (
                        <span
                          key={b}
                          className="rounded bg-success-soft px-1.5 text-[10px] font-bold text-success"
                        >
                          {b}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Blocks replicated across independent DataNodes for fault tolerance
            </p>
          </div>
        </div>
      </Section>

      <Section letter="B" title="MapReduce — Explainable Streaming Aggregation">
        <PipelineDiagram
          steps={[
            { label: "Input CSV", icon: FileSpreadsheet },
            { label: "Mapper", icon: Cpu, note: "emit (household, kWh)" },
            { label: "Shuffle & Sort", icon: Sparkles, note: "group by key" },
            { label: "Reducer", icon: Cpu, note: "sum values" },
            { label: "Output", icon: BarChart3 },
          ]}
        />
        <div className="mt-5 grid gap-4 lg:grid-cols-4">
          <div>
            <p className="mb-1 text-sm font-semibold">1. Input records</p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Household</th>
                  <th className={th}>App.</th>
                  <th className={th}>kWh</th>
                </tr>
              </thead>
              <tbody>
                {mapReduceInput.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5">{r.household}</td>
                    <td>{r.appliance}</td>
                    <td>{r.kwh}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">2. Map output</p>
            <ul className="space-y-1 font-mono text-xs">
              {mapped.map((m, i) => (
                <li key={i} className="rounded bg-secondary px-2 py-1.5">
                  ({m.key}, {m.value})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">3. Shuffle & sort</p>
            <ul className="space-y-1 font-mono text-xs">
              {shuffled.map((g) => (
                <li key={g.key} className="rounded bg-secondary px-2 py-1.5">
                  {g.key} → [{g.values.join(", ")}]
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">4. Reduce result</p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>Household</th>
                  <th className={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {reduced.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="py-1.5">{r.key}</td>
                    <td className="font-semibold text-success">{r.total} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunJob("mapreduce")}
            disabled={jobRunning}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Trigger Hadoop MapReduce Job
          </button>
          <button
            onClick={() => handleRunJob("pyspark")}
            disabled={jobRunning}
            className="flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Trigger PySpark Analytics Job
          </button>
        </div>

        {jobStatus && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            {"error" in jobStatus ? (
              <div className="text-xs text-destructive">
                <span className="font-semibold">Job Error:</span> {jobStatus.error}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">
                    Job Result: {jobStatus.operation}
                  </span>
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                    {jobStatus.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Execution Mode: <b className="text-foreground">{jobStatus.execution_mode}</b>
                </p>
                {jobStatus.result_summary && (
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-sidebar p-3 text-xs text-sidebar-foreground">
                    {JSON.stringify(jobStatus.result_summary, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </Section>

      <Section letter="C" title="Apache Spark & PySpark Analytics">
        <p className="mb-4 text-sm text-muted-foreground">
          Spark keeps data in distributed memory (Resilient Distributed Datasets / DataFrames),
          enabling fast iterative aggregations compared to disk-based MapReduce.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <ol className="space-y-2 text-sm">
            {[
              "Load electricity records from HDFS or local storage into DataFrame",
              "Enforce explicit StructType schema on all fields",
              "Filter null, negative, or invalid sensor readings",
              "Group by household and appliance in Spark cluster executors",
              "Aggregate daily and monthly kWh usage in memory",
              "Return compact JSON summary to Flask REST API",
            ].map((s, i) => (
              <li key={s} className="flex items-center gap-3 rounded-xl bg-secondary px-3 py-2">
                <span className="font-display font-bold text-success">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <pre className="overflow-x-auto rounded-xl bg-sidebar p-4 text-xs leading-relaxed text-sidebar-foreground">
            {`# bigdata/spark/spark_analytics.py
df = spark.read.csv("data/sample_electricity_records.csv",
                    schema=explicit_schema, header=True)
clean = df.filter(df.energy_kwh >= 0)
by_household = clean.groupBy("household_id") \\
                    .agg(F.round(F.sum("energy_kwh"), 2))
# Compact summaries returned to Flask API:`}
          </pre>
        </div>
      </Section>
    </>
  );
}
