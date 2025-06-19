"use client";

import React, { useState } from "react";
import { Playlist } from "../../../../../shared/types";
import { usePlaylists } from "@/app/hooks/UsePlaylists";
import { FaEllipsisH, FaEdit, FaTrash } from "react-icons/fa";

interface PlaylistItemProps {
  playlist: Playlist;
  onEdit: () => void;
  onSelect: (playlistId: number) => void;
  isSelected: boolean;
  onDelete: () => void;
  onDrop: (e: React.DragEvent<HTMLLIElement>) => void;
}

const PlaylistItem: React.FC<PlaylistItemProps> = ({
  playlist,
  onEdit,
  onSelect,
  isSelected,
  onDelete,
  onDrop,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [playlistName, setPlaylistName] = useState(playlist.name);
  const [showOptions, setShowOptions] = useState(false);
  const { updatePlaylistMetadata, addTrackToPlaylist } = usePlaylists();

  const handlePlaylistNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaylistName(e.target.value);
  };

  const handlePlaylistNameBlur = async () => {
    if (playlistName !== playlist.name) {
      try {
        const updatedPlaylist = await updatePlaylistMetadata(playlist.id, {
          name: playlistName,
        });
        // Update the local state with the new playlist data
        setPlaylistName(updatedPlaylist.name);
        // You might want to update other playlist properties here as well
      } catch (error) {
        console.error("Error updating playlist name:", error);
        // Revert the name change in the UI
        setPlaylistName(playlist.name);
      }
    }
    setIsEditing(false);
  };

  //   const handleDelete = async () => {
  //     await deletePlaylist(playlist.id);
  //   };

  const handleDrop = async (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    const trackId = e.dataTransfer.getData("text/plain");
    console.log(`Dropping track ${trackId} into playlist ${playlist.id}`);
    try {
      await addTrackToPlaylist(playlist.id, Number(trackId));
      console.log(
        `Successfully added track ${trackId} to playlist ${playlist.id}`
      );
    } catch (error) {
      console.error(
        `Failed to add track ${trackId} to playlist ${playlist.id}:`,
        error
      );
      // Optionally, you can show an error message to the user here
    }
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowOptions(!showOptions);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setShowOptions(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
    setShowOptions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePlaylistNameBlur();
    }
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect(playlist.id);
      }}
      className={`playlist-item flex items-center justify-between p-2 mb-2 rounded-lg cursor-pointer ${
        isSelected ? "bg-gray-700" : "hover:bg-gray-600"
      }`}
    >
      <li
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="w-full flex items-center justify-between"
      >
        {isEditing ? (
          <input
            value={playlistName}
            onChange={handlePlaylistNameChange}
            onBlur={handlePlaylistNameBlur}
            onKeyDown={(e) => {
              handleKeyDown(e);
              if (e.key === " ") {
                e.stopPropagation();
              }
            }}
            autoFocus
            className="bg-transparent border-b focus:outline-none w-full"
          />
        ) : (
          <>
            <span className="flex-1">{playlist.name}</span>
            <div className="relative">
              <FaEllipsisH
                className="ml-2 cursor-pointer"
                onClick={handleOptionsClick}
              />
              {showOptions && (
                <div className="absolute right-0 mt-2 py-2 w-48 bg-gray-700 rounded-md shadow-xl z-20">
                  <button
                    className="block px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
                    onClick={handleEditClick}
                  >
                    <FaEdit className="inline mr-2" />
                    Edit
                  </button>
                  <button
                    className="block px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
                    onClick={handleDeleteClick}
                  >
                    <FaTrash className="inline mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </li>
    </div>
  );
};

export default PlaylistItem;
