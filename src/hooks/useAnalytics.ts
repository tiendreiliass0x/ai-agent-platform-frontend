import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api';

export const analyticsKeys = {
  all: ['analytics'] as const,
  stats: (agentId: number, timeRange: string) => [...analyticsKeys.all, 'stats', agentId, timeRange] as const,
  insights: (agentId: number, timeRange: string) => [...analyticsKeys.all, 'insights', agentId, timeRange] as const,
};

export function useAgentStats(agentId: number, timeRange: string) {
  return useQuery({
    queryKey: analyticsKeys.stats(agentId, timeRange),
    queryFn: () => analyticsApi.getStats(agentId, timeRange).then(res => res.data),
    enabled: !!agentId,
  });
}

export function useAgentInsights(agentId: number, timeRange: string) {
  return useQuery({
    queryKey: analyticsKeys.insights(agentId, timeRange),
    queryFn: () => analyticsApi.getInsights(agentId, timeRange).then(res => res.data),
    enabled: !!agentId,
  });
}
