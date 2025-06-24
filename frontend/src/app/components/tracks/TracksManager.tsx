"use client";

import { useState, useRef, useEffect } from "react";
import FileUpload from "@/app/FileUpload";
import TracksTable from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { useTracks } from "@/app/providers/TracksProvider";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useComments } from "@/app/hooks/useComments";
import { Track, _Comment as Comment } from "../../../../../shared/types";

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
    currentTrack, 
    setCurrentTrackIndex,
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
  const [comments, setComments] = useState<Comment[]>([]);
  const { user, token } = useMockAuth(); // Replace with your actual auth hook
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [commentTime, setCommentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
      <div className="flex-1 overflow-auto p-4">
        {fetchError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {fetchError}
          </div>
        )}

        <div className="mb-4">
          <FileUpload onUploadSuccess={fetchTracks} />
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
