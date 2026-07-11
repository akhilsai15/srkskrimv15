import { create } from 'zustand';
import {
  signUp as cognitoSignUp,
  confirmSignUp as cognitoConfirmSignUp,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  getCurrentSession,
  refreshSession as cognitoRefreshSession,
} from '../lib/auth/cognitoClient';

export interface User {
  username: string;
  email: string;
  [key: string]: any;
}

interface AuthState {
  user: User | null;
  idToken: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  signUp: (
    username: string,
    password: string,
    email: string,
    additionalAttributes?: Record<string, string>
  ) => Promise<any>;
  confirmSignUp: (username: string, code: string) => Promise<string>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshSession: () => Promise<void>;
  setAuthenticated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  idToken: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  setAuthenticated: (val) => set({ isAuthenticated: val }),

  signUp: async (username, password, email, additionalAttributes) => {
    set({ isLoading: true, error: null });
    try {
      const result = await cognitoSignUp(username, password, email, additionalAttributes);
      set({ isLoading: false });
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign up';
      set({ isLoading: false, error: errorMessage });
      throw err;
    }
  },

  confirmSignUp: async (username, code) => {
    set({ isLoading: true, error: null });
    try {
      const result = await cognitoConfirmSignUp(username, code);
      set({ isLoading: false });
      return result;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to confirm sign up';
      set({ isLoading: false, error: errorMessage });
      throw err;
    }
  },

  signIn: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const session = await cognitoSignIn(username, password);
      
      const payload = session.getIdToken().payload || {};
      const user: User = {
        username: payload['cognito:username'] || payload['sub'] || username,
        email: payload['email'] || '',
        ...payload,
      };

      set({
        user,
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to sign in';
      set({ isLoading: false, error: errorMessage });
      throw err;
    }
  },

  signOut: async () => {
    set({ isLoading: true });
    try {
      await cognitoSignOut();
    } catch (err) {
      console.error('Error during Cognito signOut:', err);
    } finally {
      set({
        user: null,
        idToken: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  },

  checkSession: async () => {
    set({ isLoading: true });
    try {
      const session = await getCurrentSession();
      if (session && session.isValid()) {
        const payload = session.getIdToken().payload || {};
        const username = payload['cognito:username'] || payload['sub'] || '';
        const user: User = {
          username,
          email: payload['email'] || '',
          ...payload,
        };

        set({
          user,
          idToken: session.getIdToken().getJwtToken(),
          accessToken: session.getAccessToken().getJwtToken(),
          refreshToken: session.getRefreshToken().getToken(),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          idToken: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('Error checking current session:', err);
      set({
        user: null,
        idToken: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  refreshSession: async () => {
    const { refreshToken, user } = get();
    if (!refreshToken || !user) {
      throw new Error('No active session or refresh token found');
    }

    set({ isLoading: true });
    try {
      const session = await cognitoRefreshSession(refreshToken, user.username);
      const payload = session.getIdToken().payload || {};
      const updatedUser: User = {
        username: user.username,
        email: payload['email'] || user.email,
        ...payload,
      };

      set({
        user: updatedUser,
        idToken: session.getIdToken().getJwtToken(),
        accessToken: session.getAccessToken().getJwtToken(),
        refreshToken: session.getRefreshToken().getToken(),
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to refresh session';
      set({ isLoading: false, error: errorMessage });
      throw err;
    }
  },
}));
