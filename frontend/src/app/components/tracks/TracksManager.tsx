"use client";

import { useState, useRef } from "react";
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

  // Add refs for WaveSurfer and regions
  const waveSurferRef = useRef(null);
  const regionsRef = useRef(null);

  // Add comments functionality
  const { addMarkerAndComment, fetchCommentsAndMarkers } = useComments(waveSurferRef, regionsRef);

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
    console.log('Seeking to:', time);
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
      return;
    }

    try {
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
        await fetchCommentsAndMarkers(playbackCurrentTrack.id, 1, 10);
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment. Please try again.');
    }
  };

  const handleSelectComment = (commentId: number) => {
    console.log('Comment selected:', commentId);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Audio player at the top */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {playbackCurrentTrack ? playbackCurrentTrack.name : 'No track selected'}
          </h3>
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
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
            comments={[]}
            addComment={async () => {}}
            handleCommentClick={() => {}}
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
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
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
