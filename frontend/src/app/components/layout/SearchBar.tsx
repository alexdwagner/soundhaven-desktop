"use client";

import React, { useState, useRef, useEffect } from 'react';
import { FaSearch, FaTimes, FaCog, FaFilter } from 'react-icons/fa';
import { useSearch, SearchFilters } from '../../hooks/useSearch';
import { Track, Playlist, _Comment as Comment } from '../../../../../shared/types';

interface SearchBarProps {
  tracks: Track[];
  playlists: Playlist[];
  comments?: Comment[];
  onTrackSelect: (track: Track) => void;
  onPlaylistSelect: (playlist: Playlist) => void;
  onCommentSelect: (comment: Comment) => void;
  onSearchResults: (tracks: Track[], playlists: Playlist[]) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  tracks,
  playlists,
  comments = [],
  onTrackSelect,
  onPlaylistSelect,
  onCommentSelect,
  onSearchResults
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const onSearchResultsRef = useRef(onSearchResults);
  
  // Update ref when callback changes
  useEffect(() => {
    onSearchResultsRef.current = onSearchResults;
  }, [onSearchResults]);

  const {
    filters,
    setQuery,
    updateFilters,
    clearSearch,
    searchResults,
    isSearching,
    isActive,
    triggerSearch,
    searchQuery
  } = useSearch(tracks, playlists, comments);

  console.log('🔍 [SearchBar] Props received:', {
    tracksCount: tracks.length,
    playlistsCount: playlists.length,
    commentsCount: comments.length,
    firstTrack: tracks[0] ? { id: tracks[0].id, name: tracks[0].name } : null
  });

  // Call parent callback when search results change
  useEffect(() => {
    console.log('🔍 [SearchBar] Search results changed, updating parent:', {
      isActive,
      tracksCount: searchResults.tracks.length,
      playlistsCount: searchResults.playlists.length
    });
    
    if (isActive) {
      onSearchResultsRef.current(searchResults.tracks, searchResults.playlists);
    } else {
      onSearchResultsRef.current([], []);
    }
  }, [isActive, searchResults.totalResults]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + F to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        inputRef.current?.focus();
        setShowResults(true);
      }
      
      // Escape to close search
      if (e.key === 'Escape') {
        setShowResults(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle click outside to close results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setShowFilters(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTrackClick = (track: Track) => {
    onTrackSelect(track);
    setShowResults(false);
  };

  const handlePlaylistClick = (playlist: Playlist) => {
    onPlaylistSelect(playlist);
    setShowResults(false);
  };

  const handleCommentClick = (comment: Comment) => {
    onCommentSelect(comment);
    setShowResults(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowResults(value.length > 0);
  };

  const handleClear = () => {
    clearSearch();
    setShowResults(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch();
      setShowResults(true);
    }
  };

  const getMatchedFieldsText = (trackId: string) => {
    const fields = searchResults.matchedFields[trackId];
    if (!fields || fields.length === 0) return '';
    return `Found in: ${fields.join(', ')}`;
  };

  return (
    <div ref={searchRef} className="relative flex-1 max-w-2xl mx-4">
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-4 w-4 text-gray-400" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={filters.query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowResults(filters.query.length > 0)}
          placeholder="Search tracks, artists, albums, genres, playlists, tags, comments... (Press Enter to search)"
          className="block w-full pl-10 pr-20 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        
        <div className="absolute inset-y-0 right-0 flex items-center">
          {/* Clear button */}
          {isActive && (
            <button
              onClick={handleClear}
              className="p-1 mr-1 text-gray-400 hover:text-gray-600 rounded"
              title="Clear search"
            >
              <FaTimes className="h-3 w-3" />
            </button>
          )}
          
          {/* Filter button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-1 mr-2 rounded ${showFilters ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="Search filters"
          >
            <FaFilter className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Search Filters */}
      {showFilters && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
          <div className="text-sm font-medium text-gray-700 mb-3">Search in:</div>
          
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeTrackNames}
                onChange={(e) => updateFilters({ includeTrackNames: e.target.checked })}
                className="mr-2"
              />
              Track names
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeArtists}
                onChange={(e) => updateFilters({ includeArtists: e.target.checked })}
                className="mr-2"
              />
              Artists
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeAlbums}
                onChange={(e) => updateFilters({ includeAlbums: e.target.checked })}
                className="mr-2"
              />
              Albums
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeGenres}
                onChange={(e) => updateFilters({ includeGenres: e.target.checked })}
                className="mr-2"
              />
              Genres
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includePlaylists}
                onChange={(e) => updateFilters({ includePlaylists: e.target.checked })}
                className="mr-2"
              />
              Playlists
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeTags}
                onChange={(e) => updateFilters({ includeTags: e.target.checked })}
                className="mr-2"
              />
              Tags
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.includeComments}
                onChange={(e) => updateFilters({ includeComments: e.target.checked })}
                className="mr-2"
              />
              Comments
            </label>
          </div>

          {/* Tag type filters */}
          {filters.includeTags && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-2">Tag types:</div>
              <div className="flex gap-4">
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={filters.tagTypes?.includes('manual') ?? true}
                    onChange={(e) => {
                      const tagTypes = filters.tagTypes || ['manual', 'auto', 'system'];
                      const newTagTypes = e.target.checked 
                        ? [...tagTypes.filter(t => t !== 'manual'), 'manual']
                        : tagTypes.filter(t => t !== 'manual');
                      updateFilters({ tagTypes: newTagTypes });
                    }}
                    className="mr-1"
                  />
                  Manual
                </label>
                
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={filters.tagTypes?.includes('auto') ?? true}
                    onChange={(e) => {
                      const tagTypes = filters.tagTypes || ['manual', 'auto', 'system'];
                      const newTagTypes = e.target.checked 
                        ? [...tagTypes.filter(t => t !== 'auto'), 'auto']
                        : tagTypes.filter(t => t !== 'auto');
                      updateFilters({ tagTypes: newTagTypes });
                    }}
                    className="mr-1"
                  />
                  Auto
                </label>
                
                <label className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    checked={filters.tagTypes?.includes('system') ?? true}
                    onChange={(e) => {
                      const tagTypes = filters.tagTypes || ['manual', 'auto', 'system'];
                      const newTagTypes = e.target.checked 
                        ? [...tagTypes.filter(t => t !== 'system'), 'system']
                        : tagTypes.filter(t => t !== 'system');
                      updateFilters({ tagTypes: newTagTypes });
                    }}
                    className="mr-1"
                  />
                  System
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Results */}
      {showResults && isActive && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-40">
          {isSearching ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              Searching...
            </div>
          ) : (
            <>
              {/* Results summary */}
              <div className="p-3 border-b border-gray-100 bg-gray-50 text-sm text-gray-600">
                Found {searchResults.totalResults} results for "{searchQuery}"
              </div>

              {/* Track results */}
              {searchResults.tracks.length > 0 && (
                <div>
                  <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                    Tracks ({searchResults.tracks.length})
                  </div>
                  {searchResults.tracks.slice(0, 10).map((track) => (
                    <div
                      key={track.id}
                      onClick={() => handleTrackClick(track)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {track.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {track.artistName || track.artist?.name || 'Unknown Artist'}
                            {track.albumName || track.album?.name ? ` • ${track.albumName || track.album?.name}` : ''}
                          </div>
                          <div className="text-xs text-blue-600 mt-1">
                            {getMatchedFieldsText(track.id)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {searchResults.tracks.length > 10 && (
                    <div className="p-2 text-xs text-gray-500 text-center">
                      and {searchResults.tracks.length - 10} more tracks...
                    </div>
                  )}
                </div>
              )}

              {/* Playlist results */}
              {searchResults.playlists.length > 0 && (
                <div>
                  <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                    Playlists ({searchResults.playlists.length})
                  </div>
                  {searchResults.playlists.slice(0, 5).map((playlist) => (
                    <div
                      key={playlist.id}
                      onClick={() => handlePlaylistClick(playlist)}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                    >
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {playlist.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {playlist.tracks?.length || 0} tracks
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Comment results */}
              {searchResults.comments && searchResults.comments.length > 0 && (
                <div>
                  <div className="p-2 text-xs font-medium text-gray-500 uppercase tracking-wide bg-gray-50 border-b">
                    Comments ({searchResults.comments.length})
                  </div>
                  {searchResults.comments.slice(0, 5).map((comment) => {
                    // Find the track name for this comment
                    const track = comment.trackId 
                      ? tracks.find(t => t.id.toString() === comment.trackId.toString())
                      : null;
                    const trackName = track?.name || 'Unknown Track';
                    
                    return (
                      <div
                        key={comment.id}
                        onClick={() => handleCommentClick(comment)}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {comment.content}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {comment.userName || 'Unknown User'} • {trackName}
                          {comment.marker?.time !== undefined && (
                            <span> • {Math.floor(comment.marker.time / 60)}:{('0' + Math.floor(comment.marker.time % 60)).slice(-2)}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {searchResults.comments.length > 5 && (
                    <div className="p-2 text-xs text-gray-500 text-center">
                      and {searchResults.comments.length - 5} more comments...
                    </div>
                  )}
                </div>
              )}

              {/* No results */}
              {searchResults.totalResults === 0 && (
                <div className="p-4 text-center text-gray-500">
                  No results found for "{searchQuery}"
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
