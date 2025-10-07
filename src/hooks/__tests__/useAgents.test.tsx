import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAgents } from '@/hooks/useAgents';
import { agentApi, type Agent } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  agentApi: { getAll: jest.fn() },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function AgentsProbe() {
  const { data = [], isLoading } = useAgents();
  return (
    <div>
      <div>loading:{String(isLoading)}</div>
      <div>count:{data.length}</div>
      {data.map(a => (
        <div key={a.id}>{a.name}</div>
      ))}
    </div>
  );
}

describe('useAgents', () => {
  it('returns agent list from API', async () => {
    const agents: Agent[] = [
      {
        id: 1,
        public_id: 'pub-1',
        name: 'Support Bot',
        is_active: true,
        api_key: 'hidden',
        config: {},
        widget_config: {},
      } as any,
    ];

    (agentApi.getAll as jest.Mock).mockResolvedValue({ data: agents });

    render(<AgentsProbe />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('count:1')).toBeInTheDocument());
    expect(screen.getByText('Support Bot')).toBeInTheDocument();
  });
});
