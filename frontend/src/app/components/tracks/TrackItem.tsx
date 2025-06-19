"use client";

import React, { useState, useEffect } from "react";
import { Track } from "../../../../../shared/types";
import { usePlayback } from "@/app/hooks/UsePlayback";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TrackItemProps {
  track: Track;
  index: number;
  onDelete: (id: number) => void;
  onUpdate: (trackId: number, field: string, value: string) => void;
  onEdit: (track: Track) => void;
  isCurrent: boolean;
  isSelected: boolean;
  onSelectTrack: (trackId: number) => void;
  isPlaylistView: boolean;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  index,
  onDelete,
  onUpdate,
  onEdit,
  isCurrent,
  isSelected,
  onSelectTrack,
  isPlaylistView,
}) => {
  const { selectTrack } = usePlayback();
  const [openMenuTrackId, setOpenMenuTrackId] = useState<number | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = () => {
    onSelectTrack(track.id);
  };

  const handleDoubleClick = () => {
    selectTrack(track, index);
  };

  // const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>) => {
  //   e.dataTransfer.setData("text/plain", track.id.toString());
  // };

  const toggleMenu = (id: number, event: React.MouseEvent) => {
    event.stopPropagation();
    setOpenMenuTrackId(openMenuTrackId === id ? null : id);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (
        openMenuTrackId !== null &&
        !target?.closest(".menu-container") &&
        !target?.closest(".menu-item")
      ) {
        setOpenMenuTrackId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuTrackId]);

  useEffect(() => {
    console.log("TrackItem: Rendering track", track);
  }, [track]);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`hover:bg-gray-100 ${isCurrent ? "bg-blue-100" : ""} ${
        isSelected ? "bg-blue-200" : ""
      } ${isDragging ? "bg-gray-100" : ""}`}
    >
      <td className="px-4 py-2">{track.name}</td>
      <td className="px-4 py-2">{track.artist?.name ?? "Unknown Artist"}</td>
      <td className="px-4 py-2">{track.album?.name ?? "No Album"}</td>
      <td className="px-4 py-2">{track.duration}</td>
      <td className="px-4 py-2 relative">
        <button onClick={(e) => toggleMenu(track.id, e)}>•••</button>
        {openMenuTrackId === track.id && (
          <div className="absolute right-0 bg-white shadow-lg rounded-md z-10 menu-item">
            <button
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation(); // Prevents click from bubbling to the parent element
                onEdit(track);
                setOpenMenuTrackId(null); // Closes the menu
              }}
            >
              Edit Metadata
            </button>
            <button
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 menu-item"
              onClick={async (e) => {
                e.stopPropagation(); // Prevents click from bubbling to the parent element
                await onDelete(track.id);
                setOpenMenuTrackId(null); // Closes the menu
              }}
            >
              Delete Track
            </button>
          </div>
        )}
      </td>
    </tr>
  );
};

export default TrackItem;
