"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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

// Performance logging utility
const perfLog = (message: string, ...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`⚡ [TracksManager]: ${message}`, ...args);
  }
};

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

// Memoized track processing function
const useProcessedTracks = (
  tracks: Track[],
  searchQuery: string,
  sortColumn: SortColumn | null,
  sortDirection: SortDirection,
  isPlaylistView: boolean,
  playlistSortMode: 'manual' | SortColumn
) => {
  return useMemo(() => {
    let processedTracks = [...tracks];
    
    // Apply search filter first
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      processedTracks = processedTracks.filter(track => 
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
      processedTracks.sort((a, b) => {
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
    
    perfLog('Tracks processed', {
      original: tracks.length,
      filtered: processedTracks.length,
      hasSearch: !!searchQuery.trim(),
      sortBy: sortCol
    });
    
    return processedTracks;
  }, [tracks, searchQuery, sortColumn, sortDirection, isPlaylistView, playlistSortMode]);
};

const TracksManagerOptimized: React.FC<TracksManagerProps> = React.memo(({ 
  selectedPlaylistTracks, 
  selectedPlaylistId,
  selectedPlaylistName 
}) => {
  perfLog('Component rendering', { selectedPlaylistId, tracksCount: selectedPlaylistTracks?.length });
  
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

  // Memoized tracks selection - avoid recalculation on every render
  const { tracks, isPlaylistView } = useMemo(() => {
    const isPlaylist = !!selectedPlaylistId;
    const trackList = isPlaylist ? currentPlaylistTracks : allTracks;
    const safeTrackList = Array.isArray(trackList) ? trackList : [];
    
    return {
      tracks: safeTrackList,
      isPlaylistView: isPlaylist
    };
  }, [selectedPlaylistId, currentPlaylistTracks, allTracks]);

  // State variables
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

  const { user, token } = useMockAuth();
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

  // Refs
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);
  const lastReorderRef = useRef<{ startIndex: number; endIndex: number; timestamp: number } | null>(null);
  const autoSelectInitialized = useRef(false);

  // Comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Optimized playlist sync - only run when necessary
  useEffect(() => {
    if (selectedPlaylistId !== currentPlaylistId) {
      perfLog('Syncing playlist selection', { from: currentPlaylistId, to: selectedPlaylistId });
      setCurrentPlaylistId(selectedPlaylistId || null);
      if (selectedPlaylistTracks) {
        setCurrentPlaylistTracks(selectedPlaylistTracks);
      }
    }
  }, [selectedPlaylistId, currentPlaylistId, setCurrentPlaylistId, setCurrentPlaylistTracks]);

  // Memoized track processing with performance optimization
  const displayTracks = useProcessedTracks(
    tracks,
    searchQuery,
    sortColumn,
    sortDirection,
    isPlaylistView,
    playlistSortMode
  );

  // Optimized auto-selection logic - run only once per track list change
  useEffect(() => {
    if (displayTracks.length > 0 && !playbackCurrentTrack && !autoSelectInitialized.current) {
      perfLog('Auto-selecting first track', displayTracks[0]);
      setSelectedTrackIds([displayTracks[0].id]);
      autoSelectInitialized.current = true;
    } else if (displayTracks.length === 0) {
      autoSelectInitialized.current = false;
    }
  }, [displayTracks.length, playbackCurrentTrack?.id]);

  // Optimized track selection handler
  const handleSelectTrack = useCallback((trackId: string, event?: React.MouseEvent) => {
    perfLog('Track selection', { trackId, hasModifiers: !!(event?.ctrlKey || event?.metaKey || event?.shiftKey) });
    
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex === -1) {
      perfLog('Track not found', trackId);
      return;
    }
    
    // Handle multi-selection with Ctrl/Cmd or Shift
    if (event?.ctrlKey || event?.metaKey) {
      setSelectedTrackIds(prev => 
        prev.includes(trackId) 
          ? prev.filter(id => id !== trackId)
          : [...prev, trackId]
      );
    } else if (event?.shiftKey && selectedTrackIds.length > 0) {
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
      // Single selection - ONLY visual, no waveform loading
      setSelectedTrackIds([trackId]);
    }
  }, [tracks, selectedTrackIds]);

  // Optimized play track handler
  const handlePlayTrack = useCallback((trackId: string) => {
    perfLog('Playing track', trackId);
    
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      setSelectedTrackIds([trackId]);
      setCurrentTrackIndex(trackIndex);
      selectTrack(track, trackIndex, true); // Load waveform and start playback
    }
  }, [tracks, setCurrentTrackIndex, selectTrack]);

  // Optimized paste handler
  const handlePasteTracks = useCallback(async () => {
    if (!isPlaylistView || !selectedPlaylistId || copiedTrackIds.length === 0) {
      perfLog('Paste conditions not met', { isPlaylistView, selectedPlaylistId, copiedCount: copiedTrackIds.length });
      return;
    }

    perfLog('Pasting tracks', copiedTrackIds);
    
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const trackId of copiedTrackIds) {
        try {
          await addTrackToPlaylist(selectedPlaylistId, trackId, true);
          successCount++;
        } catch (error) {
          perfLog('Failed to paste track', { trackId, error });
          failureCount++;
        }
      }

      if (successCount > 0) {
        setError(`Pasted ${successCount} track${successCount > 1 ? 's' : ''} to playlist`);
        setTimeout(() => setError(null), 2000);
      }
      
      if (failureCount > 0) {
        setError(`Failed to paste ${failureCount} track${failureCount > 1 ? 's' : ''}`);
        setTimeout(() => setError(null), 3000);
      }
    } catch (error) {
      perfLog('Paste error', error);
      setError('Failed to paste tracks');
      setTimeout(() => setError(null), 2000);
    }
  }, [isPlaylistView, selectedPlaylistId, copiedTrackIds, addTrackToPlaylist]);

  // Optimized reorder handler with proper dependencies
  const handleReorderTracks = useCallback(async (startIndex: number, endIndex: number) => {
    perfLog('Reorder tracks', { startIndex, endIndex, isPlaylistView, selectedPlaylistId });

    if (!isPlaylistView || !selectedPlaylistId || playlistSortMode !== 'manual') {
      perfLog('Reorder conditions not met');
      return;
    }

    if (reorderingTracks || startIndex === endIndex) {
      perfLog('Reorder skipped', { reorderingTracks, samePosition: startIndex === endIndex });
      return;
    }

    // Validate indices
    if (startIndex < 0 || endIndex < 0 || startIndex >= tracks.length || endIndex >= tracks.length) {
      perfLog('Invalid reorder indices', { startIndex, endIndex, tracksLength: tracks.length });
      return;
    }

    // Debounce rapid reorder attempts
    const now = Date.now();
    if (lastReorderRef.current && 
        lastReorderRef.current.startIndex === startIndex && 
        lastReorderRef.current.endIndex === endIndex &&
        now - lastReorderRef.current.timestamp < 1000) {
      perfLog('Duplicate reorder detected');
      return;
    }

    try {
      setReorderingTracks(true);
      lastReorderRef.current = { startIndex, endIndex, timestamp: now };

      // Use arrayMove for reliable reordering
      const reorderedTracks = arrayMove(tracks, startIndex, endIndex);
      
      // Apply optimistic update
      setCurrentPlaylistTracks(reorderedTracks);

      // Update server
      const trackIds = reorderedTracks.map(track => track.id);
      const result = await updatePlaylistTrackOrder(selectedPlaylistId, trackIds);
      
      if (!result) {
        throw new Error('Failed to update track order on server');
      }

      perfLog('Reorder completed successfully');
    } catch (error) {
      perfLog('Reorder failed', error);
      
      // Revert optimistic update on failure
      if (selectedPlaylistId) {
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
    reorderingTracks,
    tracks,
    setCurrentPlaylistTracks,
    updatePlaylistTrackOrder,
    fetchPlaylistById
  ]);

  // Optimized sorting handler
  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    perfLog('Sort changed', { column, direction: sortColumn === column ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' });
  }, [sortColumn, sortDirection]);

  // Memoized view title
  const viewTitle = useMemo(() => {
    const totalTracks = tracks.length;
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
  }, [tracks.length, displayTracks.length, searchQuery, isPlaylistView, playlistSortMode, selectedPlaylistName]);

  // Clear sorting when entering playlist view
  useEffect(() => {
    if (isPlaylistView && sortColumn) {
      setSortColumn(null);
    }
  }, [isPlaylistView]);

  // Optimized keyboard shortcuts with proper dependencies
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target as HTMLElement)?.contentEditable === 'true'
      ) {
        return;
      }

      switch (event.key) {
        case ' ':
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
          if (searchQuery.trim()) {
            setSearchQuery('');
          } else {
            setSelectedTrackIds([]);
          }
          break;

        case 'c':
        case 'C':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (selectedTrackIds.length > 0) {
              setCopiedTrackIds([...selectedTrackIds]);
              setError(`Copied ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''}`);
              setTimeout(() => setError(null), 2000);
            }
          }
          break;

        case 'v':
        case 'V':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            if (copiedTrackIds.length > 0 && isPlaylistView && selectedPlaylistId) {
              handlePasteTracks();
            } else if (copiedTrackIds.length === 0) {
              setError('No tracks copied to paste');
              setTimeout(() => setError(null), 2000);
            } else if (!isPlaylistView) {
              setError('Can only paste tracks into playlists');
              setTimeout(() => setError(null), 2000);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedTrackIds,
    handlePlayTrack,
    togglePlayback,
    copiedTrackIds,
    isPlaylistView,
    selectedPlaylistId,
    handlePasteTracks,
    searchQuery
  ]);

  // Other handlers (memoized for performance)
  const handleDeleteTrack = useCallback(async () => {
    if (selectedTrackIds.length > 0) {
      try {
        await deleteTrack(selectedTrackIds[0]);
        setSelectedTrackIds([]);
      } catch (error) {
        perfLog('Delete track error', error);
      }
    }
    setShowDeleteModal(false);
  }, [selectedTrackIds, deleteTrack]);

  const handleNext = useCallback(() => {
    nextTrack(displayTracks);
  }, [nextTrack, displayTracks]);

  const handlePrevious = useCallback(() => {
    previousTrack(displayTracks);
  }, [previousTrack, displayTracks]);

  const handleAddComment = useCallback(async (time: number) => {
    if (!playbackCurrentTrack?.id || !user || !token) {
      perfLog('Cannot add comment: missing requirements');
      return;
    }
    setCommentTime(time);
    setShowCommentModal(true);
  }, [playbackCurrentTrack?.id, user, token]);

  // Memoized TracksTable props to prevent unnecessary re-renders
  const tracksTableProps = useMemo(() => ({
    tracks: displayTracks,
    onSelectTrack: handleSelectTrack,
    onPlayTrack: handlePlayTrack,
    selectedTrackIds,
    onReorderTracks: handleReorderTracks,
    isPlaylistView,
    sortColumn: isPlaylistView ? null : sortColumn,
    sortDirection,
    onSort: isPlaylistView ? undefined : handleSort,
    visibleColumns,
  }), [
    displayTracks,
    handleSelectTrack,
    handlePlayTrack,
    selectedTrackIds,
    handleReorderTracks,
    isPlaylistView,
    sortColumn,
    sortDirection,
    handleSort,
    visibleColumns
  ]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel - Tracks */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-lg font-semibold text-gray-900">
                {viewTitle}
              </h1>
              
              {/* Controls */}
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
                
                {/* Playlist Sort Dropdown */}
                {isPlaylistView && (
                  <select
                    value={playlistSortMode}
                    onChange={(e) => {
                      const newMode = e.target.value as 'manual' | SortColumn;
                      perfLog('Playlist sort mode changed', { from: playlistSortMode, to: newMode });
                      setPlaylistSortMode(newMode);
                    }}
                    className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="manual">Manual Order</option>
                    <option value="name">Sort by Title</option>
                    <option value="artistName">Sort by Artist</option>
                    <option value="albumName">Sort by Album</option>
                    <option value="year">Sort by Year</option>
                    <option value="duration">Sort by Duration</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Tracks Table */}
          <div className="flex-1 bg-white rounded-lg shadow overflow-hidden">
            <TracksTable {...tracksTableProps} />
          </div>
        </div>

        {/* Right Panel - Audio Player */}
        <div className="w-96 flex flex-col">
          {playbackCurrentTrack && (
            <AudioPlayer
              track={playbackCurrentTrack}
              isPlaying={isPlaying}
              onPlayPause={togglePlayback}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSeek={() => {}} // Handled by AudioPlayer
              onVolumeChange={setVolume}
              onPlaybackSpeedChange={setPlaybackSpeed}
              onAddComment={handleAddComment}
              volume={volume}
              playbackSpeed={playbackSpeed}
              waveSurferRef={waveSurferRef}
              regionsRef={regionsRef}
            />
          )}

          {/* Comments Panel */}
          {playbackCurrentTrack?.id && showComments && (
            <CommentsPanel
              trackId={playbackCurrentTrack.id}
              show={showComments}
              onClose={() => setShowComments(false)}
              regionsRef={regionsRef}
              waveSurferRef={waveSurferRef}
              onSelectComment={() => {}}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTrack}
        doNotAskAgain={doNotAskAgain}
        setDoNotAskAgain={setDoNotAskAgain}
      />
    </div>
  );
});

TracksManagerOptimized.displayName = 'TracksManagerOptimized';

export default TracksManagerOptimized; 