import React, { useState, ReactElement, useCallback, useEffect } from "react";
import { handleResponse } from "@/services/apiService";
import { Track } from "../../types/types";
import { TracksContext } from "@/contexts/TracksContext";
import { backendUrl } from "@/services/apiService";
import { useAuth } from "@/hooks/UseAuth";

export const TracksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}): ReactElement | null => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(
    null
  );
  const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(
    null
  );
  const { token, refreshToken, setToken } = useAuth();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);

  useEffect(() => {
    console.log("useAuth token:", token);
    if (token) {
      fetchTracks();
    } else {
      console.error("No token available");
    }
  }, [token]);

  const fetchTrack = async (id: number): Promise<Track | undefined> => {
    if (!token) {
      console.log("No token available");
      throw new Error("No token available");
    }

    try {
      const response = await fetch(`${backendUrl}/tracks/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const track = await handleResponse<Track>(response);
      return track;
    } catch (error) {
      console.error("Error fetching track:", error);
      throw new Error("Failed to fetch track");
    }
  };

  const fetchTracks = useCallback(
    async (retryCount = 0): Promise<Track[]> => {
      if (!token) {
        console.error("No token available");
        return [];
      }
  
      console.log(
        `Attempting to fetch tracks with token (attempt ${retryCount + 1}):`,
        token
      );
  
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
  
      try {
        const response = await fetch(`${backendUrl}/tracks`, {
          headers: { Authorization: `Bearer ${token}` },
        });
  
        if (response.status === 401) {
          const errorBody = await response.text();
          console.error("401 Unauthorized. Response body:", errorBody);
  
          if (retryCount >= maxRetries) {
            console.error("Max retries reached. Unable to fetch tracks.");
            return [];
          }
  
          console.log("Token expired. Attempting to refresh...");
          const newToken = await refreshToken();
  
          if (newToken) {
            console.log("Token refreshed. Retrying fetch with new token...");
            setToken(newToken);
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            return fetchTracks(retryCount + 1);
          } else {
            console.error("Failed to refresh token");
            return [];
          }
        }
  
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
  
        const tracks = await handleResponse<Track[]>(response);
        console.log("Tracks fetched successfully:", tracks);
        setTracks(tracks);
        return tracks; // Return the fetched tracks
      } catch (error) {
        console.error("Error fetching tracks:", error);
        return []; // Return an empty array in case of error
      }
    },
    [token, refreshToken, setToken]
  );

  // const uploadTrack = async (formData: FormData) => {
  //   console.log("Preparing to upload file");

  //   // Log the contents of formData for debugging
  //   // Convert formData keys to an array and log them
  //   const formDataKeys = Array.from(formData.keys());
  //   for (const key of formDataKeys) {
  //     console.log(key, formData.get(key));
  //   }

  //   try {
  //     console.log("Sending upload request to server");
  //     const response = await fetch(`${backendUrl}/tracks/upload`, {
  //       method: 'POST',
  //       body: formData,
  //     });

  //     console.log("Received response from upload request", response);

  //     if (!response.ok) {
  //       console.error('Response status:', response.status);
  //       const errorData = await response.json();
  //       console.error('Response error data:', errorData);
  //       throw new Error(errorData.message || 'Error uploading track');
  //     }

  //     return await response.json();
  //   } catch (error: any) {
  //     console.error('Error uploading track:', error.message);
  //     throw error;
  //   }
  // };

  const uploadTrack = async (formData: FormData) => {
    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }

    try {
      const response = await fetch(`${backendUrl}/tracks/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      return await handleResponse(response);
    } catch (error) {
      console.error("Error uploading track:", error);
      throw error;
    }
  };

  const deleteTrack = async (id: number) => {
    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }
  
    try {
      const response = await fetch(`${backendUrl}/tracks/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete track');
      }
  
      const result = await response.json();
      console.log(result.message); // Log the success message
  
      setTracks((prevTracks) => prevTracks.filter((track) => track.id !== id));
      return result;
    } catch (error) {
      console.error(`Error deleting track with ID ${id}:`, error);
      throw error;
    }
  };

  // const updateTrackMetadata = async (trackId: number, updatedData: Partial<Track>) => {
  //   console.log('updateTrackMetadata received', updatedData);

  //   const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL as string;

  //   console.log("Final data being sent to backend:", { name: updatedData.name, artistName: updatedData.artist?.name, albumName: updatedData.album?.name });

  //     // Preparing the payload
  //     const payload = JSON.stringify({
  //       name: updatedData.name,
  //       artistName: updatedData.artistName,
  //       albumName: updatedData.albumName,
  //     });

  //     console.log("Sending payload:", payload);

  //     const response = await fetch(`${backendUrl}/tracks/${trackId}`, {
  //       method: 'PATCH',
  //       headers: {
  //         'Content-Type': 'application/json',
  //       },
  //       body: payload,
  //     });

  //   if (!response.ok) {
  //     const errorData = await response.json();
  //     console.error(`Error updating track ${trackId}:`, errorData.message || 'Unknown error');
  //     throw new Error(errorData.message || 'Error updating track');
  //   }

  //   const responseData = await response.json();
  //   console.log(`Track ${trackId} updated successfully:`, responseData);
  //   return responseData;
  // };

  const updateTrackMetadata = async (
    trackId: number,
    updatedData: Partial<Track>
  ) => {
    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }

    const payload = JSON.stringify({
      name: updatedData.name,
      artistName: updatedData.artistName,
      albumName: updatedData.albumName,
    });

    try {
      const response = await fetch(`${backendUrl}/tracks/${trackId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: payload,
      });

      const responseData = await handleResponse(response);
      setTracks((prevTracks) =>
        prevTracks.map((track) =>
          track.id === trackId ? { ...track, ...responseData } : track
        )
      );
      return responseData;
    } catch (error) {
      console.error(`Error updating track ${trackId}:`, error);
      throw error;
    }
  };

  const updateTrack = (trackId: number, field: keyof Track, value: string) => {
    setTracks((prevTracks) =>
      prevTracks.map((track) =>
        track.id === trackId ? { ...track, [field]: value } : track
      )
    );
  };

  const clearTracks = useCallback(() => {
    console.log('clearTracks called in TracksProvider');
    console.log('Tracks before clearing:', tracks);
    setTracks([]);
    console.log('Tracks after clearing:', tracks);
    // Any other track-related state that needs to be cleared
  }, []);

  useEffect(() => {
    if (!token) {
      clearTracks();
    }
  }, [token]);

  return (
    <TracksContext.Provider
      value={{
        tracks,
        setTracks,
        fetchTrack,
        updateTrack,
        updateTrackMetadata,
        deleteTrack,
        fetchTracks,
        uploadTrack,
        clearTracks,
        showDeleteModal,
        setShowDeleteModal,
        doNotAskAgain,
        setDoNotAskAgain,
      }}
    >
      {children}
    </TracksContext.Provider>
  );
};
