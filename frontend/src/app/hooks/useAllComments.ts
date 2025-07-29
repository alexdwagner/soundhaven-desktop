import { useState, useEffect, useCallback, useRef } from 'react';
import { _Comment as Comment } from '../../../../shared/types';
import apiService from '../../services/electronApiService';

// Configuration for retry logic
const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000   // 5 seconds
};

// Helper function to validate comment structure
const isValidComment = (comment: any): comment is Comment => {
  return (
    comment &&
    typeof comment === 'object' &&
    (typeof comment.id === 'string' || typeof comment.id === 'number') &&
    typeof comment.content === 'string' &&
    typeof comment.userName === 'string' &&
    (typeof comment.trackId === 'string' || typeof comment.trackId === 'number') &&
    (typeof comment.userId === 'string' || typeof comment.userId === 'number')
  );
};

// Helper function to sanitize comments array
const sanitizeComments = (comments: any[]): Comment[] => {
  if (!Array.isArray(comments)) {
    console.warn('🔍 [useAllComments] Comments data is not an array, returning empty array');
    return [];
  }

  return comments.filter(isValidComment).map(comment => ({
    ...comment,
    // Ensure consistent types
    id: comment.id.toString(),
    trackId: comment.trackId.toString(),
    userId: comment.userId.toString(),
    createdAt: comment.createdAt || new Date(),
    // Provide safe defaults for optional fields
    marker: comment.marker || undefined,
    replies: Array.isArray(comment.replies) ? comment.replies : undefined,
    replyToId: comment.replyToId || undefined,
    replyTo: comment.replyTo || undefined
  }));
};

export const useAllComments = () => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start with true for initial load
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const attemptCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup function
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const fetchAllComments = useCallback(async (isRetry = false) => {
    // Only set loading to true if it's not a retry or if we don't have any comments yet
    if (!isRetry || comments.length === 0) {
      setIsLoading(true);
    }
    
    // Clear error when starting a new attempt (not a retry)
    if (!isRetry) {
      setError(null);
      attemptCountRef.current = 0;
    }

    try {
      console.log('🔍 [useAllComments] Fetching all comments for search (attempt:', attemptCountRef.current + 1, ')');
      
      // Ensure we have a mounted component before making the API call
      if (!isMountedRef.current) {
        console.log('🔍 [useAllComments] Component unmounted, aborting fetch');
        return;
      }

      const response = await apiService.fetchAllComments();
      
      // Check if component is still mounted after async operation
      if (!isMountedRef.current) {
        console.log('🔍 [useAllComments] Component unmounted during fetch, ignoring response');
        return;
      }
      
      console.log('🔍 [useAllComments] Raw response:', response);
      
      // Handle API error responses
      if (response.error) {
        console.error('🔍 [useAllComments] API returned error:', response.error);
        throw new Error(response.error);
      }

      // Handle different response structures with robust error handling
      let fetchedComments: Comment[] = [];
      
      try {
        console.log('🔍 [useAllComments] Processing response.data:', response.data);
        console.log('🔍 [useAllComments] Response.data type:', typeof response.data);
        console.log('🔍 [useAllComments] Response.data keys:', response.data && typeof response.data === 'object' ? Object.keys(response.data) : 'not an object');
        
        if (response.data && typeof response.data === 'object' && 'comments' in response.data) {
          // Pagination structure
          const rawComments = (response.data as any).comments;
          console.log('🔍 [useAllComments] Raw comments from pagination structure:', rawComments?.length, rawComments);
          fetchedComments = sanitizeComments(rawComments || []);
          console.log('🔍 [useAllComments] Using pagination structure, comments:', fetchedComments.length);
        } else if (Array.isArray(response.data)) {
          // Array structure
          fetchedComments = sanitizeComments(response.data);
          console.log('🔍 [useAllComments] Using array structure, comments:', fetchedComments.length);
        } else if (response.data === null || response.data === undefined) {
          // Null/undefined response - treat as empty but not an error
          console.log('🔍 [useAllComments] API returned null/undefined data, using empty array');
          fetchedComments = [];
        } else {
          console.warn('🔍 [useAllComments] Unexpected response structure:', response.data);
          console.warn('🔍 [useAllComments] Response.data:', JSON.stringify(response.data, null, 2));
          fetchedComments = [];
        }
      } catch (parseError) {
        console.error('🔍 [useAllComments] Error parsing response data:', parseError);
        fetchedComments = [];
      }

      console.log('🔍 [useAllComments] Final fetched comments:', fetchedComments.length);
      
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setComments(fetchedComments);
        setError(null); // Clear any previous errors on success
        attemptCountRef.current = 0; // Reset retry counter on success
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [useAllComments] Error fetching comments:', errorMessage);
      
      // Only update state if component is still mounted
      if (!isMountedRef.current) {
        return;
      }

      // Implement retry logic for transient failures
      attemptCountRef.current += 1;
      
      if (attemptCountRef.current < RETRY_CONFIG.maxAttempts && 
          (errorMessage.includes('Load failed') || 
           errorMessage.includes('Network error') || 
           errorMessage.includes('timeout') ||
           errorMessage.includes('IPC'))) {
        
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attemptCountRef.current - 1),
          RETRY_CONFIG.maxDelay
        );
        
        console.log(`🔄 [useAllComments] Retrying in ${delay}ms (attempt ${attemptCountRef.current}/${RETRY_CONFIG.maxAttempts})`);
        
        retryTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchAllComments(true);
          }
        }, delay);
      } else {
        // Set error state only after all retries are exhausted or for non-retryable errors
        setError(errorMessage);
        console.warn('🔍 [useAllComments] All retry attempts exhausted or non-retryable error, using empty array for comments');
      }
      
      // Always ensure comments is an empty array on error to prevent crashes
      setComments([]);
    } finally {
      // Only update loading state if component is still mounted
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [comments.length]);

  useEffect(() => {
    fetchAllComments();
  }, [fetchAllComments]);

  // Return bulletproof state - comments is always an array
  return {
    comments: Array.isArray(comments) ? comments : [], // Double-check array type
    isLoading,
    error,
    refetch: () => fetchAllComments(false) // Reset retry counter on manual refetch
  };
}; 