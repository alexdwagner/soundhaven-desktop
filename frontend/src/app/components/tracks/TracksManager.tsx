"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import TracksTable, { SortColumn, SortDirection } from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { useTracks } from "@/app/providers/TracksProvider";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useComments } from "@/app/hooks/useComments";
import { _Comment as Comment, Track } from "../../../../../shared/types";
import { usePlaylists } from "@/app/providers/PlaylistsProvider";

// Temporary mock for the auth user - replace with your actual auth context
const useMockAuth = () => ({
  user: { id: 1, name: 'Test User' },
  token: 'mock-token'
});

interface TracksManagerProps {
  selectedPlaylistTracks?: Track[];
  selectedPlaylistId?: string | null;
  selectedPlaylistName?: string | null;
}

export default function TracksManager({ 
  selectedPlaylistTracks, 
  selectedPlaylistId,
  selectedPlaylistName 
}: TracksManagerProps) {
  // Performance: Only log in development and reduce frequency
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 TracksManager rendering - playlist:', selectedPlaylistId);
  }
  
  const { 
    tracks: allTracks = [], 
    fetchTracks, 
    deleteTrack, 
    setCurrentTrackIndex,
    uploadBatchTracks,
    error: fetchError
  } = useTracks();
  
  const { 
    removeTrackFromPlaylist, 
    updatePlaylistTrackOrder, 
    fetchPlaylistById, 
    setCurrentPlaylistTracks,
    currentPlaylistTracks,
    currentPlaylistId,
    setCurrentPlaylistId,
    addTrackToPlaylist 
  } = usePlaylists();
  
  // Sync playlist selection with provider
  useEffect(() => {
    if (selectedPlaylistId !== currentPlaylistId) {
      setCurrentPlaylistId(selectedPlaylistId || null);
      if (selectedPlaylistTracks) {
        setCurrentPlaylistTracks(selectedPlaylistTracks);
      }
    }
  }, [selectedPlaylistId, selectedPlaylistTracks, currentPlaylistId, setCurrentPlaylistId, setCurrentPlaylistTracks]);
  
  // Use provider tracks for playlist view, all tracks for library view
  const tracks = selectedPlaylistId ? currentPlaylistTracks : allTracks;
  const isPlaylistView = !!selectedPlaylistId;
  
  const {
    isPlaying,
    currentTrack: playbackCurrentTrack,
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
  
  // Performance: Reduce logging frequency
  if (process.env.NODE_ENV === 'development' && Math.random() < 0.1) {
    console.log('🎯 TracksManager state sample:', {
      tracksCount: safeTracks.length,
      hasCurrentTrack: !!playbackCurrentTrack,
      isPlaylistView: isPlaylistView,
      selectedPlaylistId: selectedPlaylistId
    });
  }
  
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const [copiedTrackIds, setCopiedTrackIds] = useState<string[]>([]);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Playlist sorting state (separate from column header sorting)
  const [playlistSortMode, setPlaylistSortMode] = useState<'manual' | SortColumn>('manual');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    title: true,
    artist: true,
    album: true,
    year: true,
    duration: true,
  });
  const { user, token } = useMockAuth(); // Replace with your actual auth hook
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentTime, setCommentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Drag & Drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number }[]>([]);
  const [reorderingTracks, setReorderingTracks] = useState(false);
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [showColumnOptions, setShowColumnOptions] = useState(false);

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);
  const lastReorderRef = useRef<{ startIndex: number; endIndex: number; timestamp: number } | null>(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Copy/Paste functionality
  const handlePasteTracks = useCallback(async () => {
    console.log('🎵 [PASTE] handlePasteTracks called!');
    console.log('🎵 [PASTE] Parameters:', {
      isPlaylistView,
      selectedPlaylistId,
      copiedTrackIds,
      copiedCount: copiedTrackIds.length
    });

    if (!isPlaylistView || !selectedPlaylistId || copiedTrackIds.length === 0) {
      console.error('🎵 [PASTE] Cannot paste tracks: missing requirements', {
        isPlaylistView,
        selectedPlaylistId,
        copiedCount: copiedTrackIds.length
      });
      return;
    }

    let successCount = 0;
    let failureCount = 0;

    try {
      console.log('🎵 [PASTE] Starting paste operation for tracks:', copiedTrackIds);
      console.log('🎵 [PASTE] Target playlist:', selectedPlaylistId);
      
      // Add each copied track to the playlist (with force=true to allow duplicates)
      for (const trackId of copiedTrackIds) {
        try {
          console.log(`🎵 [PASTE] Pasting track ${trackId} with force=true`);
          const result = await addTrackToPlaylist(selectedPlaylistId, trackId, true); // force=true allows duplicates
          console.log(`🎵 [PASTE] Successfully pasted track ${trackId}:`, result);
          successCount++;
        } catch (error) {
          console.error(`🎵 [PASTE] Failed to paste track ${trackId}:`, error);
          failureCount++;
        }
      }

      console.log('🎵 [PASTE] Paste operation completed:', { successCount, failureCount });

      if (successCount > 0) {
        setError(`Pasted ${successCount} track${successCount > 1 ? 's' : ''} to playlist`);
      }
      if (failureCount > 0) {
        setError(`Failed to paste ${failureCount} track${failureCount > 1 ? 's' : ''} (might already exist)`);
      }
      
      setTimeout(() => setError(null), 3000);
    } catch (error) {
      console.error('🎵 [PASTE] Error pasting tracks:', error);
      setError('Failed to paste tracks');
      setTimeout(() => setError(null), 2000);
    }
  }, [isPlaylistView, selectedPlaylistId, copiedTrackIds, addTrackToPlaylist]);

  // Enhanced reorder handler with optimistic updates and debouncing
  const handleReorderTracks = useCallback(async (startIndex: number, endIndex: number) => {
    console.log('🚀🚀🚀 [DRAG] handleReorderTracks ENTRY POINT - FUNCTION CALLED!', { startIndex, endIndex });
    console.log('🚀 [DRAG] handleReorderTracks called:', {
      startIndex,
      endIndex,
      isPlaylistView,
      selectedPlaylistId,
      playlistSortMode,
      reorderingTracks,
      tracksLength: safeTracks.length,
      currentTracks: tracks.map(t => t.name).slice(0, 5)
    });

    // Check if we're in the right mode for reordering
    console.log('🔍 [DRAG] Validation check - isPlaylistView:', isPlaylistView);
    if (!isPlaylistView) {
      console.error('❌ [DRAG] Not in playlist view, cannot reorder');
      setError('Cannot reorder tracks: Not in playlist view');
      return;
    }

    console.log('🔍 [DRAG] Validation check - selectedPlaylistId:', selectedPlaylistId);
    if (!selectedPlaylistId) {
      console.error('❌ [DRAG] No playlist selected for reordering');
      setError('Cannot reorder tracks: No playlist selected');
      return;
    }

    console.log('🔍 [DRAG] Validation check - playlistSortMode:', playlistSortMode);
    if (playlistSortMode !== 'manual') {
      console.error('❌ [DRAG] Playlist is not in manual order mode, cannot reorder. Current mode:', playlistSortMode);
      setError(`Cannot reorder tracks: Playlist is sorted by ${playlistSortMode}. Switch to "Manual Order" to enable reordering.`);
      return;
    }

    // Prevent simultaneous reordering operations
    console.log('🔍 [DRAG] Validation check - reorderingTracks:', reorderingTracks);
    if (reorderingTracks) {
      console.log('🔄 [DRAG] Reordering already in progress, skipping...');
      return;
    }

    // Validate indices
    console.log('🔍 [DRAG] Validation check - indices:', { startIndex, endIndex, tracksLength: tracks.length });
    if (startIndex < 0 || endIndex < 0 || startIndex >= tracks.length || endIndex >= tracks.length) {
      console.error('❌ [DRAG] Invalid indices:', { startIndex, endIndex, tracksLength: tracks.length });
      setError(`Cannot reorder tracks: Invalid positions (${startIndex} -> ${endIndex})`);
      return;
    }

    // Debounce rapid reorder attempts
    const now = Date.now();
    console.log('🔍 [DRAG] Debounce check:', {
      now,
      lastReorder: lastReorderRef.current,
      timeDiff: lastReorderRef.current ? now - lastReorderRef.current.timestamp : 'N/A'
    });
    if (lastReorderRef.current && 
        lastReorderRef.current.startIndex === startIndex && 
        lastReorderRef.current.endIndex === endIndex &&
        now - lastReorderRef.current.timestamp < 1000) {
      console.log('🔄 [DRAG] Duplicate reorder operation detected, skipping...');
      return;
    }

    // Skip if no actual movement
    console.log('🔍 [DRAG] Movement check:', { startIndex, endIndex, samePosition: startIndex === endIndex });
    if (startIndex === endIndex) {
      console.log('🔄 [DRAG] No movement detected, skipping...');
      return;
    }

    console.log('🔄 [DRAG] Starting reorder operation:', { 
      startIndex, 
      endIndex, 
      isPlaylistView, 
      selectedPlaylistId,
      trackBeingMoved: tracks[startIndex]?.name,
      targetPosition: tracks[endIndex]?.name 
    });

          try {
        setReorderingTracks(true);
        lastReorderRef.current = { startIndex, endIndex, timestamp: now };

        // Use arrayMove for reliable reordering (same as playlists)
        const reorderedTracks = arrayMove(tracks, startIndex, endIndex);
        
        console.log('🔄 [DRAG] Optimistic reorder using arrayMove:', { 
          originalLength: tracks.length, 
          reorderedLength: reorderedTracks.length,
          movedTrack: tracks[startIndex]?.name,
          from: startIndex,
          to: endIndex,
          newOrder: reorderedTracks.map((t, i) => `${i}: ${t.name}`).slice(0, 10)
        });

        // Apply optimistic update immediately (same as playlists)
        console.log('🔄 [DRAG] BEFORE setCurrentPlaylistTracks - current tracks:', tracks.map(t => t.name));
        setCurrentPlaylistTracks(reorderedTracks);
        console.log('🔄 [DRAG] AFTER setCurrentPlaylistTracks - should update to:', reorderedTracks.map(t => t.name));

        // Prepare track IDs in new order for API call
        const trackIds = reorderedTracks.map(track => track.id);
        console.log('🔄 [DRAG] Calling updatePlaylistTrackOrder API with track IDs:', trackIds.slice(0, 10));
        
        const result = await updatePlaylistTrackOrder(selectedPlaylistId, trackIds);
        
        console.log('🔄 [DRAG] API response:', result);
        
        if (result) {
          console.log('✅ [DRAG] Reorder operation completed successfully - trusting optimistic update');
          // NO REFRESH - trust the optimistic update like playlists do
        } else {
          console.error('❌ [DRAG] Reorder operation failed, API returned:', result);
          throw new Error('Failed to update track order on server');
        }

      } catch (error) {
        console.error('❌ [DRAG] Error during reorder operation:', error);
        
        // Revert optimistic update on failure by refreshing
        if (selectedPlaylistId) {
          console.log('🔄 [DRAG] Reverting optimistic update due to error');
          await fetchPlaylistById(selectedPlaylistId);
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setError(`Failed to reorder tracks: ${errorMessage}`);
      } finally {
        setReorderingTracks(false);
      }
  }, [
    isPlaylistView,
    selectedPlaylistId,
    playlistSortMode,
    currentPlaylistTracks,
    reorderingTracks,
    setCurrentPlaylistTracks,
    updatePlaylistTrackOrder,
    fetchPlaylistById,
    setError
  ]);

  const handleSelectTrack = useCallback((trackId: string, event?: React.MouseEvent) => {
    console.log('🎵 handleSelectTrack called with trackId:', trackId);
    console.log('🎵 Available tracks:', tracks);
    
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    console.log('🎵 Found trackIndex:', trackIndex);
    
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      console.log('🎵 Selecting track (visual selection only, no waveform loading):', track);
      
      // Handle multi-selection with Ctrl/Cmd or Shift
      if (event?.ctrlKey || event?.metaKey) {
        // Toggle selection for Ctrl/Cmd+click
        setSelectedTrackIds(prev => 
          prev.includes(trackId) 
            ? prev.filter(id => id !== trackId)
            : [...prev, trackId]
        );
      } else if (event?.shiftKey && selectedTrackIds.length > 0) {
        // Range selection for Shift+click
        const lastSelectedIndex = tracks.findIndex(t => t.id === selectedTrackIds[selectedTrackIds.length - 1]);
        if (lastSelectedIndex !== -1) {
          const startIndex = Math.min(lastSelectedIndex, trackIndex);
          const endIndex = Math.max(lastSelectedIndex, trackIndex);
          const rangeIds = tracks.slice(startIndex, endIndex + 1).map(t => t.id);
          setSelectedTrackIds(rangeIds);
        } else {
          setSelectedTrackIds([trackId]);
        }
      } else {
        // Single selection for normal click - ONLY update visual selection
        setSelectedTrackIds([trackId]);
      }
      
      // DO NOT call selectTrack or setCurrentTrackIndex for single-click
      // This keeps the waveform from loading until the user double-clicks
      console.log('🎵 Track visually selected, no waveform loaded');
    } else {
      console.log('❌ Track not found in tracks array');
    }
  }, [tracks, selectedTrackIds]);

  const handlePlayTrack = useCallback((trackId: string) => {
    console.log('🎵 handlePlayTrack called with trackId:', trackId);
    console.log('🎵 Available tracks:', tracks);
    
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    console.log('🎵 Found trackIndex:', trackIndex);
    
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      console.log('🎵 Loading and playing track with waveform:', track);
      
      // Select the track visually AND load for playback
      setSelectedTrackIds([trackId]);
      setCurrentTrackIndex(trackIndex);
      selectTrack(track, trackIndex, true); // Load waveform and start playback
      console.log('🎵 Track loaded with waveform and playback started');
    } else {
      console.log('❌ Track not found in tracks array');
    }
  }, [tracks, setCurrentTrackIndex, selectTrack]);

  // Sorting logic
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  // Performance: Memoized track processing to prevent unnecessary re-computations
  const processedTracks = useMemo(() => {
    let tracks = [...safeTracks];
    
    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      tracks = tracks.filter(track => 
        (track.name?.toLowerCase().includes(query)) ||
        (track.artistName?.toLowerCase().includes(query)) ||
        (track.albumName?.toLowerCase().includes(query))
      );
    }
    
    // Apply sorting
    let sortCol: SortColumn | null = null;
    let sortDir = sortDirection;
    
    if (isPlaylistView) {
      // In playlist view, use dropdown sorting
      if (playlistSortMode !== 'manual') {
        sortCol = playlistSortMode;
        sortDir = 'asc'; // Always ascending for playlist dropdown sorting
      }
    } else {
      // In library view, use column header sorting
      sortCol = sortColumn;
    }
    
    if (sortCol) {
      tracks.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortCol) {
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

        if (aValue < bValue) return sortDir === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return tracks;
  }, [safeTracks, searchQuery, sortColumn, sortDirection, isPlaylistView, playlistSortMode]);

  // Debug logging for drag-to-reorder state
  useEffect(() => {
    console.log('🎯 [DRAG DEBUG] Current state:', {
      isPlaylistView,
      selectedPlaylistId,
      currentPlaylistId,
      playlistSortMode,
      dragToReorderEnabled: isPlaylistView && playlistSortMode === 'manual',
      tracksCount: tracks.length,
      reorderingTracks,
      firstFewTracks: tracks.slice(0, 3).map(t => ({ id: t.id, name: t.name })),
      usingProviderTracks: !!selectedPlaylistId
    });
  }, [isPlaylistView, selectedPlaylistId, currentPlaylistId, playlistSortMode, tracks.length, reorderingTracks]);

  // Log when handleReorderTracks function is recreated
  useEffect(() => {
    console.log('🔄 [DRAG] handleReorderTracks function recreated/initialized');
  }, [handleReorderTracks]);

  const displayTracks = processedTracks;

  // Clear sorting when entering playlist view
  useEffect(() => {
    if (isPlaylistView && sortColumn) {
      setSortColumn(null);
    }
  }, [isPlaylistView, sortColumn]);

  // Close column options dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showColumnOptions && !(event.target as Element)?.closest('.column-options-dropdown')) {
        setShowColumnOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnOptions]);

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
            setShowDeleteModal(true);
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
          // Clear search first if it's active, otherwise clear selection
          if (searchQuery.trim()) {
            setSearchQuery('');
          } else {
            setSelectedTrackIds([]);
          }
          break;

        case 'a':
        case 'A':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setSelectedTrackIds(displayTracks.map(track => track.id));
          }
          break;

        case 'c':
        case 'C':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (selectedTrackIds.length > 0) {
              setCopiedTrackIds([...selectedTrackIds]);
              console.log('🎵 [COPY] Copied tracks:', selectedTrackIds);
              console.log('🎵 [COPY] copiedTrackIds state updated');
              // Optional: Show a brief notification
              setError(`Copied ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''}`);
              setTimeout(() => setError(null), 2000);
            } else {
              console.log('🎵 [COPY] No tracks selected to copy');
            }
          }
          break;

        case 'v':
        case 'V':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            console.log('🎵 [PASTE] Paste key detected!');
            console.log('🎵 [PASTE] Current state:', {
              copiedTrackIds: copiedTrackIds,
              copiedCount: copiedTrackIds.length,
              isPlaylistView: isPlaylistView,
              selectedPlaylistId: selectedPlaylistId
            });
            
            if (copiedTrackIds.length > 0 && isPlaylistView && selectedPlaylistId) {
              console.log('🎵 [PASTE] Conditions met, calling handlePasteTracks');
              handlePasteTracks();
            } else if (copiedTrackIds.length === 0) {
              console.log('🎵 [PASTE] No tracks copied to paste');
              setError('No tracks copied to paste');
              setTimeout(() => setError(null), 2000);
            } else if (!isPlaylistView) {
              console.log('🎵 [PASTE] Not in playlist view');
              setError('Can only paste tracks into playlists');
              setTimeout(() => setError(null), 2000);
            } else {
              console.log('🎵 [PASTE] No playlist selected');
              setError('No playlist selected');
              setTimeout(() => setError(null), 2000);
            }
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
              if (event.shiftKey && selectedTrackIds.length > 0) {
                // Extend selection
                const startIndex = displayTracks.findIndex(track => track.id === selectedTrackIds[0]);
                const endIndex = nextIndex;
                const rangeIds = displayTracks
                  .slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
                  .map(track => track.id);
                setSelectedTrackIds(rangeIds);
              } else {
                setSelectedTrackIds([nextTrack.id]);
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
              if (event.shiftKey && selectedTrackIds.length > 0) {
                // Extend selection
                const startIndex = displayTracks.findIndex(track => track.id === selectedTrackIds[0]);
                const endIndex = prevIndex;
                const rangeIds = displayTracks
                  .slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1)
                  .map(track => track.id);
                setSelectedTrackIds(rangeIds);
              } else {
                setSelectedTrackIds([prevTrack.id]);
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
  }, [selectedTrackIds, displayTracks, handlePlayTrack, togglePlayback, copiedTrackIds, isPlaylistView, selectedPlaylistId, handlePasteTracks, searchQuery]);

  // Performance: Optimized auto-selection with proper dependencies
  const autoSelectRef = useRef(false);
  useEffect(() => {
    // Only auto-select once per track list change and when no track is playing
    if (displayTracks.length > 0 && !playbackCurrentTrack && !autoSelectRef.current) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎵 Auto-selecting first track:', displayTracks[0]);
      }
      setSelectedTrackIds([displayTracks[0].id]);
      autoSelectRef.current = true;
    } else if (displayTracks.length === 0) {
      autoSelectRef.current = false;
    }
  }, [displayTracks.length, playbackCurrentTrack?.id]); // Only track count and current track ID

  const handleDeleteTrack = async () => {
    if (selectedTrackIds.length > 0) {
      try {
        // Delete the first selected track for now
        await deleteTrack(selectedTrackIds[0]);
        setSelectedTrackIds([]);
      } catch (error) {
        console.error("Error deleting track:", error);
      }
    }
    setShowDeleteModal(false);
  };

  const handleSeek = (time: number) => {
    // This will be handled by the AudioPlayer component
    // console.log('Seeking to:', time);
  };

  const handleNext = () => {
    nextTrack(displayTracks);
  };

  const handlePrevious = () => {
    previousTrack(displayTracks);
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
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
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
    const totalTracks = safeTracks.length;
    const displayedTracks = displayTracks.length;
    const hasFilter = searchQuery.trim() || (isPlaylistView && playlistSortMode !== 'manual');
    
    let title = '';
    if (isPlaylistView && selectedPlaylistName) {
      title = selectedPlaylistName;
    } else {
      title = 'All Tracks';
    }
    
    if (hasFilter && displayedTracks !== totalTracks) {
      return `${title} (${displayedTracks} of ${totalTracks} tracks)`;
    } else {
      return `${title} (${displayedTracks} tracks)`;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Audio player at the top */}
      <div className="border-b bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            {/* Left side content can go here if needed */}
          </div>
          <button
            onClick={() => setShowComments(!showComments)}
            disabled={!playbackCurrentTrack}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              playbackCurrentTrack 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {showComments ? 'Hide Comments' : 'Show Comments'}
          </button>
        </div>
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
        className={`flex-1 overflow-auto p-3 transition-colors ${
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
          <div className="mb-3 bg-white rounded shadow p-3">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Uploading Files...</h3>
            <div className="space-y-2">
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
        <div className="mb-3">
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
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Escape</kbd> Clear search/selection</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Delete</kbd> Delete selected</div>
                <div><span className="text-blue-600">Click headers to sort (library only)</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-semibold text-gray-900">
              {getViewTitle()}
            </h1>
            
            {/* Controls Section */}
            <div className="flex items-center space-x-3">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
                <svg 
                  className="absolute left-2.5 top-2 h-4 w-4 text-gray-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              {/* Playlist Sort Dropdown (only in playlist view) */}
              {isPlaylistView && (
                <select
                  value={playlistSortMode}
                  onChange={(e) => {
                    const newMode = e.target.value as 'manual' | SortColumn;
                    console.log('🔄 [SORT] Playlist sort mode changed:', {
                      from: playlistSortMode,
                      to: newMode,
                      dragToReorderEnabled: newMode === 'manual'
                    });
                    setPlaylistSortMode(newMode);
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  title={`Current: ${playlistSortMode}. Drag-to-reorder ${playlistSortMode === 'manual' ? 'enabled' : 'disabled'}.`}
                >
                  <option value="manual">Manual Order {playlistSortMode === 'manual' ? '✓' : ''}</option>
                  <option value="name">Sort by Title {playlistSortMode === 'name' ? '✓' : ''}</option>
                  <option value="artistName">Sort by Artist {playlistSortMode === 'artistName' ? '✓' : ''}</option>
                  <option value="albumName">Sort by Album {playlistSortMode === 'albumName' ? '✓' : ''}</option>
                  <option value="year">Sort by Year {playlistSortMode === 'year' ? '✓' : ''}</option>
                  <option value="duration">Sort by Duration {playlistSortMode === 'duration' ? '✓' : ''}</option>
                </select>
              )}
              
              {/* Column Visibility Dropdown */}
              <div className="relative column-options-dropdown">
                <button
                  onClick={() => setShowColumnOptions(!showColumnOptions)}
                  className="text-sm px-2 py-1.5 border border-gray-300 rounded hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                >
                  Columns ▼
                </button>
                {showColumnOptions && (
                  <div className="absolute right-0 top-full mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-32">
                    <div className="p-2 space-y-1">
                      {Object.entries(visibleColumns).map(([column, visible]) => (
                        <label key={column} className="flex items-center space-x-2 text-sm">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={(e) => setVisibleColumns(prev => ({
                              ...prev,
                              [column]: e.target.checked
                            }))}
                            disabled={column === 'title'} // Title column is always required
                            className="rounded"
                          />
                          <span className={`capitalize ${column === 'title' ? 'text-gray-500' : ''}`}>
                            {column}
                            {column === 'title' && <span className="text-xs ml-1">(required)</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TracksTable
            tracks={displayTracks}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={handlePlayTrack}
            selectedTrackIds={selectedTrackIds}
            onReorderTracks={handleReorderTracks}
            isPlaylistView={isPlaylistView}
            sortColumn={isPlaylistView ? null : sortColumn}
            sortDirection={sortDirection}
            onSort={isPlaylistView ? undefined : handleSort}
            visibleColumns={visibleColumns}
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
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTrack}
        doNotAskAgain={doNotAskAgain}
        setDoNotAskAgain={setDoNotAskAgain}
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