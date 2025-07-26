"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { DndContext, closestCenter, PointerSensor, MouseSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import PlaylistSidebar from "../playlists/PlaylistSidebar";
import TracksManager from "../tracks/TracksManager";
import TrackItem from "../tracks/TrackItem";
import { Track, Playlist } from "../../../../../shared/types";
import { usePlaylists } from "@/app/providers/PlaylistsProvider";
import { useTracks } from "@/app/providers/TracksProvider";
import { useColumnVisibility } from '@/app/hooks/useColumnVisibility';
import { useEnvironment } from '@/app/hooks/useEnvironment';
import MobileSearch from '../search/MobileSearch';

interface MainContentProps {
  searchResults?: {
    tracks: Track[];
    playlists: Playlist[];
    isActive: boolean;
  };
}

// Mobile navigation views
type MobileView = 'playlists' | 'library' | 'comments';

export default function MainContent({ searchResults }: MainContentProps) {
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [dragTrackCount, setDragTrackCount] = useState(1);
  const [tracksManagerReorderHandler, setTracksManagerReorderHandler] = useState<((startIndex: number, endIndex: number) => void) | null>(null);
  const [tracksManagerSelectHandler, setTracksManagerSelectHandler] = useState<((trackId: string) => void) | null>(null);
  const [tracksManagerPlayHandler, setTracksManagerPlayHandler] = useState<((trackId: string) => void) | null>(null);
  const [playlistSidebarDragHandler, setPlaylistSidebarDragHandler] = useState<((event: any) => void) | null>(null);
  
  // Mobile navigation state
  const [mobileView, setMobileView] = useState<MobileView>('library');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState("");
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Environment detection
  const { isMobile } = useEnvironment();
  
  // Debug handler registration
  const handleRegisterReorderHandler = useCallback((handler: (startIndex: number, endIndex: number) => void) => {
    console.log('🔧 [MAIN CONTENT] Registering reorder handler:', typeof handler);
    setTracksManagerReorderHandler(handler); // Remove function wrapper
  }, []);

  const handleRegisterPlaylistDragHandler = useCallback((handler: (event: any) => void) => {
    console.log('🔧 [MAIN CONTENT] Registering playlist drag handler:', typeof handler);
    setPlaylistSidebarDragHandler(handler); // Remove function wrapper
  }, []);

  const handleRegisterSelectHandler = useCallback((handler: (trackId: string) => void) => {
    console.log('🔧 [MAIN CONTENT] Registering select handler:', typeof handler);
    setTracksManagerSelectHandler(() => handler);
  }, []);

  const handleRegisterPlayHandler = useCallback((handler: (trackId: string) => void) => {
    console.log('🔧 [MAIN CONTENT] Registering play handler:', typeof handler);
    setTracksManagerPlayHandler(() => handler);
  }, []);
  
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

  // Mobile swipe navigation
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left - go to next view
      switch (mobileView) {
        case 'playlists':
          setMobileView('library');
          break;
        case 'library':
          setMobileView('comments');
          break;
        case 'comments':
          // Stay on comments
          break;
      }
    } else if (isRightSwipe) {
      // Swipe right - go to previous view
      switch (mobileView) {
        case 'playlists':
          // Stay on playlists
          break;
        case 'library':
          setMobileView('playlists');
          break;
        case 'comments':
          setMobileView('library');
          break;
      }
    }
  };

  const handleSelectPlaylist = (tracks: Track[], playlistId: string, playlistName?: string) => {
    console.log("📋 Playlist selected:", { playlistId, playlistName, tracksCount: tracks.length });
    setSelectedPlaylistTracks(tracks);
    setSelectedPlaylistId(playlistId);
    setSelectedPlaylistName(playlistName || 'Unknown Playlist');
    // On mobile, switch to library view when playlist is selected
    if (isMobile) {
      setMobileView('library');
    }
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
    console.log('👉 [DRAG START] Global drag start triggered');
    setIsDragging(true);
    const activeData = event.active.data.current;
    
    console.log('👉 [DRAG START] Setting isDragging to true');
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
        console.log('👉 [DRAG START] Found track for preview:', track.name);
        setActiveTrack(track);
        // Set the count of tracks being dragged
        const selectedCount = activeData.selectedTrackIds?.length || 1;
        setDragTrackCount(selectedCount);
        console.log('👉 [DRAG START] Setting active track and count:', track.name, 'count:', selectedCount);
        console.log('🌍 [GLOBAL DND] Setting active track for preview:', track.name, 'count:', selectedCount);
      } else {
        console.log('👉 [DRAG START] No track found for preview');
      }
    }
  };

  // Global drag end handler
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    console.log('👉 [DRAG END] Global drag end triggered');
    console.log('👉 [DRAG END] Active ID:', active.id);
    console.log('👉 [DRAG END] Over ID:', over?.id);
    console.log('👉 [DRAG END] Has valid drop target:', !!over);
    
    console.log('🌍 [GLOBAL DND] *** DRAG ENDED ***', { 
      activeId: active.id, 
      overId: over?.id, 
      activeData: active.data.current,
      overData: over?.data.current,
      activeType: active.data.current?.type,
      overType: over?.data.current?.type
    });

    // Always clean up our drag state immediately to let @dnd-kit handle its own lifecycle
    console.log('👉 [DRAG END] Cleaning up drag state');
    setIsDragging(false);
    setActiveTrack(null);
    setDragTrackCount(1);

    if (!over) {
      console.log('👉 [DRAG END] No drop target - failed drop');
      console.log('🌍 [GLOBAL DND] No drop target');
      return;
    }

    const activeData = active.data.current;
    const overData = over.data.current;

    console.log('👉 [DRAG END] Active data type:', activeData?.type);
    console.log('👉 [DRAG END] Over data type:', overData?.type);
    
    console.log('🌍 [GLOBAL DND] Detailed drag analysis:', {
      activeType: activeData?.type,
      overType: overData?.type,
      isTrackToTrack: activeData?.type === 'track' && overData?.type === 'track',
      isTrackToPlaylist: activeData?.type === 'track' && overData?.type === 'playlist',
      isPlaylistToPlaylist: activeData?.type === 'playlist' && overData?.type === 'playlist'
    });

    // Case 1: Track dropped on another track (playlist reordering)
    if (activeData?.type === 'track' && overData?.type === 'track') {
      console.log('👉 [DRAG END] CASE 1: Track-to-track reordering');
      console.log('👉 [DRAG END] Skipping - now handled by local DndContext in TracksTable');
      console.log('🌍 [GLOBAL DND] Track-to-track drag detected (playlist reordering)');
      
      // Track reordering is now handled by the local DndContext in TracksTable
      // This global handler only deals with cross-playlist operations
      console.log('👉 [DRAG END] Delegating to local TracksTable DndContext');
      return;
    }

    // Case 2: Track dropped on playlist (cross-playlist operation)
    if (activeData?.type === 'track' && overData?.type === 'playlist') {
      console.log('👉 [DRAG END] CASE 2: Track-to-playlist operation');
      console.log('🌍 [GLOBAL DND] Track-to-playlist drag detected (cross-playlist)');
      console.log('🌍 [GLOBAL DND] Track data:', activeData);
      console.log('🌍 [GLOBAL DND] Playlist data:', overData);
      
      // Handle cross-playlist operation
      console.log('👉 [DRAG END] Calling handleCrossPlaylistDrag');
      handleCrossPlaylistDrag(activeData, overData);
      console.log('👉 [DRAG END] Exiting track-to-playlist case');
      return;
    }

    // Case 3: Playlist dropped on playlist (playlist reordering)
    if (activeData?.type === 'playlist' && overData?.type === 'playlist') {
      console.log('👉 [DRAG END] CASE 3: Playlist-to-playlist reordering');
      console.log('🌍 [GLOBAL DND] Playlist-to-playlist drag detected (playlist reordering)');
      // Delegate to PlaylistSidebar's drag handler
      if (playlistSidebarDragHandler && typeof playlistSidebarDragHandler === 'function') {
        console.log('👉 [DRAG END] Calling PlaylistSidebar drag handler');
        console.log('🌍 [GLOBAL DND] Calling PlaylistSidebar drag handler');
        playlistSidebarDragHandler(event);
      } else {
        console.log('👉 [DRAG END] No PlaylistSidebar drag handler available');
        console.warn('🌍 [GLOBAL DND] No PlaylistSidebar drag handler registered');
      }
      console.log('👉 [DRAG END] Exiting playlist-to-playlist case');
      return;
    }

    console.log('👉 [DRAG END] Unhandled drag type - no case matched');
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
    <main className={`flex flex-col mx-auto w-full h-screen ${isMobile ? 'p-0' : 'p-2'}`}>
      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter} 
        onDragStart={(event) => {
          console.log('👉 [DND LIFECYCLE] DndContext onDragStart triggered');
          console.log('🎯 [DND CONTEXT] onDragStart triggered!', event);
          handleDragStart(event);
        }}
        onDragEnd={(event) => {
          console.log('👉 [DND LIFECYCLE] DndContext onDragEnd triggered');
          console.log('🎯 [DND CONTEXT] onDragEnd triggered!', event);
          handleDragEnd(event);
        }}
        onDragMove={(event) => {
          console.log('👉 [DND LIFECYCLE] DndContext onDragMove triggered for:', event.active.id);
          console.log('🎯 [DND CONTEXT] onDragMove triggered!', event.active.id);
        }}
        onDragOver={(event) => {
          console.log('👉 [DND LIFECYCLE] DndContext onDragOver triggered');
        }}
        onDragCancel={(event) => {
          console.log('👉 [DND LIFECYCLE] DndContext onDragCancel triggered');
        }}
      >
        {isMobile ? (
          console.log('🔍 [MOBILE SEARCH] Rendering mobile layout with search field'),
          // Mobile Layout with Swipe Navigation
          <div 
            ref={containerRef}
            className="flex flex-col h-full"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Mobile Navigation Header */}
            <div className="flex items-center justify-center bg-white border-b border-gray-200 px-4 py-3 relative">
              <div className="flex space-x-8">
                <button
                  onClick={() => setMobileView('playlists')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    mobileView === 'playlists' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Playlists
                </button>
                <button
                  onClick={() => setMobileView('library')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    mobileView === 'library' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Library
                </button>
                <button
                  onClick={() => setMobileView('comments')}
                  className={`px-3 py-2 rounded-lg font-medium transition-colors ${
                    mobileView === 'comments' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Comments
                </button>
              </div>
              
              {/* Swipe indicators */}
              <div className="swipe-indicator left"></div>
              <div className="swipe-indicator right"></div>
              
              {/* Swipe hint */}
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
                Swipe to navigate
              </div>
            </div>
            
            {/* Mobile Search Field - positioned directly below navigation */}
            <div className="bg-white border-b border-gray-200 px-4 py-3">
              <div className="relative">
                <input
                  type="text"
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowMobileSearch(true);
                    }
                  }}
                  onFocus={() => setShowMobileSearch(true)}
                  placeholder="Search tracks, artists, albums, playlists, tags, comments..."
                  className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <svg 
                  className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </div>
            </div>

            {/* Mobile Content Area */}
            <div className="flex-1 overflow-hidden">
              {/* Playlists View */}
              {mobileView === 'playlists' && (
                <div className="h-full overflow-auto">
                  <PlaylistSidebar 
                    onSelectPlaylist={handleSelectPlaylist}
                    onViewAllTracks={handleViewAllTracks}
                    onDeletePlaylist={handleDeletePlaylist}
                    onRegisterDragHandler={handleRegisterPlaylistDragHandler}
                  />
                </div>
              )}

              {/* Library View */}
              {mobileView === 'library' && (
                <div className="h-full overflow-hidden">
                  <TracksManager 
                    selectedPlaylistTracks={selectedPlaylistTracks}
                    selectedPlaylistId={selectedPlaylistId}
                    selectedPlaylistName={selectedPlaylistName}
                    onRegisterReorderHandler={handleRegisterReorderHandler}
                    onRegisterSelectHandler={handleRegisterSelectHandler}
                    onRegisterPlayHandler={handleRegisterPlayHandler}
                    searchResults={searchResults}
                  />
                </div>
              )}

              {/* Comments View */}
              {mobileView === 'comments' && (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <div className="text-4xl mb-4">💬</div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Comments</h3>
                    <p className="text-gray-600">Comments view coming soon...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Desktop Layout (unchanged)
          <div className="flex h-full gap-2">
            <div className="w-1/5 flex-shrink-0">
              <PlaylistSidebar 
                onSelectPlaylist={handleSelectPlaylist}
                onViewAllTracks={handleViewAllTracks}
                onDeletePlaylist={handleDeletePlaylist}
                onRegisterDragHandler={handleRegisterPlaylistDragHandler}
              />
            </div>
            <div className="w-4/5 flex-1 min-w-0">
              <TracksManager 
                selectedPlaylistTracks={selectedPlaylistTracks}
                selectedPlaylistId={selectedPlaylistId}
                selectedPlaylistName={selectedPlaylistName}
                onRegisterReorderHandler={handleRegisterReorderHandler}
                onRegisterSelectHandler={handleRegisterSelectHandler}
                onRegisterPlayHandler={handleRegisterPlayHandler}
                searchResults={searchResults}
              />
            </div>
          </div>
        )}
        
        {/* Drag Overlay for visual feedback */}
        <DragOverlay>
          {activeTrack ? (
            <>
              {console.log('👉 [DRAG OVERLAY] Rendering drag overlay for:', activeTrack.name)}
              <div className="bg-white border border-gray-200 rounded-lg shadow-xl opacity-95 max-w-2xl">
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
            </>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Mobile Search Overlay */}
      {isMobile && showMobileSearch && (
        <MobileSearch
          initialQuery={mobileSearchQuery}
          onClose={() => {
            setShowMobileSearch(false);
            setMobileSearchQuery("");
          }}
          onTrackSelect={(trackId) => {
            console.log('🔍 [MOBILE SEARCH] Track selected:', trackId);
            // Switch to library view FIRST so TracksManager uses the correct track context
            setMobileView('library');
            // Then call the TracksManager's select handler to highlight the track
            setTimeout(() => {
              if (tracksManagerSelectHandler) {
                console.log('🔍 [MOBILE SEARCH] Calling select handler for track:', trackId);
                tracksManagerSelectHandler(trackId);
              } else {
                console.warn('🔍 [MOBILE SEARCH] No select handler available');
              }
            }, 50); // Small delay to ensure view switch completes
            // Then close search
            setShowMobileSearch(false);
            setMobileSearchQuery("");
          }}
          onTrackPlay={(trackId) => {
            console.log('🔍 [MOBILE SEARCH] Track play requested:', trackId);
            // Call the TracksManager's play handler FIRST before closing search
            if (tracksManagerPlayHandler) {
              console.log('🔍 [MOBILE SEARCH] Calling play handler for track:', trackId);
              tracksManagerPlayHandler(trackId);
            } else {
              console.warn('🔍 [MOBILE SEARCH] No play handler available');
            }
            // Then close search after a small delay to allow handler to complete
            setTimeout(() => {
              setShowMobileSearch(false);
              setMobileSearchQuery("");
            }, 100);
          }}
          onPlaylistSelect={(playlistId) => {
            // Switch to playlists view and select the playlist
            setMobileView('playlists');
            setSelectedPlaylistId(playlistId);
            setShowMobileSearch(false);
            setMobileSearchQuery("");
            console.log('Selected playlist:', playlistId);
          }}
        />
      )}
    </main>
  );
}
