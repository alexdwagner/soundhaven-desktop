"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Playlist, Track } from "../../../../../shared/types";
import { usePlaylists } from "../../providers/PlaylistsProvider";
import { useAuth } from "@/app/hooks/UseAuth";
import { useTracks } from "@/app/hooks/UseTracks";
import PlaylistItem from "./PlaylistItem";
import DuplicateTrackModal from "../modals/DuplicateTrackModal";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { apiService } from "../../../services/electronApiService";
import { useEnvironment } from "../../hooks/useEnvironment";

interface PlaylistSidebarProps {
  onSelectPlaylist: (tracks: Track[], playlistId: string, playlistName?: string) => void;
  onViewAllTracks: () => void;
  onDeletePlaylist: (playlistId: string) => void;
  onRegisterDragHandler?: (handler: (event: any) => void) => void;
  keyPrefix?: string; // Add optional key prefix to ensure uniqueness
}

const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  onSelectPlaylist,
  onViewAllTracks,
  onDeletePlaylist,
  onRegisterDragHandler,
  keyPrefix = "",
}) => {
  const { playlists, createPlaylist, deletePlaylist, fetchPlaylists, fetchPlaylistById, updatePlaylistOrder, setPlaylists, loading, error: playlistError, setCurrentPlaylistId, setCurrentPlaylistTracks } = usePlaylists();
  const { user, token } = useAuth();
  const { isMobile } = useEnvironment();
  
  // Log only once on mount and when error state changes
  useEffect(() => {
    console.log("🔍 PlaylistSidebar: Component mounted/updated");
    console.log("🔍 PlaylistSidebar: Token from useAuth:", !!token);
    console.log("🔍 PlaylistSidebar: User from useAuth:", user ? user.email : 'null');
    console.log("🔍 PlaylistSidebar: Playlists count:", playlists?.length || 0);
    console.log("🔍 PlaylistSidebar: Loading state:", loading);
    console.log("🔍 PlaylistSidebar: Error state:", playlistError);
    
    if (playlists && playlists.length > 0) {
      console.log("🔍 PlaylistSidebar: First playlist:", playlists[0]);
    }
  }, [playlistError, loading]); // Only log when error or loading state changes
  
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const libraryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.log("🔍 PlaylistSidebar: useEffect triggered");
    console.log("🔍 PlaylistSidebar: fetchPlaylists function:", typeof fetchPlaylists);
    console.log("🔍 PlaylistSidebar: About to call fetchPlaylists (local-first, no token required)");
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Additional effect to monitor playlists changes
  useEffect(() => {
    console.log("🔍 PlaylistSidebar: Playlists changed:", playlists?.length || 0, "playlists");
    if (playlists && playlists.length > 0) {
      console.log("🔍 PlaylistSidebar: Playlist names:", playlists.map(p => p.name));
    }
  }, [playlists]);

  const handleCreatePlaylist = async () => {
    console.log("🎯 Add Playlist button clicked!");
    console.log("🎯 User:", user);
    console.log("🎯 Token:", token);
    console.log("🎯 Playlists count:", playlists.length);
    
    try {
      // For local-first app, we don't require authentication
      console.log("🎯 Calling createPlaylist...");
      const newPlaylist = await createPlaylist(`New Playlist ${playlists.length + 1}`, "A new playlist");
      console.log("🎯 CreatePlaylist result:", newPlaylist);
      
      if (newPlaylist) {
        console.log("✅ Playlist created successfully:", newPlaylist);
        // The createPlaylist method in PlaylistsProvider already updates the state
        // so we don't need to manually setPlaylists here
      } else {
        console.error("❌ CreatePlaylist returned null");
        setError("Failed to create playlist - no result returned");
      }
    } catch (error) {
      console.error("❌ Error creating playlist:", error);
      setError(error instanceof Error ? error.message : "Failed to create playlist");
    }
  };

  const handlePlaylistSelect = useCallback(async (playlistId: string) => {
    console.log(`📓 [PLAYLIST SIDEBAR] handlePlaylistSelect called with playlistId: ${playlistId}`);
    
    try {
      const playlist = await fetchPlaylistById(playlistId);
      console.log(`📓 [PLAYLIST SIDEBAR] fetchPlaylistById result:`, playlist);
      
      if (playlist?.tracks) {
        console.log(`📓 [PLAYLIST SIDEBAR] Setting currentPlaylistId to: ${playlistId}`);
        console.log(`📓 [PLAYLIST SIDEBAR] Setting currentPlaylistTracks to: ${playlist.tracks.length} tracks`);
        
        // Update the PlaylistsProvider context
        setCurrentPlaylistId(playlistId);
        setCurrentPlaylistTracks(playlist.tracks);
        
        // Update the MainContent state (for props)
        onSelectPlaylist(playlist.tracks, playlistId, playlist.name);
        setSelectedPlaylistId(playlistId);
        
        console.log(`📓 [PLAYLIST SIDEBAR] ✅ Playlist selection complete`);
      } else {
        console.log(`📓 [PLAYLIST SIDEBAR] ❌ No tracks found in playlist`);
        setError("Failed to load playlist tracks");
      }
    } catch (error) {
      console.error("📓 [PLAYLIST SIDEBAR] ❌ Error fetching playlist:", error);
      setError("Failed to load playlist");
    }
  }, [fetchPlaylistById, setCurrentPlaylistId, setCurrentPlaylistTracks, onSelectPlaylist]);

  const handleDeletePlaylist = useCallback(async (playlistId: string) => {
    try {
      await deletePlaylist(playlistId);
      setSelectedPlaylistId(null);
      
      // Clear the PlaylistsProvider context if this was the selected playlist
      if (selectedPlaylistId === playlistId) {
        setCurrentPlaylistId(null);
        setCurrentPlaylistTracks([]);
      }
      
      onDeletePlaylist(playlistId);
      libraryButtonRef.current?.focus();
    } catch (error) {
      console.error("Error deleting playlist:", error);
      setError("Failed to delete playlist");
    }
  }, [deletePlaylist, selectedPlaylistId, setCurrentPlaylistId, setCurrentPlaylistTracks, onDeletePlaylist]);

  const handleViewAllTracks = useCallback(() => {
    console.log(`📓 [PLAYLIST SIDEBAR] handleViewAllTracks called - clearing playlist selection`);
    
    // Clear the PlaylistsProvider context
    setCurrentPlaylistId(null);
    setCurrentPlaylistTracks([]);
    
    // Clear the MainContent state
    onViewAllTracks();
    setSelectedPlaylistId(null);
    
    console.log(`📓 [PLAYLIST SIDEBAR] ✅ View all tracks complete`);
  }, [setCurrentPlaylistId, setCurrentPlaylistTracks, onViewAllTracks]);

  const handleDragEnd = useCallback((event: any) => {
    if (!event) {
      console.warn('🔄 [PLAYLIST SORT] Drag ended with null event - ignoring');
      return;
    }
    
    const { active, over } = event;
    console.log('🔄 [PLAYLIST SORT] Drag ended:', { activeId: active.id, overId: over?.id });
    
    if (active.id !== over?.id && over) {
      const oldIndex = playlists.findIndex((p) => p.id === active.id);
      const newIndex = playlists.findIndex((p) => p.id === over.id);
      console.log('🔄 [PLAYLIST SORT] Moving playlist from index', oldIndex, 'to', newIndex);
      
      const reorderedPlaylists = arrayMove(playlists, oldIndex, newIndex);
      console.log('🔄 [PLAYLIST SORT] New order:', reorderedPlaylists.map(p => p.name));
      
      setPlaylists(reorderedPlaylists);
      updatePlaylistOrder(reorderedPlaylists.map((p) => p.id));
    }
  }, [playlists, setPlaylists, updatePlaylistOrder]);

  // Register the drag handler with MainContent
  useEffect(() => {
    if (onRegisterDragHandler) {
      console.log('🔧 [PLAYLIST SIDEBAR] Registering drag handler with MainContent');
      onRegisterDragHandler(handleDragEnd);
    }
  }, [onRegisterDragHandler, handleDragEnd]);

  console.log("🔍 PlaylistSidebar: About to render component");

  // Error state handling
  if (playlistError) {
    return (
      <div className="playlist-sidebar bg-gray-800 text-gray-100 p-2 h-full min-w-48">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-sm mb-2" onClick={handleCreatePlaylist}>
          + Add Playlist
        </button>
        <button ref={libraryButtonRef} className="w-full hover:bg-gray-700 text-gray-100 font-medium py-1 px-2 rounded text-sm mb-2 text-left transition-colors bg-gray-900" onClick={handleViewAllTracks}>
          {user ? `${user.name}'s Library` : "My Library"}
        </button>
        <div className="bg-red-900/20 border border-red-700 rounded p-3 mt-2">
          <p className="text-red-400 text-sm font-medium">Failed to load playlists</p>
          <p className="text-red-300 text-xs mt-1">{playlistError}</p>
          <button 
            className="text-xs text-red-400 underline mt-2 hover:text-red-300"
            onClick={() => {
              console.log("🔍 PlaylistSidebar: Retrying playlist fetch...");
              fetchPlaylists();
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading && playlists.length === 0) {
    return (
      <div className="playlist-sidebar bg-gray-800 text-gray-100 p-2 h-full min-w-48">
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-sm mb-2" onClick={handleCreatePlaylist}>
          + Add Playlist
        </button>
        <button ref={libraryButtonRef} className="w-full hover:bg-gray-700 text-gray-100 font-medium py-1 px-2 rounded text-sm mb-2 text-left transition-colors bg-gray-900" onClick={handleViewAllTracks}>
          {user ? `${user.name}'s Library` : "My Library"}
        </button>
        <div className="flex items-center justify-center p-4">
          <p className="text-gray-400 text-sm">Loading playlists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-sidebar bg-gray-800 text-gray-100 p-2 h-full min-w-48">

        
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-1 px-2 rounded text-sm mb-2" onClick={handleCreatePlaylist}>
          + Add Playlist
        </button>
        <button ref={libraryButtonRef} className="w-full hover:bg-gray-700 text-gray-100 font-medium py-1 px-2 rounded text-sm mb-2 text-left transition-colors bg-gray-900" onClick={handleViewAllTracks}>
          {user ? `${user.name}'s Library` : "My Library"}
        </button>

        <h3 className="font-medium text-xs uppercase text-gray-400 border-b border-gray-600 pb-1 mb-2">Playlists</h3>

        {/* Empty state */}
        {playlists.length === 0 && !loading && !playlistError && (
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm mb-2">No playlists yet</p>
            <p className="text-gray-500 text-xs">Click "Add Playlist" to create one</p>
          </div>
        )}

        {/* Playlist list */}
        {playlists.length > 0 && !isMobile ? (
          // Desktop: Enable drag and drop
          <DndContext onDragEnd={handleDragEnd}>
            <SortableContext items={playlists.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <ul className="px-1">
                {playlists.map((playlist) => (
                  <PlaylistItem 
                    key={`${keyPrefix}${playlist.id}`} 
                    playlist={playlist} 
                    onSelect={() => handlePlaylistSelect(playlist.id)} 
                    isSelected={playlist.id === selectedPlaylistId} 
                    onDelete={() => handleDeletePlaylist(playlist.id)}
                    isDragDisabled={false}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : playlists.length > 0 ? (
          // Mobile: Disable drag and drop
          <ul className="px-1">
            {playlists.map((playlist) => (
              <PlaylistItem 
                key={`${keyPrefix}${playlist.id}`} 
                playlist={playlist} 
                onSelect={() => handlePlaylistSelect(playlist.id)} 
                isSelected={playlist.id === selectedPlaylistId} 
                onDelete={() => handleDeletePlaylist(playlist.id)}
                isDragDisabled={true}
              />
            ))}
          </ul>
        ) : null}
      </div>
  );
};

export default React.memo(PlaylistSidebar);
