"use client";

import React, { useEffect, useRef } from 'react';
import { FaTrash, FaEdit, FaPlus } from 'react-icons/fa';

interface TrackContextMenuProps {
  x: number;
  y: number;
  selectedTrackIds: number[];
  onClose: () => void;
  onDelete: () => void;
  onEditMetadata: () => void;
  onAddToPlaylist: () => void;
}

const TrackContextMenu: React.FC<TrackContextMenuProps> = ({
  x,
  y,
  selectedTrackIds,
  onClose,
  onDelete,
  onEditMetadata,
  onAddToPlaylist
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const trackCount = selectedTrackIds.length;
  const isMultiple = trackCount > 1;

  return (
    <div
      ref={menuRef}
      className="fixed bg-white border border-gray-200 rounded-lg shadow-lg py-2 z-50 min-w-48"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-100 mb-1">
        {isMultiple ? `${trackCount} tracks selected` : '1 track selected'}
      </div>

      <button
        onClick={() => {
          onAddToPlaylist();
          onClose();
        }}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2 text-sm"
      >
        <FaPlus className="text-green-600" />
        <span>Add to playlist</span>
      </button>

      <button
        onClick={() => {
          onEditMetadata();
          onClose();
        }}
        className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center space-x-2 text-sm"
        disabled={isMultiple}
      >
        <FaEdit className={isMultiple ? "text-gray-400" : "text-blue-600"} />
        <span className={isMultiple ? "text-gray-400" : ""}>
          Edit metadata
          {isMultiple && " (single track only)"}
        </span>
      </button>

      <div className="border-t border-gray-100 my-1" />

      <button
        onClick={() => {
          onDelete();
          onClose();
        }}
        className="w-full text-left px-3 py-2 hover:bg-red-50 flex items-center space-x-2 text-sm text-red-600"
      >
        <FaTrash />
        <span>Delete {isMultiple ? 'tracks' : 'track'}</span>
      </button>
    </div>
  );
};

export default TrackContextMenu; 