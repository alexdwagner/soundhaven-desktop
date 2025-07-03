"use client";

import React, { useState, useEffect } from "react";
import { Track } from "../../../../../shared/types";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaTrash } from "react-icons/fa";
import { useDrag } from "@/app/contexts/DragContext";

interface VisibleColumns {
  title: boolean;
  artist: boolean;
  album: boolean;
  year: boolean;
  duration: boolean;
}

interface TrackItemProps {
  track: Track;
  index: number;
  onSelectTrack: (trackId: string, event?: React.MouseEvent) => void;
  onPlayTrack: (trackId: string) => void;
  isSelected: boolean;
  onRemoveFromPlaylist?: (trackId: string) => void;
  isPlaylistView?: boolean;
  onContextMenu?: (trackId: string, x: number, y: number) => void;
  visibleColumns?: VisibleColumns;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  index,
  onSelectTrack,
  onPlayTrack,
  isSelected,
  onRemoveFromPlaylist,
  isPlaylistView = false,
  onContextMenu,
  visibleColumns = { title: true, artist: true, album: true, year: true, duration: true },
}) => {
  const { dragState, startDrag, endDrag } = useDrag();
  const [isBeingDragged, setIsBeingDragged] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: track.id,
    disabled: !isPlaylistView // Only enable sortable in playlist view
  });

  // Log sortable state for debugging
  useEffect(() => {
    console.log(`🎵 [TRACK ITEM] ${track.name} sortable state:`, {
      id: track.id,
      isPlaylistView,
      disabled: !isPlaylistView,
      isDragging,
      hasListeners: !!listeners,
      hasAttributes: !!attributes
    });
  }, [track.id, track.name, isPlaylistView, isDragging, listeners, attributes]);

  // Apply transform for playlist reordering, disable for cross-component drag
  const style = {
    transform: isPlaylistView ? CSS.Transform.toString(transform) : 'none',
    transition: isPlaylistView ? transition : 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (event: React.MouseEvent) => {
    console.log('🎵 [TRACK ITEM] Click event triggered:', {
      trackId: track.id,
      trackName: track.name,
      isPlaylistView,
      event: event.type
    });
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
      e.dataTransfer.setData("text/track-name", track.name || "Unknown Track");
      e.dataTransfer.effectAllowed = "copy";
      console.log(`[DRAG N DROP] 🎵 DataTransfer set with track ID: ${track.id} and name: ${track.name}`);
      
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

  // Enhanced click handler that works with sortable in playlist view
  const handleEnhancedClick = (event: React.MouseEvent) => {
    console.log('🎵 [TRACK ITEM] Enhanced click handler:', {
      trackId: track.id,
      isPlaylistView,
      isDragging,
      eventType: event.type
    });
    
    // Always handle click events, but in playlist view we need to be careful
    // The sortable library should allow clicks when not dragging
    handleClick(event);
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...(isPlaylistView ? attributes : {})}
      {...(isPlaylistView ? listeners : {})}
      draggable={!isPlaylistView} // Only draggable in library view for playlist drops
      onClick={handleEnhancedClick} // Always use onClick, but with enhanced logic
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={!isPlaylistView ? handleDragStart : undefined}
      onDragEnd={!isPlaylistView ? handleDragEnd : undefined}
      data-track-id={track.id}
      data-track-name={track.name}
      data-is-playlist-view={isPlaylistView}
      data-sortable-enabled={isPlaylistView}
      className={`transition-all duration-200 select-none ${
        isPlaylistView && isDragging 
          ? "cursor-grabbing" // Grabbing cursor when dragging in playlist
          : isPlaylistView 
            ? "cursor-grab" // Grab cursor in playlist view
            : "cursor-pointer" // Normal pointer in library view
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
      {visibleColumns.title && (
        <td className="px-3 py-1">{track.name}</td>
      )}
      {visibleColumns.artist && (
        <td className="px-3 py-1">{track.artistName ?? track.artist?.name ?? "Unknown Artist"}</td>
      )}
      {visibleColumns.album && (
        <td className="px-3 py-1">{track.albumName ?? track.album?.name ?? "No Album"}</td>
      )}
      {visibleColumns.year && (
        <td className="px-3 py-1">{track.year ?? "—"}</td>
      )}
      {visibleColumns.duration && (
        <td className="px-3 py-1">{track.duration}</td>
      )}
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
