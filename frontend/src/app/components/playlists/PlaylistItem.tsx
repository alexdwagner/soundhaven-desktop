"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Playlist } from "../../../../../shared/types";
import { usePlaylists } from "../../providers/PlaylistsProvider";
import { FaEllipsisH, FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { useDrag } from "@/app/contexts/DragContext";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface PlaylistItemProps {
  playlist: Playlist;
  onEdit?: () => void;
  onSelect: (playlistId: string) => void;
  isSelected: boolean;
  onDelete: () => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [isBeingDragged, setIsBeingDragged] = useState(false);
  const [dragTrackCount, setDragTrackCount] = useState(1); // Track how many tracks are being dragged
  const { updatePlaylistMetadata, addTrackToPlaylist, addTracksToPlaylist } = usePlaylists();
  const { dragState } = useDrag();
  const optionsRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragTimeout = useRef<NodeJS.Timeout | null>(null);
  const isDragActive = useRef(false);

  // Sortable functionality for playlist reordering
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: playlist.id });

  // Handle clicking outside the options menu to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        console.log('[EDIT PLAYLIST] Clicked outside options menu, closing menu');
        setShowOptions(false);
      }
    };

    if (showOptions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showOptions]);

  const handlePlaylistNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPlaylistName(e.target.value);
  };

  const handlePlaylistNameBlur = async () => {
    console.log(`[EDIT PLAYLIST] Step 1: handlePlaylistNameBlur called for playlist ID: ${playlist.id}`);
    if (playlistName !== playlist.name) {
      console.log(`[EDIT PLAYLIST] Name changed from "${playlist.name}" to "${playlistName}". Proceeding with update.`);
      try {
        await updatePlaylistMetadata(playlist.id, {
          name: playlistName,
        });
        console.log(`[EDIT PLAYLIST] Step 1 Success: updatePlaylistMetadata call finished.`);
        // The UI is already updated, and the provider handles the backend sync.
        // No need to set the name again from the return value.
      } catch (error) {
        console.error("[EDIT PLAYLIST] Step 1 Failure: Error calling updatePlaylistMetadata:", error);
        // Revert the name change in the UI
        setPlaylistName(playlist.name);
      }
    } else {
      console.log(`[EDIT PLAYLIST] Name not changed. Skipping update.`);
    }
    setIsEditing(false);
  };

  //   const handleDelete = async () => {
  //     await deletePlaylist(playlist.id);
  //   };

  const handleDrop = async (e: React.DragEvent<HTMLLIElement>) => {
    console.log(`🔥 [PLAYLIST DEBUG] ===== DROP EVENT TRIGGERED =====`);
    console.log(`🔥 [PLAYLIST DEBUG] Drop on playlist ${playlist.id} (${playlist.name})`);
    console.log(`🔥 [PLAYLIST DEBUG] DataTransfer types:`, e.dataTransfer.types);
    console.log(`🔥 [PLAYLIST DEBUG] Event target:`, e.target);
    console.log(`🔥 [PLAYLIST DEBUG] Event currentTarget:`, e.currentTarget);
    
    console.log(`[DRAG N DROP] 🎯 Drop event triggered on playlist ${playlist.id} (${playlist.name})`);
    console.log(`[DRAG N DROP] 🎯 DataTransfer types:`, e.dataTransfer.types);
    
    try {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      console.log(`[DRAG N DROP] 🎯 Drop event prevented and isDragOver reset`);
      
      const trackData = e.dataTransfer.getData("text/plain");
      console.log(`🔥 [PLAYLIST DEBUG] Retrieved track data:`, trackData);
      console.log(`[DRAG N DROP] 🎯 Retrieved track data from dataTransfer: "${trackData}"`);
      console.log(`[DRAG N DROP] 🎯 Track data type: ${typeof trackData}, length: ${trackData.length}`);
      
      if (!trackData || trackData.trim() === '') {
        console.error(`[DRAG N DROP] ❌ No track data found in drag data`);
        console.log(`[DRAG N DROP] ❌ Available types:`, e.dataTransfer.types);
        return;
      }
      
      // Parse track IDs - could be JSON array or single track ID
      let trackIds: string[] = [];
      try {
        // Try to parse as JSON array first
        const parsed = JSON.parse(trackData);
        if (Array.isArray(parsed)) {
          trackIds = parsed;
        } else {
          trackIds = [parsed]; // Single track ID
        }
      } catch {
        // Not JSON, assume single track ID
        trackIds = [trackData];
      }
      
      console.log(`🔥 [PLAYLIST DEBUG] Parsed track IDs:`, trackIds);
      console.log(`[DRAG N DROP] 🎯 Parsed ${trackIds.length} track ID(s):`, trackIds);
      console.log(`[DRAG N DROP] 🎯 About to add tracks to playlist ${playlist.id}...`);
      
      // Use batch function for multiple tracks, single function for one track
      if (trackIds.length > 1) {
        const result = await addTracksToPlaylist(playlist.id, trackIds);
        console.log(`[DRAG N DROP] ✅ Successfully added ${result.successful.length} tracks to playlist ${playlist.id}`);
        if (result.failed.length > 0) {
          console.warn(`[DRAG N DROP] ⚠️ Failed to add ${result.failed.length} tracks:`, result.failed);
        }
      } else {
        const result = await addTrackToPlaylist(playlist.id, trackIds[0]);
        console.log(`[DRAG N DROP] ✅ Successfully added track ${trackIds[0]} to playlist ${playlist.id}`);
      }
      
    } catch (error) {
      console.error(`🔥 [PLAYLIST DEBUG] ===== DROP ERROR =====`);
      console.error(`[DRAG N DROP] ❌ Failed to add track(s) to playlist:`, error);
      console.error(`[DRAG N DROP] ❌ Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId: playlist.id,
        trackData: e.dataTransfer.getData("text/plain")
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    
    console.log(`🔥 [PLAYLIST DEBUG] handleDragOver triggered on playlist ${playlist.id} (${playlist.name})`);
    console.log(`🔥 [PLAYLIST DEBUG] DataTransfer types:`, e.dataTransfer.types);
    console.log(`🔥 [PLAYLIST DEBUG] isDragOver current state:`, isDragOver);
    
    if (!isDragOver) {
      console.log(`[DRAG N DROP] 🎯 Drag over playlist ${playlist.id} (${playlist.name})`);
      console.log(`[DRAG N DROP] 🎯 DataTransfer types:`, e.dataTransfer.types);
      setIsDragOver(true);
      console.log(`🔥 [PLAYLIST DEBUG] Setting isDragOver to true`);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    // Only set isDragOver to false if we're actually leaving the element
    // (not just moving to a child element)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    const isLeavingElement = x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom;
    console.log(`[DRAG N DROP] 🎯 Drag leave playlist ${playlist.id} (${playlist.name})`);
    console.log(`[DRAG N DROP] 🎯 Leave check: mouse(${x}, ${y}) vs rect(${rect.left}, ${rect.top}, ${rect.right}, ${rect.bottom}) = ${isLeavingElement}`);
    
    if (isLeavingElement) {
      console.log(`[DRAG N DROP] 🎯 Actually leaving playlist ${playlist.id}, setting isDragOver to false`);
      setIsDragOver(false);
    }
  };

  const handleOptionsClick = (e: React.MouseEvent) => {
    console.log('[EDIT PLAYLIST] Options menu clicked');
    e.stopPropagation();
    setShowOptions(!showOptions);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    console.log('[EDIT PLAYLIST] Edit button clicked');
    e.stopPropagation();
    setIsEditing(true);
    setShowOptions(false);
    console.log('[EDIT PLAYLIST] isEditing set to true, showOptions set to false');
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    console.log('[EDIT PLAYLIST] Delete button clicked');
    e.stopPropagation();
    onDelete();
    setShowOptions(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    console.log('[EDIT PLAYLIST] Context menu opened');
    e.preventDefault();
    e.stopPropagation();
    setShowOptions(true);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Don't start drag on right click
    if (e.button !== 0) return;
    
    // Don't start drag if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button') || target.closest('.options-menu') || target.closest('.options-button')) {
      return;
    }

    // Record start position for drag threshold
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    isDragActive.current = false;
    
    // Set a timeout - if mouse is held down for 150ms, start drag mode
    dragTimeout.current = setTimeout(() => {
      if (dragStartPos.current) {
        isDragActive.current = true;
        setIsBeingDragged(true);
      }
    }, 150);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartPos.current || isDragActive.current) return;

    const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
    
    // If mouse moves more than 5px in any direction, start dragging immediately
    if (deltaX > 5 || deltaY > 5) {
      if (dragTimeout.current) {
        clearTimeout(dragTimeout.current);
        dragTimeout.current = null;
      }
      isDragActive.current = true;
      setIsBeingDragged(true);
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Clear timeout
    if (dragTimeout.current) {
      clearTimeout(dragTimeout.current);
      dragTimeout.current = null;
    }

    // If this was just a click (not a drag), select the playlist
    if (!isDragActive.current && dragStartPos.current) {
      e.stopPropagation();
      onSelect(playlist.id);
    }
    
    // Reset drag state
    dragStartPos.current = null;
    isDragActive.current = false;
    setIsBeingDragged(false);
  }, [onSelect, playlist.id]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (dragTimeout.current) {
        clearTimeout(dragTimeout.current);
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handlePlaylistNameBlur();
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: isDragOver ? '2px dashed #4F46E5' : '2px solid transparent',
    backgroundColor: isSelected ? 'rgba(79, 70, 229, 0.3)' : (isDragOver ? 'rgba(79, 70, 229, 0.1)' : 'transparent'),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative group rounded-md transition-all duration-150 ease-in-out ${isBeingDragged ? 'shadow-lg' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        className="w-full h-full p-2 flex items-center justify-between"
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
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag from starting on input
            onContextMenu={(e) => e.stopPropagation()} // Prevent context menu from opening on input
            autoFocus
            className="bg-transparent border-b focus:outline-none w-full cursor-text"
          />
        ) : (
          <>
            <div className="flex items-center flex-1">
              <span className="flex-1">{playlist.name}</span>
              {isDragOver && (
                <div className="flex items-center text-green-600 text-sm ml-2">
                  <FaPlus className="mr-1" size={12} />
                  <span>Add Track(s)</span>
                </div>
              )}
            </div>
            <div className="relative z-10">
              <FaEllipsisH
                className="options-button ml-2 cursor-pointer hover:text-gray-300 relative z-20"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleOptionsClick(e);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
              {showOptions && (
                <div 
                  ref={optionsRef}
                  className="options-menu absolute right-0 mt-2 py-2 w-48 bg-gray-700 rounded-md shadow-xl z-50 border border-gray-600"
                >
                  <button
                    className="block px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
                    onClick={handleEditClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <FaEdit className="inline mr-2" />
                    Edit
                  </button>
                  <button
                    className="block px-4 py-2 text-sm text-white hover:bg-gray-600 w-full text-left"
                    onClick={handleDeleteClick}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    <FaTrash className="inline mr-2" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
};

export default PlaylistItem;
