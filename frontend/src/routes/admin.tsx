import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Users, Database, Cpu, Activity, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import {
  getAdminOverview,
  getHealth,
  type AdminOverviewData,
  type HealthData,
  type User as ApiUser,
  type AnalyticsJob,
} from "@/services/api";
import { PageHeader, Card, MetricCard } from "@/components/ui-kit";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "System Administration — PowerWise" },
      {
        name: "description",
        content:
          "Admin overview for monitoring users, datasets, processing jobs and system health.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate({ to: "/" });
      return;
    }

    if (isAdmin) {
      Promise.all([getAdminOverview(), getHealth()])
        .then(([ov, hl]) => {
          setOverview(ov);
          setHealth(hl);
          setLoading(false);
        })
        .catch((err: Error) => {
          setError(err.message || "Failed to load admin telemetry.");
          setLoading(false);
        });
    }
  }, [isAdmin, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-destructive">
        <p className="font-semibold">Access Error</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const stats = overview?.stats || {
    total_users: 1,
    total_appliances: 6,
    total_datasets: 1,
    total_jobs: 0,
  };
  const users: ApiUser[] = overview?.users || [];
  const recentJobs: AnalyticsJob[] = overview?.recent_jobs || [];

  return (
    <>
      <PageHeader
        title="System Administration & Health"
        subtitle="Restricted to administrators. Real-time overview of users, datasets, job executions, and Big Data engine availability."
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldAlert className="h-3.5 w-3.5" /> Admin Privilege Enforced
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Registered Users" value={String(stats.total_users)} icon={Users} />
        <MetricCard
          label="Configured Appliances"
          value={String(stats.total_appliances)}
          icon={Activity}
        />
        <MetricCard label="Stored Datasets" value={String(stats.total_datasets)} icon={Database} />
        <MetricCard
          label="Total Jobs Executed"
          value={String(stats.total_jobs)}
          icon={Cpu}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Backend & Storage Architecture</h3>
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
            </span>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between rounded-lg bg-secondary p-2.5">
              <dt className="text-muted-foreground">Database Storage Mode</dt>
              <dd className="font-semibold">
                {overview?.database_mode === "mongodb"
                  ? "MongoDB (Remote/Local)"
                  : "Local Persistent JSON File Storage"}
              </dd>
            </div>
            <div className="flex justify-between rounded-lg bg-secondary p-2.5">
              <dt className="text-muted-foreground">HDFS Distributed Storage</dt>
              <dd className="font-semibold">
                {health?.big_data_environment?.hdfs_status ||
                  "HDFS unavailable — using local dataset storage"}
              </dd>
            </div>
            <div className="flex justify-between rounded-lg bg-secondary p-2.5">
              <dt className="text-muted-foreground">PySpark Engine</dt>
              <dd className="font-semibold">
                {health?.big_data_environment?.pyspark_available
                  ? "Installed & Active"
                  : "Local Python Demo Fallback"}
              </dd>
            </div>
            <div className="flex justify-between rounded-lg bg-secondary p-2.5">
              <dt className="text-muted-foreground">API Session Security</dt>
              <dd className="font-semibold">
                HttpOnly + SameSite Cookies & Werkzeug Password Hashing
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Registered Users ({users.length})</h3>
            <span className="text-xs text-muted-foreground">RBAC Enforced</span>
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-xl border border-border p-2.5 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    u.role === "admin"
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {u.role.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="mb-3 font-semibold text-foreground">
          Recent Big Data Analytics Jobs ({recentJobs.length})
        </h3>
        {recentJobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No processing jobs have been triggered yet. Trigger one on the Big Data or Clustering
            page!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Job ID</th>
                  <th>Operation</th>
                  <th>Execution Mode</th>
                  <th>Status</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.id} className="border-t border-border">
                    <td className="py-2.5 font-mono text-xs text-primary">{j.id}</td>
                    <td>{j.operation}</td>
                    <td>
                      <span className="rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                        {j.execution_mode}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          j.status === "Completed"
                            ? "bg-success-soft text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="text-xs text-muted-foreground">
                      {new Date(j.started_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
