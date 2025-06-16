"use client";

import React, { useState, ReactNode, FC, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { User } from '../../../../shared/types';

interface LoginResponse {
  user: User;
  access_token: string;
  refresh_token?: string;
}

interface RefreshTokenResponse {
  access_token: string;
  refresh_token?: string;
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

  // Initialize auth state from Electron secure storage
  useEffect(() => {
    const initializeAuthState = async () => {
      try {
        const [storedUser, storedToken] = await Promise.all([
          electronApiService.getStoredUser(),
          electronApiService.getToken()
        ]);

        console.log('Initializing auth state from secure storage', {
          storedUser,
          storedToken
        });

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
    setLoading(true);
    try {
      const response = await electronApiService.login({
        email,
        password
      });
      
      if (!response) {
        throw new Error('No response from server');
      }

      const { user, access_token, refresh_token } = response as LoginResponse;

      await Promise.all([
        electronApiService.setUser(user),
        electronApiService.setToken(access_token),
        refresh_token ? electronApiService.setRefreshToken(refresh_token) : Promise.resolve()
      ]);

      setUser(user);
      setToken(access_token);
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Logout initiated');
      
      await electronApiService.logout();
      
      // Clear local state
      clearTracks();
      clearPlaylists();
      setUser(null);
      setToken(null);

      console.log('Logout completed');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  }, [clearTracks, clearPlaylists]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    console.log('Attempting to refresh token via Electron');
    const storedRefreshToken = await electronApiService.getRefreshToken();
    if (!storedRefreshToken) {
      console.log('No refresh token available');
      await logout();
      return null;
    }
    
    try {
      const response = await electronApiService.refreshToken(storedRefreshToken);
      if (!response) {
        throw new Error('No response from refresh token endpoint');
      }

      const { access_token, refresh_token } = response as RefreshTokenResponse;

      await Promise.all([
        electronApiService.setToken(access_token),
        refresh_token ? electronApiService.setRefreshToken(refresh_token) : Promise.resolve()
      ]);

      setToken(access_token);
      return access_token;
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