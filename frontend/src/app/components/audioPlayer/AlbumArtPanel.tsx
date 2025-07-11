import React, { useState } from 'react';
import { Track } from '../../../../../shared/types/track';
import { usePlayback } from '@/app/hooks/UsePlayback';
import { FaChevronUp, FaChevronDown } from 'react-icons/fa';

interface AlbumArtPanelProps {
  track: Track | null;
  show: boolean;
}

const AlbumArtPanel: React.FC<AlbumArtPanelProps> = ({ track, show }) => {
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Helper function to format time (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  const getAlbumArtUrl = (track: Track | null): string | null => {
    if (!track?.albumArtPath) return null;
    
    // Construct the full URL for the album art
    return `http://localhost:3000${track.albumArtPath}`;
  };

  const getDisplayInfo = (track: Track | null) => {
    if (!track) return { title: 'No track selected', artist: '', album: '' };
    
    return {
      title: track.name || 'Unknown Track',
      artist: track.artistName || track.artist?.name || 'Unknown Artist',
      album: track.albumName || track.album?.name || 'Unknown Album'
    };
  };

  const albumArtUrl = getAlbumArtUrl(track);
  const { title, artist, album } = getDisplayInfo(track);

  return (
    <div 
      className={`fixed bottom-0 left-0 w-64 bg-white shadow-lg border-t border-r border-gray-200 transform transition-all duration-300 z-10 ${
        show ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{ 
        height: isMinimized ? '48px' : '320px' // Minimized height vs full height
      }}
    >
      {/* Header with minimize/maximize button */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-700">Now Playing</h4>
        <button
          onClick={() => setIsMinimized(!isMinimized)}
          className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
          title={isMinimized ? 'Expand album art panel' : 'Minimize album art panel'}
        >
          {isMinimized ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
        </button>
      </div>

      {/* Panel content - hidden when minimized */}
      {!isMinimized && (
        <div className="p-4 h-full flex flex-col" style={{ height: 'calc(100% - 48px)' }}>
          {/* Album Art Image */}
          <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden mb-3 flex-shrink-0">
            {albumArtUrl ? (
              <img
                src={albumArtUrl}
                alt={`${album} album art`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to placeholder on error
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            
            {/* Fallback placeholder */}
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300 ${albumArtUrl ? 'hidden' : ''}`}>
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-2 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <p className="text-sm font-medium">No Album Art</p>
              </div>
            </div>
          </div>

          {/* Track Information */}
          <div className="flex-1 min-h-0">
            <div className="mb-2">
              <h3 className="text-sm font-semibold text-gray-900 truncate" title={title}>
                {title}
              </h3>
            </div>
            
            <div className="space-y-1">
              <p className="text-xs text-gray-600 truncate" title={artist}>
                <span className="font-medium">Artist:</span> {artist}
              </p>
              <p className="text-xs text-gray-600 truncate" title={album}>
                <span className="font-medium">Album:</span> {album}
              </p>
            </div>

            {/* Additional track metadata */}
            {track && (
              <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
                {track.duration && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Duration:</span> {formatTime(track.duration)}
                  </p>
                )}
                {track.year && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Year:</span> {track.year}
                  </p>
                )}
                {track.genre && (
                  <p className="text-xs text-gray-500 truncate" title={track.genre}>
                    <span className="font-medium">Genre:</span> {track.genre}
                  </p>
                )}
                {track.bitrate && (
                  <p className="text-xs text-gray-500">
                    <span className="font-medium">Quality:</span> {Math.round(track.bitrate / 1000)} kbps
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons (optional - for future features) */}
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex justify-center space-x-2">
              <button 
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Like track"
                disabled={!track}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
              <button 
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Add to playlist"
                disabled={!track}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button 
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="More options"
                disabled={!track}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlbumArtPanel; 