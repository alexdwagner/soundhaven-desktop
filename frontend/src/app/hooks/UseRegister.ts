// src/hooks/useRegister.ts
import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

interface RegisterUserData {
  name: string;
  email: string;
  password: string;
}

export const useRegister = () => {
  const context = useContext(AuthContext);

  // Check if context is null and throw an error
  if (!context) {
    throw new Error('useRegister must be used within an AuthProvider');
  }

  const performRegistration = async (userData: RegisterUserData) => {
    try {
      // Pass arguments separately
      await context.register(userData.name, userData.email, userData.password);
      // Handle any post-registration logic if necessary
    } catch (error) {
      // Handle registration errors
      if (error instanceof Error) {
        console.error('Registration error:', error.message);
        throw error;
      }
    }
  };

  return { register: performRegistration };
};
