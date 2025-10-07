import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentApi } from '@/lib/api';
import { useErrorHandler } from '@/hooks/useErrorHandler';

// Query keys for documents
export const documentKeys = {
  all: ['documents'] as const,
  byAgent: (agentId: number) => [...documentKeys.all, 'agent', agentId] as const,
};

// Get documents for an agent
export function useDocuments(agentId: number) {
  return useQuery({
    queryKey: documentKeys.byAgent(agentId),
    queryFn: () => documentApi.getByAgent(agentId).then(res => res.data),
    enabled: !!agentId,
  });
}

// Upload file mutation
export function useUploadFile() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: ({ agentId, file }: { agentId: number; file: File }) =>
      documentApi.upload(agentId, file).then(res => res.data),
    onSuccess: (data, { agentId, file }) => {
      // Invalidate documents for this agent
      queryClient.invalidateQueries({ queryKey: documentKeys.byAgent(agentId) });
      handleSuccess(`Successfully uploaded ${file.name}`);
    },
    onError: (error: any, { file }) => {
      handleError(error, `Failed to upload ${file.name}`);
    },
  });
}

// Upload URL mutation
export function useUploadUrl() {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();

  return useMutation({
    mutationFn: ({ agentId, url }: { agentId: number; url: string }) =>
      documentApi
        .uploadUrl(agentId, {
          filename: url,
          content: '',
          content_type: 'text/uri-list',
          doc_metadata: { source_url: url },
        })
        .then(res => res.data),
    onSuccess: (data, { agentId, url }) => {
      // Invalidate documents for this agent
      queryClient.invalidateQueries({ queryKey: documentKeys.byAgent(agentId) });
      handleSuccess(`Successfully uploaded content from ${url}`);
    },
    onError: (error: any, { url }) => {
      handleError(error, `Failed to upload content from ${url}`);
    },
  });
}

// Delete document mutation
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId: _agentId, documentId }: { agentId: number; documentId: number }) =>
      documentApi.delete(documentId),
    onSuccess: (_, { agentId }) => {
      // Invalidate documents for this agent
      queryClient.invalidateQueries({ queryKey: documentKeys.byAgent(agentId) });
    },
    onError: (error) => {
      console.error('Failed to delete document:', error);
    },
  });
}
