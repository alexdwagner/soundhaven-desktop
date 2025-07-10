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
  
  // Use context playlist tracks if available (for optimistic updates), otherwise use prop, otherwise use all tracks
  const tracks = selectedPlaylistId ? (currentPlaylistTracks.length > 0 ? currentPlaylistTracks : (selectedPlaylistTracks || [])) : allTracks;
  const isPlaylistView = !!selectedPlaylistId;
  
  // Debug: Log which data source we're using
  console.log('🎯 TracksManager tracks source:', {
    selectedPlaylistId,
    contextTracksLength: currentPlaylistTracks.length,
    propTracksLength: selectedPlaylistTracks?.length || 0,
    allTracksLength: allTracks.length,
    usingSource: selectedPlaylistId ? (currentPlaylistTracks.length > 0 ? 'context' : 'prop') : 'allTracks'
  });
  
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
  const [showDebugTools, setShowDebugTools] = useState(false);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);
  const lastReorderRef = useRef<{ startIndex: number; endIndex: number; timestamp: number } | null>(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Enhanced reorder handler with optimistic updates and debouncing
  const handleReorderTracks = async (startIndex: number, endIndex: number) => {
    console.log('🔄 [DRAG] handleReorderTracks called:', { startIndex, endIndex, playlistSortMode, isPlaylistView });
    
    // Only allow reordering in manual mode
    if (isPlaylistView && playlistSortMode !== 'manual') {
      console.log('🔄 [DRAG] Cannot reorder in column sort mode');
      return;
    }

    // Prevent simultaneous reordering operations
    if (reorderingTracks) {
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
      console.log('🔄 [DRAG] Calling updatePlaylistTrackOrder...');
      
      // Create a copy of the tracks array for optimistic update
      const reorderedTracks = [...tracks];
      const [reorderedItem] = reorderedTracks.splice(startIndex, 1);
      reorderedTracks.splice(endIndex, 0, reorderedItem);

      console.log('🔄 [DRAG] Reordered tracks (optimistic):', reorderedTracks.map((t, i) => ({ index: i, id: t.id, name: t.name })));

      // Optimistically update the UI
      setCurrentPlaylistTracks(reorderedTracks);
      
      // Prepare track IDs in new order for API call
      const trackIds = reorderedTracks.map(track => track.id);
      console.log('🔄 [DRAG] Track IDs being sent to API:', trackIds);
      
      // Make the API call
      const result = await updatePlaylistTrackOrder(selectedPlaylistId, trackIds);
      console.log('✅ [DRAG] API call result:', result);
      console.log('✅ [DRAG] Reorder operation completed successfully');
    } catch (error) {
      console.error('❌ [DRAG] Error during reorder operation:', error);
      // Revert optimistic update by refetching
      if (selectedPlaylistId) {
        try {
          console.log('🔄 [DRAG] Reverting optimistic update by refetching playlist...');
          await fetchPlaylistById(selectedPlaylistId);
          console.log('🔄 [DRAG] Playlist refetched after error');
        } catch (refetchError) {
          console.error('❌ [DRAG] Failed to revert optimistic update:', refetchError);
        }
      }
    } finally {
      setReorderingTracks(false);
    }
  };

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
      return safeTracks;
    }
    
    // Don't sort if no sort column is selected
    if (!sortColumn) return safeTracks;

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

  const handleSelectTrack = useCallback((trackId: string, event?: React.MouseEvent) => {
    console.log('🎵 handleSelectTrack called with trackId:', trackId);
    console.log('🎵 Available tracks:', tracks);
    
    if (event) {
      // Handle multi-selection with Ctrl/Cmd key
      if (event.ctrlKey || event.metaKey) {
        setSelectedTrackIds(prev => {
          const newSelection = prev.includes(trackId) 
            ? prev.filter(id => id !== trackId)
            : [...prev, trackId];
          
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
        const anchorIndex = displayTracks.findIndex(t => t.id === selectionAnchor);
        const currentIndex = displayTracks.findIndex(t => t.id === trackId);
        
        console.log('🎵 Shift+click selection:', {
          anchorId: selectionAnchor,
          anchorIndex,
          currentId: trackId,
          currentIndex,
          displayTracksLength: displayTracks.length
        });
        
        if (anchorIndex !== -1 && currentIndex !== -1) {
          const start = Math.min(anchorIndex, currentIndex);
          const end = Math.max(anchorIndex, currentIndex);
          const rangeIds = displayTracks.slice(start, end + 1).map(t => t.id);
          console.log('🎵 Range selection:', { start, end, rangeIds });
          setSelectedTrackIds(rangeIds);
          return;
        }
      }
    }
    
    // Single selection - set as new anchor
    setSelectedTrackIds([trackId]);
    setSelectionAnchor(trackId);
    
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    console.log('🎵 Found trackIndex:', trackIndex);
    
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      console.log('🎵 Selecting track for playback:', track);
      setCurrentTrackIndex(trackIndex);
      selectTrack(track, trackIndex); // Also set in PlaybackContext for CommentsProvider
      console.log('🎵 selectTrack called successfully');
    } else {
      console.log('❌ Track not found in tracks array');
    }
  }, [tracks, setCurrentTrackIndex, selectTrack, selectedTrackIds, selectionAnchor, displayTracks]);

  const handlePlayTrack = useCallback((trackId: string) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      // Here, we can decide if we want to autoplay.
      // For a double-click action, autoplay is desired.
      selectTrack(track, trackIndex, true);
    }
  }, [tracks, selectTrack]);

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
  }, [selectedTrackIds, displayTracks, handlePlayTrack, togglePlayback]);

  // Auto-select first track for testing
  useEffect(() => {
    console.log('🎵 Auto-select useEffect triggered:', {
      displayTracksLength: displayTracks.length,
      playbackCurrentTrack: playbackCurrentTrack,
      firstTrack: displayTracks[0]
    });
    
    if (displayTracks.length > 0 && !playbackCurrentTrack) {
      console.log('🎵 Auto-selecting first track for testing:', displayTracks[0]);
      handleSelectTrack(displayTracks[0].id);
    } else if (displayTracks.length === 0) {
      console.log('❌ No tracks available for auto-select');
    } else if (playbackCurrentTrack) {
      console.log('❌ Track already selected:', playbackCurrentTrack);
    }
  }, [displayTracks, playbackCurrentTrack, handleSelectTrack]);

  const handleDeleteTrack = async () => {
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
    if (isPlaylistView && selectedPlaylistName) {
      return `${selectedPlaylistName} (${displayTracks.length} tracks)`;
    }
    return `All Tracks (${displayTracks.length})`;
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
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Escape</kbd> Clear selection</div>
                <div><kbd className="px-1 py-0.5 bg-blue-100 rounded text-xs">Delete</kbd> Delete selected</div>
                <div><span className="text-blue-600">Click headers to sort</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Header */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900">
              {getViewTitle()}
            </h1>
            
            {/* Sorting Mode Toggle - Only show in playlist view */}
            {isPlaylistView && (
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
            )}
          </div>
          
          {/* Sorting Mode Description */}
          {isPlaylistView && (
            <div className="mt-2 text-sm text-gray-500">
              {playlistSortMode === 'manual' ? (
                <span>💡 Drag and drop tracks to reorder your playlist</span>
              ) : (
                <span>💡 Click column headers to sort tracks</span>
              )}
              {reorderingTracks && (
                <span className="ml-2 text-blue-600">
                  ⏳ Reordering tracks...
                </span>
              )}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TracksTable
            tracks={displayTracks}
            onSelectTrack={handleSelectTrack}
            onPlayTrack={handlePlayTrack}
            selectedTrackIds={selectedTrackIds}
            onReorderTracks={handleReorderTracks}
            isPlaylistView={isPlaylistView}
            playlistSortMode={playlistSortMode}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
            onContextMenu={handleContextMenu}
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