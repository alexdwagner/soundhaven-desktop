"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Playlist, Track } from "../../../types/types";
import { usePlaylists } from "@/app/hooks/UsePlaylists";
import { useAuth } from "@/app/hooks/UseAuth";
import { useTracks } from "@/app/hooks/UseTracks";
import PlaylistItem from "./PlaylistItem";
import DuplicateTrackModal from "../modals/DuplicateTrackModal";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface PlaylistSidebarProps {
  onSelectPlaylist: (tracks: Track[], playlistId: number) => void;
  onViewAllTracks: () => void;
  onDeletePlaylist: (playlistId: number) => void;
}

const PlaylistSidebar: React.FC<PlaylistSidebarProps> = ({
  onSelectPlaylist,
  onViewAllTracks,
  onDeletePlaylist,
}) => {
  const { playlists, createPlaylist, deletePlaylist, fetchPlaylists, fetchPlaylistById, updatePlaylistOrder, setPlaylists } = usePlaylists();
  const { user, token } = useAuth();
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const libraryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (token) fetchPlaylists();
  }, [token, fetchPlaylists]);

  const handleCreatePlaylist = async () => {
    try {
      if (!user) throw new Error("User not authenticated");
      const newPlaylist = await createPlaylist({ name: `New Playlist ${playlists.length + 1}`, userId: user.id, description: "A new playlist" });
      if (newPlaylist) setPlaylists([...playlists, newPlaylist]);
    } catch (error) {
      console.error("Error creating playlist:", error);
      setError(error instanceof Error ? error.message : "Failed to create playlist");
    }
  };

  const handlePlaylistSelect = async (playlistId: number) => {
    try {
      const playlist = await fetchPlaylistById(playlistId);
      if (playlist?.tracks) {
        onSelectPlaylist(playlist.tracks, playlistId);
        setSelectedPlaylistId(playlistId);
      } else {
        setError("Failed to load playlist tracks");
      }
    } catch (error) {
      console.error("Error fetching playlist:", error);
      setError("Failed to load playlist");
    }
  };

  const handleDeletePlaylist = async (playlistId: number) => {
    try {
      await deletePlaylist(playlistId);
      setSelectedPlaylistId(null);
      onDeletePlaylist(playlistId);
      libraryButtonRef.current?.focus();
    } catch (error) {
      console.error("Error deleting playlist:", error);
      setError("Failed to delete playlist");
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = playlists.findIndex((p) => p.id === Number(active.id));
      const newIndex = playlists.findIndex((p) => p.id === Number(over.id));
      const reorderedPlaylists = arrayMove(playlists, oldIndex, newIndex);
      setPlaylists(reorderedPlaylists);
      updatePlaylistOrder(reorderedPlaylists.map((p) => p.id));
    }
  };

  if (!token) return null;

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="playlist-sidebar p-4 bg-gray-800 text-white min-w-48">
        <button className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-2 rounded" onClick={handleCreatePlaylist}>
          Add Playlist
        </button>
        <button ref={libraryButtonRef} className="w-full hover:text-blue-400 text-white font-bold py-2 mt-2 rounded my-1 text-left" onClick={onViewAllTracks}>
          {user ? `${user.name}'s Library` : "Anon’s Library"}
        </button>

        <h3 className="font-bold my-1 py-2 border-b border-t border-gray-600">Playlists</h3>

        <SortableContext items={playlists.map((p) => p.id.toString())} strategy={verticalListSortingStrategy}>
          <ul className="px-1">
            {playlists.map((playlist) => (
              <PlaylistItem key={playlist.id} playlist={playlist} onSelect={() => handlePlaylistSelect(playlist.id)} isSelected={playlist.id === selectedPlaylistId} onDelete={() => handleDeletePlaylist(playlist.id)} />
            ))}
          </ul>
        </SortableContext>
      </div>
    </DndContext>
  );
};

export default PlaylistSidebar;
