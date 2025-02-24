"use client";

import { useState, useEffect } from "react";
import FileUpload from "../FileUpload";
import TracksTable from "./TracksTable";
import AudioPlayer from "../audioPlayer/AudioPlayer";
import CommentsPanel from "../comments/CommentsPanel";
import DeleteConfirmationModal from "../modals/DeleteConfirmationModal";

export default function TracksManager() {
  const [tracks, setTracks] = useState([]);
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(null);

  // ✅ Fetch tracks via Electron IPC
  const fetchTracks = async () => {
    try {
      const result = await window.electron.getTracks();
      setTracks(result);
    } catch (error) {
      console.error("Error fetching tracks:", error);
      setFetchError("Failed to load tracks.");
    }
  };

  useEffect(() => {
    fetchTracks();
  }, []);

  const handleSelectTrack = (trackId: number) => {
    const track = tracks.find((t) => t.id === trackId);
    if (track) setCurrentTrack(track);
  };

  const handleDeleteTrack = async () => {
    if (selectedTrackId !== null) {
      try {
        await window.electron.deleteTrack(selectedTrackId);
        fetchTracks();
        setSelectedTrackId(null);
      } catch (error) {
        console.error("Error deleting track:", error);
        setFetchError("Failed to delete track.");
      }
    }
    setShowDeleteModal(false);
  };

  const handleReorderTracks = async (startIndex: number, endIndex: number) => {
    const reorderedTracks = [...tracks];
    const [reorderedItem] = reorderedTracks.splice(startIndex, 1);
    reorderedTracks.splice(endIndex, 0, reorderedItem);
    setTracks(reorderedTracks);
    // ✅ Send updated order to backend
    await window.electron.updateTrackOrder(reorderedTracks.map((track) => track.id));
  };

  return (
    <div>
      <button onClick={() => setShowComments(!showComments)} disabled={!currentTrack}>
        {showComments ? "Close Comments" : "Open Comments"}
      </button>

      {fetchError && <ErrorMessage message={fetchError} />}

      <div className="w-full px-8 items-center">
        <AudioPlayer track={currentTrack} />
      </div>

      <FileUpload onUploadSuccess={fetchTracks} />
      <TracksTable
        tracks={tracks}
        onSelectTrack={handleSelectTrack}
        setSelectedTrackId={setSelectedTrackId}
        onReorderTracks={handleReorderTracks}
      />

      {currentTrack?.id && showComments && (
        <CommentsPanel trackId={currentTrack.id} show={showComments} />
      )}

      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteTrack}
      />
    </div>
  );
}
