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

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
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

export type DatasetItem = {
  id: string;
  owner_id: string;
  filename: string;
  row_count: number;
  status: string;
  created_at: string;
  is_demo?: boolean;
};

export type AnalyticsJob = {
  id: string;
  operation: string;
  engine: string;
  execution_mode: string;
  status: string;
  started_at: string;
  completed_at?: string;
  result_summary?: Record<string, unknown>;
  safe_error_message?: string | null;
};

export type AdminOverviewData = {
  stats: {
    total_users: number;
    total_appliances: number;
    total_datasets: number;
    total_jobs: number;
  };
  users: User[];
  recent_jobs: AnalyticsJob[];
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

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = localStorage.getItem("powerwise_token");
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

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

// ----------------- Authentication -----------------
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
  if (res.token) localStorage.setItem("powerwise_token", res.token);
  return res.user;
}

export async function apiLogin(email: string, password: string) {
  const res = await request<{ message: string; user: User; token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (res.token) localStorage.setItem("powerwise_token", res.token);
  return res.user;
}

export async function apiLogout() {
  localStorage.removeItem("powerwise_token");
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
    // Fallback to sample data if backend is offline
    return mockAppliances;
  }
}

export async function createAppliance(data: {
  name: string;
  category: string;
  watts: number;
  hours: number;
}) {
  return request("/appliances", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      category: data.category,
      wattage_w: data.watts,
      daily_usage_hours: data.hours,
    }),
  });
}

export async function deleteAppliance(id: string) {
  return request(`/appliances/${id}`, { method: "DELETE" });
}

// ----------------- Analytics -----------------
export async function getAnalyticsSummary(tariff = 8): Promise<DashboardMetrics> {
  try {
    return await request<DashboardMetrics>(`/analytics/summary?tariff=${tariff}`);
  } catch {
    return {
      total_consumption: mockSummary.totalConsumption,
      expenditure: mockSummary.expenditure,
      avg_daily: mockSummary.avgDaily,
      highest_appliance: "Air conditioner",
      period_change: -4.2,
      households: mockSummary.households,
      potential_savings: mockSummary.potentialSavings,
      efficiency_score: mockSummary.efficiencyScore,
      record_count: mockRecords.length,
      execution_mode: "Local demo (Flask backend offline)",
      tariff,
    };
  }
}

export async function getConsumptionSeries(
  period: "daily" | "weekly" | "monthly",
): Promise<ConsumptionData> {
  try {
    return await request<ConsumptionData>(`/analytics/consumption?period=${period}`);
  } catch {
    return {
      series: [],
      by_appliance: [],
      by_household: [],
    };
  }
}

export async function getClusters(): Promise<ClusteredHousehold[]> {
  try {
    const res = await request<{ clusters: ClusteredHousehold[] }>("/analytics/clusters");
    return res.clusters;
  } catch {
    return mockClusters;
  }
}

// ----------------- Datasets & Jobs -----------------
export async function getDatasets() {
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

export async function triggerJob(operation: string, engine: string) {
  return request<{ message: string; job: AnalyticsJob }>("/analytics/jobs", {
    method: "POST",
    body: JSON.stringify({ operation, engine }),
  });
}

// ----------------- Admin & Health -----------------
export async function getAdminOverview() {
  return request<AdminOverviewData>("/admin/overview");
}

export async function getHealth() {
  return request<HealthData>("/health");
}

export async function getRecommendations() {
  return mockRecommendations;
}

export function getExportCsvUrl(tariff = 8) {
  return `${API_BASE_URL}/reports/export.csv?tariff=${tariff}`;
}
