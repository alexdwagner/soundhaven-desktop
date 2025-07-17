"use client";

import { useState } from "react";
import { DndContext, closestCenter, PointerSensor, MouseSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import PlaylistSidebar from "../playlists/PlaylistSidebar";
import TracksManager from "../tracks/TracksManager";
import TrackItem from "../tracks/TrackItem";
import { Track } from "../../../../../shared/types";
import { usePlaylists } from "@/app/providers/PlaylistsProvider";
import { useTracks } from "@/app/providers/TracksProvider";
import { useColumnVisibility } from '@/app/hooks/useColumnVisibility';

export default function MainContent() {
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [dragTrackCount, setDragTrackCount] = useState(1);
  const [tracksManagerReorderHandler, setTracksManagerReorderHandler] = useState<((startIndex: number, endIndex: number) => void) | null>(null);
  const [isSuccessfulDrop, setIsSuccessfulDrop] = useState(false);
  
  // Debug handler registration
  const handleRegisterReorderHandler = (handler: (startIndex: number, endIndex: number) => void) => {
    console.log('🔧 [MAIN CONTENT] Registering reorder handler:', typeof handler);
    setTracksManagerReorderHandler(() => handler);
  };
  
  // Use playlists provider for cross-playlist operations and track reordering
  const { addTracksToPlaylist, updatePlaylistTrackOrder, currentPlaylistTracks, currentPlaylistId } = usePlaylists();
  
  // Use tracks provider to get all tracks for drag preview
  const { tracks: allTracks } = useTracks();
  
  // Column visibility for the drag preview
  const { columnVisibility } = useColumnVisibility();

  // Configure sensors for drag and drop with more lenient settings
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced from 15px to 3px for easier drag start
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3, // Also add mouse sensor as fallback
      },
    })
  );

  const handleSelectPlaylist = (tracks: Track[], playlistId: string, playlistName?: string) => {
    console.log("📋 Playlist selected:", { playlistId, playlistName, tracksCount: tracks.length });
    setSelectedPlaylistTracks(tracks);
    setSelectedPlaylistId(playlistId);
    setSelectedPlaylistName(playlistName || 'Unknown Playlist');
  };

  const handleViewAllTracks = () => {
    console.log("📚 View all tracks selected");
    setSelectedPlaylistTracks([]);
    setSelectedPlaylistId(null);
    setSelectedPlaylistName(null);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    console.log("🗑️ Playlist deleted:", playlistId);
    // If the deleted playlist was selected, go back to all tracks
    if (selectedPlaylistId === playlistId) {
      handleViewAllTracks();
    }
  };

  // Global drag start handler
  const handleDragStart = (event: any) => {
    setIsDragging(true);
    const activeData = event.active.data.current;
    
    console.log('🌍 [GLOBAL DND] *** DRAG STARTED ***', { 
      activeId: event.active.id, 
      activeData: activeData,
      activeType: activeData?.type 
    });

    // Find the track being dragged for the preview
    if (activeData?.type === 'track') {
      // Find the track from the appropriate source (playlist tracks or all tracks)
      const tracks = selectedPlaylistId ? currentPlaylistTracks : allTracks;
      const track = tracks.find(t => 
        (t.playlist_track_id || t.id) === event.active.id
      );
      
      if (track) {
        setActiveTrack(track);
        // Set the count of tracks being dragged
        const selectedCount = activeData.selectedTrackIds?.length || 1;
        setDragTrackCount(selectedCount);
        console.log('🌍 [GLOBAL DND] Setting active track for preview:', track.name, 'count:', selectedCount);
      }
    }
  };

  // Global drag end handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    // Check if this was a successful drop (has a valid target)
    const wasSuccessfulDrop = !!over;
    
    if (wasSuccessfulDrop) {
      // Mark as successful drop to trigger fade-out animation
      setIsSuccessfulDrop(true);
      
      // Clean up after animation
      setTimeout(() => {
        setIsDragging(false);
        setActiveTrack(null);
        setDragTrackCount(1);
        setIsSuccessfulDrop(false);
      }, 200); // Short delay for fade-out animation
    } else {
      // No valid drop target, clean up immediately
      setIsDragging(false);
      setActiveTrack(null);
      setDragTrackCount(1);
      setIsSuccessfulDrop(false);
    }
    console.log('🌍 [GLOBAL DND] *** DRAG ENDED ***', { 
      activeId: active.id, 
      overId: over?.id, 
      activeData: active.data.current,
      overData: over?.data.current,
      activeType: active.data.current?.type,
      overType: over?.data.current?.type
    });

    if (!over) {
      console.log('🌍 [GLOBAL DND] No drop target');
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    console.log('🌍 [GLOBAL DND] Detailed drag analysis:', {
      activeType: activeData?.type,
      overType: overData?.type,
      isTrackToTrack: activeData?.type === 'track' && overData?.type === 'track',
      isTrackToPlaylist: activeData?.type === 'track' && overData?.type === 'playlist',
      isPlaylistToPlaylist: activeData?.type === 'playlist' && overData?.type === 'playlist'
    });

    // Case 1: Track dropped on another track (playlist reordering)
    if (activeData?.type === 'track' && overData?.type === 'track') {
      console.log('🌍 [GLOBAL DND] Track-to-track drag detected (playlist reordering)');
      
      // Only allow reordering within the same playlist
      if (!activeData.isPlaylistView || !currentPlaylistId) {
        console.log('🌍 [GLOBAL DND] Reordering only supported in playlist view');
        return;
      }
      
      // Find the indices using the current playlist tracks
      const tracks = currentPlaylistTracks;
      const activeId = active.id;
      const overId = over.id;
      
      const oldIndex = tracks.findIndex((track) => (track.playlist_track_id || track.id) === activeId);
      const newIndex = tracks.findIndex((track) => (track.playlist_track_id || track.id) === overId);
      
      console.log('🌍 [GLOBAL DND] Track reorder indices:', { activeId, overId, oldIndex, newIndex });
      
      if (oldIndex === -1 || newIndex === -1) {
        console.error('🌍 [GLOBAL DND] Invalid track indices for reordering');
        return;
      }
      
      if (oldIndex === newIndex) {
        console.log('🌍 [GLOBAL DND] No movement needed');
        return;
      }
      
      // Call the reordering callback instead of handling directly
      if (tracksManagerReorderHandler && typeof tracksManagerReorderHandler === 'function') {
        console.log('🌍 [GLOBAL DND] Calling TracksManager reorder handler:', { oldIndex, newIndex });
        // Defer the call to avoid state updates during render
        setTimeout(() => {
          if (tracksManagerReorderHandler && typeof tracksManagerReorderHandler === 'function') {
            tracksManagerReorderHandler(oldIndex, newIndex);
          }
        }, 0);
      } else {
        console.warn('🌍 [GLOBAL DND] No TracksManager reorder handler registered or not a function:', typeof tracksManagerReorderHandler);
      }
      return;
    }

    // Case 2: Track dropped on playlist (cross-playlist operation)
    if (activeData?.type === 'track' && overData?.type === 'playlist') {
      console.log('🌍 [GLOBAL DND] Track-to-playlist drag detected (cross-playlist)');
      console.log('🌍 [GLOBAL DND] Track data:', activeData);
      console.log('🌍 [GLOBAL DND] Playlist data:', overData);
      
      // Handle cross-playlist operation
      handleCrossPlaylistDrag(activeData, overData);
      return;
    }

    // Case 3: Playlist dropped on playlist (playlist reordering)
    if (activeData?.type === 'playlist' && overData?.type === 'playlist') {
      console.log('🌍 [GLOBAL DND] Playlist-to-playlist drag detected (playlist reordering)');
      // This will be handled by PlaylistSidebar logic
      return;
    }

    console.log('🌍 [GLOBAL DND] Unhandled drag type');
  };

  // Handle cross-playlist drag operations
  const handleCrossPlaylistDrag = async (trackData: any, playlistData: any) => {
    console.log('🎯 [CROSS PLAYLIST] Handling cross-playlist drag');
    console.log('🎯 [CROSS PLAYLIST] Track data:', trackData);
    console.log('🎯 [CROSS PLAYLIST] Playlist data:', playlistData);
    
    try {
      // Extract track IDs from the drag data
      let trackIds: string[] = [];
      if (trackData.selectedTrackIds && Array.isArray(trackData.selectedTrackIds)) {
        if (trackData.isPlaylistView) {
          // Convert playlist_track_id values to track.id values
          // For now, we'll use the trackId directly
          trackIds = [trackData.trackId];
        } else {
          trackIds = trackData.selectedTrackIds;
        }
      } else {
        trackIds = [trackData.trackId];
      }

      console.log('🎯 [CROSS PLAYLIST] Final track IDs to add:', trackIds);
      console.log('🎯 [CROSS PLAYLIST] Target playlist ID:', playlistData.playlistId);
      
      // Add tracks to the target playlist
      const result = await addTracksToPlaylist(playlistData.playlistId, trackIds);
      console.log('🎯 [CROSS PLAYLIST] Add tracks result:', result);
      
      if (result.successful > 0) {
        console.log(`🎯 [CROSS PLAYLIST] ✅ Successfully added ${result.successful} tracks to playlist ${playlistData.playlistName}`);
      }
      
      if (result.failed > 0) {
        console.log(`🎯 [CROSS PLAYLIST] ⚠️ Failed to add ${result.failed} tracks:`, result.errors);
      }
      
    } catch (error) {
      console.error('🎯 [CROSS PLAYLIST] Error in cross-playlist drag:', error);
    }
  };



  return (
    <main className="flex flex-col p-2 mx-auto w-full h-screen">
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter} 
        onDragStart={(event) => {
          console.log('🎯 [DND CONTEXT] onDragStart triggered!', event);
          handleDragStart(event);
        }}
        onDragEnd={(event) => {
          console.log('🎯 [DND CONTEXT] onDragEnd triggered!', event);
          handleDragEnd(event);
        }}
        onDragMove={(event) => {
          console.log('🎯 [DND CONTEXT] onDragMove triggered!', event.active.id);
        }}
      >
        <div className="flex h-full gap-2">
          <div className="w-1/5 flex-shrink-0">
            <PlaylistSidebar 
              onSelectPlaylist={handleSelectPlaylist}
              onViewAllTracks={handleViewAllTracks}
              onDeletePlaylist={handleDeletePlaylist}
            />
          </div>
          <div className="w-4/5 flex-1 min-w-0">
            <TracksManager 
              selectedPlaylistTracks={selectedPlaylistTracks}
              selectedPlaylistId={selectedPlaylistId}
              selectedPlaylistName={selectedPlaylistName}
              onRegisterReorderHandler={handleRegisterReorderHandler}
            />
          </div>
        </div>
        
        {/* Drag Overlay for visual feedback */}
        <DragOverlay>
          {activeTrack ? (
            <div 
              className={`bg-white border border-gray-200 rounded-lg shadow-xl max-w-2xl transition-all duration-200 ${
                isSuccessfulDrop 
                  ? 'opacity-0 scale-95' // Fade out and slightly shrink on successful drop
                  : 'opacity-95 scale-100' // Normal state during drag
              }`}
            >
              <table className="min-w-full">
                <tbody>
                  <TrackItem
                    track={activeTrack}
                    index={0}
                    onSelectTrack={() => {}} // No-op for drag preview
                    onPlayTrack={() => {}} // No-op for drag preview
                    isSelected={false}
                    selectedTrackIds={[]}
                    isDragEnabled={false} // Disable drag for the preview
                    columnVisibility={columnVisibility}
                  />
                  {dragTrackCount > 1 && (
                    <tr>
                      <td colSpan={Object.values(columnVisibility).filter(Boolean).length} 
                          className="px-3 py-2 text-center text-sm font-medium text-blue-600 bg-blue-50 border-t">
                        +{dragTrackCount - 1} more tracks
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </main>
  );
}
