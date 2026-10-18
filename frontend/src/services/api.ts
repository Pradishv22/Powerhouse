/**
 * PowerWise API Client Service
 * Connects the TanStack React frontend to the Python Flask REST API (/api/v1).
 * Uses credentials: 'include' to pass HttpOnly session cookies automatically.
 */

import {
  consumptionRecords as mockRecords,
  clusteredHouseholds as mockClusters,
  defaultAppliances as mockAppliances,
  dashboardSummary as mockSummary,
  recommendations as mockRecommendations,
  type Appliance,
  type ClusteredHousehold,
} from "@/data/mockData";

function safeGetStorage(key: string): string | null {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined" &&
      window.localStorage
    ) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Ignore storage errors in test or SSR environments
  }
  return null;
}

function safeSetStorage(key: string, value: string): void {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined" &&
      window.localStorage
    ) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage errors in test or SSR environments
  }
}

function safeRemoveStorage(key: string): void {
  try {
    if (
      typeof window !== "undefined" &&
      typeof window.localStorage !== "undefined" &&
      window.localStorage
    ) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage errors in test or SSR environments
  }
}

function resolveDefaultApiBase(): string {
  if (typeof window !== "undefined") {
    // 1. Check local storage override if user configured one
    const userOverride = safeGetStorage("powerwise_api_url");
    if (userOverride && userOverride.trim()) {
      return userOverride.trim().replace(/\/+$/, "");
    }

    // 2. Check build-time VITE_API_URL
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl.trim()) {
      return envUrl.trim().replace(/\/+$/, "");
    }

    // 3. Same-machine development: localhost or 127.0.0.1
    const hostname = window.location.hostname || "localhost";
    if (hostname === "localhost" || hostname === "127.0.0.1" || !hostname) {
      return "http://localhost:5000/api/v1";
    }

    // 4. LAN access (e.g., 192.168.x.x, 10.x.x.x, or tablet/phone accessing the PC)
    return `http://${hostname}:5000/api/v1`;
  }
  return import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";
}

let activeApiBaseUrl = resolveDefaultApiBase();
export const API_BASE_URL = activeApiBaseUrl;

export function getActiveApiBaseUrl(): string {
  return activeApiBaseUrl;
}

export function setActiveApiBaseUrl(newUrl: string): void {
  activeApiBaseUrl = newUrl.replace(/\/+$/, "");
  safeSetStorage("powerwise_api_url", activeApiBaseUrl);
}

export type UserRole = "user" | "household" | "analyst" | "admin";

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
  is_active: boolean;
};

export type DashboardMetrics = {
  total_consumption: number;
  expenditure: number;
  avg_daily: number;
  highest_appliance: string;
  period_change: number;
  households: number;
  potential_savings: number;
  efficiency_score: number;
  record_count: number;
  execution_mode: string;
  tariff: number;
};

export type ConsumptionData = {
  series: { name: string; kwh: number }[];
  by_appliance: { name: string; kwh: number }[];
  by_household: { name: string; kwh: number }[];
  stacked_matrix?: Record<string, string | number>[];
};

export type DataQualitySummary = {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  calculated_energy_count?: number;
  missing_values_count?: number;
  date_range?: { start: string; end: string };
  unique_households?: string[];
  unique_appliances?: string[];
  total_energy_kwh?: number;
  sample_errors?: { line: number; reason: string }[];
};

export type DatasetItem = {
  id: string;
  owner_id: string;
  owner_email?: string;
  filename: string;
  row_count: number;
  status: string;
  created_at: string;
  is_demo?: boolean;
  shared_with?: string[];
  is_shared?: boolean;
  validation_summary?: DataQualitySummary;
};

export type AnalyticsJob = {
  id: string;
  owner_id?: string;
  dataset_id?: string;
  operation: string;
  engine: string;
  execution_mode: string;
  duration_ms?: number;
  status: string;
  started_at: string;
  completed_at?: string;
  result_summary?: Record<string, unknown>;
  safe_error_message?: string | null;
};

export type AuditLogItem = {
  id: string;
  timestamp: string;
  event_type: string;
  status: string;
  user_id: string;
  user_email: string;
  ip_address: string;
  details: Record<string, unknown>;
};

export type AdminOverviewData = {
  stats: {
    total_users: number;
    active_users: number;
    deactivated_users: number;
    users_by_role: { household: number; analyst: number; admin: number };
    total_appliances: number;
    total_datasets: number;
    demo_datasets: number;
    user_datasets: number;
    total_jobs: number;
    completed_jobs: number;
    failed_jobs: number;
  };
  users: User[];
  recent_jobs: AnalyticsJob[];
  recent_audit_logs?: AuditLogItem[];
  database_mode: string;
};

export type HealthData = {
  status: string;
  database: {
    mode: string;
    status: string;
  };
  big_data_environment: {
    pyspark_available: boolean;
    spark_master: string;
    hdfs_status: string;
  };
};

export type SavingsCalculation = {
  is_hypothetical_projection: boolean;
  disclaimer: string;
  assumptions: {
    billing_days: number;
    tariff_inr_per_kwh: number;
    fixed_charges_inr: number;
    formula: string;
  };
  current_scenario: {
    daily_hours: number;
    daily_kwh: number;
    monthly_kwh: number;
    monthly_cost_inr: number;
  };
  proposed_scenario: {
    daily_hours: number;
    daily_kwh: number;
    monthly_kwh: number;
    monthly_cost_inr: number;
  };
  reductions: {
    daily_kwh: number;
    monthly_kwh: number;
    monthly_savings_inr: number;
    annual_savings_inr: number;
    percent_reduction: number;
  };
};

export type SavingsScenario = {
  id: string;
  owner_id: string;
  name: string;
  appliance_name: string;
  inputs: {
    wattage_w: number;
    current_daily_hours: number;
    proposed_daily_hours: number;
    tariff_inr: number;
    fixed_charges_inr?: number;
    quantity?: number;
  };
  projection: SavingsCalculation;
  created_at: string;
};

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = safeGetStorage("powerwise_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: "include",
  };

  const primaryUrl = `${activeApiBaseUrl}${endpoint}`;
  let response: Response;

  try {
    response = await fetch(primaryUrl, fetchOptions);
  } catch (primaryErr: unknown) {
    const errorMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
    const isNetworkError =
      errorMsg === "Failed to fetch" ||
      errorMsg.includes("NetworkError") ||
      errorMsg.includes("Load failed") ||
      errorMsg.includes("network");

    if (isNetworkError && typeof window !== "undefined") {
      const candidates: string[] = [];
      const currentHost = window.location.hostname || "localhost";

      if (!activeApiBaseUrl.includes("localhost")) {
        candidates.push("http://localhost:5000/api/v1");
      }
      if (!activeApiBaseUrl.includes("127.0.0.1")) {
        candidates.push("http://127.0.0.1:5000/api/v1");
      }
      if (currentHost && currentHost !== "localhost" && currentHost !== "127.0.0.1") {
        const lanUrl = `http://${currentHost}:5000/api/v1`;
        if (activeApiBaseUrl !== lanUrl) candidates.push(lanUrl);
      }

      let fallbackSuccess = false;
      for (const candidateBase of candidates) {
        try {
          const fallbackUrl = `${candidateBase}${endpoint}`;
          response = await fetch(fallbackUrl, fetchOptions);
          activeApiBaseUrl = candidateBase;
          fallbackSuccess = true;
          break;
        } catch {
          // continue checking other candidates
        }
      }

      if (!fallbackSuccess) {
        throw new Error(
          `Unable to reach PowerWise API at ${activeApiBaseUrl}. Ensure the Flask backend is running on port 5000 (e.g. 'python -m backend.app').`,
        );
      }
    } else {
      throw new Error(errorMsg);
    }
  }

  if (!response.ok) {
    let errMessage = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch {
      // ignore
    }
    const error = new Error(errMessage) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
}

// ----------------- Authentication & Profile -----------------
export async function apiRegister(
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
) {
  const res = await request<{ message: string; user: User; token: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password, confirm_password: confirmPassword }),
  });
  if (res.token) safeSetStorage("powerwise_token", res.token);
  return res.user;
}

export async function apiLogin(email: string, password: string) {
  const res = await request<{ message: string; user: User; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (res.token) safeSetStorage("powerwise_token", res.token);
  return res.user;
}

export async function apiLogout() {
  safeRemoveStorage("powerwise_token");
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    // Ignore network error on logout
  }
}

export async function apiGetCurrentUser(): Promise<User | null> {
  try {
    const res = await request<{ user: User }>("/auth/me");
    return res.user;
  } catch {
    return null;
  }
}

export async function apiUpdateProfile(name: string): Promise<User> {
  const res = await request<{ message: string; user: User }>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  return res.user;
}

export async function apiChangePassword(
  currentPassword: string,
  newPassword: string,
  confirmNewPassword: string,
): Promise<{ message: string }> {
  return request<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_new_password: confirmNewPassword,
    }),
  });
}

// ----------------- Appliances -----------------
type ApiApplianceRecord = {
  id: string;
  name: string;
  category: string;
  wattage_w: number;
  daily_usage_hours: number;
  quantity?: number;
  daily_kwh: number;
  monthly_kwh: number;
  estimated_monthly_cost: number;
  share_percent?: number;
};

export async function getAppliances(tariff = 8): Promise<Appliance[]> {
  try {
    const res = await request<{ appliances: ApiApplianceRecord[] }>(`/appliances?tariff=${tariff}`);
    return res.appliances.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category,
      watts: a.wattage_w,
      hours: a.daily_usage_hours,
      quantity: a.quantity || 1,
      daily: a.daily_kwh,
      monthly: a.monthly_kwh,
      cost: a.estimated_monthly_cost,
      share: a.share_percent,
    }));
  } catch {
    return mockAppliances;
  }
}

export async function createAppliance(data: {
  name: string;
  category: string;
  watts: number;
  hours: number;
  quantity?: number;
}) {
  return request("/appliances", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      wattage_w: data.watts,
      daily_usage_hours: data.hours,
      quantity: data.quantity || 1,
    }),
  });
}

export async function updateAppliance(
  id: string,
  data: Partial<{ name: string; category: string; watts: number; hours: number; quantity: number }>,
) {
  return request(`/appliances/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.watts !== undefined ? { wattage_w: data.watts } : {}),
      ...(data.hours !== undefined ? { daily_usage_hours: data.hours } : {}),
      ...(data.quantity !== undefined ? { quantity: data.quantity } : {}),
    }),
  });
}

export async function deleteAppliance(id: string) {
  return request(`/appliances/${id}`, { method: "DELETE" });
}

// ----------------- Analytics -----------------
export async function getAnalyticsSummary(
  tariff = 8,
  datasetId?: string,
): Promise<DashboardMetrics> {
  const query = new URLSearchParams({ tariff: String(tariff) });
  if (datasetId) query.set("dataset_id", datasetId);

  try {
    return await request<DashboardMetrics>(`/analytics/summary?${query.toString()}`);
  } catch {
    return {
      total_consumption: mockSummary.totalConsumption,
      expenditure: mockSummary.expenditure,
      avg_daily: mockSummary.avgDaily,
      highest_appliance: "Air conditioner",
      period_change: -4.2,
      households: mockSummary.households,
      potential_savings: 15,
      efficiency_score: mockSummary.efficiencyScore,
      record_count: mockRecords.length,
      execution_mode: "Local demo (Flask backend offline)",
      tariff,
    };
  }
}

export async function getConsumptionSeries(
  period: "daily" | "weekly" | "monthly",
  datasetId?: string,
): Promise<ConsumptionData> {
  const query = new URLSearchParams({ period });
  if (datasetId) query.set("dataset_id", datasetId);

  try {
    return await request<ConsumptionData>(`/analytics/consumption?${query.toString()}`);
  } catch {
    return {
      series: [],
      by_appliance: [],
      by_household: [],
    };
  }
}

export async function getClusters(datasetId?: string): Promise<ClusteredHousehold[]> {
  const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : "";
  try {
    const res = await request<{ clusters: ClusteredHousehold[] }>(`/analytics/clusters${query}`);
    return res.clusters;
  } catch {
    return mockClusters;
  }
}

// ----------------- Datasets & Big Data Jobs -----------------
export async function getDatasets(): Promise<DatasetItem[]> {
  try {
    const res = await request<{ datasets: DatasetItem[] }>("/datasets");
    return res.datasets;
  } catch {
    return [];
  }
}

export async function uploadDataset(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<{ message: string; dataset: DatasetItem }>("/datasets", {
    method: "POST",
    body: formData,
  });
}

export async function updateDataset(id: string, filename: string) {
  return request<{ dataset: DatasetItem }>(`/datasets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ filename }),
  });
}

export async function deleteDataset(id: string) {
  return request(`/datasets/${id}`, { method: "DELETE" });
}

export async function shareDataset(id: string, analystId?: string, allAnalysts = false) {
  return request<{ message: string; dataset: DatasetItem }>(`/datasets/${id}/share`, {
    method: "POST",
    body: JSON.stringify({ analyst_id: analystId, all_analysts: allAnalysts }),
  });
}

export async function triggerJob(operation: string, engine: string, datasetId?: string) {
  return request<{ message: string; job: AnalyticsJob }>("/analytics/jobs", {
    method: "POST",
    body: JSON.stringify({ operation, engine, dataset_id: datasetId }),
  });
}

// ----------------- Smart Savings Planner -----------------
export async function calculateSavings(data: {
  wattage_w: number;
  current_daily_hours: number;
  proposed_daily_hours: number;
  tariff_inr?: number;
  fixed_charges_inr?: number;
  quantity?: number;
  billing_days?: number;
}) {
  return request<{ projection: SavingsCalculation }>("/savings/calculate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSavingsScenarios(): Promise<SavingsScenario[]> {
  try {
    const res = await request<{ scenarios: SavingsScenario[] }>("/savings/scenarios");
    return res.scenarios;
  } catch {
    return [];
  }
}

export async function saveSavingsScenario(data: {
  name: string;
  appliance_name: string;
  wattage_w: number;
  current_daily_hours: number;
  proposed_daily_hours: number;
  tariff_inr: number;
  fixed_charges_inr?: number;
  quantity?: number;
}) {
  return request<{ message: string; scenario: SavingsScenario }>("/savings/scenarios", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteSavingsScenario(id: string) {
  return request(`/savings/scenarios/${id}`, { method: "DELETE" });
}

// ----------------- Admin, Health & Audit -----------------
export async function getAdminOverview() {
  return request<AdminOverviewData>("/admin/overview");
}

export async function getAdminUsers(q?: string, role?: string, status?: string) {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (role) query.set("role", role);
  if (status) query.set("status", status);
  return request<{ users: User[]; total: number }>(`/admin/users?${query.toString()}`);
}

export async function updateUserRole(userId: string, role: string) {
  return request<{ message: string; user: User }>(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function toggleUserStatus(userId: string, isActive: boolean) {
  return request<{ message: string; user: User }>(`/admin/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function deleteAdminUser(userId: string) {
  return request<{ message: string }>(`/admin/users/${userId}?confirm=true`, {
    method: "DELETE",
  });
}

export async function getAuditLogs(eventType?: string) {
  const query = eventType ? `?event_type=${encodeURIComponent(eventType)}` : "";
  return request<{ audit_logs: AuditLogItem[]; count: number }>(`/admin/audit-logs${query}`);
}

export async function getHealth() {
  return request<HealthData>("/health");
}

export async function getRecommendations() {
  return mockRecommendations;
}

export function getExportCsvUrl(tariff = 8, datasetId?: string) {
  const query = new URLSearchParams({ tariff: String(tariff) });
  if (datasetId) query.set("dataset_id", datasetId);
  return `${getActiveApiBaseUrl()}/reports/export.csv?${query.toString()}`;
}
