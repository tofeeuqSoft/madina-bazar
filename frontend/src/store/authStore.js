import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', credentials);
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (userData) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', userData);
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (e) {}
        localStorage.removeItem('accessToken'); // legacy cleanup (no longer written)
        localStorage.removeItem('user');
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),

      // Social (Google/Facebook) session — payload from /auth/social
      setSocialSession: (data) => {
        set({
          user: data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      },
    }),
    {
      name: 'madina-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useAuthStore;
