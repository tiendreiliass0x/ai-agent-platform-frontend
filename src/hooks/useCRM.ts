import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi, agentApi, CRMConfig } from '@/lib/api';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export const crmKeys = {
  org: (orgId: number) => ['crm', 'org', orgId] as const,
  agent: (agentId: number) => ['crm', 'agent', agentId] as const,
  escalations: (agentId: number, status: string | undefined, limit: number | undefined) =>
    ['escalations', agentId, status, limit] as const,
};

export function useOrgCRM(orgId: number) {
  return useQuery({
    queryKey: crmKeys.org(orgId),
    queryFn: () => organizationApi.getCRM(orgId).then(res => res.data.crm),
    enabled: !!orgId,
  });
}

export function useUpdateOrgCRM(orgId: number) {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  return useMutation({
    mutationFn: (cfg: CRMConfig) => organizationApi.updateCRM(orgId, cfg).then(res => res.data.crm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.org(orgId) });
      handleSuccess('CRM settings updated');
    },
    onError: (e: any) => handleError(e, 'Failed to update CRM settings'),
  });
}

export function useTestOrgCRM(orgId: number) {
  const { handleError } = useErrorHandler();
  return useMutation({
    mutationFn: (cfg?: CRMConfig) => organizationApi.testCRM(orgId, cfg).then(res => res.data),
    onError: (e: any) => handleError(e, 'Failed to test CRM connection'),
  });
}

export function useSyncOrgCRM(orgId: number) {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  return useMutation({
    mutationFn: () => organizationApi.syncCRM(orgId).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.org(orgId) });
      handleSuccess('CRM sync completed');
    },
    onError: (e: any) => handleError(e, 'Failed to run CRM sync'),
  });
}

export function useAgentCRM(agentId: number) {
  return useQuery({
    queryKey: crmKeys.agent(agentId),
    queryFn: () => agentApi.getCRMOverride(agentId).then(res => res.data.crm),
    enabled: !!agentId,
  });
}

export function useUpdateAgentCRM(agentId: number) {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  return useMutation({
    mutationFn: (cfg: CRMConfig) => agentApi.updateCRMOverride(agentId, cfg).then(res => res.data.crm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.agent(agentId) });
      handleSuccess('Agent CRM override updated');
    },
    onError: (e: any) => handleError(e, 'Failed to update agent CRM override'),
  });
}

export function useEscalations(agentId: number, status?: string, limit = 10) {
  return useQuery({
    queryKey: crmKeys.escalations(agentId, status, limit),
    queryFn: () => agentApi.getEscalations(agentId, { status, limit }).then(res => res.data.items),
    enabled: !!agentId,
    refetchInterval: 10000,
  });
}

export function useResolveEscalation(agentId: number) {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  return useMutation({
    mutationFn: (escalationId: number) => agentApi.resolveEscalation(agentId, escalationId).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.escalations(agentId, undefined, 10) });
      handleSuccess('Escalation resolved');
    },
    onError: (e: any) => handleError(e, 'Failed to resolve escalation'),
  });
}

