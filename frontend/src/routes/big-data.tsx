import { useState, useEffect, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Database,
  HardDrive,
  Server,
  FileSpreadsheet,
  Cpu,
  BarChart3,
  Sparkles,
  Upload,
  Play,
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Trash2,
  Share2,
  ShieldAlert,
  Clock,
  Layers,
  FileCheck2,
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
  shareDataset,
  triggerJob,
  type HealthData,
  type AnalyticsJob,
  type DatasetItem,
} from "@/services/api";
import { useAuth } from "@/lib/authContext";

export const Route = createFileRoute("/big-data")({
  head: () => ({
    meta: [
      { title: "Big Data Processing & Quality Pipeline — PowerWise" },
      {
        name: "description",
        content:
          "HDFS distributed storage architecture, MapReduce streaming aggregation, Apache Spark, and CSV Data Quality & Trust Panel.",
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
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </Card>
  );
}

const th = "py-2 text-left text-xs uppercase text-muted-foreground";

function BigData() {
  const { mapped, shuffled, reduced } = runMapReduce(mapReduceInput);
  const sizeKb = Math.round((consumptionRecords.length * 42) / 1024);
  const { user, isAdmin, isAnalyst } = useAuth();

  const [health, setHealth] = useState<HealthData | null>(null);
  const [jobStatus, setJobStatus] = useState<AnalyticsJob | { error: string } | null>(null);
  const [jobRunning, setJobRunning] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [datasets, setDatasets] = useState<DatasetItem[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("demo-dataset-default");
  const [shareSuccess, setShareSuccess] = useState("");

  const refreshDatasets = async () => {
    try {
      const data = await getDatasets();
      setDatasets(data);
      if (data.length > 0 && !data.some((d) => d.id === selectedDatasetId)) {
        setSelectedDatasetId(data[0].id);
      }
    } catch {
      setDatasets([]);
    }
  };

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

    refreshDatasets();
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadMessage("Validating and uploading CSV...");
    setUploadError("");
    try {
      const res = await uploadDataset(file);
      setUploadMessage(
        `Validation Passed: ${res.dataset.row_count} records accepted. Storage: Local CSV.`,
      );
      await refreshDatasets();
      setSelectedDatasetId(res.dataset.id);
    } catch (err: unknown) {
      setUploadMessage("");
      setUploadError(
        `Upload rejected: ${err instanceof Error ? err.message : String(err)}. Active dataset was not corrupted.`,
      );
    }
  };

  const handleRenameDataset = async (dataset: DatasetItem) => {
    const filename = window.prompt(
      "Enter new dataset filename (must end in .csv):",
      dataset.filename,
    );
    if (filename === null) return;
    try {
      await updateDataset(dataset.id, filename);
      await refreshDatasets();
    } catch (err) {
      setUploadError(`Rename failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDeleteDataset = async (dataset: DatasetItem) => {
    if (
      !window.confirm(
        `Permanently delete "${dataset.filename}"? This will remove its metadata and stored file.`,
      )
    )
      return;
    try {
      await deleteDataset(dataset.id);
      await refreshDatasets();
    } catch (err) {
      setUploadError(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleShareWithAnalysts = async (dataset: DatasetItem) => {
    try {
      await shareDataset(dataset.id, undefined, true);
      setShareSuccess(`Dataset "${dataset.filename}" shared with all authorized analysts!`);
      await refreshDatasets();
      setTimeout(() => setShareSuccess(""), 4000);
    } catch (err) {
      setUploadError(`Share failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleRunJob = async (engine: string) => {
    setJobRunning(true);
    setJobStatus(null);
    try {
      const res = await triggerJob("aggregation", engine, selectedDatasetId);
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

  // Selected Dataset metadata
  const activeDataset = datasets.find((d) => d.id === selectedDatasetId) || datasets[0];
  const summary = activeDataset?.validation_summary;

  return (
    <>
      <PageHeader
        title="Big Data Processing & Trust Pipeline"
        subtitle="End-to-end data pipeline: CSV Ingestion → Schema Validation → HDFS/Local Storage → MapReduce & PySpark Processing → Analytics Engine."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold">
          Execution Status: {sparkAvailable ? "PySpark Cluster Ready" : "Local Python Demo Mode"}
        </span>
      </PageHeader>

      {/* SECTION 1: DATA QUALITY & TRUST PANEL */}
      <Section letter="A" title="Data Quality & Trust Panel (CSV Ingestion & Audit)">
        <p className="mb-4 text-sm text-muted-foreground">
          Every uploaded dataset undergoes strict validation against the canonical Big Data schema.
          Invalid records and malformed timestamps are quarantined to protect analytical integrity.
        </p>

        <div className="grid gap-4 lg:grid-cols-12">
          {/* Active Dataset Inspection Card */}
          <div className="space-y-4 lg:col-span-7">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase">
                    Inspecting Dataset
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={selectedDatasetId}
                      onChange={(e) => setSelectedDatasetId(e.target.value)}
                      className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm font-semibold text-foreground focus:ring-2 focus:ring-ring"
                    >
                      {datasets.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.filename} {d.is_demo ? "(Shared Demo)" : `(${d.row_count} rows)`}
                        </option>
                      ))}
                    </select>
                    {activeDataset?.is_demo ? (
                      <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                        SHARED DEMO DATASET
                      </span>
                    ) : (
                      <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                        USER-OWNED DATASET
                      </span>
                    )}
                  </div>
                </div>

                {/* Share action for dataset owner or admin */}
                {(isAdmin || activeDataset?.owner_id === user?.id) && !activeDataset?.is_demo && (
                  <button
                    onClick={() => handleShareWithAnalysts(activeDataset)}
                    className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
                  >
                    <Share2 className="h-3.5 w-3.5" /> Share with Analysts
                  </button>
                )}
              </div>

              {shareSuccess && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircle2 className="h-4 w-4" /> {shareSuccess}
                </div>
              )}

              {/* Data Quality Metrics Grid */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Accepted Records
                  </p>
                  <p className="mt-1 font-display text-xl font-bold text-success">
                    {summary?.valid_rows ?? activeDataset?.row_count ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Verified valid schema</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Rejected Rows
                  </p>
                  <p
                    className={`mt-1 font-display text-xl font-bold ${(summary?.error_rows ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}
                  >
                    {summary?.error_rows ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Quarantined records</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Date Range
                  </p>
                  <p className="mt-1 text-xs font-bold text-foreground truncate">
                    {summary?.date_range?.start || "2026-09-01"} →{" "}
                    {summary?.date_range?.end || "2026-09-30"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">ISO timestamps</p>
                </div>
                <div className="rounded-xl bg-secondary p-3">
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                    Total Energy
                  </p>
                  <p className="mt-1 font-display text-xl font-bold text-primary">
                    {summary?.total_energy_kwh ? `${summary.total_energy_kwh} kWh` : "238.4 kWh"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Valid sum</p>
                </div>
              </div>

              {/* Unique Entities & Quality Breakdown */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-border p-3">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" /> Unique Households (
                    {summary?.unique_households?.length || 5})
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(
                      summary?.unique_households || ["HH-01", "HH-02", "HH-03", "HH-04", "HH-05"]
                    ).map((hh) => (
                      <span
                        key={hh}
                        className="rounded-md bg-secondary px-2 py-0.5 font-mono text-[10px]"
                      >
                        {hh}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border p-3">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <FileCheck2 className="h-3.5 w-3.5 text-primary" /> Unique Appliances (
                    {summary?.unique_appliances?.length || 6})
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(
                      summary?.unique_appliances || [
                        "Air conditioner",
                        "Refrigerator",
                        "Water heater",
                        "Television",
                        "Washing machine",
                        "Lights and fans",
                      ]
                    ).map((app) => (
                      <span key={app} className="rounded-md bg-secondary px-2 py-0.5 text-[10px]">
                        {app}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rejected row audit sample if any */}
              {summary?.sample_errors && summary.sample_errors.length > 0 && (
                <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <span className="text-xs font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Quarantined Rows Sample (
                    {summary.sample_errors.length})
                  </span>
                  <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs">
                    {summary.sample_errors.map((err, i) => (
                      <div
                        key={i}
                        className="flex justify-between rounded bg-background px-2 py-1 text-muted-foreground"
                      >
                        <span>Line {err.line}</span>
                        <span className="text-destructive">{err.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Upload & Saved Datasets Column */}
          <div className="space-y-4 lg:col-span-5">
            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="block text-xs font-semibold uppercase text-muted-foreground">
                Upload New Electricity Dataset (CSV)
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Requires canonical headers: <code>household_id</code>, <code>timestamp</code>, and
                either <code>energy_kwh</code> or (<code>wattage_w</code> & <code>usage_hours</code>
                ).
              </p>
              <div className="mt-3">
                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
                  <Upload className="h-4 w-4" /> Select CSV File
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>

              {uploadMessage && (
                <div className="mt-3 rounded-lg border border-success/30 bg-success-soft/20 p-2.5 text-xs font-medium text-success flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> {uploadMessage}
                </div>
              )}
              {uploadError && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" /> {uploadError}
                </div>
              )}

              {/* Saved Datasets list */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Available Datasets ({datasets.length})
                  </p>
                  <button
                    onClick={refreshDatasets}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Refresh
                  </button>
                </div>

                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {datasets.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDatasetId(d.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-2.5 text-xs transition ${
                        selectedDatasetId === d.id
                          ? "border-primary bg-primary/5 text-foreground"
                          : "border-border bg-secondary hover:border-border/80"
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="truncate font-semibold">{d.filename}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {d.is_demo ? "Shared Demo" : "Private"} · {d.row_count} records
                        </p>
                      </div>
                      {!d.is_demo && (
                        <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            aria-label={`Rename ${d.filename}`}
                            onClick={() => handleRenameDataset(d)}
                            className="p-1 text-muted-foreground hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            aria-label={`Delete ${d.filename}`}
                            onClick={() => handleDeleteDataset(d)}
                            className="p-1 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Architecture Node Overview */}
            <div className="rounded-2xl border border-border bg-card p-4 text-xs">
              <span className="font-semibold text-foreground">Storage Engine Status</span>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <span className="text-muted-foreground">Active Storage Mode</span>
                  <span className="font-semibold">Local Persistent CSV</span>
                </div>
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <span className="text-muted-foreground">HDFS Distributed Storage</span>
                  <span className="font-semibold">{hdfsStatus}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* SECTION 2: MAPREDUCE STREAMING AGGREGATION */}
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

        {/* Real Job Triggers */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleRunJob("mapreduce")}
            disabled={jobRunning}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Run MapReduce Job on Selected Dataset
          </button>
          <button
            onClick={() => handleRunJob("pyspark")}
            disabled={jobRunning}
            className="flex items-center gap-2 rounded-xl border border-primary px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" /> Run PySpark Job on Selected Dataset
          </button>
        </div>

        {/* Real Job Execution Result Card with Transparent Duration & Engine */}
        {jobStatus && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            {"error" in jobStatus ? (
              <div className="text-xs text-destructive">
                <span className="font-semibold">Job Error:</span> {jobStatus.error}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Job Result: {jobStatus.operation}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      ({jobStatus.id})
                    </span>
                  </div>
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                    {jobStatus.status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div>
                    Execution Engine: <b className="text-foreground">{jobStatus.execution_mode}</b>
                  </div>
                  <div>
                    Input Dataset: <b className="text-foreground">{jobStatus.dataset_id}</b>
                  </div>
                  <div>
                    Duration:{" "}
                    <b className="text-foreground">
                      {jobStatus.duration_ms ? `${jobStatus.duration_ms} ms` : "Instant"}
                    </b>
                  </div>
                  <div>
                    Timestamp:{" "}
                    <b className="text-foreground">
                      {new Date(jobStatus.started_at).toLocaleTimeString()}
                    </b>
                  </div>
                </div>
                {jobStatus.result_summary && (
                  <pre className="mt-3 overflow-x-auto rounded-lg bg-sidebar p-3 text-xs text-sidebar-foreground">
                    {JSON.stringify(jobStatus.result_summary, null, 2)}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </Section>

      {/* SECTION 3: APACHE SPARK & PYSPARK */}
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
