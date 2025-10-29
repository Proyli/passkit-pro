import { api } from "@/utils/api";

export type OverviewParams = { from?: string; to?: string };

export const AnalyticsService = {
  overview: (params: OverviewParams = {}) =>
    api.get("/api/analytics/overview", { params }).then(r => r.data),
};
