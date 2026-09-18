import { useQuery } from "@tanstack/react-query";
import { QueryKeys } from "@/lib/constants";
import {
  AnalyticsData,
  AnalyticsReport,
  ReportFilters,
  getAnalytics,
  getAnalyticsReport,
} from "../api/client";

export const useAnalytics = () => {
  return useQuery<AnalyticsData>({
    queryKey: [QueryKeys.ANALYTICS],
    queryFn: getAnalytics,
    staleTime: 1000 * 60 * 1, // Consider data fresh for 1 minute
    refetchOnWindowFocus: true,
    retry: 2,
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
    refetchOnMount: true,
  });
}; 
/**
 * The filtered spend report behind the settings "Reports & export" section.
 *
 * The filters are part of the query key, so changing a date range or a
 * category refetches rather than serving the previous window's numbers.
 */
export const useAnalyticsReport = (filters: ReportFilters) => {
  return useQuery<AnalyticsReport>({
    queryKey: [QueryKeys.ANALYTICS, "report", filters],
    queryFn: () => getAnalyticsReport(filters),
    staleTime: 1000 * 60,
  });
};
