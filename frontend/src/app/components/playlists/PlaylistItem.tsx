"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Playlist } from "../../../../../shared/types";
import { usePlaylists } from "../../providers/PlaylistsProvider";
import { FaEllipsisH, FaEdit, FaTrash, FaPlus } from "react-icons/fa";
import { useDroppable } from "@dnd-kit/core";
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

  // Droppable functionality for receiving tracks
  const {
    isOver,
    setNodeRef: setDropRef,
  } = useDroppable({
    id: playlist.id, // Use same ID as sortable to avoid conflicts
    data: {
      type: 'playlist',
      playlistId: playlist.id,
      playlistName: playlist.name
    }
  });

  // Debug logging for isOver state
  useEffect(() => {
    if (isOver) {
      console.log(`🎯 [PLAYLIST ITEM] ${playlist.name} - isOver: TRUE (should show green styling)`);
    }
  }, [isOver, playlist.name]);

  // Combine the refs for both sortable and droppable functionality
  const combineRefs = (...refs: any[]) => {
    return (node: any) => {
      refs.forEach(ref => {
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref && typeof ref === 'object') {
          ref.current = node;
        }
      });
    };
  };

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
    console.log(`📓 [PLAYLIST ITEM] ===== DROP EVENT TRIGGERED =====`);
    console.log(`📓 [PLAYLIST ITEM] Drop on playlist ${playlist.id} (${playlist.name})`);
    console.log(`📓 [PLAYLIST ITEM] Current playlist tracks count: ${playlist.tracks?.length || 0}`);
    
    try {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      setDragTrackCount(1); // Reset drag count
      
      const trackData = e.dataTransfer.getData("text/plain");
      console.log(`📓 [PLAYLIST ITEM] Raw track data from drag:`, trackData);
      
      if (!trackData) {
        console.log(`📓 [PLAYLIST ITEM] ❌ No track data found in drag event`);
        return;
      }
      
      const dragData = JSON.parse(trackData);
      console.log(`📓 [PLAYLIST ITEM] Parsed drag data:`, dragData);
      
      // Handle the new drag data structure from TrackItem
      let trackIds: string[] = [];
      
      if (dragData.type === 'track' && dragData.selectedTrackIds) {
        // New format: object with selectedTrackIds array
        trackIds = dragData.selectedTrackIds;
        console.log(`📓 [PLAYLIST ITEM] Using selectedTrackIds from new format:`, trackIds);
      } else if (Array.isArray(dragData)) {
        // Legacy format: direct array of track IDs
        trackIds = dragData;
        console.log(`📓 [PLAYLIST ITEM] Using legacy array format:`, trackIds);
      } else {
        console.log(`📓 [PLAYLIST ITEM] ❌ Unrecognized drag data format:`, dragData);
        return;
      }
      
      console.log(`📓 [PLAYLIST ITEM] Final track IDs to add:`, trackIds);
      console.log(`📓 [PLAYLIST ITEM] Track IDs count: ${trackIds.length}`);
      
      if (trackIds.length > 0) {
        console.log(`📓 [PLAYLIST ITEM] �� Adding ${trackIds.length} tracks to playlist ${playlist.id}`);
        const result = await addTracksToPlaylist(playlist.id, trackIds);
        console.log(`📓 [PLAYLIST ITEM] ✅ Add tracks result:`, result);
        console.log(`📓 [PLAYLIST ITEM] Successfully added ${result.successful} tracks to playlist ${playlist.id}`);
        if (result.failed > 0) {
          console.log(`📓 [PLAYLIST ITEM] ⚠️ Failed to add ${result.failed} tracks:`, result.errors);
        }
      } else {
        console.log(`📓 [PLAYLIST ITEM] ⚠️ No tracks to add to playlist ${playlist.id}`);
      }
      
    } catch (error) {
      console.error(`📓 [PLAYLIST ITEM] ❌ Error in handleDrop:`, error);
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
      
      // Try to get track count for visual feedback
      try {
        const trackData = e.dataTransfer.getData("text/plain");
        if (trackData) {
          const dragData = JSON.parse(trackData);
          let trackCount = 1;
          
          if (dragData.type === 'track' && dragData.selectedTrackIds) {
            trackCount = dragData.selectedTrackIds.length;
          } else if (Array.isArray(dragData)) {
            trackCount = dragData.length;
          }
          
          setDragTrackCount(trackCount);
          console.log(`[DRAG N DROP] 🎯 Dragging ${trackCount} track(s)`);
        }
      } catch (error) {
        // Ignore parsing errors during drag over
        setDragTrackCount(1);
      }
      
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
      setDragTrackCount(1); // Reset drag count
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
    transition: 'all 0.2s ease-in-out',
    border: (isDragOver || isOver) ? '2px solid #10B981' : '2px solid transparent', // Solid border for both drag states
    backgroundColor: isSelected 
      ? 'rgba(79, 70, 229, 0.3)' 
      : (isDragOver || isOver)
        ? 'rgba(16, 185, 129, 0.15)' // Slightly more visible green background
        : 'transparent',
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    scale: (isDragOver || isOver) ? 1.03 : 1, // Slightly more prominent scale change
    boxShadow: (isDragOver || isOver) ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none', // More visible shadow
  };

  return (
    <li
      ref={combineRefs(setNodeRef, setDropRef)}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative group rounded-lg transition-all duration-200 ease-in-out hover:bg-gray-50 ${
        isBeingDragged ? 'shadow-md' : ''
      } ${
        (isOver || isDragOver) ? 'bg-green-50 ring-2 ring-green-400 shadow-lg' : '' // Combined and more prominent styling
      }`}
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
                  <span>
                    Add {dragTrackCount === 1 ? 'Track' : `${dragTrackCount} Tracks`}
                  </span>
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
