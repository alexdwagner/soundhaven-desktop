"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import TracksTable, { SortColumn, SortDirection } from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import AlbumArtPanel from "../audioPlayer/AlbumArtPanel";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import TrackContextMenu from "./TrackContextMenu";
import EditTrackForm from "./EditTrackForm";
import GenericModal from "../modals/GenericModal";
import { useTracks } from "@/app/providers/TracksProvider";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useComments } from "@/app/hooks/useComments";
import { useColumnVisibility } from '@/app/hooks/useColumnVisibility';
import { _Comment as Comment, Track } from "../../../../../shared/types";
import { usePlaylists } from "@/app/providers/PlaylistsProvider";
import ColumnVisibilityControl from "./ColumnVisibilityControl";

// Temporary mock for the auth user - replace with your actual auth context
const useMockAuth = () => ({
  user: { id: 1, name: 'Test User' },
  token: 'mock-token'
});

interface TracksManagerProps {
  selectedPlaylistTracks?: Track[];
  selectedPlaylistId?: string | null;
  selectedPlaylistName?: string | null;
  onRegisterReorderHandler?: (handler: (startIndex: number, endIndex: number) => void) => void;
  searchResults?: {
    tracks: Track[];
    playlists: any[];
    isActive: boolean;
  };
}

export default function TracksManager({ 
  selectedPlaylistTracks, 
  selectedPlaylistId,
  selectedPlaylistName,
  onRegisterReorderHandler,
  searchResults
}: TracksManagerProps) {
  console.log('🎯 TracksManager component rendering...');
  
  const { 
    tracks: allTracks = [], 
    fetchTracks, 
    deleteTrack, 
    setCurrentTrackIndex,
    uploadBatchTracks,
    error: fetchError
  } = useTracks();
  
  const { removeTrackFromPlaylist, updatePlaylistTrackOrder, fetchPlaylistById, setCurrentPlaylistTracks, currentPlaylistTracks } = usePlaylists();
  
  // Determine which tracks to display
  const tracks = (() => {
    // If search is active, use search results
    if (searchResults?.isActive) {
      console.log('📓 [TRACKS MANAGER] Using search results:', searchResults.tracks.length, 'tracks');
      return searchResults.tracks;
    }
    
    // Otherwise use normal logic: playlist tracks or all tracks
    return selectedPlaylistId ? currentPlaylistTracks : allTracks;
  })();
  
  console.log(`📓 [TRACKS MANAGER] Tracks determination:`, {
    selectedPlaylistId,
    searchActive: searchResults?.isActive || false,
    searchResultsLength: searchResults?.tracks.length || 0,
    currentPlaylistTracksLength: currentPlaylistTracks.length,
    allTracksLength: allTracks.length,
    finalTracksLength: tracks.length,
    usingSource: searchResults?.isActive ? 'search' : selectedPlaylistId ? 'playlist' : 'all',
    tracks: tracks.map(t => ({ id: t.id, name: t.name }))
  });
  
  const isPlaylistView = !!selectedPlaylistId;
  
  // Debug: Log which data source we're using
  console.log('📓 TracksManager tracks source:', {
    selectedPlaylistId,
    contextTracksLength: currentPlaylistTracks.length,
    propTracksLength: selectedPlaylistTracks?.length || 0,
    allTracksLength: allTracks.length,
    usingSource: selectedPlaylistId ? 'context' : 'allTracks',
    actualTracksUsed: tracks.length,
    trackIds: tracks.map(t => t.id)
  });
  
  const {
    isPlaying,
    currentTrack: playbackCurrentTrack,
    currentTrackIndex: playbackCurrentTrackIndex,
    currentPlaylistContext,
    togglePlayback,
    selectTrack,
    nextTrack,
    previousTrack,
    volume,
    setVolume,
    playbackSpeed,
    setPlaybackSpeed
  } = usePlayback();
  
  // Ensure tracks is always an array to prevent map errors
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null); // Track the anchor point for shift+click
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    trackIds: string[];
  } | null>(null);
  
  // Edit track modal state
  const [editTrackModal, setEditTrackModal] = useState<{
    isOpen: boolean;
    track: Track | null;
  }>({ isOpen: false, track: null });
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [playlistSortMode, setPlaylistSortMode] = useState<'manual' | 'column'>('manual'); // New state for playlist sorting mode
  const { user, token } = useMockAuth(); // Replace with your actual auth hook
  
  console.log('🎯 TracksManager state:', {
    tracks: tracks,
    safeTracks: safeTracks,
    safeTracksLength: safeTracks.length,
    playbackCurrentTrack: playbackCurrentTrack,
    isPlaylistView: isPlaylistView,
    selectedPlaylistId: selectedPlaylistId,
    selectedPlaylistName: selectedPlaylistName,
    playlistSortMode: playlistSortMode,
    selectedPlaylistTracks: selectedPlaylistTracks?.length || 0
  });
  
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentTime, setCommentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Drag & Drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number }[]>([]);
  const [reorderingTracks, setReorderingTracks] = useState(false);
  const reorderingRef = useRef(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Column visibility hook
  const { columnVisibility, toggleColumn, resetToDefault } = useColumnVisibility();

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);
  const lastReorderRef = useRef<{ startIndex: number; endIndex: number; timestamp: number } | null>(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Handle delete track - moved before keyboard handler to fix hoisting
  const handleDeleteTrack = useCallback(async () => {
    if (selectedTrackIds.length > 0) {
      try {
        console.log(`🗑️ Deleting ${selectedTrackIds.length} track(s):`, selectedTrackIds);
        
        // Delete all selected tracks
        const deletePromises = selectedTrackIds.map(trackId => deleteTrack(trackId));
        await Promise.all(deletePromises);
        
        console.log(`✅ Successfully deleted ${selectedTrackIds.length} track(s)`);
        setSelectedTrackIds([]);
        setSelectionAnchor(null);
      } catch (error) {
        console.error("Error deleting tracks:", error);
        setError(`Failed to delete tracks: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    setShowDeleteModal(false);
  }, [selectedTrackIds, deleteTrack, setShowDeleteModal]);

  // Enhanced reorder handler with optimistic updates and debouncing
  const handleReorderTracks = useCallback(async (startIndex: number, endIndex: number) => {
    console.log('👉 [REORDER] TracksManager handleReorderTracks called');
    console.log('👉 [REORDER] Parameters:', { startIndex, endIndex, playlistSortMode, isPlaylistView });
    console.log('🔄 [DRAG] handleReorderTracks called:', { startIndex, endIndex, playlistSortMode, isPlaylistView });
    
    // Only allow reordering in manual mode
    if (isPlaylistView && playlistSortMode !== 'manual') {
      console.log('🔄 [DRAG] Cannot reorder in column sort mode');
      return;
    }

    // Prevent simultaneous reordering operations
    if (reorderingRef.current) {
      console.log('🔄 [DRAG] Reordering already in progress, skipping...');
      return;
    }

    // Debounce rapid reorder attempts
    const now = Date.now();
    if (lastReorderRef.current && 
        lastReorderRef.current.startIndex === startIndex && 
        lastReorderRef.current.endIndex === endIndex &&
        now - lastReorderRef.current.timestamp < 1000) {
      console.log('🔄 [DRAG] Duplicate reorder operation detected, skipping...');
      return;
    }

    // Skip if no actual movement
    if (startIndex === endIndex) {
      console.log('🔄 [DRAG] No movement detected, skipping...');
      return;
    }

    console.log('🔄 [DRAG] Starting reorder operation:', { startIndex, endIndex, isPlaylistView, selectedPlaylistId });
    console.log('🔄 [DRAG] Current tracks before reorder:', tracks.map((t, i) => ({ index: i, id: t.id, name: t.name })));

    if (!isPlaylistView || !selectedPlaylistId) {
      console.log('❌ [DRAG] Reordering only supported in playlist view');
      return;
    }

    // Record the operation
    lastReorderRef.current = { startIndex, endIndex, timestamp: now };

    try {
      setReorderingTracks(true);
      reorderingRef.current = true;
      console.log('🔄 [DRAG] Calling updatePlaylistTrackOrder...');

      // Create a copy of the tracks array to determine new order
      const reorderedTracks = [...tracks];
      const [reorderedItem] = reorderedTracks.splice(startIndex, 1);
      reorderedTracks.splice(endIndex, 0, reorderedItem);

      console.log('🔄 [DRAG] Calculated new track order:', reorderedTracks.map((t, i) => ({ index: i, id: t.id, name: t.name })));

      // Prepare track IDs in new order for API call
      // Use playlist_track_id for playlist view to handle duplicates correctly
      const trackIds = reorderedTracks.map(track => 
        isPlaylistView ? (track.playlist_track_id?.toString() || track.id) : track.id
      );
      console.log('🔄 [DRAG] Track IDs being sent to API:', trackIds);
      console.log('🔄 [DRAG] Using playlist_track_id for reorder:', isPlaylistView);
      
      // Make the API call - the PlaylistsProvider will handle refetching fresh data
      const result = await updatePlaylistTrackOrder(selectedPlaylistId, trackIds);
      console.log('✅ [DRAG] API call result:', result);
      console.log('✅ [DRAG] Reorder operation completed successfully');
      

    } catch (error) {
      console.error('❌ [DRAG] Error during reorder operation:', error);
      // The PlaylistsProvider will handle error recovery by refetching
    } finally {
      setReorderingTracks(false);
      reorderingRef.current = false;
    }
  }, [isPlaylistView, playlistSortMode, tracks, selectedPlaylistId, setReorderingTracks, updatePlaylistTrackOrder]);

  // Register the reorder handler with MainContent once
  useEffect(() => {
    if (onRegisterReorderHandler) {
      console.log('🔧 [TRACKS MANAGER] Registering reorder handler with MainContent');
      onRegisterReorderHandler(handleReorderTracks);
    }
  }, [onRegisterReorderHandler, handleReorderTracks]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  // Handle context menu
  const handleContextMenu = useCallback((trackId: string, x: number, y: number) => {
    // If the right-clicked track is not in the current selection, select only that track
    const trackIds = selectedTrackIds.includes(trackId) ? selectedTrackIds : [trackId];
    
    // Update selection if needed
    if (!selectedTrackIds.includes(trackId)) {
      setSelectedTrackIds([trackId]);
    }

    setContextMenu({ x, y, trackIds });
  }, [selectedTrackIds]);

  // Handle edit metadata from context menu
  const handleEditMetadata = useCallback(() => {
    if (contextMenu && contextMenu.trackIds.length === 1) {
      const trackId = contextMenu.trackIds[0];
      const track = tracks.find(t => t.id === trackId);
      if (track) {
        setEditTrackModal({ isOpen: true, track });
      }
    }
    setContextMenu(null);
  }, [contextMenu, tracks]);

  // Handle delete from context menu
  const handleDeleteFromContextMenu = useCallback(() => {
    if (contextMenu && contextMenu.trackIds.length > 0) {
      setSelectedTrackIds(contextMenu.trackIds);
      setShowDeleteModal(true);
    }
    setContextMenu(null);
  }, [contextMenu]);

  // Handle add to playlist from context menu
  const handleAddToPlaylist = useCallback(() => {
    // TODO: Implement add to playlist functionality
    console.log('Add to playlist:', contextMenu?.trackIds);
    setContextMenu(null);
  }, [contextMenu]);

  // Handle remove from playlist
  const handleRemoveFromPlaylist = useCallback(async (trackId: string) => {
    if (!selectedPlaylistId) {
      console.error('Cannot remove track from playlist: no playlist selected');
      return;
    }

    try {
      console.log(`🗑️ Removing track ${trackId} from playlist ${selectedPlaylistId}`);
      
      // Optimistic update - immediately remove from UI
      console.log('📓 [OPTIMISTIC] Before setCurrentPlaylistTracks call');
      setCurrentPlaylistTracks((prev: Track[]) => {
        console.log('📓 [OPTIMISTIC UPDATE] Before filter:', {
          prevLength: prev.length,
          prevTracks: prev.map(t => ({ id: t.id, name: t.name })),
          tracksToRemove: [trackId]
        });
        
        const filtered = prev.filter((track: Track) => track.id !== trackId);
        
        console.log('📓 [DELETE KEY] Optimistic update result:', {
          beforeLength: prev.length,
          afterLength: filtered.length,
          removedIds: [trackId],
          remainingTracks: filtered.map((t: Track) => ({ id: t.id, name: t.name }))
        });
        
        return filtered;
      });
      console.log('📓 [OPTIMISTIC] After setCurrentPlaylistTracks call');
      setSelectedTrackIds(prev => prev.filter(id => id !== trackId));
      
      // Make API call in background
      const success = await removeTrackFromPlaylist(selectedPlaylistId, trackId);
      
      if (success) {
        console.log(`✅ Successfully removed track ${trackId} from playlist`);
    } else {
        console.error(`❌ Failed to remove track ${trackId} from playlist - reverting UI`);
        // Revert optimistic update by refetching
        const updatedPlaylist = await fetchPlaylistById(selectedPlaylistId);
        if (updatedPlaylist) {
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
        }
      }
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      // Revert optimistic update by refetching
      try {
        const updatedPlaylist = await fetchPlaylistById(selectedPlaylistId);
        if (updatedPlaylist) {
          setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
        }
      } catch (revertError) {
        console.error('Failed to revert optimistic update:', revertError);
      }
    }
  }, [selectedPlaylistId, removeTrackFromPlaylist, fetchPlaylistById]);

  // Handle remove from playlist via context menu
  const handleRemoveFromPlaylistContextMenu = useCallback(async () => {
    if (contextMenu && contextMenu.trackIds.length > 0) {
      console.log('📓 [CONTEXT MENU] Starting optimistic removal:', {
        trackIds: contextMenu.trackIds,
        currentPlaylistTracksLength: currentPlaylistTracks.length
      });
      
      // Optimistic update - immediately remove all tracks from UI
      setCurrentPlaylistTracks((prev: Track[]) => {
        const filtered = prev.filter((track: Track) => !contextMenu.trackIds.includes(track.id));
        console.log('📓 [CONTEXT MENU] Optimistic update result:', {
          beforeLength: prev.length,
          afterLength: filtered.length,
          removedIds: contextMenu.trackIds
        });
        return filtered;
      });
      setSelectedTrackIds(prev => prev.filter(id => !contextMenu.trackIds.includes(id)));
      
      // Remove all selected tracks from playlist in background
      try {
        const results = await Promise.allSettled(
          contextMenu.trackIds.map(trackId => removeTrackFromPlaylist(selectedPlaylistId!, trackId, true))
        );
        
        const failedRemovals = results.filter(result => result.status === 'rejected' || !result.value);
        
        if (failedRemovals.length > 0) {
          console.error(`❌ Failed to remove ${failedRemovals.length} tracks from playlist - reverting UI`);
          // Revert optimistic update by refetching
          if (selectedPlaylistId) {
            const updatedPlaylist = await fetchPlaylistById(selectedPlaylistId);
            if (updatedPlaylist) {
              setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
            }
          }
        } else {
          console.log(`✅ Successfully removed ${contextMenu.trackIds.length} tracks from playlist`);
        }
      } catch (error) {
        console.error('Error removing tracks from playlist:', error);
        // Revert optimistic update by refetching
        if (selectedPlaylistId) {
          try {
            const updatedPlaylist = await fetchPlaylistById(selectedPlaylistId);
            if (updatedPlaylist) {
              setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
            }
          } catch (revertError) {
            console.error('Failed to revert optimistic update:', revertError);
          }
        }
      }
    }
    setContextMenu(null);
  }, [contextMenu, removeTrackFromPlaylist, selectedPlaylistId, fetchPlaylistById]);

  // Close edit modal
  const handleCloseEditModal = useCallback(() => {
    setEditTrackModal({ isOpen: false, track: null });
  }, []);

  // Handle successful edit
  const handleEditSuccess = useCallback(() => {
    handleCloseEditModal();
    fetchTracks(); // Refresh tracks after edit
  }, [handleCloseEditModal, fetchTracks]);

  // Sorting logic
  const handleSort = useCallback((column: SortColumn) => {
    if (isPlaylistView) {
      // In playlist view, switch to column sorting mode when user clicks a header
      setPlaylistSortMode('column');
    }
    
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection, isPlaylistView]);

  // Apply sorting to tracks - only sort if not in playlist manual mode
  const sortedTracks = useCallback(() => {
    // Don't sort if we're in playlist view and manual mode
    if (isPlaylistView && playlistSortMode === 'manual') {
      console.log('🎵 [SEQUENTIAL] Using manual playlist order (no sorting applied)');
      return safeTracks;
    }
    
    // Don't sort if no sort column is selected
    if (!sortColumn) {
      console.log('🎵 [SEQUENTIAL] No sort column selected, using original order');
      return safeTracks;
    }

    console.log('🎵 [SEQUENTIAL] Applying sorting:', { sortColumn, sortDirection, isPlaylistView, playlistSortMode });

    return [...safeTracks].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'artistName':
          aValue = a.artistName?.toLowerCase() || '';
          bValue = b.artistName?.toLowerCase() || '';
          break;
        case 'albumName':
          aValue = a.albumName?.toLowerCase() || '';
          bValue = b.albumName?.toLowerCase() || '';
          break;
        case 'year':
          aValue = a.year || 0;
          bValue = b.year || 0;
          break;
        case 'duration':
          aValue = a.duration || 0;
          bValue = b.duration || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [safeTracks, sortColumn, sortDirection, isPlaylistView, playlistSortMode]);

  const displayTracks = sortedTracks();
  console.log('🎵 [SEQUENTIAL] Final displayTracks order:', displayTracks.map((t, i) => ({ index: i, name: t.name })));

  const handleSelectTrack = useCallback((trackId: string, event?: React.MouseEvent) => {
    console.log('🐥 [TRACKS MANAGER] handleSelectTrack called with trackId:', trackId);
    console.log('🐥 [TRACKS MANAGER] Available tracks (displayTracks):', displayTracks.map(t => ({ id: t.id, name: t.name, playlist_track_id: t.playlist_track_id })));
    console.log('🐥 [TRACKS MANAGER] isPlaylistView:', isPlaylistView);
    console.log('🐥 [TRACKS MANAGER] Current selectedTrackIds:', selectedTrackIds);
    
    if (event) {
      // Handle multi-selection with Ctrl/Cmd/Option key
      if (event.ctrlKey || event.metaKey || event.altKey) {
        setSelectedTrackIds(prev => {
          const newSelection = prev.includes(trackId) 
            ? prev.filter(id => id !== trackId)
            : [...prev, trackId];
          
          console.log('🐥 Multi-select click (Ctrl/Cmd/Option):', { prev, trackId, newSelection });
          
          // Update anchor to the clicked track if it's being added
          if (!prev.includes(trackId)) {
            setSelectionAnchor(trackId);
          } else if (newSelection.length > 0) {
            // Keep the anchor if we still have selections, otherwise clear it
            setSelectionAnchor(newSelection[0]);
          } else {
            setSelectionAnchor(null);
          }
          
          return newSelection;
        });
        return;
      }
      
      // Handle range selection with Shift key
      if (event.shiftKey && selectionAnchor && displayTracks.length > 0) {
        // For range selection, find tracks by the same ID logic as handlePlayTrack
        let anchorIndex = -1;
        let currentIndex = -1;
        
        if (isPlaylistView) {
          anchorIndex = displayTracks.findIndex(t => {
            const playlistTrackId = t.playlist_track_id?.toString();
            const regularTrackId = t.id.toString();
            return playlistTrackId === selectionAnchor || regularTrackId === selectionAnchor;
          });
          currentIndex = displayTracks.findIndex(t => {
            const playlistTrackId = t.playlist_track_id?.toString();
            const regularTrackId = t.id.toString();
            return playlistTrackId === trackId || regularTrackId === trackId;
          });
        } else {
          anchorIndex = displayTracks.findIndex(t => t.id.toString() === selectionAnchor);
          currentIndex = displayTracks.findIndex(t => t.id.toString() === trackId);
        }
        
        console.log('🎵 Shift+click selection:', {
          anchorId: selectionAnchor,
          anchorIndex,
          currentId: trackId,
          currentIndex,
          displayTracksLength: displayTracks.length,
          isPlaylistView
        });
        
        if (anchorIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          const rangeIds = displayTracks.slice(start, end + 1).map(t => {
            if (isPlaylistView) {
              return (t.playlist_track_id || t.id).toString();
            } else {
              return t.id.toString();
            }
          });
          console.log('🎵 Range selection:', { start, end, rangeIds });
          setSelectedTrackIds(rangeIds);
          return;
        }
      }
    }
    
    // Single selection
    setSelectedTrackIds([trackId]);
    setSelectionAnchor(trackId);
    
    // Find the track for playback using the same logic as handlePlayTrack
    let trackIndex = -1;
    
    if (isPlaylistView) {
      trackIndex = displayTracks.findIndex((t) => {
        const playlistTrackId = t.playlist_track_id?.toString();
        const regularTrackId = t.id.toString();
        return playlistTrackId === trackId || regularTrackId === trackId;
      });
    } else {
      trackIndex = displayTracks.findIndex((t) => t.id.toString() === trackId);
    }
    
    console.log('🎵 Looking for track with ID:', trackId);
    console.log('🎵 Found trackIndex in displayTracks:', trackIndex);
    console.log('🎵 Track found:', trackIndex !== -1 ? displayTracks[trackIndex] : 'NOT FOUND');
    
    if (trackIndex !== -1) {
      const track = displayTracks[trackIndex];
      setCurrentTrackIndex(trackIndex);
      // Single-click should ONLY select the track for deletion, not load it into audio player
      // selectTrack(track, trackIndex, false); // REMOVED - only double-click should load tracks
    } else {
      console.log('❌ Track not found in displayTracks array');
    }
  }, [displayTracks, setCurrentTrackIndex, selectTrack, selectedTrackIds, selectionAnchor, isPlaylistView]);

  const handlePlayTrack = useCallback((trackId: string) => {
    console.log('🎵 [HANDLE PLAY TRACK] === START ===');
    console.log('🎵 [HANDLE PLAY TRACK] Called with trackId:', trackId);
    console.log('🎵 [HANDLE PLAY TRACK] isPlaylistView:', isPlaylistView);
    console.log('🎵 [HANDLE PLAY TRACK] Available tracks count:', tracks.length);
    console.log('🎵 [SEQUENTIAL] Using displayTracks for proper sort order:', displayTracks.map((t, i) => ({ index: i, name: t.name })));
    
    // IMPORTANT: Use displayTracks instead of tracks to respect current sort order
    let trackIndex = -1;
    let foundTrack = null;
    
    if (isPlaylistView) {
      // In playlist view, trackId could be playlist_track_id (number) or track.id (string)
      trackIndex = displayTracks.findIndex((t) => {
        const playlistTrackId = t.playlist_track_id?.toString();
        const regularTrackId = t.id.toString();
        return playlistTrackId === trackId || regularTrackId === trackId;
      });
    } else {
      // In library view, trackId is always track.id
      trackIndex = displayTracks.findIndex((t) => t.id.toString() === trackId);
    }
    
    console.log('🎵 [HANDLE PLAY TRACK] Found trackIndex in displayTracks:', trackIndex);
    console.log('🎵 [SEQUENTIAL] Track index in sorted order:', trackIndex);
    
    if (trackIndex !== -1) {
      foundTrack = displayTracks[trackIndex];
      console.log('🎵 [HANDLE PLAY TRACK] Track found:', {
        index: trackIndex,
        id: foundTrack.id,
        name: foundTrack.name,
        playlist_track_id: foundTrack.playlist_track_id,
        filePath: foundTrack.filePath
      });
      
      console.log('🎵 [HANDLE PLAY TRACK] About to call selectTrack with sorted index and autoplay=true');
      selectTrack(foundTrack, trackIndex, true, { isPlaylistView, playlistId: selectedPlaylistId });
      console.log('🎵 [HANDLE PLAY TRACK] selectTrack called successfully');
    } else {
      console.error('❌ [HANDLE PLAY TRACK] Track not found for playback:', trackId);
      console.error('❌ [HANDLE PLAY TRACK] Available track IDs:', displayTracks.map(t => ({
        id: t.id,
        playlist_track_id: t.playlist_track_id,
        name: t.name
      })));
    }
    
    console.log('🎵 [HANDLE PLAY TRACK] === END ===');
  }, [displayTracks, selectTrack, isPlaylistView]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }

      switch (event.key) {
        case ' ': // Spacebar
          event.preventDefault();
          togglePlayback();
          break;

        case 'Delete':
        case 'Backspace':
          if (selectedTrackIds.length > 0) {
            event.preventDefault();
            console.log('🐥 [KEYBOARD DELETE] Delete key pressed!', {
              selectedTrackIds,
              isPlaylistView,
              selectedPlaylistId,
              currentPlaylistTracksLength: currentPlaylistTracks.length,
              tracksLength: tracks.length
            });
            
            if (isPlaylistView) {
              console.log('🐥 [PLAYLIST DELETE] Processing playlist deletion...');
              
              // In playlist view, remove from playlist (optimistic)
              console.log('📓 [DELETE KEY] Before optimistic update:', {
                selectedTrackIds,
                currentPlaylistTracksLength: currentPlaylistTracks.length,
                selectedPlaylistTracksLength: selectedPlaylistTracks?.length || 0,
                tracksLength: tracks.length
              });
              
              const tracksToRemove = selectedTrackIds.slice(); // Copy array
              console.log('🐥 [TRACKS TO REMOVE]', tracksToRemove);
              
              // Optimistic update
              setCurrentPlaylistTracks((prev: Track[]) => {
                console.log('🐥 [OPTIMISTIC UPDATE] Before filter:', {
                  prevLength: prev.length,
                  prevTracks: prev.map(t => ({ id: t.id, name: t.name, playlist_track_id: t.playlist_track_id })),
                  tracksToRemove
                });
                
                // In playlist view, filter by playlist_track_id since that's what we're removing
                const filtered = prev.filter((track: Track) => {
                  const trackKey = track.playlist_track_id?.toString() || track.id;
                  return !tracksToRemove.includes(trackKey);
                });
                
                console.log('🐥 [DELETE KEY] Optimistic update result:', {
                  beforeLength: prev.length,
                  afterLength: filtered.length,
                  removedIds: tracksToRemove,
                  remainingTracks: filtered.map((t: Track) => ({ id: t.id, name: t.name, playlist_track_id: t.playlist_track_id }))
                });
                
                return filtered;
              });
              
              console.log('📓 [SELECTION CLEAR] Clearing selected track IDs');
              setSelectedTrackIds([]);
              
              // Remove tracks from playlist in background
              console.log('📓 [API CALLS] Starting background API calls...');
              Promise.allSettled(
                tracksToRemove.map(trackId => {
                  console.log('📓 [API CALL] Removing track:', trackId);
                  return removeTrackFromPlaylist(selectedPlaylistId!, trackId, true);
                })
              ).then(results => {
                console.log('📓 [API RESULTS] All API calls completed:', results);
                
                const failedRemovals = results.filter(result => result.status === 'rejected' || !result.value);
                
                if (failedRemovals.length > 0) {
                  console.error('📓 [API FAILURE] Failed to remove tracks:', {
                    failedCount: failedRemovals.length,
                    totalCount: tracksToRemove.length,
                    failures: failedRemovals
                  });
                  
                  // Revert optimistic update by refetching
                  if (selectedPlaylistId) {
                    console.log('📓 [REVERT] Reverting optimistic update...');
                    fetchPlaylistById(selectedPlaylistId).then(updatedPlaylist => {
                      if (updatedPlaylist) {
                        console.log('📓 [REVERT SUCCESS] Playlist refetched:', {
                          tracksCount: updatedPlaylist.tracks?.length || 0
                        });
                        setCurrentPlaylistTracks(updatedPlaylist.tracks || []);
                      } else {
                        console.error('📓 [REVERT FAILURE] Failed to refetch playlist');
                      }
                    }).catch(error => {
                      console.error('📓 [REVERT ERROR] Error refetching playlist:', error);
                    });
                  }
                } else {
                  console.log('📓 [API SUCCESS] Successfully removed all tracks:', {
                    removedCount: tracksToRemove.length,
                    trackIds: tracksToRemove
                  });
                }
              }).catch(error => {
                console.error('📓 [API ERROR] Unexpected error in Promise.allSettled:', error);
              });
            } else {
              console.log('📓 [LIBRARY DELETE] Processing library deletion...');
              // In library view, delete tracks entirely
              handleDeleteTrack();
            }
          } else {
            console.log('📓 [NO SELECTION] No tracks selected for deletion');
          }
          break;

        case 'Enter':
          if (selectedTrackIds.length > 0) {
            event.preventDefault();
            handlePlayTrack(selectedTrackIds[0]);
          }
          break;

        case 'Escape':
          event.preventDefault();
          setSelectedTrackIds([]);
          setSelectionAnchor(null);
          break;

        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const allTrackIds = displayTracks.map(track => track.id);
            setSelectedTrackIds(allTrackIds);
            setSelectionAnchor(allTrackIds[0] || null);
          }
          break;

        case 'ArrowDown':
          if (displayTracks.length > 0) {
            event.preventDefault();
            const currentIndex = selectedTrackIds.length > 0 
              ? displayTracks.findIndex(track => track.id === selectedTrackIds[0]) 
              : -1;
            const nextIndex = Math.min(currentIndex + 1, displayTracks.length - 1);
            const nextTrack = displayTracks[nextIndex];
            if (nextTrack) {
              if (event.shiftKey && selectionAnchor) {
                // Extend selection from anchor
                const anchorIndex = displayTracks.findIndex(track => track.id === selectionAnchor);
                const endIndex = nextIndex;
                const rangeIds = displayTracks
                  .slice(Math.min(anchorIndex, endIndex), Math.max(anchorIndex, endIndex) + 1)
                  .map(track => track.id);
                setSelectedTrackIds(rangeIds);
              } else {
                setSelectedTrackIds([nextTrack.id]);
                setSelectionAnchor(nextTrack.id);
              }
            }
          }
          break;

        case 'ArrowUp':
          if (displayTracks.length > 0) {
            event.preventDefault();
            const currentIndex = selectedTrackIds.length > 0 
              ? displayTracks.findIndex(track => track.id === selectedTrackIds[0]) 
              : displayTracks.length;
            const prevIndex = Math.max(currentIndex - 1, 0);
            const prevTrack = displayTracks[prevIndex];
            if (prevTrack) {
              if (event.shiftKey && selectionAnchor) {
                // Extend selection from anchor
                const anchorIndex = displayTracks.findIndex(track => track.id === selectionAnchor);
                const endIndex = prevIndex;
                const rangeIds = displayTracks
                  .slice(Math.min(anchorIndex, endIndex), Math.max(anchorIndex, endIndex) + 1)
                  .map(track => track.id);
                setSelectedTrackIds(rangeIds);
              } else {
                setSelectedTrackIds([prevTrack.id]);
                setSelectionAnchor(prevTrack.id);
              }
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTrackIds, displayTracks, handlePlayTrack, togglePlayback, isPlaylistView, selectedPlaylistId, removeTrackFromPlaylist, fetchPlaylistById, setCurrentPlaylistTracks]);

  // Auto-select first track for testing - DISABLED to prevent interference with manual selection
  // useEffect(() => {
  //   console.log('🎵 Auto-select useEffect triggered:', {
  //     displayTracksLength: displayTracks.length,
  //     playbackCurrentTrack: playbackCurrentTrack,
  //     firstTrack: displayTracks[0]
  //   });
  //   
  //   if (displayTracks.length > 0 && !playbackCurrentTrack) {
  //     console.log('🎵 Auto-selecting first track for testing:', displayTracks[0]);
  //     handleSelectTrack(displayTracks[0].id);
  //   } else if (displayTracks.length === 0) {
  //     console.log('❌ No tracks available for auto-select');
  //   } else if (playbackCurrentTrack) {
  //     console.log('❌ Track already selected:', playbackCurrentTrack);
  //   }
  // }, [displayTracks, playbackCurrentTrack, handleSelectTrack]);

  const handleSeek = (time: number) => {
    // This will be handled by the AudioPlayer component
    // console.log('Seeking to:', time);
  };

  const handleNext = () => {
    console.log('🎵 [SEQUENTIAL] Next track requested - displayTracks order:', displayTracks.map((t, i) => ({ index: i, name: t.name })));
    nextTrack(displayTracks, true); // autoPlay = true
  };

  const handlePrevious = () => {
    console.log('🎵 [SEQUENTIAL] Previous track requested - displayTracks order:', displayTracks.map((t, i) => ({ index: i, name: t.name })));
    previousTrack(displayTracks, true); // autoPlay = true
  };

  // Add comments functionality
  const handleAddComment = async (time: number) => {
    if (!playbackCurrentTrack?.id || !user || !token) {
      console.log('Cannot add comment: missing track, user, or token');
      return;
    }

    setCommentTime(time);
    setShowCommentModal(true);
  };

  const handleSubmitComment = async () => {
    if (!commentContent.trim() || !playbackCurrentTrack?.id || !user || !token) {
      console.error('Cannot submit comment: missing required data', { 
        hasContent: !!commentContent.trim(), 
        trackId: playbackCurrentTrack?.id,
        hasUser: !!user,
        hasToken: !!token
      });
      
      if (!commentContent.trim()) {
        setError('Comment content cannot be empty');
      } else if (!user) {
        setError('You must be logged in to add comments');
      } else {
        setError('Missing required information to add comment');
      }
      
      return;
    }

    try {
      console.log('Submitting comment:', { 
        trackId: playbackCurrentTrack.id,
        time: commentTime,
        contentLength: commentContent.length
      });
      
      await addMarkerAndComment(
        playbackCurrentTrack.id,
        commentContent.trim(),
        commentTime,
        '#FF0000' // Default color
      );
      console.log('Comment added successfully at time:', commentTime);
      setCommentContent('');
      setShowCommentModal(false);
      
      // No need to refresh - addMarkerAndComment already updates the state
    } catch (error) {
      console.error('Error adding comment:', error);
      setError(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Keep the modal open so the user can try again
    }
  };

  const handleSelectComment = (commentId: number) => {
    console.log('Comment selected:', commentId);
  };

  // Drag & Drop handlers
  const validateFile = useCallback((file: File): string | null => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/ogg'];
    const maxSize = 2 * 1024 * 1024 * 1024; // 2GB

    if (!allowedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }

    if (file.size > maxSize) {
      return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds 2GB limit`;
    }

    return null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Only show the file drop overlay for external file drags
    // Check if this is an external file drag by looking for files in the dataTransfer
    const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    const hasFileType = e.dataTransfer.types.includes('Files');
    
    // Only show overlay for external file drops, not internal track dragging
    if (hasFiles || hasFileType) {
      console.log('🔧 [DRAG] External file drag detected, showing overlay');
    setIsDragOver(true);
    } else {
      console.log('🔧 [DRAG] Internal track drag detected, not showing overlay');
      setIsDragOver(false);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    // Only handle drag leave for external file drops
    const hasFiles = e.dataTransfer.files && e.dataTransfer.files.length > 0;
    const hasFileType = e.dataTransfer.types.includes('Files');
    
    if (hasFiles || hasFileType) {
      console.log('🔧 [DRAG] External file drag left, hiding overlay');
    setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles: File[] = [];
      const errors: string[] = [];

      files.forEach(file => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push(file);
        }
      });

      if (errors.length > 0) {
        setError(`Some files were rejected:\n${errors.join('\n')}`);
      }

      if (validFiles.length > 0) {
        console.log('🚀 Starting drag & drop upload with files:', validFiles.map(f => f.name));
        setUploading(true);
        setUploadProgress(validFiles.map(file => ({ fileName: file.name, progress: 0 })));
        
        try {
          console.log('📞 Calling uploadBatchTracks...');
          const result = await uploadBatchTracks(validFiles);
          console.log('📥 uploadBatchTracks result:', result);
          
          if (result) {
            console.log(`✅ Drag & drop upload completed: ${result.successful} successful, ${result.failedCount} failed`);
            
            if (result.successful > 0) {
              fetchTracks();
            }
            
            if (result.failed.length > 0) {
              alert(`Some uploads failed:\n${result.failed.map((f: { fileName: string; error: string }) => `${f.fileName}: ${f.error}`).join('\n')}`);
            }
          } else {
            console.error('❌ uploadBatchTracks returned undefined');
          }
        } catch (error) {
          console.error('❌ Error during drag & drop upload:', error);
          alert('Upload failed');
        } finally {
          setUploading(false);
          setUploadProgress([]);
        }
      }
    }
  }, [validateFile, uploadBatchTracks, fetchTracks]);

  // Auto-show comments panel when a comment is selected via marker click
  useEffect(() => {
    console.log('=== AUTO-SHOW EFFECT ===');
    console.log('selectedCommentId:', selectedCommentId);
    console.log('showComments:', showComments);
    console.log('playbackCurrentTrack?.id:', playbackCurrentTrack?.id);
    
    if (selectedCommentId && !showComments) {
      console.log('✅ Auto-showing comments panel due to selected comment:', selectedCommentId);
      setShowComments(true);
    } else if (selectedCommentId && showComments) {
      console.log('✅ Comments panel already showing for selected comment:', selectedCommentId);
    } else if (!selectedCommentId) {
      console.log('❌ No selected comment ID');
    } else {
      console.log('❌ Comments panel already showing but no selected comment');
    }
  }, [selectedCommentId, showComments]);

  // Test database integrity check
  const testDatabaseIntegrity = async () => {
    console.log('🔍 Testing database integrity check...');
    try {
      const response = await window.electron.ipcRenderer.invoke('db:check-integrity');
      console.log('🔍 Database integrity check result:', response);
      
      if (response.success) {
        const data = response.data;
        console.log('📊 Integrity Summary:', {
          filesInUploads: data.filesInUploads.length,
          tracksInDb: data.tracksInDb.length,
          orphanedFiles: data.orphanedFiles.length,
          missingFiles: data.missingFiles.length,
          invalidPaths: data.invalidPaths.length,
          isHealthy: data.isHealthy
        });
        
        if (data.orphanedFiles.length > 0) {
          console.log('🗑️  Orphaned files:', data.orphanedFiles);
        }
        
        if (data.missingFiles.length > 0) {
          console.log('❌ Missing files:', data.missingFiles);
        }
        
        if (data.invalidPaths.length > 0) {
          console.log('⚠️  Invalid paths:', data.invalidPaths);
        }
        
        alert(`Database Integrity Check Complete!\n\nFiles in uploads: ${data.filesInUploads.length}\nTracks in DB: ${data.tracksInDb.length}\nOrphaned files: ${data.orphanedFiles.length}\nMissing files: ${data.missingFiles.length}\nInvalid paths: ${data.invalidPaths.length}\n\nHealthy: ${data.isHealthy ? '✅ Yes' : '❌ No'}`);
      } else {
        console.error('❌ Database integrity check failed:', response.error);
        alert(`Database integrity check failed: ${response.error}`);
      }
    } catch (error) {
      console.error('❌ Error testing database integrity:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Test cleanup orphaned files
  const testCleanupOrphaned = async () => {
    console.log('🧹 Testing orphaned files cleanup...');
    try {
      const response = await window.electron.ipcRenderer.invoke('db:cleanup-orphaned');
      console.log('🧹 Cleanup result:', response);
      
      if (response.success) {
        alert('✅ Orphaned files cleanup completed successfully!');
      } else {
        alert(`❌ Cleanup failed: ${response.error}`);
      }
    } catch (error) {
      console.error('❌ Error testing cleanup:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Test fix invalid paths
  const testFixPaths = async () => {
    console.log('🔧 Testing path fixes...');
    try {
      const response = await window.electron.ipcRenderer.invoke('db:fix-paths');
      console.log('🔧 Path fix result:', response);
      
      if (response.success) {
        alert('✅ Path fixes completed successfully!');
      } else {
        alert(`❌ Path fixes failed: ${response.error}`);
      }
    } catch (error) {
      console.error('❌ Error testing path fixes:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getViewTitle = () => {
    // If search is active, show search results indicator
    if (searchResults?.isActive) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">Search Results</span>
          <span className="text-sm text-white bg-blue-500 px-2 py-1 rounded-full">
            {displayTracks.length} result{displayTracks.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => {
              // Clear search by setting empty search in parent - we'll need to handle this
              console.log('🔍 Clear search clicked - TODO: implement clear search');
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear search
          </button>
        </div>
      );
    }
    
    if (isPlaylistView && selectedPlaylistName) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">{selectedPlaylistName}</span>
          <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {displayTracks.length} track{displayTracks.length !== 1 ? 's' : ''}
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-900">All Tracks</span>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
          {displayTracks.length} track{displayTracks.length !== 1 ? 's' : ''}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Persistent Audio player at the top */}
      <div className="border-b bg-white p-2">
        <AudioPlayer 
          track={playbackCurrentTrack}
          isPlaying={isPlaying}
          onPlayPause={togglePlayback}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={handleSeek}
          onVolumeChange={setVolume}
          onPlaybackSpeedChange={setPlaybackSpeed}
          onAddComment={handleAddComment}
          volume={volume}
          playbackSpeed={playbackSpeed}
          waveSurferRef={waveSurferRef}
          regionsRef={regionsRef}
        />
      </div>

      {/* Main content area */}
      <div 
        className={`flex-1 overflow-auto p-2 transition-colors ${
          isDragOver ? 'bg-blue-50 border-2 border-dashed border-blue-400' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {fetchError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {fetchError}
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
            <button
              onClick={() => setError(null)}
              className="absolute top-0 bottom-0 right-0 px-4 py-3"
            >
              <span className="sr-only">Dismiss</span>
              ×
            </button>
          </div>
        )}

        {/* Drag & Drop Overlay */}
        {isDragOver && (
          <div className="fixed inset-0 bg-blue-50 bg-opacity-90 flex items-center justify-center z-50 pointer-events-none">
            <div className="text-center">
              <div className="text-6xl mb-4">🎵</div>
              <div className="text-2xl font-bold text-blue-600">Drop audio files here</div>
              <div className="text-lg text-blue-500">Release to upload to your library</div>
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && uploadProgress.length > 0 && (
          <div className="mb-1 bg-white rounded shadow p-2">
            <h3 className="text-sm font-medium text-gray-900 mb-1">Uploading Files...</h3>
            <div className="space-y-1">
              {uploadProgress.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded p-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-medium text-gray-900 truncate mr-2">{item.fileName}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0">{item.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact Upload and Debug Tools */}
        <div className="mb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    const files = Array.from(e.target.files);
                    console.log('🚀 Testing file upload with files:', files.map(f => f.name));
                    setUploading(true);
                    setUploadProgress(files.map(file => ({ fileName: file.name, progress: 0 })));
                    
                    uploadBatchTracks(files).then(result => {
                      console.log('📥 Test upload result:', result);
                      if (result && result.successful > 0) {
                        fetchTracks();
                      }
                      setUploading(false);
                      setUploadProgress([]);
                    }).catch(error => {
                      console.error('❌ Test upload error:', error);
                      setUploading(false);
                      setUploadProgress([]);
                    });
                  }
                }}
                className="hidden"
                id="file-upload-input"
              />
              <label
                htmlFor="file-upload-input"
                className="inline-flex items-center px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                Upload Files
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowComments(!showComments)}
                className={`text-xs px-2 py-1 rounded border ${
                  playbackCurrentTrack 
                    ? 'text-blue-600 border-blue-300 hover:text-blue-800 hover:border-blue-400' 
                    : 'text-gray-400 border-gray-200 cursor-not-allowed'
                }`}
                disabled={!playbackCurrentTrack}
                title={playbackCurrentTrack ? "Toggle comments panel" : "Select a track to view comments"}
              >
                💬 {showComments ? 'Hide' : 'Show'} Comments
              </button>
              <button
                onClick={() => setShowKeyboardHelp(!showKeyboardHelp)}
                className="text-xs px-2 py-1 text-blue-600 hover:text-blue-800 border border-blue-300 rounded"
                title="Keyboard Shortcuts"
              >
                ⌨️ Shortcuts
              </button>
              <button
                onClick={() => setShowDebugTools(!showDebugTools)}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
              >
                {showDebugTools ? 'Hide' : 'Show'} Debug Tools
              </button>
            </div>
          </div>
          
          {/* Collapsible Debug Tools */}
          {showDebugTools && (
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                onClick={async () => {
                  console.log('🔧 Testing IPC communication...');
                  try {
                    const { apiService } = await import('@/services/electronApiService');
                    const result = await apiService.debugTest({ test: 'data', timestamp: Date.now() });
                    console.log('🔧 IPC test result:', result);
                    alert(`IPC Test: ${result.success ? 'SUCCESS' : 'FAILED'}\n${result.message}`);
                  } catch (error) {
                    console.error('🔧 IPC test error:', error);
                    alert(`IPC Test FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                className="text-xs px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                🔧 Test IPC
              </button>
              
              <button
                onClick={testDatabaseIntegrity}
                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              >
                🔍 DB Integrity
              </button>
              
              <button
                onClick={testCleanupOrphaned}
                className="text-xs px-2 py-1 bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                🧹 Cleanup
              </button>
              
              <button
                onClick={testFixPaths}
                className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                🔧 Fix Paths
              </button>
            </div>
          )}
          
          {/* Keyboard Shortcuts Help */}
          {showKeyboardHelp && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-xs">
              <div className="font-medium text-blue-800 mb-2">Keyboard Shortcuts:</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-blue-700">
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Space</kbd> Play/Pause (global)</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Enter</kbd> Play selected</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">↑/↓</kbd> Navigate tracks</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Shift+↑/↓</kbd> Extend selection</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Ctrl+A</kbd> Select all</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Escape</kbd> Clear selection</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Delete</kbd> Delete selected</div>
                <div><span className="text-blue-600">Click headers to sort</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="mb-1">
          <div className="flex items-center justify-between">
          {getViewTitle()}
            
            {/* Sorting Mode Toggle and Column Visibility - Only show in playlist view */}
            {isPlaylistView && (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => {
                        setPlaylistSortMode('manual');
                        setSortColumn(null);
                      }}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        playlistSortMode === 'manual'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📋 Manual Order
                    </button>
                    <button
                      onClick={() => {
                        setPlaylistSortMode('column');
                      }}
                      className={`px-3 py-1 text-sm rounded-md transition-colors ${
                        playlistSortMode === 'column'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🔤 Column Sort
                    </button>
                  </div>
                </div>
                
                {/* Column Visibility Control */}
                <ColumnVisibilityControl
                  columnVisibility={columnVisibility}
                  onToggleColumn={toggleColumn}
                  onResetToDefault={resetToDefault}
                />
              </div>
            )}
            
            {/* Column Visibility Control for Library view */}
            {!isPlaylistView && (
              <ColumnVisibilityControl
                columnVisibility={columnVisibility}
                onToggleColumn={toggleColumn}
                onResetToDefault={resetToDefault}
              />
            )}
          </div>
          

        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TracksTable
            tracks={displayTracks}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={handlePlayTrack}
            selectedTrackIds={selectedTrackIds}
            onReorderTracks={handleReorderTracks}
            onRemoveFromPlaylist={isPlaylistView ? handleRemoveFromPlaylist : undefined}
            isPlaylistView={isPlaylistView}
            currentPlaylistId={selectedPlaylistId}
            playlistSortMode={playlistSortMode}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onContextMenu={handleContextMenu}
            columnVisibility={columnVisibility}
            onToggleColumn={toggleColumn}
            onResetColumns={resetToDefault}
          />
        </div>

        {/* Comments Panel */}
        {playbackCurrentTrack?.id && showComments && (
          <CommentsPanel
            trackId={playbackCurrentTrack.id}
            show={showComments}
            onClose={() => setShowComments(false)}
            regionsRef={regionsRef}
            waveSurferRef={waveSurferRef}
            onSelectComment={handleSelectComment}
          />
        )}

        {/* Album Art Panel */}
        <AlbumArtPanel
          track={playbackCurrentTrack}
          show={!!playbackCurrentTrack}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TrackContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          selectedTrackIds={contextMenu.trackIds.map(id => parseInt(id))}
          onClose={() => setContextMenu(null)}
          onDelete={handleDeleteFromContextMenu}
          onEditMetadata={handleEditMetadata}
          onAddToPlaylist={handleAddToPlaylist}
          onRemoveFromPlaylist={isPlaylistView ? handleRemoveFromPlaylistContextMenu : undefined}
          isPlaylistView={isPlaylistView}
        />
      )}

      {/* Edit Track Modal */}
      <GenericModal 
        isOpen={editTrackModal.isOpen} 
        onClose={handleCloseEditModal}
        showDefaultCloseButton={false}
      >
        {editTrackModal.track && (
          <EditTrackForm
            track={editTrackModal.track}
            closeModal={handleCloseEditModal}
            fetchTracks={handleEditSuccess}
          />
        )}
      </GenericModal>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTrack}
        doNotAskAgain={doNotAskAgain}
        setDoNotAskAgain={setDoNotAskAgain}
        trackCount={selectedTrackIds.length}
      />

      {/* Comment Modal */}
      {showCommentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Add Comment</h3>
            <p className="text-sm text-gray-600 mb-4">
              Time: {Math.floor(commentTime / 60)}:{(commentTime % 60).toFixed(0).padStart(2, '0')}
            </p>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Enter your comment..."
              className="w-full p-3 border border-gray-300 rounded-md mb-4 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCommentModal(false);
                  setCommentContent('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitComment}
                disabled={!commentContent.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Comment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 