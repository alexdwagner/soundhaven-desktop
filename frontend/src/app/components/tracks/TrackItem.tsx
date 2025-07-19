"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Track } from "../../../../../shared/types";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaTrash, FaTag } from "react-icons/fa";
import { useDrag } from "@/app/contexts/DragContext";
import { ColumnVisibility } from '@/app/hooks/useColumnVisibility';

interface TrackItemProps {
  track: Track;
  index: number;
  onSelectTrack: (trackId: string, event?: React.MouseEvent) => void;
  onPlayTrack: (trackId: string) => void;
  isSelected: boolean;
  selectedTrackIds?: string[]; // Add this to pass all selected track IDs
  allTracks?: Track[]; // All tracks in the current view to help with ID mapping
  onRemoveFromPlaylist?: (trackId: string) => void;
  isPlaylistView?: boolean;
  currentPlaylistId?: string | null; // Add playlist context
  isDragEnabled?: boolean;
  onContextMenu?: (trackId: string, x: number, y: number) => void;
  columnVisibility: ColumnVisibility;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  index,
  onSelectTrack,
  onPlayTrack,
  isSelected,
  selectedTrackIds = [],
  allTracks = [],
  onRemoveFromPlaylist,
  isPlaylistView = false,
  currentPlaylistId = null,
  isDragEnabled = true,
  onContextMenu,
  columnVisibility,
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
    // disabled: !isDragEnabled, // Temporarily disable this to test drag detection
    data: {
      type: 'track',
      trackId: track.id,
      trackName: track.name,
      isPlaylistView,
      selectedTrackIds: isSelected ? selectedTrackIds : [track.id],
      playlistTrackId: track.playlist_track_id
    }
  });

  // Wrap @dnd-kit listeners with our logging while preserving their functionality
  const dragListeners = useMemo(() => {
    if (!listeners || !isDragEnabled) return {};
    
    console.log(`🔧 [TRACK ITEM] ${track.name} - Original listeners:`, Object.keys(listeners));
    console.log(`🔧 [TRACK ITEM] ${track.name} - Using all listeners for @dnd-kit drag detection (${isPlaylistView ? 'playlist' : 'library'} view)`);
    console.log(`👉 [TRACK ITEM] ${track.name} - Raw listeners object:`, listeners);
    
    // Wrap the onPointerDown to add logging while preserving @dnd-kit functionality
    const wrappedListeners = { ...listeners };
    if (wrappedListeners.onPointerDown) {
      console.log(`👉 [TRACK ITEM] ${track.name} - Found onPointerDown, wrapping it`);
      const originalOnPointerDown = wrappedListeners.onPointerDown;
      wrappedListeners.onPointerDown = (e: any) => {
        console.log(`👉 [TRACK POINTER] ${track.name} - onPointerDown triggered`);
        console.log(`🖱️ [TRACK ITEM] ${track.name} - onPointerDown triggered!`, e);
        console.log(`👉 [TRACK POINTER] ${track.name} - calling @dnd-kit onPointerDown`);
        originalOnPointerDown(e);
      };
    } else {
      console.log(`👉 [TRACK ITEM] ${track.name} - NO onPointerDown found in listeners!`);
    }
    
    if (wrappedListeners.onMouseDown) {
      console.log(`👉 [TRACK ITEM] ${track.name} - Found onMouseDown, wrapping it`);
      const originalOnMouseDown = wrappedListeners.onMouseDown;
      wrappedListeners.onMouseDown = (e: any) => {
        console.log(`👉 [TRACK MOUSE] ${track.name} - onMouseDown triggered`);
        console.log(`👉 [TRACK MOUSE] ${track.name} - calling @dnd-kit onMouseDown`);
        originalOnMouseDown(e);
      };
    }
    
    console.log(`👉 [TRACK ITEM] ${track.name} - Final wrapped listeners:`, Object.keys(wrappedListeners));
    return wrappedListeners;
  }, [listeners, isDragEnabled, track.name, isPlaylistView]);

  const { isPlaying, currentTrack, currentTrackIndex: playbackCurrentTrackIndex, currentPlaylistContext } = usePlayback();

  // Apply drag transform and transition when drag is enabled
  const style = {
    transform: isDragEnabled ? CSS.Transform.toString(transform) : 'none',
    transition: isDragEnabled ? transition : 'none',
    opacity: isDragging ? 0.6 : 1, // Less transparent (0.6 instead of 0.3)
    scale: isDragging ? 0.98 : 1, // Smaller scale change (0.98 instead of 0.95)
    zIndex: isDragging ? 100 : 'auto', // Lower z-index (100 instead of 1000)
    boxShadow: isDragging ? '0 4px 12px rgba(0, 0, 0, 0.2)' : 'none', // Softer shadow
  };

  // Debug logging for isDragging state (moved after style declaration)
  useEffect(() => {
    if (isDragging) {
      console.log(`👉 [TRACK DRAG] ${track.name} - isDragging: TRUE`);
      console.log(`🚀 [TRACK ITEM] ${track.name} - isDragging: TRUE (should show enhanced styling)`);
      console.log(`🚀 [TRACK ITEM] ${track.name} - style:`, style);
    } else {
      console.log(`👉 [TRACK DRAG] ${track.name} - isDragging: FALSE`);
    }
  }, [isDragging, track.name, style]);

  // Enhanced current track detection - only highlight the specific instance that's playing
  const isCurrentTrack = currentTrack?.id === track.id && 
                         playbackCurrentTrackIndex === index &&
                         currentPlaylistContext.isPlaylistView === isPlaylistView &&
                         currentPlaylistContext.playlistId === currentPlaylistId;
  
  // Debug logging for current track detection (only when track is actually current)
  if (isCurrentTrack || (currentTrack?.id === track.id && !isCurrentTrack)) {
    console.log(`🎵 [TRACK HIGHLIGHT] ${track.name} - isCurrentTrack:`, isCurrentTrack, {
      trackIdMatch: currentTrack?.id === track.id,
      indexMatch: playbackCurrentTrackIndex === index,
      contextMatch: currentPlaylistContext.isPlaylistView === isPlaylistView,
      playlistIdMatch: currentPlaylistContext.playlistId === currentPlaylistId,
      playbackIndex: playbackCurrentTrackIndex,
      thisIndex: index,
      playbackContext: currentPlaylistContext,
      thisContext: { isPlaylistView, currentPlaylistId }
    });
  }

  // Track selection with proper event handling
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🐥 [TRACK ITEM] Click event:', {
      trackId: track.id,
      trackName: track.name,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      selectedTrackIds: selectedTrackIds
    });
    
    // Call the selection handler
    onSelectTrack(track.id, e);
  };

  // Double-click to play track
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🐥 [TRACK ITEM] Double-click event:', {
      trackId: track.id,
      trackName: track.name
    });
    
    onPlayTrack(track.id);
  };

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onContextMenu) {
      onContextMenu(track.id, e.clientX, e.clientY);
    }
  };

  // Remove from playlist handler
  const handleRemoveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onRemoveFromPlaylist) {
      onRemoveFromPlaylist(track.id);
    }
  };

  // Effect to sync drag state
  useEffect(() => {
    if (!isDragging && isBeingDragged) {
      setIsBeingDragged(false);
    }
  }, [isDragging, isBeingDragged]);

  // Add debugging like the working version
  useEffect(() => {
    console.log(`🔧 [TRACK ITEM] ${track.name} - isDragEnabled: ${isDragEnabled}, isPlaylistView: ${isPlaylistView}, view: ${isPlaylistView ? 'playlist' : 'library'}`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - draggable: ${isDragEnabled ? 'ENABLED' : 'DISABLED'} (for ${isPlaylistView ? 'reordering & cross-playlist' : 'cross-playlist only'})`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - @dnd-kit listeners: ${isDragEnabled ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`🔧 [TRACK ITEM] ${track.name} - Available listeners:`, Object.keys(listeners || {}));
  }, [isDragEnabled, isPlaylistView, track.name, listeners]);

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  const renderTagsCell = () => {
    if (!track.tags || track.tags.length === 0) {
      return <span className="text-gray-400 text-xs">No tags</span>;
    }

    return (
      <div className="flex flex-wrap gap-1 max-w-48">
        {track.tags.slice(0, 3).map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: tag.color }}
            title={`${tag.name} (${tag.type}${tag.confidence ? `, ${Math.round(tag.confidence * 100)}%` : ''})`}
          >
            {tag.type === 'auto' && <FaTag size={8} />}
            {tag.name}
          </span>
        ))}
        {track.tags.length > 3 && (
          <span className="text-xs text-gray-500">
            +{track.tags.length - 3} more
          </span>
        )}
      </div>
    );
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-track-id={track.id}
      {...attributes}
      {...dragListeners}
      onClick={(e) => {
        console.log('👉 [TRACK CLICK] Track clicked:', track.name);
        console.log('🐥 [TRACK ITEM] Track clicked:', track.name);
        handleClick(e);
      }}

      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      className={`transition-all duration-200 select-none relative ${
        isDragging 
          ? "cursor-grabbing shadow-md border border-blue-300 bg-blue-25 opacity-80" // Dragging state (for both views)
          : isDragEnabled
            ? "cursor-grab hover:shadow-sm" // Grab cursor when drag is enabled (for both views)
            : "cursor-pointer" // Normal pointer otherwise
      } ${
        isSelected 
          ? "bg-blue-100 hover:bg-blue-200" // Selected track styling
          : "hover:bg-gray-100" // Lighter hover styling
      } ${
        dragState.isDragging && !isBeingDragged
          ? "opacity-75" // Less dim for other tracks
          : ""
      }`}
    >
      {columnVisibility.name && (
        <td className="px-3 py-1">
          <div className="flex items-center gap-2">
            {isCurrentTrack && (
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            )}
            <span className={isCurrentTrack ? "font-semibold text-blue-600" : ""}>
              {track.name}
            </span>
          </div>
        </td>
      )}
      
      {columnVisibility.artistName && (
        <td className="px-3 py-1">{track.artistName ?? track.artist?.name ?? "Unknown Artist"}</td>
      )}
      
      {columnVisibility.albumName && (
        <td className="px-3 py-1">{track.albumName ?? track.album?.name ?? "No Album"}</td>
      )}
      
      {columnVisibility.year && (
        <td className="px-3 py-1">{track.year ?? "—"}</td>
      )}
      
      {columnVisibility.duration && (
        <td className="px-3 py-1">{formatTime(track.duration)}</td>
      )}
      
      {columnVisibility.tags && (
        <td className="px-3 py-1">
          {renderTagsCell()}
        </td>
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