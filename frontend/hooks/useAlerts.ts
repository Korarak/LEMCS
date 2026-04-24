import useSWR from "swr";
import { api } from "@/lib/api";

const fetcher = (url: string) => api.get(url).then(r => r.data);

export interface AlertFilters {
  status?: string;
  level?: string;
  affiliation_id?: string;
  district_id?: string;
  school_id?: string;
  assessment_type?: string;
  grade?: string;
  gender?: string;
  date_from?: string;
  date_to?: string;
}

export function useAlerts(filters: AlertFilters = {}) {
  const query = new URLSearchParams();
  if (filters.status)          query.append("status",          filters.status);
  if (filters.level)           query.append("alert_level",     filters.level);
  if (filters.affiliation_id)  query.append("affiliation_id",  filters.affiliation_id);
  if (filters.district_id)     query.append("district_id",     filters.district_id);
  if (filters.school_id)       query.append("school_id",       filters.school_id);
  if (filters.assessment_type) query.append("assessment_type", filters.assessment_type);
  if (filters.grade)           query.append("grade",           filters.grade);
  if (filters.gender)          query.append("gender",          filters.gender);
  if (filters.date_from)       query.append("date_from",       filters.date_from);
  if (filters.date_to)         query.append("date_to",         filters.date_to);

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
