import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  Database,
  Cpu,
  Activity,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  UserCheck,
  UserX,
  Trash2,
  RefreshCw,
  Lock,
  ArrowLeft,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/lib/authContext";
import {
  getAdminOverview,
  getHealth,
  getAdminUsers,
  updateUserRole,
  toggleUserStatus,
  deleteAdminUser,
  getAuditLogs,
  type AdminOverviewData,
  type HealthData,
  type User as ApiUser,
  type AnalyticsJob,
  type AuditLogItem,
} from "@/services/api";
import { PageHeader, Card, MetricCard } from "@/components/ui-kit";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "System Administration & RBAC — PowerWise" },
      {
        name: "description",
        content:
          "Admin control panel for multi-user RBAC, account status, security audit logs, and Big Data health.",
      },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { isAdmin, isHousehold, isAnalyst, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "audit" | "health">("overview");

  // Overview data
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // User management state
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [userActionMsg, setUserActionMsg] = useState("");
  const [userActionErr, setUserActionErr] = useState("");

  // Delete modal state
  const [userToDelete, setUserToDelete] = useState<ApiUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [auditEventType, setAuditEventType] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchOverview = async () => {
    try {
      const [ov, hl] = await Promise.all([getAdminOverview(), getHealth()]);
      setOverview(ov);
      setHealth(hl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load admin telemetry.");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await getAdminUsers(searchQuery, roleFilter, statusFilter);
      setUsers(res.users);
    } catch (err) {
      setUserActionErr(err instanceof Error ? err.message : "Failed to load users.");
    }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const res = await getAuditLogs(auditEventType);
      setAuditLogs(res.audit_logs);
    } catch {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchOverview();
      fetchUsers();
      fetchAudit();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === "users") {
      fetchUsers();
    }
  }, [searchQuery, roleFilter, statusFilter, activeTab, isAdmin]);

  useEffect(() => {
    if (isAdmin && activeTab === "audit") {
      fetchAudit();
    }
  }, [auditEventType, activeTab, isAdmin]);

  // If user is not an administrator, show clean Access Denied page complying with requirements
  if (!authLoading && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Access Restricted</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          The Administration & Security panel is restricted exclusively to authorized
          administrators. Your current account does not have permission to view this resource.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

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
    active_users: 1,
    deactivated_users: 0,
    users_by_role: { household: 1, analyst: 0, admin: 0 },
    total_appliances: 6,
    total_datasets: 1,
    demo_datasets: 1,
    user_datasets: 0,
    total_jobs: 0,
    completed_jobs: 0,
    failed_jobs: 0,
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUserActionMsg("");
    setUserActionErr("");
    try {
      await updateUserRole(userId, newRole);
      setUserActionMsg("User role updated successfully.");
      await fetchUsers();
      await fetchOverview();
    } catch (err) {
      setUserActionErr(err instanceof Error ? err.message : "Failed to update role.");
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: boolean) => {
    setUserActionMsg("");
    setUserActionErr("");
    try {
      await toggleUserStatus(userId, !currentStatus);
      setUserActionMsg(
        `User account ${!currentStatus ? "activated" : "deactivated"} successfully.`,
      );
      await fetchUsers();
      await fetchOverview();
    } catch (err) {
      setUserActionErr(err instanceof Error ? err.message : "Failed to update status.");
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    setIsDeleting(true);
    setUserActionMsg("");
    setUserActionErr("");
    try {
      await deleteAdminUser(userToDelete.id);
      setUserActionMsg(`User ${userToDelete.email} and associated data deleted.`);
      setUserToDelete(null);
      await fetchUsers();
      await fetchOverview();
    } catch (err) {
      setUserActionErr(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="System Administration & RBAC Control"
        subtitle="Manage user roles, account activation, system health, and tamper-resistant security audit logs."
      >
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "overview"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "users"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            User Management ({stats.total_users})
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "audit"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Security Audit Log
          </button>
          <button
            onClick={() => setActiveTab("health")}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === "health"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            System Health
          </button>
        </div>
      </PageHeader>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Registered Users"
              value={`${stats.total_users} (${stats.active_users} Active)`}
              icon={Users}
            />
            <MetricCard
              label="Configured Appliances"
              value={String(stats.total_appliances)}
              icon={Activity}
            />
            <MetricCard
              label="Stored Datasets"
              value={`${stats.total_datasets} (${stats.user_datasets} User · ${stats.demo_datasets} Demo)`}
              icon={Database}
            />
            <MetricCard
              label="Processing Jobs"
              value={`${stats.total_jobs} (${stats.completed_jobs} Succeeded)`}
              icon={Cpu}
              tone="success"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Role Breakdown Card */}
            <Card>
              <h3 className="mb-3 font-semibold text-foreground">Multi-User Role Distribution</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <span className="text-xs font-semibold text-emerald-500 uppercase">
                    Household Users
                  </span>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    {stats.users_by_role?.household ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Personal analytics</p>
                </div>
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                  <span className="text-xs font-semibold text-blue-500 uppercase">
                    Energy Analysts
                  </span>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    {stats.users_by_role?.analyst ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Authorized datasets</p>
                </div>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                  <span className="text-xs font-semibold text-purple-500 uppercase">
                    Administrators
                  </span>
                  <p className="mt-1 font-display text-2xl font-bold text-foreground">
                    {stats.users_by_role?.admin ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Full governance</p>
                </div>
              </div>
            </Card>

            {/* Architecture Card */}
            <Card>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Backend & Storage Architecture</h3>
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Healthy
                </span>
              </div>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <dt className="text-muted-foreground">Database Engine</dt>
                  <dd className="font-semibold">
                    {overview?.database_mode === "mongodb"
                      ? "MongoDB (Remote/Local)"
                      : "Local Persistent JSON File Storage"}
                  </dd>
                </div>
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <dt className="text-muted-foreground">HDFS Distributed Storage</dt>
                  <dd className="font-semibold">{health?.big_data_environment?.hdfs_status}</dd>
                </div>
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <dt className="text-muted-foreground">PySpark Engine</dt>
                  <dd className="font-semibold">
                    {health?.big_data_environment?.pyspark_available
                      ? "Installed & Active"
                      : "Local Python Demo Fallback"}
                  </dd>
                </div>
                <div className="flex justify-between rounded-lg bg-secondary p-2">
                  <dt className="text-muted-foreground">Session Security</dt>
                  <dd className="font-semibold">HttpOnly + SameSite Cookie & PBKDF2 Hashing</dd>
                </div>
              </dl>
            </Card>
          </div>

          {/* Recent Jobs Summary */}
          <Card>
            <h3 className="mb-3 font-semibold text-foreground">Recent Processing Jobs</h3>
            {(overview?.recent_jobs || []).length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No jobs executed yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-left uppercase text-muted-foreground">
                    <tr>
                      <th className="py-2">Job ID</th>
                      <th>Operation</th>
                      <th>Execution Mode</th>
                      <th>Duration</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(overview?.recent_jobs || []).map((j) => (
                      <tr key={j.id}>
                        <td className="py-2 font-mono text-primary">{j.id}</td>
                        <td>{j.operation}</td>
                        <td>
                          <span className="rounded bg-secondary px-2 py-0.5">
                            {j.execution_mode}
                          </span>
                        </td>
                        <td>{j.duration_ms ? `${j.duration_ms} ms` : "Instant"}</td>
                        <td>
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-success font-semibold">
                            {j.status}
                          </span>
                        </td>
                        <td className="text-muted-foreground">
                          {new Date(j.started_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* USER MANAGEMENT TAB */}
      {activeTab === "users" && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground">User Management & Role Assignment</h3>
              <p className="text-xs text-muted-foreground">
                Assign roles, activate or deactivate accounts, and safely manage registered users.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchUsers}
                className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 text-xs text-foreground focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:ring-2 focus:ring-ring"
              >
                <option value="">All Roles</option>
                <option value="user">Household Users</option>
                <option value="analyst">Energy Analysts</option>
                <option value="admin">Administrators</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground focus:ring-2 focus:ring-ring"
              >
                <option value="">All Statuses</option>
                <option value="true">Active Only</option>
                <option value="false">Deactivated Only</option>
              </select>
            </div>
          </div>

          {userActionMsg && (
            <div className="mb-3 rounded-lg border border-success/30 bg-success-soft/20 p-2.5 text-xs text-success flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 shrink-0" /> {userActionMsg}
            </div>
          )}
          {userActionErr && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {userActionErr}
            </div>
          )}

          {/* Users Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5">User Details</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th className="text-right">Administrative Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-secondary/40 transition">
                    <td className="py-3">
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-[11px] text-muted-foreground">{u.email}</p>
                    </td>
                    <td>
                      <select
                        value={u.role === "household" ? "user" : u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-semibold focus:ring-2 focus:ring-ring"
                      >
                        <option value="user">Household User</option>
                        <option value="analyst">Energy Analyst</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </td>
                    <td>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          u.is_active
                            ? "bg-success-soft text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {u.is_active ? "ACTIVE" : "DISABLED"}
                      </span>
                    </td>
                    <td className="text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleStatusToggle(u.id, u.is_active)}
                          title={u.is_active ? "Deactivate account" : "Activate account"}
                          className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                            u.is_active
                              ? "border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              : "border border-success/30 bg-success-soft text-success"
                          }`}
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => setUserToDelete(u)}
                          title="Delete user and associated records"
                          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Delete Confirmation Modal */}
          {userToDelete && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
              <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl text-card-foreground">
                <div className="flex items-center gap-3 text-destructive">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground">Confirm Destructive Action</h3>
                    <p className="text-xs text-muted-foreground">Explicit Confirmation Required</p>
                  </div>
                </div>
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Are you sure you want to permanently delete user <b>{userToDelete.email}</b>? This
                  will also cascade delete all their private datasets and appliances. This action
                  cannot be undone.
                </p>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => setUserToDelete(null)}
                    className="rounded-xl border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    disabled={isDeleting}
                    className="rounded-xl bg-destructive px-4 py-2 text-xs font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting..." : "Permanently Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* AUDIT LOG TAB */}
      {activeTab === "audit" && (
        <Card>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h3 className="font-semibold text-foreground">Immutable Security Audit Log</h3>
              <p className="text-xs text-muted-foreground">
                Tamper-resistant audit events recording authentication, role changes, dataset
                deletions, and security checks. Excludes secrets & passwords.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={auditEventType}
                onChange={(e) => setAuditEventType(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-1.5 text-xs text-foreground focus:ring-2 focus:ring-ring"
              >
                <option value="">All Event Types</option>
                <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
                <option value="LOGIN_FAILURE">LOGIN_FAILURE</option>
                <option value="ROLE_CHANGE">ROLE_CHANGE</option>
                <option value="ACCOUNT_STATUS_CHANGE">ACCOUNT_STATUS_CHANGE</option>
                <option value="USER_DELETED">USER_DELETED</option>
                <option value="DATASET_UPLOAD">DATASET_UPLOAD</option>
                <option value="DATASET_DELETE">DATASET_DELETE</option>
                <option value="DATASET_SHARED">DATASET_SHARED</option>
                <option value="PERMISSION_DENIED">PERMISSION_DENIED</option>
                <option value="SAVINGS_SCENARIO_SAVED">SAVINGS_SCENARIO_SAVED</option>
              </select>
              <button
                onClick={fetchAudit}
                disabled={auditLoading}
                className="flex items-center gap-1 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`} />{" "}
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border text-left uppercase text-muted-foreground">
                <tr>
                  <th className="py-2.5">Timestamp</th>
                  <th>Event Type</th>
                  <th>Actor / User</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Sanitized Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/30 transition">
                    <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <span className="font-mono font-semibold text-primary">{log.event_type}</span>
                    </td>
                    <td>{log.user_email || log.user_id}</td>
                    <td className="font-mono text-muted-foreground">{log.ip_address}</td>
                    <td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-success-soft text-success"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="max-w-xs truncate text-[11px] text-muted-foreground font-mono">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* HEALTH TAB */}
      {activeTab === "health" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h3 className="mb-3 font-semibold text-foreground">API Health & Database Mode</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">API Status</span>
                <span className="font-semibold text-success">Healthy (HTTP 200)</span>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">Database Storage Mode</span>
                <span className="font-semibold">{overview?.database_mode}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">Session Cookie Setting</span>
                <span className="font-semibold">HttpOnly, SameSite=Lax</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 font-semibold text-foreground">Big Data Cluster Status</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">HDFS Status</span>
                <span className="font-semibold">{health?.big_data_environment?.hdfs_status}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">Spark Master</span>
                <span className="font-semibold">{health?.big_data_environment?.spark_master}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-secondary p-2.5">
                <span className="text-muted-foreground">PySpark Availability</span>
                <span className="font-semibold">
                  {health?.big_data_environment?.pyspark_available ? "Active" : "Local Python Mode"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
