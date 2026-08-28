import { apiClient } from "@/api-helpers/client";

export interface AnalyticsData {
  owed: string | number;
  lent: string | number;
  settled: string | number;
  currency?: string;
}

export const getAnalytics = async (): Promise<AnalyticsData> => {
  try {
    const response = await apiClient.get<AnalyticsData>("/analytics");
    
    // Handle both direct response and response.data cases
    const data = response?.data || response;
    
    if (!data || (typeof data.owed === 'undefined' && typeof data.lent === 'undefined' && typeof data.settled === 'undefined')) {
      throw new Error('Invalid analytics data format');
    }

    return {
      owed: data.owed,
      lent: data.lent,
      settled: data.settled,
      currency: data.currency,
    };
  } catch (error) {
    console.error("Analytics API Error:", error);
    throw error; // Let the React Query hook handle the error
  }
}; 
/** Filters shared by the on-screen report and the CSV export. */
export interface ReportFilters {
  from?: string;
  to?: string;
  category?: string;
  currency?: string;
  /** Ask for org-wide data. The server decides whether the caller may have it. */
  organizationId?: string;
  /** "own" narrows the result to the caller's own rows; it can never widen one. */
  scope?: "own" | "org";
}

export interface ReportBucket {
  key: string;
  amount: number;
  count: number;
}

export interface AnalyticsReport {
  baseCurrency: string;
  totalSpend: number;
  transactionCount: number;
  /** The row cap clipped the result — totals cover only the rows counted. */
  truncated: boolean;
  byCategory: ReportBucket[];
  byCurrency: ReportBucket[];
  byMonth: ReportBucket[];
  previousPeriod: { totalSpend: number; changePct: number | null } | null;
  /** What the server actually returned: everyone's rows, or only the caller's. */
  scope: "org" | "own";
  role: "OWNER" | "ADMIN" | "MEMBER" | null;
  organizationName: string | null;
}

const reportQuery = (filters: ReportFilters): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
};

export const getAnalyticsReport = async (filters: ReportFilters): Promise<AnalyticsReport> => {
  return apiClient.get<AnalyticsReport, AnalyticsReport>(`/analytics/report${reportQuery(filters)}`);
};

/**
 * Download the filtered rows as CSV.
 *
 * Deliberately `fetch` and not `apiClient`: the response interceptor unwraps
 * every response to `response.data`, which throws away the
 * `Content-Disposition` filename the server chose for the file.
 */
export const downloadAnalyticsExport = async (filters: ReportFilters): Promise<void> => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
  const response = await fetch(`${baseUrl}/api/analytics/export${reportQuery(filters)}`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error(`Export failed with status ${response.status}`);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "splito-report.csv";
  const blobUrl = URL.createObjectURL(await response.blob());

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};
