import { useState, useEffect, useMemo } from 'react';
import { Track, Playlist, Tag } from '../../../../shared/types';

export interface SearchFilters {
  query: string;
  includeTrackNames: boolean;
  includeArtists: boolean;
  includeAlbums: boolean;
  includeGenres: boolean;
  includePlaylists: boolean;
  includeTags: boolean;
  tagTypes?: ('manual' | 'auto' | 'system')[];
}

export interface SearchResult {
  tracks: Track[];
  playlists: Playlist[];
  matchedFields: {
    [trackId: string]: string[]; // Which fields matched for each track
  };
  totalResults: number;
}

const defaultFilters: SearchFilters = {
  query: '',
  includeTrackNames: true,
  includeArtists: true,
  includeAlbums: true,
  includeGenres: true,
  includePlaylists: true,
  includeTags: true,
  tagTypes: ['manual', 'auto', 'system']
};

export function useSearch(tracks: Track[], playlists: Playlist[] = []) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [isSearching, setIsSearching] = useState(false);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(filters.query);
    }, 300);

    return () => clearTimeout(timer);
  }, [filters.query]);

  // Main search function
  const searchResults = useMemo((): SearchResult => {
    if (!debouncedQuery.trim()) {
      return {
        tracks: [],
        playlists: [],
        matchedFields: {},
        totalResults: 0
      };
    }

    setIsSearching(true);

    const query = debouncedQuery.toLowerCase().trim();
    const searchTerms = query.split(/\s+/);
    
    const matchedTracks: Track[] = [];
    const matchedPlaylists: Playlist[] = [];
    const matchedFields: { [trackId: string]: string[] } = {};

    // Search tracks
    tracks.forEach(track => {
      const fieldsMatched: string[] = [];
      let hasMatch = false;

      // Search in track name
      if (filters.includeTrackNames && track.name) {
        if (searchTerms.some(term => track.name.toLowerCase().includes(term))) {
          fieldsMatched.push('track name');
          hasMatch = true;
        }
      }

      // Search in artist name
      if (filters.includeArtists && (track.artistName || track.artist?.name)) {
        const artistName = (track.artistName || track.artist?.name || '').toLowerCase();
        if (searchTerms.some(term => artistName.includes(term))) {
          fieldsMatched.push('artist');
          hasMatch = true;
        }
      }

      // Search in album name
      if (filters.includeAlbums && (track.albumName || track.album?.name)) {
        const albumName = (track.albumName || track.album?.name || '').toLowerCase();
        if (searchTerms.some(term => albumName.includes(term))) {
          fieldsMatched.push('album');
          hasMatch = true;
        }
      }

      // Search in genre
      if (filters.includeGenres && track.genre) {
        if (searchTerms.some(term => track.genre!.toLowerCase().includes(term))) {
          fieldsMatched.push('genre');
          hasMatch = true;
        }
      }

      // Search in tags
      if (filters.includeTags && track.tags) {
        const matchingTags = track.tags.filter(tag => {
          const typeMatch = !filters.tagTypes || filters.tagTypes.includes(tag.type);
          const nameMatch = searchTerms.some(term => tag.name.toLowerCase().includes(term));
          return typeMatch && nameMatch;
        });

        if (matchingTags.length > 0) {
          fieldsMatched.push(`tags (${matchingTags.map(t => t.name).join(', ')})`);
          hasMatch = true;
        }
      }

      if (hasMatch) {
        matchedTracks.push(track);
        matchedFields[track.id] = fieldsMatched;
      }
    });

    // Search playlists
    if (filters.includePlaylists) {
      playlists.forEach(playlist => {
        if (searchTerms.some(term => playlist.name.toLowerCase().includes(term))) {
          matchedPlaylists.push(playlist);
        }
      });
    }

    setIsSearching(false);

    return {
      tracks: matchedTracks,
      playlists: matchedPlaylists,
      matchedFields,
      totalResults: matchedTracks.length + matchedPlaylists.length
    };
  }, [debouncedQuery, tracks, playlists, filters]);

  // Update search query
  const setQuery = (query: string) => {
    setFilters(prev => ({ ...prev, query }));
  };

  // Update filters
  const updateFilters = (newFilters: Partial<SearchFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  // Clear search
  const clearSearch = () => {
    setFilters(defaultFilters);
  };

  // Check if search is active
  const isActive = debouncedQuery.trim().length > 0;

  return {
    filters,
    setQuery,
    updateFilters,
    clearSearch,
    searchResults,
    isSearching,
    isActive,
    debouncedQuery
  };
} 