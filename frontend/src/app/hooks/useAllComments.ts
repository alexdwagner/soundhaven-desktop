import { useState, useEffect, useCallback } from 'react';
import { _Comment as Comment } from '../../../../shared/types';
import apiService from '../../services/electronApiService';

export const useAllComments = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllComments = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 [useAllComments] Fetching all comments for search');
      const response = await apiService.fetchAllComments();
      
      console.log('🔍 [useAllComments] Raw response:', response);
      
      if (response.error) {
        console.error('🔍 [useAllComments] API returned error:', response.error);
        throw new Error(response.error);
      }

      // Handle pagination structure from API
      let fetchedComments: Comment[] = [];
      if (response.data && typeof response.data === 'object' && 'comments' in response.data) {
        // Pagination structure
        fetchedComments = (response.data as any).comments || [];
        console.log('🔍 [useAllComments] Using pagination structure, comments:', fetchedComments.length);
      } else if (Array.isArray(response.data)) {
        // Array structure
        fetchedComments = response.data;
        console.log('🔍 [useAllComments] Using array structure, comments:', fetchedComments.length);
      } else {
        console.warn('🔍 [useAllComments] Unexpected response structure:', response.data);
        fetchedComments = [];
      }

      console.log('🔍 [useAllComments] Final fetched comments:', fetchedComments.length);
      setComments(fetchedComments);
    } catch (error) {
      console.error('❌ [useAllComments] Error fetching comments:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setComments([]); // Set empty array on error to allow other search functionality to work
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllComments();
  }, [fetchAllComments]);

  return {
    comments,
    isLoading,
    error,
    refetch: fetchAllComments
  };
}; 