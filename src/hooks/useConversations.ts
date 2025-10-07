import { useQuery } from '@tanstack/react-query';
import { conversationApi } from '@/lib/api';

export const conversationKeys = {
  detail: (conversationId: number) => ['conversations', conversationId] as const,
  list: (agentId: number, limit: number, offset: number) => ['conversations', 'list', agentId, limit, offset] as const,
};

export function useConversation(conversationId: number) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: () => conversationApi.getById(conversationId).then(res => res.data),
    enabled: !!conversationId,
  });
}

export function useAgentConversations(agentId: number, limit = 10, offset = 0) {
  return useQuery({
    queryKey: conversationKeys.list(agentId, limit, offset),
    queryFn: () => conversationApi.listByAgent(agentId, { limit, offset }).then(res => res.data),
    enabled: !!agentId,
    staleTime: 10_000,
  });
}
