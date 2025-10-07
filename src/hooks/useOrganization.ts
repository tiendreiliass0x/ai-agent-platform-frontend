import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { organizationApi, UpdateOrganizationPayload } from '@/lib/api';
import { useErrorHandler } from '@/hooks/useErrorHandler';

export const organizationKeys = {
  all: ['organizations'] as const,
  lists: () => [...organizationKeys.all, 'list'] as const,
  details: () => [...organizationKeys.all, 'detail'] as const,
  detail: (id: number) => [...organizationKeys.details(), id] as const,
};

export function useOrganization(id: number) {
  return useQuery({
    queryKey: organizationKeys.detail(id),
    queryFn: () => organizationApi.getById(id).then(res => res.data),
    enabled: !!id,
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateOrganizationPayload }) =>
      organizationApi.update(id, data).then(res => res.data),
    onSuccess: (updatedOrg) => {
      // Update the organization in the cache
      queryClient.setQueryData(organizationKeys.detail(updatedOrg.id), updatedOrg);
      // Invalidate the list of organizations
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() });
      handleSuccess('Settings saved successfully!');
    },
    onError: (error: any) => {
      handleError(error, 'Failed to save settings');
    },
  });
}
