"use client";

import React, {
  FunctionComponent,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import CommentsContext from "../contexts/CommentsContext";
import { PlaybackContext } from "../contexts/PlaybackContext";
import { _Comment, Marker } from "../../../../shared/types";
import apiService from "@/services/electronApiService";
import { useAuth } from "@/app/contexts/AuthContext";

interface CommentsProviderProps {
  children: ReactNode;
}

export const CommentsProvider: FunctionComponent<CommentsProviderProps> = ({
  children,
}) => {
  const [comments, setComments] = useState<_Comment[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [selectedCommentId, setSelectedCommentId] = useState<number | null>(
    null
  );
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [isCommentAdding, setIsCommentAdding] = useState<boolean>(false);
  const [isLoadingComments, setIsLoadingComments] = useState<boolean>(false);
  const [isLoadingMarkers, setIsLoadingMarkers] = useState<boolean>(false);
  const [regionCommentMap, setRegionCommentMap] = useState<Record<string, number>>({});
  const { token, user } = useAuth();
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentAddedFlag, setCommentAddedFlag] = useState(false);
  const { currentTrack } = useContext(PlaybackContext);

  // const [commentsCount, setCommentsCount] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async (trackId: number, page: number = 1, limit: number = 10) => {
    if (!trackId || trackId <= 0) {
      console.error("Invalid trackId, skipping fetchComments");
      return [];
    }

    setIsLoadingComments(true);
    setCommentsError(null);

    try {
      const response = await fetch(
        `/api/comments?trackId=${trackId}&page=${page}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      const data = await response.json();

      if (page === 1) {
        setComments(data.comments || []);
      } else {
        setComments((prev) => [...prev, ...(data.comments || [])]);
      }

      return data.comments || [];
    } catch (error) {
      console.error("Error fetching comments:", error);
      setCommentsError("Failed to load comments");
      return [];
    } finally {
      setIsLoadingComments(false);
    }
  }, []);

  const fetchCommentsAndMarkers = useCallback(
    async (trackId: number, page: number = 1, limit: number = 10) => {
      if (!trackId || trackId <= 0) {
        console.error("Invalid trackId, skipping fetchCommentsAndMarkers");
        return;
      }

      console.log('🔍 [CommentsProvider] Starting fetchCommentsAndMarkers for track:', trackId);
      setIsLoadingMarkers(true);

      try {
        console.log('📡 [CommentsProvider] Calling apiService.fetchCommentsAndMarkers...');
        const response = await apiService.fetchCommentsAndMarkers(trackId, page, limit);
        console.log('📡 [CommentsProvider] API Response received:', response);

        if (response.error) {
          console.error('❌ [CommentsProvider] API Error:', response.error);
          throw new Error(`Failed to fetch comments: ${response.error}`);
        }

        const responseData = response.data;
        console.log('📋 [CommentsProvider] Response data:', responseData);

        // Handle pagination structure from API
        let fetchedComments;
        if (responseData && typeof responseData === 'object' && 'comments' in responseData) {
          // New pagination structure
          fetchedComments = responseData.comments;
          console.log('📋 [CommentsProvider] Using pagination structure, comments:', fetchedComments);
        } else if (Array.isArray(responseData)) {
          // Legacy array structure
          fetchedComments = responseData;
          console.log('📋 [CommentsProvider] Using legacy array structure, comments:', fetchedComments);
        } else {
          console.error(
            "❌ [CommentsProvider] Expected an array of comments or pagination object, received:",
            typeof responseData,
            responseData
          );
          setError("Invalid response format from server");
          setIsLoadingMarkers(false);
          return;
        }

        console.log('📋 [CommentsProvider] Fetched comments:', fetchedComments);
        console.log('📋 [CommentsProvider] Comments count:', Array.isArray(fetchedComments) ? fetchedComments.length : 0);

        if (!Array.isArray(fetchedComments)) {
          console.error(
            "❌ [CommentsProvider] Expected an array of comments, received:",
            typeof fetchedComments,
            fetchedComments
          );
          setError("Invalid response format from server");
          setIsLoadingMarkers(false);
          return;
        }

        // Debug each comment's marker
        fetchedComments.forEach((comment, index) => {
          console.log(`🔍 [CommentsProvider] Comment ${index + 1}:`, {
            id: comment.id,
            content: comment.content?.substring(0, 30) + '...',
            hasMarker: !!comment.marker,
            marker: comment.marker
          });
        });

        setComments(fetchedComments);
        console.log('✅ [CommentsProvider] Comments set in state');

        const extractedMarkers = fetchedComments
          .filter((comment) => {
            const hasMarker = !!comment.marker;
            console.log(`🎯 [CommentsProvider] Comment ${comment.id} has marker:`, hasMarker);
            return hasMarker;
          })
          .map((comment, index) => {
            const marker = {
              id: comment.marker?.id || 0,
              commentId: comment.id,
              time: comment.marker?.time || 0,
              trackId: comment.marker?.trackId ?? 0,
              createdAt: comment.marker?.createdAt ?? '',
              waveSurferRegionID: comment.marker?.waveSurferRegionID ?? "",
              data: {
                customColor: comment.marker?.data?.customColor || "#FF0000",
                isVisible: true,
                isDraggable: true,
                isResizable: false
              }
            };
            console.log(`🎯 [CommentsProvider] Extracted marker ${index + 1}:`, marker);
            return marker;
          });

        console.log('🎯 [CommentsProvider] Total extracted markers:', extractedMarkers.length);
        console.log('🎯 [CommentsProvider] All extracted markers:', extractedMarkers);
        
        setMarkers(extractedMarkers);
        console.log('✅ [CommentsProvider] Markers set in state');

        const newRegionCommentMap: Record<string, number> =
          extractedMarkers.reduce((map: Record<string, number>, marker) => {
            if (marker.waveSurferRegionID && marker.commentId) {
              map[marker.waveSurferRegionID] = marker.commentId;
              console.log(`🗺️ [CommentsProvider] Added to region map: ${marker.waveSurferRegionID} -> ${marker.commentId}`);
            }
            return map;
          }, {});
        
        console.log('🗺️ [CommentsProvider] Final region comment map:', newRegionCommentMap);
        setRegionCommentMap(newRegionCommentMap);
        setIsLoadingMarkers(false);
        console.log('✅ [CommentsProvider] fetchCommentsAndMarkers completed successfully');
      } catch (error) {
        console.error("❌ [CommentsProvider] Error fetching comments and markers:", error);
        setError(`Failed to fetch comments and markers: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsLoadingMarkers(false);
      }
    },
    [setComments, setMarkers, setRegionCommentMap, setError]
  );

  // Add useEffect to fetch comments when currentTrack changes
  useEffect(() => {
    console.log('🎯 [CommentsProvider] currentTrack changed:', currentTrack);
    
    // Always clear existing markers/comments first when track changes
    console.log('🎯 [CommentsProvider] Clearing existing markers and comments');
    setComments([]);
    setMarkers([]);
    setRegionCommentMap({});
    
    if (currentTrack?.id) {
      console.log('🎯 [CommentsProvider] Fetching comments for track:', currentTrack.id);
      fetchCommentsAndMarkers(currentTrack.id)
        .then(() => {
          console.log('🎯 [CommentsProvider] Comments fetched successfully');
        })
        .catch(error => {
          console.error('🎯 [CommentsProvider] Error fetching comments:', error);
          setError(`Failed to fetch comments: ${error instanceof Error ? error.message : 'Unknown error'}`);
        });
    } else {
      console.log('🎯 [CommentsProvider] No currentTrack, staying cleared');
    }
  }, [currentTrack, fetchCommentsAndMarkers]);

  const addMarkerAndComment = async (
    trackId: number,
    content: string,
    time: number,
    color: string = "#FF0000"
  ) => {
    setIsCommentAdding(true);

    try {
      console.log('Adding comment with marker:', { trackId, content, time, color, userId: user?.id });
      
      if (!user?.id) {
        console.error('Cannot add comment: User ID is missing');
        throw new Error('User ID is required to add a comment');
      }
      
      const commentData = {
          trackId,
          content,
          time,
          color,
        userId: user.id,
      };
      
      const comment = await apiService.addMarkerAndComment(commentData);
      console.log('Comment added successfully:', comment);

      if (!comment) {
        console.error('Invalid response format from API');
        throw new Error('Invalid response format from server');
      }

      // Add the new comment without overwriting existing ones
      setComments((prev) => {
        console.log('Adding new comment to existing comments:', {
          newComment: comment,
          existingCommentsCount: prev.length
        });
        return [comment, ...prev];
      });

      if (comment.marker) {
        console.log('Marker data received:', comment.marker);
        
        // Create a properly formatted marker object
        const newMarker = {
          id: comment.marker.id,
          commentId: comment.id,
          time: comment.marker.time,
          trackId: comment.marker.trackId,
          createdAt: comment.marker.createdAt,
          waveSurferRegionID: comment.marker.waveSurferRegionID,
          data: {
            customColor: color || "#FF0000",
            isVisible: true,
            isDraggable: true,
            isResizable: false
          }
        };
        
        console.log('Adding new marker to state:', newMarker);
        setMarkers((prev) => {
          console.log('Adding new marker to existing markers:', {
            newMarker: newMarker,
            existingMarkersCount: prev.length
          });
          return [newMarker, ...prev];
        });
        
        // Update region comment map if needed
        if (comment.marker.waveSurferRegionID) {
          console.log('Updating region comment map:', {
            regionId: comment.marker.waveSurferRegionID,
            commentId: comment.id
          });
          
          setRegionCommentMap((prev) => ({
            ...prev,
            [comment.marker.waveSurferRegionID]: comment.id
          }));
      }
      } else {
        console.warn('Comment added but no marker data was returned');
      }

      // No need to refresh - we already added the comment to state above
      console.log('Comment and marker successfully added to state');

      return comment;
    } catch (error) {
      console.error("Error adding comment with marker:", error);
      setError(`Failed to add comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    } finally {
      setIsCommentAdding(false);
    }
  };

  const addComment = async (
    trackId: number,
    userId: number,
    content: string,
    token: string
  ) => {
    try {
      const response = await fetch(`/api/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error adding comment:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorData.message}`
        );
      }

      const newComment = await response.json();

      setComments((prev) => [...prev, newComment]);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const editComment = async (commentId: number, content: string) => {
    try {
      const response = await apiService.editComment(commentId, content);

      if (response.error) {
        throw new Error(response.error);
      }

      const updatedComment = response.data;

      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId ? { ...comment, ...updatedComment } : comment
        )
      );

      return updatedComment;
    } catch (error) {
      console.error("Error updating comment:", error);
      throw error;
    }
  };

  const deleteComment = async (commentId: number) => {
    try {
      const response = await apiService.deleteComment(commentId);

      if (response.error) {
        throw new Error(response.error);
      }

      // Remove comment from state
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      
      // Remove associated marker from state
      setMarkers((prev) => prev.filter((marker) => marker.commentId !== commentId));
      
      // Remove from region comment map
      setRegionCommentMap((prev) => {
        const newMap = { ...prev };
        Object.keys(newMap).forEach(regionId => {
          if (newMap[regionId] === commentId) {
            delete newMap[regionId];
          }
        });
        return newMap;
      });
      
      console.log('Comment, marker, and region mapping deleted successfully for commentId:', commentId);
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  };

  return (
    <CommentsContext.Provider
      value={{
        comments,
        setComments,
        markers,
        setMarkers,
        fetchComments,
        fetchCommentsAndMarkers,
        addComment,
        addMarkerAndComment,
        editComment,
        deleteComment,
        selectedCommentId,
        setSelectedCommentId,
        selectedRegionId,
        setSelectedRegionId,
        regionCommentMap,
        setRegionCommentMap,
        isLoadingComments,
        commentsError,
      }}
    >
      {children}
    </CommentsContext.Provider>
  );
};
