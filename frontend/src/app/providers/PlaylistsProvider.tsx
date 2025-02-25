"use client";

import React, { useState, ReactElement, useCallback, useEffect } from "react";
import { handleResponse } from "../services/apiService";
import { Playlist, Track } from "../../../../shared/types";
import { PlaylistsContext } from "../contexts/PlaylistsContext";
import { backendUrl } from "../services/apiService";
import { useAuth } from "../hooks/UseAuth";

export const PlaylistsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}): ReactElement | null => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { token, refreshToken, setToken } = useAuth();
  const [currentPlaylistId, setCurrentPlaylistId] = useState<number | null>(null);
  const [currentPlaylistTracks, setCurrentPlaylistTracks] = useState<Track[]>([]);

  useEffect(() => {
    if (token) {
      fetchPlaylists();
    } else {
      console.error("No token available");
    }
  }, [token]);

  const fetchPlaylists = useCallback(async () => {
    if (!token) {
      console.error("No token available");
      return;
    }

    try {
      const response = await fetch(`${backendUrl}/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const playlists = await handleResponse<Playlist[]>(response);
      setPlaylists(playlists);
    } catch (error) {
      console.error("Error fetching playlists:", error);
    }
  }, [token]);

  const fetchPlaylistById = useCallback(
    async (id: number): Promise<Playlist | undefined> => {
      if (!token) {
        console.error("No token available");
        return undefined;
      }

      try {
        const response = await fetch(`${backendUrl}/playlists/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 403) {
          console.error("Access forbidden: Check permissions");
          throw new Error("Forbidden resource");
        }

        const playlist = await handleResponse<Playlist>(response);

              // Convert TracksInPlaylist to tracks array
      if (playlist && playlist.TracksInPlaylist) {
        playlist.tracks = playlist.TracksInPlaylist.map(tip => ({
          ...tip.track,
          artist: tip.track.artist,
          album: tip.track.album,
        }));
        delete playlist.TracksInPlaylist;
      }

      console.log("Fetched playlist:", playlist);
        return playlist;
      } catch (error) {
        console.error(`Error fetching playlist with ID ${id}:`, error);
        return undefined;
      }
    },
    [token]
  );

  const createPlaylist = async (
    playlistData: Partial<Playlist>
  ): Promise<Playlist> => {
    console.log("Creating playlist with data:", playlistData);

    console.log("Backend URL:", `${backendUrl}/playlists`);
    console.log("Token (first 10 chars):", token.substring(0, 10));

    try {
      if (!playlistData.name || !playlistData.userId) {
        throw new Error("Name and userId are required to create a playlist");
      }

      const response = await fetch(`${backendUrl}/playlists`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(playlistData),
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)
      );

      const responseText = await response.text();
      console.log("Raw response:", responseText);

      if (!response.ok) {
        console.error("Error response:", responseText);
        throw new Error(
          `Server responded with ${response.status}: ${responseText}`
        );
      }

      if (!responseText) {
        throw new Error("Empty response from server");
      }

      let newPlaylist: Playlist;
      try {
        newPlaylist = JSON.parse(responseText);
      } catch (e) {
        console.error("Error parsing response:", e);
        throw new Error("Invalid response from server");
      }

      console.log(
        "Parsed new playlist from server:",
        JSON.stringify(newPlaylist, null, 2)
      );

      setPlaylists((prev) => [...prev, newPlaylist]);

      return newPlaylist;
    } catch (error) {
      console.error("Error in createPlaylist:", error);
      throw error;
    }
  };

  const deletePlaylist = async (id: number): Promise<void> => {
    if (!token) {
      throw new Error("No token available");
    }
  
    try {
      const response = await fetch(`${backendUrl}/playlists/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
  
      await handleResponse(response);
  
      setPlaylists((prev) => prev.filter((playlist) => playlist.id !== id));
      setCurrentPlaylistId(null);
      setCurrentPlaylistTracks([]);
  
      // No need to return anything as the function is typed to return void
    } catch (error) {
      console.error(`Error deleting playlist with ID ${id}:`, error);
  
      if (error instanceof Error) {
        throw new Error(`Failed to delete playlist: ${error.message}`);
      } else {
        throw new Error('An unknown error occurred while deleting the playlist');
      }
    }
  };

  const addTrackToPlaylist = async (playlistId: number, trackId: number, force: boolean = false) => {
    if (!token) {
      throw new Error("No token available");
    }
  
    try {
      console.log(`Attempting to add track ${trackId} to playlist ${playlistId}`);
      const response = await fetch(
        `${backendUrl}/playlists/${playlistId}/tracks/${trackId}${force ? '?force=true' : ''}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      const result = await handleResponse(response);
      
      if (result.status === 'DUPLICATE' && !force) {
        return result; // This will trigger the modal in the frontend
      }
  
      console.log("Add track to playlist result:", result);
  
      const updatedPlaylist = await fetchPlaylistById(playlistId);
      if (updatedPlaylist) {
        setPlaylists((prev) =>
          prev.map((playlist) =>
            playlist.id === playlistId ? updatedPlaylist : playlist
          )
        );
      }
  
      return updatedPlaylist;
    } catch (error) {
      console.error(`Error adding track ${trackId} to playlist ${playlistId}:`, error);
      throw error;
    }
  };

  const removeTrackFromPlaylist = async (
    playlistId: number,
    trackId: number
  ) => {
    if (!token) {
      throw new Error("No token available");
    }

    try {
      const response = await fetch(
        `${backendUrl}/playlists/${playlistId}/tracks/${trackId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await handleResponse(response);

      const updatedPlaylist = await fetchPlaylistById(playlistId);
      if (updatedPlaylist) {
        setPlaylists((prev) =>
          prev.map((playlist) =>
            playlist.id === playlistId ? updatedPlaylist : playlist
          )
        );
  
        // If this is the currently selected playlist, update its tracks
        if (currentPlaylistId === playlistId && updatedPlaylist.tracks) {
          setCurrentPlaylistTracks(updatedPlaylist.tracks);
        }
      }
    } catch (error) {
      console.error(
        `Error removing track from playlist with ID ${playlistId}:`,
        error
      );
      throw error;
    } 
  };

  const clearPlaylists = useCallback(() => {
    setPlaylists([]);
  }, []);

  useEffect(() => {
    if (!token) {
      clearPlaylists();
    }
  }, [token, clearPlaylists]);

  const updatePlaylistMetadata = async (playlistId: number, updateData: any) => {
    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }
  
    try {
      console.log(`Updating playlist ${playlistId} with data:`, updateData);
      const response = await fetch(`${backendUrl}/playlists/${playlistId}/metadata`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const responseData = await response.json();
      console.log(`Response status: ${response.status}`, responseData);
  
      if (!response.ok) {
        throw new Error(Array.isArray(responseData.message) 
          ? responseData.message.join(', ') 
          : responseData.message || 'Failed to update playlist metadata');
      }
  
      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((playlist) =>
          playlist.id === playlistId ? { ...playlist, ...updateData } : playlist
        )
      );
  
      return responseData;
    } catch (error) {
      console.error(`Error updating playlist metadata ${playlistId}:`, error);
      throw error;
    }
  };
  
  const updatePlaylistOrder = async (playlistIds: number[]): Promise<Playlist[]> => {
    console.log('Sending reorder request with payload:', { playlistIds });

    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }
  
    try {
      const response = await fetch(`${backendUrl}/playlists/reorder`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ playlistIds }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Reorder request failed:', errorData);
        throw new Error(errorData.message || 'Failed to update playlist order');
      }
  
      const updatedPlaylists = await response.json();
      console.log('Reorder request successful:', updatedPlaylists);
      return updatedPlaylists;
    } catch (error) {
      console.error(`Error reordering playlists:`, error);
      throw error;
    }
  };

  const updatePlaylistTrackOrder = async (playlistId: number, trackIds: number[]): Promise<Playlist> => {
    if (!token) {
      console.error("No token available");
      throw new Error("No token available");
    }
  
    try {
      const response = await fetch(`${backendUrl}/playlists/${playlistId}/track-order`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackIds }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update track order');
      }
  
      const updatedPlaylist = await response.json();
      setPlaylists((prevPlaylists) =>
        prevPlaylists.map((playlist) =>
          playlist.id === playlistId ? updatedPlaylist : playlist
        )
      );
      return updatedPlaylist;
    } catch (error) {
      console.error(`Error updating track order for playlist ${playlistId}:`, error);
      throw error;
    }
  };

  return (
    <PlaylistsContext.Provider
      value={{
        playlists,
        setPlaylists,
        fetchPlaylists,
        fetchPlaylistById,
        createPlaylist,
        deletePlaylist,
        addTrackToPlaylist,
        removeTrackFromPlaylist,
        clearPlaylists,
        currentPlaylistId,
        setCurrentPlaylistId,
        currentPlaylistTracks,
        setCurrentPlaylistTracks,
        updatePlaylistMetadata,
        updatePlaylistOrder,
        updatePlaylistTrackOrder,
      }}
    >
      {children}
    </PlaylistsContext.Provider>
  );
};
