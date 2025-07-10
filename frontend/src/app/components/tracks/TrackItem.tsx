"use client";

import React, { useState, useEffect } from "react";
import { Track } from "../../../../../shared/types";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaTrash } from "react-icons/fa";
import { useDrag } from "@/app/contexts/DragContext";

interface TrackItemProps {
  track: Track;
  index: number;
  onSelectTrack: (trackId: string, event?: React.MouseEvent) => void;
  onPlayTrack: (trackId: string) => void;
  isSelected: boolean;
  onRemoveFromPlaylist?: (trackId: string) => void;
  isPlaylistView?: boolean;
  isDragEnabled?: boolean;
  onContextMenu?: (trackId: string, x: number, y: number) => void;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  index,
  onSelectTrack,
  onPlayTrack,
  isSelected,
  onRemoveFromPlaylist,
  isPlaylistView = false,
  isDragEnabled = true,
  onContextMenu,
}) => {
  const { dragState, startDrag, endDrag } = useDrag();
  const [isBeingDragged, setIsBeingDragged] = useState(false);

  // Always call useSortable hook (required by React rules)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: track.id,
    disabled: !isDragEnabled // Only disable based on isDragEnabled
  });

  // Add debugging
  useEffect(() => {
    console.log(`🔧 [TRACK ITEM] ${track.name} - isDragEnabled: ${isDragEnabled}, isPlaylistView: ${isPlaylistView}, disabled: ${!isDragEnabled}`);
  }, [isDragEnabled, isPlaylistView, track.name]);

  // Apply transform for playlist reordering, disable for cross-component drag
  const style = {
    transform: (isPlaylistView && isDragEnabled) ? CSS.Transform.toString(transform) : 'none',
    transition: (isPlaylistView && isDragEnabled) ? transition : 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (event: React.MouseEvent) => {
    onSelectTrack(track.id, event);
  };

  const handleDoubleClick = () => {
    onPlayTrack(track.id);
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (onContextMenu) {
      onContextMenu(track.id, event.clientX, event.clientY);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
    // Only use custom drag system for library view (dragging to playlists)
    if (isPlaylistView) {
      // In playlist view, let @dnd-kit handle the drag
      e.preventDefault();
      return;
    }

    console.log(`[DRAG N DROP] 🎵 Starting drag for track: ${track.id} - ${track.name}`);
    console.log(`[DRAG N DROP] 🎵 Track object:`, track);
    console.log(`[DRAG N DROP] 🎵 Mouse position: ${e.clientX}, ${e.clientY}`);
    
    try {
      e.dataTransfer.setData("text/plain", track.id.toString());
      e.dataTransfer.effectAllowed = "copy";
      console.log(`[DRAG N DROP] 🎵 DataTransfer set with track ID: ${track.id}`);
      
      // Create an invisible drag image to hide the default one
      const dragImage = document.createElement('div');
      dragImage.style.opacity = '0';
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      console.log(`[DRAG N DROP] 🎵 Custom drag image created and set`);
      
      // Start our custom drag
      startDrag(track, { x: e.clientX, y: e.clientY });
      setIsBeingDragged(true);
      console.log(`[DRAG N DROP] 🎵 Custom drag state initiated`);
      
      // Clean up the drag image element
      setTimeout(() => {
        document.body.removeChild(dragImage);
        console.log(`[DRAG N DROP] 🎵 Drag image cleaned up`);
      }, 0);
    } catch (error) {
      console.error(`[DRAG N DROP] ❌ Error in handleDragStart:`, error);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    // Only handle custom drag end for library view
    if (isPlaylistView) {
      return;
    }

    console.log(`[DRAG N DROP] 🎵 Ended drag for track: ${track.id}`);
    console.log(`[DRAG N DROP] 🎵 Drop effect: ${e.dataTransfer.dropEffect}`);
    console.log(`[DRAG N DROP] 🎵 DataTransfer types:`, e.dataTransfer.types);
    
    try {
      endDrag();
      setIsBeingDragged(false);
      console.log(`[DRAG N DROP] 🎵 Drag cleanup completed`);
    } catch (error) {
      console.error(`[DRAG N DROP] ❌ Error in handleDragEnd:`, error);
    }
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent track selection
    if (onRemoveFromPlaylist) {
      if (confirm(`Remove "${track.name}" from this playlist?`)) {
        onRemoveFromPlaylist(track.id);
      }
    }
  };

  useEffect(() => {
    console.log("🎨 [TRACK ITEM] Rendering track:", {
      id: track.id,
      name: track.name,
      artistName: track.artistName,
      artistId: track.artistId,
      albumName: track.albumName,
      year: track.year,
      hasArtistName: !!track.artistName,
      hasArtistId: !!track.artistId,
      fallbackArtist: track.artist?.name,
      fullTrackKeys: Object.keys(track)
    });
  }, [track]);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      draggable={!isPlaylistView} // Only draggable in library view for playlist drops
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={!isPlaylistView ? handleDragStart : undefined}
      onDragEnd={!isPlaylistView ? handleDragEnd : undefined}
      className={`transition-all duration-200 select-none ${
        isPlaylistView && isDragging 
          ? "cursor-grabbing" // Grabbing cursor when dragging in playlist
          : isPlaylistView && isDragEnabled
            ? "cursor-grab" // Grab cursor in playlist view when drag is enabled
            : "cursor-pointer" // Normal pointer otherwise
      } ${
        isSelected 
          ? "bg-blue-100 hover:bg-blue-200" // Selected track styling
          : "hover:bg-gray-200" // Normal hover styling
      } ${
        dragState.isDragging && !isBeingDragged
          ? "opacity-75" // Dim other tracks when something is being dragged
          : ""
      }`}
    >
      <td className="px-3 py-1">{track.name}</td>
      <td className="px-3 py-1">{track.artistName ?? track.artist?.name ?? "Unknown Artist"}</td>
      <td className="px-3 py-1">{track.albumName ?? track.album?.name ?? "No Album"}</td>
      <td className="px-3 py-1">{track.year ?? "—"}</td>
      <td className="px-3 py-1">{track.duration}</td>
      {isPlaylistView && (
        <td className="px-3 py-1">
          <button
            onClick={handleRemoveClick}
            className="text-red-500 hover:text-red-700 p-1 rounded"
            title="Remove from playlist"
          >
            <FaTrash size={12} />
          </button>
        </td>
      )}
    </tr>
  );
};

export default TrackItem;
