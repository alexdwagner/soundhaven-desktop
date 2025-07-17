import { useState, useEffect } from 'react';
import { Tag } from '../../../../shared/types';
import { electronApiService } from '../../services/electronApiService';

export interface TagsState {
  tags: Tag[];
  loading: boolean;
  error: string | null;
}

export const useTags = () => {
  const [state, setState] = useState<TagsState>({
    tags: [],
    loading: false,
    error: null
  });

  // Fetch all tags
  const fetchTags = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await electronApiService.makeRequest('/api/tags', 'GET');
      setState(prev => ({ 
        ...prev, 
        tags: response.data || [], 
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to fetch tags',
        loading: false 
      }));
    }
  };

  // Create a new tag
  const createTag = async (tagData: { name: string; color?: string; type?: 'manual' | 'auto' | 'system'; confidence?: number }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await electronApiService.makeRequest('/api/tags', 'POST', tagData);
      const newTag = response.data;
      
      setState(prev => ({ 
        ...prev, 
        tags: [...prev.tags, newTag],
        loading: false 
      }));
      
      return newTag;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to create tag',
        loading: false 
      }));
      throw error;
    }
  };

  // Update an existing tag
  const updateTag = async (tagId: string, updates: { name?: string; color?: string; type?: 'manual' | 'auto' | 'system'; confidence?: number }) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const response = await electronApiService.makeRequest(`/api/tags/${tagId}`, 'PATCH', updates);
      const updatedTag = response.data;
      
      setState(prev => ({ 
        ...prev, 
        tags: prev.tags.map(tag => tag.id === tagId ? updatedTag : tag),
        loading: false 
      }));
      
      return updatedTag;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to update tag',
        loading: false 
      }));
      throw error;
    }
  };

  // Delete a tag
  const deleteTag = async (tagId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      await electronApiService.makeRequest(`/api/tags/${tagId}`, 'DELETE');
      
      setState(prev => ({ 
        ...prev, 
        tags: prev.tags.filter(tag => tag.id !== tagId),
        loading: false 
      }));
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Failed to delete tag',
        loading: false 
      }));
      throw error;
    }
  };

  // Get tags for a specific track
  const getTrackTags = async (trackId: string): Promise<Tag[]> => {
    try {
      const response = await electronApiService.makeRequest(`/api/tags/track/${trackId}`, 'GET');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch track tags:', error);
      return [];
    }
  };

  // Add tag to track
  const addTagToTrack = async (trackId: string, tagId: string) => {
    try {
      const response = await electronApiService.makeRequest(`/api/tags/track/${trackId}`, 'POST', { tagId });
      return response.data;
    } catch (error) {
      console.error('Failed to add tag to track:', error);
      throw error;
    }
  };

  // Remove tag from track
  const removeTagFromTrack = async (trackId: string, tagId: string) => {
    try {
      await electronApiService.makeRequest(`/api/tags/track/${trackId}/${tagId}`, 'DELETE');
    } catch (error) {
      console.error('Failed to remove tag from track:', error);
      throw error;
    }
  };

  // Initialize tags on mount
  useEffect(() => {
    fetchTags();
  }, []);

  return {
    ...state,
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    getTrackTags,
    addTagToTrack,
    removeTagFromTrack,
  };
}; 