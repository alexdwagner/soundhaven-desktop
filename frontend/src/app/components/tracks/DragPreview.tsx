import React from 'react';
import { Track } from '../../../../../shared/types';
import { FaMusic, FaList } from 'react-icons/fa';

interface DragPreviewProps {
  track: Track;
  position: { x: number; y: number };
  isDragging: boolean;
  trackCount?: number; // Optional count for multiple tracks
}

const DragPreview: React.FC<DragPreviewProps> = ({ track, position, isDragging, trackCount = 1 }) => {
  if (!isDragging) return null;

  const isMultipleTracks = trackCount > 1;

  // When used with DragOverlay, positioning is handled by the overlay
  const isOverlayMode = position.x === 0 && position.y === 0;

  return (
    <div
      className="pointer-events-none bg-gray-900 text-white px-4 py-3 rounded-lg shadow-2xl border border-gray-600 transition-all duration-200 backdrop-blur-sm"
      style={isOverlayMode ? {
        opacity: isDragging ? 0.95 : 0,
        transform: 'scale(1.02)',
      } : {
        position: 'fixed',
        left: position.x + 15,
        top: position.y - 35,
        opacity: isDragging ? 0.95 : 0,
        transform: 'scale(1.02)',
        zIndex: 50,
      }}
    >
      <div className="flex items-center gap-3 max-w-sm">
        {isMultipleTracks ? (
          <FaList className="text-blue-400 flex-shrink-0" size={16} />
        ) : (
          <FaMusic className="text-blue-400 flex-shrink-0" size={16} />
        )}
        <div className="min-w-0 flex-1">
          {isMultipleTracks ? (
            <>
              <div className="font-semibold text-sm text-white">
                {trackCount} tracks selected
              </div>
              <div className="text-xs text-gray-300 truncate">
                Including "{track.name}"
              </div>
            </>
          ) : (
            <>
              <div className="font-semibold text-sm text-white truncate">{track.name}</div>
              <div className="text-xs text-gray-300 truncate">
                {track.artistName || track.artist?.name || 'Unknown Artist'}
              </div>
            </>
          )}
        </div>
        {isMultipleTracks && (
          <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[24px] text-center">
            {trackCount}
          </div>
        )}
      </div>
      {/* Small arrow pointer */}
      <div 
        className="absolute w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
        style={{
          left: '10px',
          bottom: '-4px'
        }}
      />
    </div>
  );
};

export default DragPreview; 