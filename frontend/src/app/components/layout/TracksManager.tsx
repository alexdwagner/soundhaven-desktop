"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import TracksTable from "../tracks/TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import SyncModal from "../modals/SyncModal";
import { useTracks } from "@/app/providers/TracksProvider";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useComments } from "@/app/hooks/useComments";
import { _Comment as Comment } from "../../../../../shared/types";

// Temporary mock for the auth user - replace with your actual auth context
const useMockAuth = () => ({
  user: { id: 1, name: 'Test User' },
  token: 'mock-token'
});

export default function TracksManager() {
  const { 
    tracks = [], 
    fetchTracks, 
    deleteTrack, 
    setCurrentTrackIndex,
    uploadBatchTracks,
    error: fetchError
  } = useTracks();
  
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
  
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [doNotAskAgain, setDoNotAskAgain] = useState(false);
  const { user, token } = useMockAuth(); // Replace with your actual auth hook
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentTime, setCommentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Drag & Drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; progress: number }[]>([]);

  // Sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncDiff, setSyncDiff] = useState<any>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Check for sync issues on mount
  useEffect(() => {
    checkForSyncIssues();
  }, []);

  const checkForSyncIssues = async () => {
    try {
      setSyncLoading(true);
      const result = await window.electron.ipcRenderer.invoke('db:check-integrity');
      
      if (result.success && result.data) {
        const diff = result.data;
        // Only show sync modal if there are issues
        if (!diff.isHealthy) {
          setSyncDiff(diff);
          setSyncModalOpen(true);
        }
      }
    } catch (error) {
      console.error('Failed to check database integrity:', error);
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSync = async (actions: {
    deleteOrphaned: boolean;
    fixPaths: boolean;
    addMissing: boolean;
  }) => {
    try {
      setSyncInProgress(true);
      const result = await window.electron.ipcRenderer.invoke('db:sync', actions);
      
      if (result.success) {
        console.log('Sync completed:', result.data);
        // Refresh tracks after sync
        await fetchTracks();
        setSyncModalOpen(false);
        setSyncDiff(null);
        
        // Show success message
        alert(`Sync completed successfully!\n\n` +
              `Deleted files: ${result.data.deletedFiles}\n` +
              `Fixed paths: ${result.data.fixedPaths}\n` +
              `Added tracks: ${result.data.addedTracks}\n` +
              `Errors: ${result.data.errors.length}`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Sync error:', error);
      alert(`Sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSyncInProgress(false);
    }
  };

  // Add hardcoded test markers for debugging
  useEffect(() => {
    console.log('🎯 SETTING HARDCODED MARKERS - trackId:', playbackCurrentTrack?.id);
    console.log('🎯 setMarkers function available:', !!setMarkers);
    
    if (playbackCurrentTrack?.id) {
      console.log('✅ Setting hardcoded test markers for track:', playbackCurrentTrack.id);
      const testMarkers = [
        {
          id: 'test-marker-1',
          time: 10,
          commentId: 1,
          waveSurferRegionID: 'test-region-1',
          data: { customColor: 'rgba(255, 0, 0, 0.7)' }
        },
        {
          id: 'test-marker-2', 
          time: 30,
          commentId: 2,
          waveSurferRegionID: 'test-region-2',
          data: { customColor: 'rgba(0, 255, 0, 0.7)' }
        },
        {
          id: 'test-marker-3',
          time: 60,
          commentId: 3,
          waveSurferRegionID: 'test-region-3',
          data: { customColor: 'rgba(0, 0, 255, 0.7)' }
        }
      ];
      console.log('Test markers to set:', testMarkers);
      setMarkers(testMarkers);
      console.log('✅ setMarkers called');
    } else {
      console.log('❌ No playbackCurrentTrack?.id, skipping marker setup');
    }
  }, [playbackCurrentTrack?.id, setMarkers]);

  // Debug markers
  useEffect(() => {
    console.log('=== MARKERS UPDATED IN TRACKSMANAGER ===');
    console.log('markers:', markers);
    console.log('markers length:', markers?.length);
    console.log('markers type:', typeof markers);
  }, [markers]);

  const handleSelectTrack = useCallback((trackId: number) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex !== -1) {
      const track = tracks[trackIndex];
      console.log('🎵 Selecting track for playback:', track);
      setCurrentTrackIndex(trackIndex);
      selectTrack(track, trackIndex); // Also set in PlaybackContext for CommentsProvider
    }
  }, [tracks, setCurrentTrackIndex, selectTrack]);

  // Auto-select first track for testing
  useEffect(() => {
    if (safeTracks.length > 0 && !playbackCurrentTrack) {
      console.log('🎵 Auto-selecting first track for testing:', safeTracks[0]);
      handleSelectTrack(safeTracks[0].id);
    }
  }, [safeTracks, playbackCurrentTrack, handleSelectTrack]);

  const handleDeleteTrack = async () => {
    if (selectedTrackId !== null) {
      try {
        await deleteTrack(selectedTrackId.toString());
        setSelectedTrackId(null);
      } catch (error) {
        console.error("Error deleting track:", error);
      }
    }
    setShowDeleteModal(false);
  };

  const handleReorderTracks = async (startIndex: number, endIndex: number) => {
    try {
      const reorderedTracks = [...tracks];
      const [reorderedItem] = reorderedTracks.splice(startIndex, 1);
      reorderedTracks.splice(endIndex, 0, reorderedItem);
      
      // Update the tracks in the context
      // Note: This is a simplified version - you might want to add a reorderTracks function to your context
      // that handles the reordering and updates the backend
      console.log('Reordering tracks:', { startIndex, endIndex });
      
      // For now, we'll just log the reorder action
      // You should implement proper reordering logic in your TracksProvider
    } catch (error) {
      console.error('Error reordering tracks:', error);
    }
  };

  const handleSeek = (time: number) => {
    // This will be handled by the AudioPlayer component
    // console.log('Seeking to:', time);
  };

  const handleNext = () => {
    nextTrack(safeTracks);
  };

  const handlePrevious = () => {
    previousTrack(safeTracks);
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
        commentTime,
        commentContent,
        user.id,
        token
      );
      
      console.log('✅ Comment submitted successfully');
      
      // Reset form
      setCommentContent('');
      setCommentTime(0);
      setShowCommentModal(false);
      setError(null);
      
      // No need to refresh - addMarkerAndComment already updates the state
      
    } catch (error) {
      console.error('❌ Error submitting comment:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit comment');
    }
  };

  const handleSelectComment = (commentId: number) => {
    console.log('🎯 Comment selected:', commentId);
    setShowComments(true);
    // The CommentsPanel will handle highlighting the selected comment
  };

  // Drag & Drop handlers
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
    
    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => 
      file.type.startsWith('audio/') || 
      file.name.toLowerCase().endsWith('.mp3') ||
      file.name.toLowerCase().endsWith('.wav') ||
      file.name.toLowerCase().endsWith('.m4a')
    );
    
    if (audioFiles.length === 0) {
      alert('Please drop audio files only (.mp3, .wav, .m4a)');
      return;
    }
    
    try {
      setUploading(true);
      setUploadProgress([]);
      
      console.log('📁 Starting batch upload for files:', audioFiles.map(f => f.name));
      
      const result = await uploadBatchTracks(audioFiles);
      
      if (result.success) {
        console.log('✅ Batch upload completed:', result.data);
        alert(`Successfully uploaded ${result.data.uploadedTracks.length} tracks!`);
        
        // Refresh tracks list
        await fetchTracks();
      } else {
        console.error('❌ Batch upload failed:', result.error);
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('❌ Error during batch upload:', error);
      alert(`Upload error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      setUploadProgress([]);
    }
  }, [uploadBatchTracks, fetchTracks]);

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
      } else {
        console.error('❌ Database integrity check failed:', response.error);
      }
    } catch (error) {
      console.error('❌ Error testing database integrity:', error);
    }
  };

  // Test cleanup orphaned files
  const testCleanupOrphaned = async () => {
    console.log('🧹 Testing orphaned files cleanup...');
    try {
      const response = await window.electron.ipcRenderer.invoke('db:cleanup-orphaned');
      console.log('🧹 Cleanup result:', response);
    } catch (error) {
      console.error('❌ Error testing cleanup:', error);
    }
  };

  // Test fix invalid paths
  const testFixPaths = async () => {
    console.log('🔧 Testing path fixes...');
    try {
      const response = await window.electron.ipcRenderer.invoke('db:fix-paths');
      console.log('🔧 Path fix result:', response);
    } catch (error) {
      console.error('❌ Error testing path fixes:', error);
    }
  };

  // Test IPC communication
  const testIpcCommunication = async () => {
    console.log('📡 Testing IPC communication...');
    try {
      const response = await window.electron.ipcRenderer.invoke('debug:test', 'Hello from frontend!');
      console.log('📡 IPC test response:', response);
    } catch (error) {
      console.error('❌ IPC test failed:', error);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sync modal */}
      <SyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onSync={handleSync}
        diff={syncDiff}
        isLoading={syncLoading}
      />

      {/* Debug buttons */}
      <div className="bg-gray-100 p-2 border-b flex flex-wrap gap-2 text-xs">
        <button
          onClick={testIpcCommunication}
          className="px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Test IPC
        </button>
        <button
          onClick={testDatabaseIntegrity}
          className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Check Integrity
        </button>
        <button
          onClick={testCleanupOrphaned}
          className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Cleanup Orphaned
        </button>
        <button
          onClick={testFixPaths}
          className="px-2 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
        >
          Fix Paths
        </button>
        <button
          onClick={checkForSyncIssues}
          className="px-2 py-1 bg-purple-500 text-white rounded hover:bg-purple-600"
        >
          Check Sync
        </button>
      </div>

      {/* Main content area with drag & drop */}
      <div 
        className={`flex-1 flex flex-col ${isDragOver ? 'bg-blue-50 border-2 border-blue-300 border-dashed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Upload progress */}
        {uploading && uploadProgress.length > 0 && (
          <div className="bg-blue-50 p-2 border-b">
            <div className="text-sm font-medium text-blue-800 mb-1">Uploading tracks...</div>
            {uploadProgress.map((item, index) => (
              <div key={index} className="text-xs text-blue-600">
                {item.fileName}: {item.progress}%
              </div>
            ))}
          </div>
        )}

        {/* Tracks table */}
        <div className="flex-1 overflow-hidden">
          <TracksTable
            tracks={safeTracks}
            onSelectTrack={handleSelectTrack}
            onDeleteTrack={(trackId) => {
              setSelectedTrackId(trackId);
              setShowDeleteModal(true);
            }}
            onReorderTracks={handleReorderTracks}
            selectedTrackId={playbackCurrentTrack?.id || null}
            isPlaying={isPlaying}
            onTogglePlayback={togglePlayback}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onAddComment={handleAddComment}
            onSelectComment={handleSelectComment}
            markers={markers}
            waveSurferRef={waveSurferRef}
            regionsRef={regionsRef}
          />
        </div>

        {/* Audio player */}
        {playbackCurrentTrack && (
          <div className="border-t border-gray-200">
            <AudioPlayer
              track={playbackCurrentTrack}
              isPlaying={isPlaying}
              onTogglePlayback={togglePlayback}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onSeek={handleSeek}
              volume={volume}
              onVolumeChange={setVolume}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={setPlaybackSpeed}
              onAddComment={handleAddComment}
              onSelectComment={handleSelectComment}
              markers={markers}
              waveSurferRef={waveSurferRef}
              regionsRef={regionsRef}
            />
          </div>
        )}

        {/* Comments panel */}
        {showComments && playbackCurrentTrack && (
          <CommentsPanel
            trackId={playbackCurrentTrack.id}
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            selectedCommentId={selectedCommentId}
            onSelectComment={handleSelectComment}
            waveSurferRef={waveSurferRef}
            regionsRef={regionsRef}
          />
        )}

        {/* Show Comments button - always on the right */}
        {playbackCurrentTrack && !showComments && (
          <div className="absolute bottom-4 right-4">
            <button
              onClick={() => setShowComments(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
            >
              Show Comments
            </button>
          </div>
        )}

        {/* Delete confirmation modal */}
        <DeleteConfirmationModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteTrack}
          title="Delete Track"
          message={`Are you sure you want to delete "${tracks.find(t => t.id === selectedTrackId)?.name || 'this track'}"? This action cannot be undone.`}
          doNotAskAgain={doNotAskAgain}
          onDoNotAskAgainChange={setDoNotAskAgain}
        />

        {/* Comment modal */}
        {showCommentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-lg font-semibold mb-4">Add Comment at {Math.floor(commentTime)}s</h3>
              
              {error && (
                <div className="mb-4 p-2 bg-red-100 text-red-700 rounded">
                  {error}
                </div>
              )}
              
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder="Enter your comment..."
                className="w-full p-2 border border-gray-300 rounded mb-4 h-24 resize-none"
              />
              
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowCommentModal(false);
                    setCommentContent('');
                    setError(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitComment}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 