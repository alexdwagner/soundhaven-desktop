"use client";

import React, { useState, ReactNode, FC, useEffect, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { User } from '../../../../shared/types';
import { backendUrl, handleResponse, logoutAPI } from '../services/apiService';
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

  useEffect(() => {
    const initializeAuthState = async () => {
      const storedUser = localStorage.getItem('user');
      const storedToken = localStorage.getItem('token');

      console.log('Initializing auth state');
      console.log('Stored user:', storedUser);
      console.log('Stored token:', storedToken);
      
      if (storedUser && storedToken) {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
      } else {
        console.log('No stored user or token found');
      }
      setLoading(false);
    };
  
    initializeAuthState();
  }, []);  

  const register = async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await handleResponse(response);
      if (data && data.user && data.access_token) {
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.access_token);
        await Promise.all([
          setUser(data.user),
          setToken(data.access_token)
        ]);
      } else {
        throw new Error('Registration failed: No data received from register service');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setLoading(false); 
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    // Create error state or error context
    // setError(null);

    try {
      console.log('Attempting login');

      const response = await fetch(`${backendUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await handleResponse(response);

      console.log('Login response received:', data);

      if (!data || !data.access_token || !data.user) {
        throw new Error('Invalid response from server');
      }
  
      console.log('Login successful, storing data');
  
      // Store data in localStorage
      localStorage.setItem('user', JSON.stringify(data.user));
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
  
      // Update state
      await Promise.all([
        setUser(data.user),
        setToken(data.access_token)
      ]);
  
      console.log('Login process completed');
  
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      // You might want to set some error state here
      // setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(async () => {
    setLoading(true);
    const accessToken = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refreshToken');
    
    console.log('Logout initiated');
    console.log('AccessToken:', accessToken);
    console.log('RefreshToken:', refreshToken);

    try {
      if (accessToken && refreshToken) {
        await logoutAPI(accessToken, refreshToken);
        console.log('API logout successful');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');

      console.log('LocalStorage after removal:', {
        user: localStorage.getItem('user'),
        token: localStorage.getItem('token'),
        refreshToken: localStorage.getItem('refreshToken'),
      });

      // Clear tracks before clearing user and token
      clearTracks();
      clearPlaylists();

      console.log("Tracks cleared");

      setUser(null);
      setToken(null);
      console.log("User and tracks cleared in AuthProvider");

      setLoading(false);

      console.log('State after logout:', {
        user: null,
        token: null,
        tracks: [],
      });
    }
  }, [clearTracks]);

  const refreshToken = useCallback(async (): Promise<string | null> => {
    console.log('Attempting to refresh token');

    const storedRefreshToken = localStorage.getItem('refreshToken');
    console.log('Stored refresh token:', storedRefreshToken);

    if (!storedRefreshToken) {
      console.error('No refresh token available');
      return null;
    }

    // Check if current token is expired
    const currentToken = localStorage.getItem('token');
    if (currentToken) {
      const decodedToken = JSON.parse(atob(currentToken.split('.')[1]));
      if (decodedToken.exp * 1000 > Date.now()) {
        return currentToken; // Current token is still valid
      }
    }
  
    try {
      console.log('Sending refresh token request');

      const response = await fetch(`${backendUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: storedRefreshToken }),
      });
      const data = await handleResponse(response);
      console.log('Refresh token response:', data);

      if (data && data.access_token) {
        console.log('New token received, updating storage and state');
        localStorage.setItem('token', data.access_token);
        setToken(data.access_token);
        return data.access_token;
      } else {
        throw new Error('Token refresh failed: No new token received');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      return null;
    }
  }, [logout]);

  const isAuthenticated = useCallback(() => {
    return !!token && !!user;
  }, [token, user]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  }, []);

  const updateToken = useCallback((newToken: string) => {
    setToken(newToken);
    localStorage.setItem('token', newToken);
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
      }}>
      {children}
    </AuthContext.Provider>
  );
};
