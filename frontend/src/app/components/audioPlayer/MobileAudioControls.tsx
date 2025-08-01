"use client";

import React, { useState } from "react";
import { Track } from "../../../../../shared/types";
import MobileAlbumArt from "./MobileAlbumArt";

interface MobileAudioControlsProps {
  track: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onPlaybackSpeedChange: (speed: number) => void;
  volume: number;
  playbackSpeed: number;
}

const MobileAudioControls: React.FC<MobileAudioControlsProps> = ({
  track,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onPlaybackSpeedChange,
  volume,
  playbackSpeed,
}) => {
  const [showFullScreenArt, setShowFullScreenArt] = useState(false);
  
  // Handle touch events with proper mobile interaction
  const handleButtonTouch = (action: () => void, buttonName: string) => {
    return {
      onTouchStart: (e: React.TouchEvent) => {
        e.preventDefault();
        console.log(`🍅 [TOUCH] ${buttonName} touch start`);
      },
      onTouchEnd: (e: React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🍅 [TOUCH] ${buttonName} touch end - executing action`);
        action();
      },
      onClick: (e: React.MouseEvent) => {
        // Fallback for non-touch devices
        console.log(`🍅 [CLICK] ${buttonName} click (non-touch fallback)`);
        action();
      }
    };
  };

  return (
    <>
      {/* Mobile Audio Controls Bar - Fixed at bottom */}
      <div 
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50"
      >
        <div className="flex items-center px-4 py-3">
          {/* Left: Album Art */}
          <div className="flex-shrink-0 mr-3">
            <MobileAlbumArt 
              track={track}
              onTap={() => setShowFullScreenArt(true)}
            />
          </div>

          {/* Center: Track Info */}
          <div className="flex-1 min-w-0 mr-3">
            <div className="text-sm font-medium text-gray-900 truncate">
              {track?.name || 'No track selected'}
            </div>
            {track?.artist?.name && (
              <div className="text-xs text-gray-600 truncate">
                {track.artist.name}
              </div>
            )}
          </div>

          {/* Right: Transport Controls */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              {...handleButtonTouch(onPrevious, 'Previous')}
              disabled={!track}
              className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
              aria-label="Previous track"
            >
              <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" className="pointer-events-none"/>
              </svg>
            </button>
            
            <button
              {...handleButtonTouch(onPlayPause, 'Play/Pause')}
              disabled={!track}
              className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" className="pointer-events-none"/>
                </svg>
              ) : (
                <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" className="pointer-events-none"/>
                </svg>
              )}
            </button>
            
            <button
              {...handleButtonTouch(onNext, 'Next')}
              disabled={!track}
              className="p-2 text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed transition-colors select-none"
              style={{ touchAction: 'manipulation' }}
              aria-label="Next track"
            >
              <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" className="pointer-events-none"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Full Screen Album Art Modal */}
      {showFullScreenArt && track && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
          onClick={() => setShowFullScreenArt(false)}
        >
          <div className="relative max-w-sm max-h-sm mx-4">
            {/* Close Button */}
            <button
              onClick={() => setShowFullScreenArt(false)}
              className="absolute -top-4 -right-4 w-8 h-8 bg-white rounded-full flex items-center justify-center text-gray-800 hover:text-gray-600 transition-colors z-10"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
            
            {/* Album Art */}
            <img
              src={`/api/album-art/${track.id}`}
              alt={`Album art for ${track.name}`}
              className="w-full h-auto rounded-lg shadow-2xl"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjQwMCIgdmlld0JveD0iMCAwIDQwMCA0MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTUwQzE3OS4wODggMTUwIDE2MiAxNjcuMDg4IDE2MiAxODhDMTYyIDIwOC45MTIgMTc5LjA4OCAyMjYgMjAwIDIyNkMyMjAuOTEyIDIyNiAyMzggMjA4LjkxMiAyMzggMTg4QzIzOCAxNjcuMDg4IDIyMC45MTIgMTUwIDIwMCAxNTBaIiBmaWxsPSIjOUI5QkEwIi8+CjxwYXRoIGQ9Ik0yMDAgMjUwQzE3OS4wODggMjUwIDE2MiAyNjcuMDg4IDE2MiAyODhDMTYyIDMwOC45MTIgMTc5LjA4OCAzMjYgMjAwIDMyNkMyMjAuOTEyIDMyNiAyMzggMzA4LjkxMiAyMzggMjg4QzIzOCAyNjcuMDg4IDIyMC45MTIgMjUwIDIwMCAyNTBaIiBmaWxsPSIjOUI5QkEwIi8+Cjwvc3ZnPgo=';
              }}
            />
            
            {/* Track Info Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 rounded-b-lg">
              <div className="text-white">
                <div className="text-lg font-semibold">{track.name}</div>
                {track.artist?.name && (
                  <div className="text-sm text-gray-300">{track.artist.name}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileAudioControls; 