"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import TracksTable from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
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
  console.log('🎯 TracksManager component rendering...');
  
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
  
  console.log('🎯 TracksManager state:', {
    tracks: tracks,
    safeTracks: safeTracks,
    safeTracksLength: safeTracks.length,
    playbackCurrentTrack: playbackCurrentTrack
  });
  
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

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

  // Removed hardcoded test markers - using real comment system now

  const handleSelectTrack = useCallback((trackId: number) => {
    console.log('🎵 handleSelectTrack called with trackId:', trackId);
    console.log('🎵 Available tracks:', tracks);
    
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
  }, [tracks, setCurrentTrackIndex, selectTrack]);

  // Auto-select first track for testing
  useEffect(() => {
    console.log('🎵 Auto-select useEffect triggered:', {
      safeTracksLength: safeTracks.length,
      playbackCurrentTrack: playbackCurrentTrack,
      firstTrack: safeTracks[0]
    });
    
    if (safeTracks.length > 0 && !playbackCurrentTrack) {
      console.log('🎵 Auto-selecting first track for testing:', safeTracks[0]);
      handleSelectTrack(safeTracks[0].id);
    } else if (safeTracks.length === 0) {
      console.log('❌ No tracks available for auto-select');
    } else if (playbackCurrentTrack) {
      console.log('❌ Track already selected:', playbackCurrentTrack);
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
        alert(`Some files were rejected:\n${errors.join('\n')}`);
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
        className={`flex-1 overflow-auto p-4 transition-colors ${
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
          <div className="mb-4 bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Uploading Files...</h3>
            <div className="space-y-3">
              {uploadProgress.map((item, index) => (
                <div key={index} className="bg-gray-50 rounded-md p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-900">{item.fileName}</span>
                    <span className="text-sm text-gray-500">{item.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Simple Upload Button for Testing */}
        <div className="mb-4">
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
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer mr-2"
          >
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            Upload Audio Files
          </label>
          
          {/* Debug IPC Test Button */}
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
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 cursor-pointer mr-2"
          >
            🔧 Test IPC
          </button>
          
          {/* Database Integrity Test Button */}
          <button
            onClick={testDatabaseIntegrity}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer mr-2"
          >
            🔍 Check DB Integrity
          </button>
          
          {/* Cleanup Orphaned Files Button */}
          <button
            onClick={testCleanupOrphaned}
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 cursor-pointer mr-2"
          >
            🧹 Cleanup Orphaned
          </button>
          
          {/* Fix Invalid Paths Button */}
          <button
            onClick={testFixPaths}
            className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer"
          >
            🔧 Fix Paths
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <TracksTable
            tracks={safeTracks}
            onSelectTrack={handleSelectTrack}
            setSelectedTrackId={setSelectedTrackId}
            onReorderTracks={handleReorderTracks}
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
