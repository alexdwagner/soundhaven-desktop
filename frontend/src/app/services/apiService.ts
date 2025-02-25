import { Track, Album, Artist, User, ErrorResponse } from '../../types/types';
import { useTracks } from '@/hooks/UseTracks';
import { useAuth } from '@/hooks/UseAuth';

if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  console.log('NEXT_PUBLIC_BACKEND_URL is undefined in apiService.ts');
  throw new Error("Backend URL is not defined in .env.local");
}

export const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  export const handleResponse = async <T = any>(response: Response): Promise<T> => {
    if (!response.ok) {
      const clonedResponse = response.clone();
      try {
        let errorData: ErrorResponse;
        const contentType = response.headers.get('content-type');

        if (contentType?.includes('application/json')) {
          errorData = await response.json();
          if (response.status === 400 && errorData.errors) {
            const validationErrors = Object.values(errorData.errors).join(', ');
            throw new Error(`Validation error: ${validationErrors}`);
          }
        } else {
          errorData = { message: await clonedResponse.text() };
        }

        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        const errorMessage = errorData.message || 'Unknown error occurred';
        throw new Error(`Error ${response.status}: ${errorMessage}`);
      } catch (error) {
        console.error('Error parsing response:', error);
        throw new Error(`Error parsing server response: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return response.json() as Promise<T>;
  };

export const register = async (data: { name?: string; email: string; password: string }) => {
  const { name, email, password } = data;
  try {
    const response = await fetch(`${backendUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    return await handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error during registration:', error.message);
    } else {
      console.error('Unknown error occurred during registration');
    }
    throw error;
  }
};


export const getToken = () => {
  // Retrieve the JWT token from localStorage
  const token = localStorage.getItem('token');
  return token || '';  // Return the token, or an empty string if it's not found
};

export const login = async (email: string, password: string) => {
  console.log("Login request data:", { email, password });

  try {
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Efficiently handle and display backend validation or error messages
      const errorData = await response.json();
      const errorMessage = errorData.message || 'An error occurred during login.';
      console.error('Login error:', errorMessage);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log("Login response data:", data);

    if (!data || !data.access_token || !data.user) {
      console.error('Login response missing token or user data:', data);
      throw new Error('Incomplete login response from server.');
    }

    // Store token and user data for global application use
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    console.log('Login successful, token and user data stored.');

    // Return user and token data for immediate use in the application if needed
    return { user: data.user, access_token: data.access_token };
  } catch (error) {
    console.error('Error during login process:', error.message);
    // Clear potentially invalid or outdated data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    throw error; // Re-throw the error to be handled by the caller (e.g., login form)
  }
};


export const logoutAPI = async (accessToken: string, refreshToken: string) => {
  try {
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error during logout API call:', error);
    throw error;
  }
};

export const deleteAccount = async (userId: number) => {
  const token = getToken();
  try {
    const response = await fetch(`${backendUrl}/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`, // Include the JWT token here
      },
    });
    return await handleResponse(response);
  } catch (error: any) {
    console.error(`Error deleting account for user ID ${userId}:`, error.message);
    throw error;
  }
};

// Move these functions into providers

// Artists and albums functionality
export const fetchArtists = async (): Promise<Artist[]> => {
  const response = await fetch(`${backendUrl}/artists`);
  return handleResponse(response);
};

export const fetchAlbums = async (): Promise<Album[]> => {
  const response = await fetch(`${backendUrl}/albums`);
  return handleResponse(response);
};

export const createArtist = async (artistData: Partial<Artist>): Promise<Artist> => {
  const response = await fetch(`${backendUrl}/artists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(artistData),
  });
  return handleResponse(response);
};

export const createAlbum = async (albumData: Partial<Album>): Promise<Album> => {
  const response = await fetch(`${backendUrl}/albums`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(albumData),
  });
  return handleResponse(response);
};

// In apiService.js or wherever you manage your API calls

export const createMarker = async (markerData) => {
  try {
    const response = await fetch(`${backendUrl}/markers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`, // Assuming you're using JWT for auth
      },
      body: JSON.stringify(markerData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating marker:', error);
    throw error;
  }
};

export const fetchMarkersByTrackId = async (trackId) => {
  try {
    const response = await fetch(`${backendUrl}/markers?trackId=${trackId}`, {
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error fetching markers:', error);
    throw error;
  }
};

export const deleteMarker = async (markerId) => {
  try {
    const response = await fetch(`${backendUrl}/markers/${markerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getToken()}`,
      },
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error deleting marker:', error);
    throw error;
  }
};
