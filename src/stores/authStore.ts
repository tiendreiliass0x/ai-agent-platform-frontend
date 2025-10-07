import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Organization, authApi, organizationApi } from '@/lib/api';

interface AuthState {
  user: User | null;
  token: string | null;
  organizations: Organization[];
  currentOrganization: Organization | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => Promise<void>;
  logout: () => void;
  setLoading: (loading: boolean) => void;
  setCurrentOrganization: (orgId: number) => void;
  initializeApp: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      organizations: [],
      currentOrganization: null,
      isAuthenticated: false,
      isLoading: true,

      login: async (token: string, user: User) => {
        set({ token, user, isAuthenticated: true });
        try {
          const orgsResponse = await organizationApi.getAll();
          const organizations = orgsResponse.data;
          set({ organizations });
          if (organizations.length > 0) {
            set({ currentOrganization: organizations[0] });
          }
        } catch (error) {
          console.error("Failed to fetch organizations", error);
          // Keep user logged in even if org fetch fails
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
          organizations: [],
          currentOrganization: null,
        });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setCurrentOrganization: (orgId: number) => {
        const organization = get().organizations.find(org => org.id === orgId);
        if (organization) {
          set({ currentOrganization: organization });
        }
      },

      initializeApp: async () => {
        const token = get().token;
        if (!token) {
          set({ isLoading: false });
          return;
        }

        try {
          const response = await authApi.getMe();
          await get().login(token, response.data);
        } catch (error) {
          console.error("Failed to authenticate with token", error);
          get().logout();
        } finally {
          set({ isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token }),
    }
  )
);
