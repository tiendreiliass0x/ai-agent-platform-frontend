import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  agentApi,
  CreateAgentPayload,
  UpdateAgentPayload,
  DomainExpertisePayload,
  EnhancedAgentResponse,
} from '@/lib/api';
import { useErrorHandler } from '@/hooks/useErrorHandler';

// Query keys for consistent cache management
export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (filters: string) => [...agentKeys.lists(), { filters }] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: number) => [...agentKeys.details(), id] as const,
  embedCode: (id: number) => [...agentKeys.detail(id), 'embed-code'] as const,
};

// Get all agents
export function useAgents() {
  return useQuery({
    queryKey: agentKeys.lists(),
    queryFn: () => agentApi.getAll().then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get single agent
export function useAgent(id: number) {
  return useQuery({
    queryKey: agentKeys.detail(id),
    queryFn: () => agentApi.getById(id).then(res => res.data),
    enabled: !!id,
  });
}

// Get embed code for agent
export function useAgentEmbedCode(id: number) {
  return useQuery({
    queryKey: agentKeys.embedCode(id),
    queryFn: () => agentApi.getEmbedCode(id).then(res => res.data),
    enabled: !!id,
  });
}

// Create agent mutation
type CreateAgentVariables = CreateAgentPayload & { organization_id?: number };

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: (variables: CreateAgentVariables) => {
      const { organization_id, ...payload } = variables;
      return agentApi
        .create(payload, organization_id ? { organization_id } : undefined)
        .then(res => res.data);
    },
    onSuccess: (response: EnhancedAgentResponse) => {
      const createdAgent = response.agent;
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      queryClient.setQueryData(agentKeys.detail(createdAgent.id), createdAgent);
      handleSuccess(`Agent "${createdAgent.name}" created successfully!`);
    },
    onError: (error: any) => {
      handleError(error, 'Failed to create agent');
    },
  });
}

// Update agent mutation
export function useUpdateAgent() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateAgentPayload }) =>
      agentApi.update(id, data).then(res => res.data),
    onSuccess: (updatedAgent) => {
      queryClient.setQueryData(agentKeys.detail(updatedAgent.id), updatedAgent);
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      handleSuccess(`Agent "${updatedAgent.name}" updated successfully.`);
    },
    onError: (error: any, variables) => {
      handleError(error, `Failed to update agent (ID: ${variables.id})`);
    },
  });
}

// Delete agent mutation
export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: (id: number) => agentApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: agentKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      handleSuccess(`Agent (ID: ${id}) deleted successfully.`);
    },
    onError: (error: any, id) => {
      handleError(error, `Failed to delete agent (ID: ${id})`);
    },
  });
}

export function useUpdateAgentDomainExpertise(agentId: number) {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: (payload: DomainExpertisePayload) =>
      agentApi.updateDomainExpertise(agentId, payload).then(res => res.data),
    onSuccess: (updatedAgent) => {
      queryClient.setQueryData(agentKeys.detail(updatedAgent.id), updatedAgent);
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      handleSuccess('Domain expertise updated successfully.');
    },
    onError: (error: any) => {
      handleError(error, 'Failed to update domain expertise');
    },
  });
}
