import { act } from '@testing-library/react';
import { useAuthStore } from '@/stores/authStore';
import { authApi, organizationApi, type User, type Organization } from '@/lib/api';

jest.mock('@/lib/api', () => {
  const actual = jest.requireActual('@/lib/api');
  return {
    ...actual,
    authApi: { ...actual.authApi, getMe: jest.fn() },
    organizationApi: { ...actual.organizationApi, getAll: jest.fn() },
  };
});

describe('authStore initializeApp', () => {
  beforeEach(() => {
    // Reset store to a known state
    useAuthStore.setState({
      user: null,
      token: null,
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
      isLoading: true,
    } as any);
  });

  it('hydrates user/orgs when token exists', async () => {
    const mockUser: User = { id: 1, email: 'a@b.com', name: 'Alice' } as any;
    const mockOrgs: Organization[] = [
      { id: 10, name: 'Acme', slug: 'acme', plan: 'pro', subscription_status: 'active', settings: {}, is_active: true, max_agents: 5, max_users: 10, max_documents_per_agent: 100, agents_count: 1, active_users_count: 1, created_at: new Date().toISOString() } as any,
    ];

    (authApi.getMe as jest.Mock).mockResolvedValue({ data: mockUser });
    (organizationApi.getAll as jest.Mock).mockResolvedValue({ data: mockOrgs });

    // Set a token to trigger bootstrap
    useAuthStore.setState({ token: 'test-token' });

    await act(async () => {
      await useAuthStore.getState().initializeApp();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(state.organizations).toEqual(mockOrgs);
    expect(state.currentOrganization?.id).toBe(10);
    expect(state.isLoading).toBe(false);
  });
});

