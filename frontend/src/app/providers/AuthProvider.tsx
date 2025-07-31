"use client";

import React, { useState, ReactNode, FC, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { User } from '../../../../shared/types';

interface LoginResponse {
  data?: {
    user: User;
    accessToken: string;
    refreshToken?: string;
  };
  error?: string;
}

interface RefreshTokenResponse {
  data?: {
    accessToken: string;
    refreshToken?: string;
  };
  error?: string;
}
import electronApiService from '../../services/electronApiService';
import { useTracks } from '../hooks/UseTracks';
import { usePlaylists } from '../hooks/UsePlaylists';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { clearTracks } = useTracks();
  const { clearPlaylists } = usePlaylists();

  // Initialize auth state from Electron secure storage or auto-login test user
  useEffect(() => {
    const initializeAuthState = async () => {
      // Detect if we're in mobile browser (no Electron APIs)
      const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
      
      if (!isElectron) {
        // console.log('📱 [AuthProvider] Mobile browser detected - skipping auth initialization');
        setLoading(false);
        return;
      }
      
      try {
        const [storedUser, storedToken] = await Promise.all([
          electronApiService.getStoredUser(),
          electronApiService.getToken()
        ]);

        // console.log('Initializing auth state from secure storage', {
        //   storedUser,
        //   storedToken
        // });

        if (storedUser && storedToken) {
          // Create a full User object with required fields
          const fullUser: User = {
            ...storedUser,
            name: storedUser.name || '',
            createdAt: storedUser.createdAt || new Date().toISOString(),
            updatedAt: storedUser.updatedAt || new Date().toISOString(),
            playlists: [],
            followedArtists: [],
            refreshTokens: []
          };
          setUser(fullUser);
          setToken(storedToken);
        } else {
          // Auto-login test user for desktop app convenience
          // console.log('🔐 No stored auth found, attempting auto-login for test user...');
          try {
            const response = await electronApiService.login({
              email: 'test@example.com',
              password: 'testpassword'
            });
            
            if (!response?.data) {
              throw new Error('No response from server during auto-login');
            }

            const { user, accessToken, refreshToken } = response.data;

            await Promise.all([
              electronApiService.setUser(user),
              electronApiService.setToken(accessToken),
              refreshToken ? electronApiService.setRefreshToken(refreshToken) : Promise.resolve()
            ]);

            setUser(user);
            setToken(accessToken);
            // console.log('✅ Auto-login successful for user:', user.name);
          } catch (error) {
            // console.log('❌ Auto-login failed:', error);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuthState();
  }, []);

  const register = async (name: string, email: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const response = await electronApiService.register({
        name,
        email,
        password
      });
      
      if (!response) {
        throw new Error('No response from server');
      }

      const { user, access_token } = response;

      await Promise.all([
        electronApiService.setUser(user),
        electronApiService.setToken(access_token)
      ]);

      setUser(user);
      setToken(access_token);
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<User> => {
    // console.log('AuthProvider: Starting login...');
    setLoading(true);
    
    // Detect mobile browser and handle gracefully - use consistent detection
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    
    if (!isElectron) {
      // console.log('📱 [AuthProvider] Mobile browser login - using test user');
      
      // For mobile browsers, create a simple test user without backend validation
      const mobileUser: User = {
        id: 1,
        email: email || 'mobile@test.com',
        name: 'Mobile User',
        role: 'USER',
        created_at: new Date(),
        updated_at: new Date()
      };
      
             // Store user locally
       localStorage.setItem('user', JSON.stringify(mobileUser));
       localStorage.setItem('token', 'mobile-test-token');
       
       setUser(mobileUser);
       setToken('mobile-test-token');
       setLoading(false);
      
      // console.log('📱 [AuthProvider] Mobile login successful:', mobileUser);
      return mobileUser;
    }
    
    try {
      const response = await electronApiService.login({
        email,
        password
      });
      
      // console.log('AuthProvider: Login response:', response);
      
      if (!response?.data) {
        throw new Error('No response from server');
      }

      const { user, accessToken, refreshToken } = response.data;
      // console.log('AuthProvider: Setting user and tokens...');

      await Promise.all([
        electronApiService.setUser(user),
        electronApiService.setToken(accessToken),
        refreshToken ? electronApiService.setRefreshToken(refreshToken) : Promise.resolve()
      ]);

      // console.log('AuthProvider: Updating state...');
      setUser(user);
      setToken(accessToken);
      // console.log('AuthProvider: Login complete, returning user:', user);
      return user;
    } catch (error) {
      console.error('AuthProvider: Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setLoading(true);
    
    // Detect mobile browser and handle gracefully - use consistent detection
    const isElectron = typeof window !== 'undefined' && !!window.electron?.ipcRenderer;
    
    try {
      // console.log('Logout initiated');
      
      if (isElectron) {
        await electronApiService.logout();
      } else {
        // console.log('📱 [AuthProvider] Logout on mobile browser - clearing local state only');
      }
      
      // Clear local state (works for both environments)
      clearTracks();
      clearPlaylists();
      setUser(null);
      setToken(null);

      // console.log('Logout completed');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  }, [clearTracks, clearPlaylists]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    // console.log('Attempting to refresh token via Electron');
    const storedRefreshToken = await electronApiService.getRefreshToken();
    if (!storedRefreshToken) {
      // console.log('No refresh token available');
      await logout();
      return null;
    }
    
    try {
      const response = await electronApiService.refreshToken();
      if (!response?.data) {
        throw new Error('No response from refresh token endpoint');
      }

      const { accessToken, refreshToken } = response.data;

      await Promise.all([
        electronApiService.setToken(accessToken),
        refreshToken ? electronApiService.setRefreshToken(refreshToken) : Promise.resolve()
      ]);

      setToken(accessToken);
      return accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      await logout();
      return null;
    }
  }, [logout]);

  const isAuthenticated = useCallback(() => {
    return !!token && !!user;
  }, [token, user]);

  const updateUser = useCallback(async (updatedUser: User) => {
    setUser(updatedUser);
    await electronApiService.setUser(updatedUser);
  }, []);

  const updateToken = useCallback(async (newToken: string) => {
    setToken(newToken);
    await electronApiService.setToken(newToken);
  }, []);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        token, 
        loading, 
        login, 
        logout, 
        register,
        refreshToken,
        isAuthenticated,
        updateUser,
        setToken: updateToken,
        setUser,
        setLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};