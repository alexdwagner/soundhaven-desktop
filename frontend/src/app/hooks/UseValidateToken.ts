import { useState, useCallback } from 'react';
import { apiService } from '@/services/electronApiService';
import { User } from '../../../../shared/types';

const validateTokenFromLocalStorage = async (): Promise<{ user: User; access_token: string }> => {
  const token = apiService.getToken();
  console.log('Validating token from localStorage');

  if (!token) {
    throw new Error('No token found in localStorage');
  }

  try {
    // Use the refresh token to get a new access token
    const response = await apiService.refreshToken(token);
    
    if (!response) {
      throw new Error('No response from token refresh');
    }

    console.log('Token validation successful');
    
    // Update the stored token with the new one
    apiService.setToken(response.access_token);
    if (response.refresh_token) {
      apiService.setRefreshToken(response.refresh_token);
    }
    
    // Get the user from localStorage or make an API call if needed
    const user = apiService.getStoredUser();
    if (!user) {
      throw new Error('User not found in storage');
    }
    
    return {
      user,
      access_token: response.access_token
    };
  } catch (error) {
    console.error('Error validating token:', error);
    // Clear invalid tokens
    apiService.setToken(null);
    apiService.setRefreshToken(null);
    throw error;
  }
};

export const useValidateToken = () => {
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [user, setUser] = useState<User | null>(null);

  const validate = useCallback(async () => {
    setIsValidating(true);
    setError(null);
    
    try {
      const { user, access_token } = await validateTokenFromLocalStorage();
      setUser(user);
      return { user, access_token };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Token validation failed');
      setError(error);
      throw error;
    } finally {
      setIsValidating(false);
    }
  }, []);

  return {
    validate,
    isValidating,
    error,
    user
  };
};

export default useValidateToken;
