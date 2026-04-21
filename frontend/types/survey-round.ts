export interface SurveyRound {
  id: string;
  label: string;
  academic_year: string;
  term: number;
  status: "open" | "closed" | "cancelled";
  opened_at: string;
  closed_at: string | null;
  cancelled_at: string | null;
}
