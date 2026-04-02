import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export function useAlerts(filters: { status?: string; level?: string } = {}) {
  const query = new URLSearchParams();
  if (filters.status) query.append("status", filters.status);
  if (filters.level) query.append("alert_level", filters.level);

  const { data, error, isLoading, mutate } = useSWR(`/alerts?${query.toString()}`, fetcher, {
    refreshInterval: 30000,
  });

  return {
    alerts: data,
    isLoading,
    isError: error,
    mutate,
  };
}
