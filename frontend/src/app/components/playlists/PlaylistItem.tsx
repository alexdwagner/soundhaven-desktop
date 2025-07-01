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
  const { updatePlaylistMetadata, addTrackToPlaylist } = usePlaylists();
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

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    console.log(`[DRAG N DROP] 🎯 Drop event triggered on playlist ${playlist.id} (${playlist.name})`);
    console.log(`[DRAG N DROP] 🎯 Event details:`, {
      type: e.type,
      dataTransfer: {
        types: e.dataTransfer.types,
        items: Array.from(e.dataTransfer.items).map(item => ({
          kind: item.kind,
          type: item.type
        })),
        effectAllowed: e.dataTransfer.effectAllowed,
        dropEffect: e.dataTransfer.dropEffect
      }
    });
    
    try {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      console.log(`[DRAG N DROP] 🎯 Drop event prevented and isDragOver reset`);
      
      const trackId = e.dataTransfer.getData("text/plain");
      console.log(`[DRAG N DROP] 🎯 Retrieved track ID from dataTransfer: "${trackId}"`);
      console.log(`[DRAG N DROP] 🎯 Track ID type: ${typeof trackId}, length: ${trackId.length}`);
      
      if (!trackId || trackId.trim() === '') {
        console.error(`[DRAG N DROP] ❌ No track ID found in drag data`);
        console.log(`[DRAG N DROP] ❌ DataTransfer analysis:`, {
          items: Array.from(e.dataTransfer.items),
          types: e.dataTransfer.types,
          files: e.dataTransfer.files
        });
        return;
      }
      
      console.log(`[DRAG N DROP] 🎯 About to add track ${trackId} to playlist ${playlist.id}...`);
      console.log(`[DRAG N DROP] 🎯 Playlist object:`, playlist);
      console.log(`[DRAG N DROP] 🎯 addTrackToPlaylist function:`, typeof addTrackToPlaylist);
      
      const result = await addTrackToPlaylist(playlist.id, trackId);
      console.log(`[DRAG N DROP] ✅ Successfully added track ${trackId} to playlist ${playlist.id}`);
      console.log(`[DRAG N DROP] ✅ Result:`, result);
      
    } catch (error) {
      console.error(`[DRAG N DROP] ❌ Failed to add track to playlist:`, error);
      console.error(`[DRAG N DROP] ❌ Error details:`, {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        playlistId: playlist.id,
        trackId: e.dataTransfer.getData("text/plain")
      });
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isDragOver) {
      console.log(`[DRAG N DROP] 🎯 Drag over playlist ${playlist.id} (${playlist.name})`);
      console.log(`[DRAG N DROP] 🎯 DataTransfer in dragOver:`, {
        types: e.dataTransfer.types,
        effectAllowed: e.dataTransfer.effectAllowed,
        dropEffect: e.dataTransfer.dropEffect
      });
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
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

  const handleContextMenu = (e: React.MouseEvent) => {
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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isBeingDragged ? attributes : {})}
      {...(isBeingDragged ? listeners : {})}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onDrop={onDrop || handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDragEnter={(e) => {
        console.log(`[DRAG N DROP] 🎯 BASIC: Drag enter on playlist ${playlist.id}`);
        e.preventDefault();
      }}
      onMouseEnter={() => {
        console.log(`[DRAG N DROP] 🎯 BASIC: Mouse enter on playlist ${playlist.id}`);
      }}
      onContextMenu={handleContextMenu}
      className={`playlist-item flex items-center justify-between p-2 mb-1 rounded transition-all duration-200 text-sm select-none border border-transparent ${
        isDragOver 
          ? "bg-green-600 border-green-400 shadow-md text-white cursor-pointer" // Drag over state
          : dragState.isDragging
            ? "bg-gray-700 border-gray-500 opacity-90 hover:bg-gray-600 hover:border-green-400 cursor-pointer" // Available drop zone during drag
            : isDragging || isBeingDragged
              ? "bg-gray-600 border-gray-400 shadow-lg z-50 cursor-grabbing transform scale-105" // Being dragged
              : isSelected 
                ? "bg-blue-600 text-white hover:bg-blue-700 border-blue-500 cursor-pointer" // Selected state
                : "hover:bg-gray-700 hover:border-gray-600 text-gray-100 cursor-pointer" // Default hover state
      }`}
    >
      <li className="w-full flex items-center justify-between">
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
                  <span>Add Track</span>
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
