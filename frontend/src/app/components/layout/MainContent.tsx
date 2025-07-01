"use client";

import { useState } from "react";
import PlaylistSidebar from "../playlists/PlaylistSidebar";
import TracksManager from "../tracks/TracksManager";
import { Track } from "../../../../shared/types";

export default function MainContent() {
  const [selectedPlaylistTracks, setSelectedPlaylistTracks] = useState<Track[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedPlaylistName, setSelectedPlaylistName] = useState<string | null>(null);

  const handleSelectPlaylist = (tracks: Track[], playlistId: string, playlistName?: string) => {
    console.log("📋 Playlist selected:", { playlistId, playlistName, tracksCount: tracks.length });
    setSelectedPlaylistTracks(tracks);
    setSelectedPlaylistId(playlistId);
    setSelectedPlaylistName(playlistName || 'Unknown Playlist');
  };

  const handleViewAllTracks = () => {
    console.log("📚 View all tracks selected");
    setSelectedPlaylistTracks([]);
    setSelectedPlaylistId(null);
    setSelectedPlaylistName(null);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    console.log("🗑️ Playlist deleted:", playlistId);
    // If the deleted playlist was selected, go back to all tracks
    if (selectedPlaylistId === playlistId) {
      handleViewAllTracks();
    }
  };

  return (
    <main className="flex flex-col p-2 mx-auto w-full h-screen">
      <div className="flex h-full gap-2">
        <div className="w-1/5 flex-shrink-0">
          <PlaylistSidebar 
            onSelectPlaylist={handleSelectPlaylist}
            onViewAllTracks={handleViewAllTracks}
            onDeletePlaylist={handleDeletePlaylist}
          />
        </div>
        <div className="w-4/5 flex-1 min-w-0">
          <TracksManager 
            selectedPlaylistTracks={selectedPlaylistTracks}
            selectedPlaylistId={selectedPlaylistId}
            selectedPlaylistName={selectedPlaylistName}
          />
        </div>
      </div>
    </main>
  );
}
