import { useState, useEffect, useMemo } from 'react';
import { Track, Playlist, Tag, _Comment as Comment } from '../../../../shared/types';

export interface SearchFilters {
  query: string;
  includeTrackNames: boolean;
  includeArtists: boolean;
  includeAlbums: boolean;
  includeGenres: boolean;
  includePlaylists: boolean;
  includeTags: boolean;
  includeComments: boolean;
  tagTypes?: ('manual' | 'auto' | 'system')[];
}

export interface SearchResult {
  tracks: Track[];
  playlists: Playlist[];
  comments: Comment[];
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
  includeComments: true,
  tagTypes: ['manual', 'auto', 'system']
};

export function useSearch(tracks: Track[], playlists: Playlist[] = [], comments: Comment[] = []) {
  // console.log('🔍 [useSearch] Hook called with:', { 
  //   tracksCount: tracks.length, 
  //   playlistsCount: playlists.length, 
  //   commentsCount: comments.length 
  // });
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState(''); // Manual search query (only updates on Enter)

  // Manual search function
  const triggerSearch = () => {
    console.log('🔍 [useSearch] MANUAL SEARCH TRIGGERED:', {
      query: filters.query,
      filters: Object.entries(filters).filter(([, value]) => value).map(([key]) => key),
      availableData: {
        tracks: tracks.length,
        playlists: playlists.length,
        comments: comments.length
      },
      timestamp: new Date().toISOString()
    });
    setSearchQuery(filters.query);
  };

  // Main search function
  const searchResults = useMemo((): SearchResult => {
    if (!searchQuery.trim()) {
      return {
        tracks: [],
        playlists: [],
        comments: [],
        matchedFields: {},
        totalResults: 0
      };
    }

    setIsSearching(true);

    const query = searchQuery.toLowerCase().trim();
    const searchTerms = query.split(/\s+/);
    
    const matchedTracks: Track[] = [];
    const matchedPlaylists: Playlist[] = [];
    const matchedComments: Comment[] = [];
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

      // Search in comments (with error handling)
      if (filters.includeComments && Array.isArray(comments) && comments.length > 0) {
        try {
          const trackComments = comments.filter(comment => 
            comment && comment.trackId && comment.trackId.toString() === track.id.toString()
          );
          const matchingComments = trackComments.filter(comment => 
            comment && comment.content && 
            searchTerms.some(term => comment.content.toLowerCase().includes(term))
          );

          if (matchingComments.length > 0) {
            const commentPreview = matchingComments[0].content.substring(0, 30) + '...';
            fieldsMatched.push(`comments (${matchingComments.length} found: "${commentPreview}")`);
            hasMatch = true;
          }
        } catch (error) {
          console.warn('🔍 [useSearch] Error searching comments:', error);
          // Continue without comments search if there's an error
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

    // Search comments separately
    if (filters.includeComments && Array.isArray(comments) && comments.length > 0) {
      try {
        comments.forEach(comment => {
          if (comment && comment.content && 
              searchTerms.some(term => comment.content.toLowerCase().includes(term))) {
            matchedComments.push(comment);
          }
        });
      } catch (error) {
        console.warn('🔍 [useSearch] Error searching comments separately:', error);
      }
    }

    setIsSearching(false);

    console.log('🔍 [useSearch] Search completed:', {
      query: searchQuery,
      searchTerms,
      totalTracks: tracks.length,
      totalPlaylists: playlists.length,
      totalComments: comments.length,
      matchedTracks: matchedTracks.length,
      matchedPlaylists: matchedPlaylists.length,
      matchedComments: matchedComments.length,
      totalResults: matchedTracks.length + matchedPlaylists.length + matchedComments.length,
      activeFilters: Object.entries(filters).filter(([, value]) => value).map(([key]) => key),
      includeComments: filters.includeComments
    });

    return {
      tracks: matchedTracks,
      playlists: matchedPlaylists,
      comments: matchedComments,
      matchedFields,
      totalResults: matchedTracks.length + matchedPlaylists.length + matchedComments.length
    };
  }, [searchQuery, tracks, playlists, comments, filters]);

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
  const isActive = searchQuery.trim().length > 0;

  return {
    filters,
    setQuery,
    updateFilters,
    clearSearch,
    searchResults,
    isSearching,
    isActive,
    triggerSearch,
    searchQuery
  };
} 