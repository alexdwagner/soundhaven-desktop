"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  selectedTrackIds?: string[]; // Add this to pass all selected track IDs
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
  selectedTrackIds = [],
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
    id: track.playlist_track_id || track.id,
    disabled: !isDragEnabled // Only disable when drag is not enabled
  });

  // Add debugging
  useEffect(() => {
    console.log(`🔧 [TRACK ITEM] ${track.name} - isDragEnabled: ${isDragEnabled}, isPlaylistView: ${isPlaylistView}, disabled: ${!isDragEnabled}`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - draggable: always true (for cross-playlist)`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - @dnd-kit listeners: ${isPlaylistView && isDragEnabled ? 'ACTIVE' : 'INACTIVE'} (for reordering)`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - custom handlers: ACTIVE (for cross-playlist)`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - Available listeners:`, Object.keys(listeners || {}));
  }, [isDragEnabled, isPlaylistView, track.name, listeners]);



  // Filter out drag-specific listeners but keep others (like pointer events)
  const nonDragListeners = useMemo(() => {
    if (!listeners || !isPlaylistView || !isDragEnabled) return {};
    
    const { onDragStart, onDragEnd, onDragOver, onDragEnter, onDragLeave, onDrop, ...rest } = listeners;
    console.log(`🔧 [TRACK ITEM] ${track.name} - Filtered listeners:`, Object.keys(rest));
    return rest;
  }, [listeners, isPlaylistView, isDragEnabled, track.name]);

  // Apply transform for playlist reordering, disable for cross-component drag
  const style = {
    // Re-enable @dnd-kit transforms for playlist reordering when enabled
    transform: (isPlaylistView && isDragEnabled) ? CSS.Transform.toString(transform) : 'none',
    transition: (isPlaylistView && isDragEnabled) ? transition : 'none',
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (event: React.MouseEvent) => {
    const uniqueKey = track.playlist_track_id || track.id;
    console.log('🐥 [TRACK ITEM] Track clicked:', {
      trackName: track.name,
      trackId: track.id,
      playlistTrackId: track.playlist_track_id,
      uniqueKey,
      isSelected,
      selectedTrackIds,
      event: event.type
    });
    onSelectTrack(uniqueKey.toString(), event);
  };

  const handleDoubleClick = () => {
    const uniqueKey = track.playlist_track_id || track.id;
    console.log('🐥 [TRACK ITEM] handleDoubleClick called for track:', track.name, 'with uniqueKey:', uniqueKey);
    onPlayTrack(uniqueKey.toString());
  };

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    if (onContextMenu) {
      const uniqueKey = track.playlist_track_id || track.id;
      onContextMenu(uniqueKey.toString(), event.clientX, event.clientY);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
    console.log(`🔥 [DEBUG] handleDragStart called! isPlaylistView: ${isPlaylistView}, isDragEnabled: ${isDragEnabled}`);
    console.log(`🔥 [DEBUG] Both @dnd-kit and native drag are active - they will coexist`);
    
    // Call @dnd-kit handler first if it exists and conditions are met
    if (isPlaylistView && isDragEnabled && listeners?.onDragStart) {
      console.log(`🔥 [DEBUG] Calling @dnd-kit dragStart handler first`);
      try {
        listeners.onDragStart(e);
      } catch (error) {
        console.error(`🔥 [DEBUG] Error calling @dnd-kit dragStart:`, error);
      }
    }
    
    // Always set up drag data for cross-playlist functionality
    // This works alongside @dnd-kit - both systems can handle the same drag
    const tracksToDrag = isSelected && selectedTrackIds.length > 0 ? selectedTrackIds : [track.id];
    
    console.log(`[DRAG N DROP] 🎵 Setting up drag data for ${tracksToDrag.length} track(s) from ${isPlaylistView ? 'playlist' : 'library'}`);
    console.log(`[DRAG N DROP] 🎵 Track IDs being dragged:`, tracksToDrag);
    
    try {
      // Always set track data for cross-playlist drops (playlists will read this)
      e.dataTransfer.setData("text/plain", JSON.stringify(tracksToDrag));
      e.dataTransfer.effectAllowed = "copy";
      console.log(`[DRAG N DROP] 🎵 DataTransfer set with ${tracksToDrag.length} track ID(s) for cross-playlist drops`);
      
      // Start our custom drag state for visual feedback
      startDrag(track, { x: e.clientX, y: e.clientY });
      setIsBeingDragged(true);
      console.log(`[DRAG N DROP] 🎵 Custom drag state initiated for visual feedback`);
      
      // Note: @dnd-kit will also handle this drag if listeners are active
      // The drop target determines which system processes the drop
      
    } catch (error) {
      console.error(`[DRAG N DROP] ❌ Error in handleDragStart:`, error);
    }
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    // Call @dnd-kit handler first if it exists and conditions are met
    if (isPlaylistView && isDragEnabled && listeners?.onDragEnd) {
      console.log(`🔥 [DEBUG] Calling @dnd-kit dragEnd handler first`);
      try {
        listeners.onDragEnd(e);
      } catch (error) {
        console.error(`🔥 [DEBUG] Error calling @dnd-kit dragEnd:`, error);
      }
    }
    
    // Use the exact same logic as library tracks
    console.log(`[DRAG N DROP] 🎵 Ended drag for track: ${track.id} from ${isPlaylistView ? 'playlist' : 'library'}`);
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

  // Helper function to format time (seconds to MM:SS)
  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-track-id={track.id} // Add track ID for drag event listener setup
      // Re-enable @dnd-kit attributes and listeners when drag is enabled for playlist reordering
      {...(isPlaylistView && isDragEnabled ? attributes : {})}
      {...(isPlaylistView && isDragEnabled ? listeners : {})}
      draggable={true} // Always enable native dragging for cross-playlist functionality
      onClick={(e) => {
        console.log('🐥 [TRACK ITEM] Track clicked:', track.name);
        handleClick(e);
      }}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onDragStart={handleDragStart} // Always attach native drag handlers
      onDragEnd={handleDragEnd} // Always attach native drag handlers
      className={`transition-all duration-200 select-none ${
        isPlaylistView && isDragEnabled
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
      <td 
        className="px-3 py-1"
      >
        {track.name}
      </td>
      <td className="px-3 py-1">{track.artistName ?? track.artist?.name ?? "Unknown Artist"}</td>
      <td className="px-3 py-1">{track.albumName ?? track.album?.name ?? "No Album"}</td>
      <td className="px-3 py-1">{track.year ?? "—"}</td>
      <td className="px-3 py-1">{formatTime(track.duration)}</td>
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
