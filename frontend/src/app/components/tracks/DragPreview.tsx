import React from 'react';
import { Track } from '../../../../../shared/types';
import { FaMusic } from 'react-icons/fa';

interface DragPreviewProps {
  track: Track;
  position: { x: number; y: number };
  isDragging: boolean;
}

const DragPreview: React.FC<DragPreviewProps> = ({ track, position, isDragging }) => {
  if (!isDragging) return null;

  return (
    <div
      className="fixed pointer-events-none z-50 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-xl border border-gray-600 transition-opacity duration-200"
      style={{
        left: position.x + 10,
        top: position.y - 30,
        opacity: isDragging ? 0.9 : 0,
      }}
    >
      <div className="flex items-center gap-2 max-w-xs">
        <FaMusic className="text-gray-400 flex-shrink-0" size={14} />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{track.name}</div>
          <div className="text-xs text-gray-400 truncate">
            {track.artist?.name || 'Unknown Artist'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DragPreview; 