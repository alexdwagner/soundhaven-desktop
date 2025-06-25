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

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers, markers, setMarkers, selectedCommentId } = useComments(waveSurferRef, regionsRef);

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

  const handleSelectTrack = (trackId: number) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
    }
  };

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
      
      // Refresh comments to show the new comment
      if (fetchCommentsAndMarkers) {
        console.log('Refreshing comments after adding new comment');
        try {
          await fetchCommentsAndMarkers(playbackCurrentTrack.id, 1, 10);
        } catch (refreshError) {
          console.error('Failed to refresh comments after adding new comment:', refreshError);
          // Don't throw here, as the comment was already added successfully
        }
      }
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
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 cursor-pointer"
          >
            🔧 Test IPC
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
