"use client";

import React, { useState, useEffect } from "react";
import { useSearch } from "@/app/hooks/useSearch";
import { useTracks } from "@/app/providers/TracksProvider";
import { usePlaylists } from "@/app/providers/PlaylistsProvider";
import { useAllComments } from "@/app/hooks/useAllComments";
import { Track, Playlist } from "../../../../../shared/types";

interface MobileSearchProps {
  onClose: () => void;
  onTrackSelect?: (trackId: string) => void;
  onTrackPlay?: (trackId: string) => void;
  onPlaylistSelect?: (playlistId: string) => void;
  initialQuery?: string;
}

const MobileSearch: React.FC<MobileSearchProps> = ({ 
  onClose, 
  onTrackSelect, 
  onTrackPlay,
  onPlaylistSelect,
  initialQuery = "" 
}) => {
  const [inputQuery, setInputQuery] = useState(initialQuery);

  // Get data from providers
  const { tracks } = useTracks();
  const { playlists } = usePlaylists();
  const { comments, error: commentsError } = useAllComments();
  
  // Use defensive programming for comments - always pass a valid array
  const safeComments = Array.isArray(comments) ? comments : [];
  
  const { searchResults, setQuery, updateFilters, triggerSearch, clearSearch } = useSearch(tracks, playlists, safeComments);
  
  // Perform search on mount if initialQuery is provided
  useEffect(() => {
    if (initialQuery.trim()) {
      setQuery(initialQuery.trim());
      triggerSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]); // Only depend on initialQuery to avoid infinite loop

  // Search on Enter key press
  const handleSearch = () => {
    if (inputQuery.trim()) {
      setQuery(inputQuery.trim());
      // Use a small delay to ensure setQuery has been processed
      setTimeout(() => {
        triggerSearch();
      }, 0);
    } else {
      clearSearch();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleTrackSelect = (trackId: string) => {
    if (onTrackSelect) {
      onTrackSelect(trackId);
    }
    onClose();
  };
  
  const handleTrackPlay = (trackId: string, event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onTrackPlay) {
      onTrackPlay(trackId);
    }
    // Don't close immediately - let the parent handle closing
    // onClose();
  };

  const handlePlaylistSelect = (playlistId: string) => {
    if (onPlaylistSelect) {
      onPlaylistSelect(playlistId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Search Header */}
      <div className="flex items-center p-4 border-b border-gray-200 bg-white">
        <button
          onClick={onClose}
          onTouchEnd={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="p-2 mr-2 text-gray-600 hover:text-gray-800"
          style={{ touchAction: 'manipulation' }}
          aria-label="Close search"
        >
          <svg className="w-6 h-6 pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tracks, artists, albums, playlists, tags, comments... (Press Enter)"
            className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
          <svg 
            className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
        </div>
      </div>

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        {!inputQuery.trim() ? (
          <div className="p-4 text-center text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
            <p>Start typing to search your music library</p>
          </div>
        ) : searchResults.tracks.length === 0 && searchResults.playlists.length === 0 && searchResults.comments.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p>No results found for "{inputQuery}"</p>
            <p className="text-sm mt-2">Try different keywords or check your spelling</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tracks Results */}
            {searchResults.tracks.length > 0 && (
              <div>
                <h3 className="px-4 py-2 text-lg font-semibold text-gray-900 bg-gray-50">
                  Tracks ({searchResults.tracks.length})
                </h3>
                <div className="divide-y divide-gray-200">
                  {searchResults.tracks.map((track: Track) => (
                    <div
                      key={track.id}
                      className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onClick={() => handleTrackSelect(track.id)}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleTrackSelect(track.id);
                      }}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {track.name}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {track.artistName || track.artist?.name || 'Unknown Artist'}
                            {track.albumName || track.album?.name ? ` • ${track.albumName || track.album?.name}` : ''}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <button
                            onClick={(e) => handleTrackPlay(track.id, e)}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleTrackPlay(track.id, e);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-colors"
                            style={{ touchAction: 'manipulation' }}
                            aria-label="Play track"
                          >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Playlists Results */}
            {searchResults.playlists.length > 0 && (
              <div>
                <h3 className="px-4 py-2 text-lg font-semibold text-gray-900 bg-gray-50">
                  Playlists ({searchResults.playlists.length})
                </h3>
                <div className="divide-y divide-gray-200">
                  {searchResults.playlists.map((playlist: Playlist) => (
                    <div
                      key={playlist.id}
                      className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onClick={() => handlePlaylistSelect(playlist.id)}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePlaylistSelect(playlist.id);
                      }}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {playlist.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Playlist
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Results */}
            {searchResults.comments.length > 0 && (
              <div>
                <h3 className="px-4 py-2 text-lg font-semibold text-gray-900 bg-gray-50">
                  Comments ({searchResults.comments.length})
                </h3>
                <div className="divide-y divide-gray-200">
                  {searchResults.comments.map((comment: any) => (
                    <div
                      key={comment.id}
                      className="p-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      onClick={() => {
                        if (comment.trackId && onTrackSelect) {
                          onTrackSelect(comment.trackId);
                        }
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (comment.trackId && onTrackSelect) {
                          onTrackSelect(comment.trackId);
                        }
                      }}
                      style={{ touchAction: 'manipulation' }}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-green-100 rounded flex items-center justify-center">
                            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {comment.content}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {comment.userName} • {comment.trackName}
                            {comment.timestamp && ` • ${Math.floor(comment.timestamp / 60)}:${Math.floor(comment.timestamp % 60).toString().padStart(2, '0')}`}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSearch;