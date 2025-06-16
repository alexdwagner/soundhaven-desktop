import { createContext, useContext } from 'react';
import { User } from '../../../../shared/types';

interface AuthContextState {
  user: User | null;
  token: string | null; // Include token
  loading: boolean; // Add loading state
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;  
  register: (name: string, email: string, password: string) => Promise<User>;
  refreshToken: () => Promise<string | null>;
  isAuthenticated: () => boolean;
  updateUser: (updatedUser: User) => void;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
}

const defaultContextValue: AuthContextState = {
  user: null,
  token: null, // Ensure token is included in the context's default state
  loading: true, // Default loading state
  login: async (): Promise<User> => { throw new Error("login function not implemented"); },
  logout: async () => { throw new Error("logout function not implemented"); },
  register: async (): Promise<User> => { throw new Error("register function not implemented"); },
  refreshToken: async () => { throw new Error("refreshToken function not implemented"); },
  isAuthenticated: () => false,
  updateUser: () => { throw new Error("updateUser function not implemented"); },
  setToken: () => { throw new Error("setToken function not implemented"); },
  setUser: () => { throw new Error("setUser function not implemented"); },
  setLoading: () => { throw new Error("setLoading function not implemented"); },
};

export const AuthContext = createContext<AuthContextState>(defaultContextValue);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
