"use client";

import { useState, useRef } from "react";
import FileUpload from "@/app/FileUpload";
import TracksTable from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";
import { useTracks } from "@/app/providers/TracksProvider";
import { Track, Comment, Region } from "@/shared/types";
import WaveSurfer from "wavesurfer.js";
import { Regions } from "wavesurfer.js/plugins/regions";

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
  
  // Ensure tracks is always an array to prevent map errors
  const safeTracks = Array.isArray(tracks) ? tracks : [];
  
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const wavesurferRef = useRef<Regions | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const { user, token } = useMockAuth(); // Replace with your actual auth hook

  const handleSelectTrack = (trackId: number) => {
    const trackIndex = tracks.findIndex((t) => t.id === trackId);
    if (trackIndex !== -1) {
      setCurrentTrackIndex(trackIndex);
    }
  };

  const handleDeleteTrack = async () => {
    if (selectedTrackId !== null) {
      try {
        await deleteTrack(selectedTrackId);
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

  return (
    <div className="w-full h-full flex flex-col">
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

        {currentTrack?.id && showComments && (
          <div className="mt-4 p-4 border rounded-lg bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Comments</h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex justify-between">
                      <span className="font-medium">{comment.user.name}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(comment.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-1">{comment.content}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No comments yet. Be the first to comment!</p>
              )}
              <div className="mt-4">
                <textarea
                  className="w-full p-2 border rounded"
                  placeholder="Add a comment..."
                  rows={3}
                />
                <button
                  className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    // TODO: Implement add comment functionality
                  }}
                >
                  Post Comment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Audio player fixed at the bottom */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {currentTrack ? currentTrack.name : 'No track selected'}
          </h3>
          <button
            onClick={() => setShowComments(!showComments)}
            disabled={!currentTrack}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              currentTrack 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {showComments ? 'Hide Comments' : 'Show Comments'}
          </button>
        </div>
        <AudioPlayer track={currentTrack} />
      </div>

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTrack}
      />
    </div>
  );
}
