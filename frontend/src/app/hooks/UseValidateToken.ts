import { useEffect, useState } from 'react';
import { validateToken } from '@/services/apiService';

// Assuming validateTokenFromLocalStorage is either imported here or defined within this file
const validateTokenFromLocalStorage = async () => {
  const token = localStorage.getItem('token');
  console.log("Retrieving token from localStorage for validation:", token);

  if (!token) {
    throw new Error('No token found in localStorage');
  }

  try {
    // Directly use validateToken function with the retrieved token
    const response = await validateToken(token);
    console.log("Response from validateToken with localStorage token:", response);
    return response;
  } catch (error) {
    console.error('Error validating token retrieved from localStorage:', error);
    throw error;
  }
};

export default function useValidateToken() {
  console.log("useValidateToken hook executing"); // Log when the hook is executing

  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    validateTokenFromLocalStorage()
      .then(() => {
        console.log("Token is valid"); // Log if the token validation is successful
        setIsValid(true);
      })
      .catch(() => {
        console.log("Token validation failed"); // Log if the token validation fails
        setIsValid(false);
      });
  }, []); 
  return isValid;
}
