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
import { apiService } from "@/services/electronApiService";
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
  const { token } = useAuth();
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentAddedFlag, setCommentAddedFlag] = useState(false);
  const { currentTrack } = useContext(PlaybackContext);

  // const [commentsCount, setCommentsCount] = useState<number>(0);

  const [error, setError] = useState<string | null>(null);

  // useEffect(() => {
  //   if (commentAddedFlag && currentTrack?.id) {
  //     fetchCommentsAndMarkers(currentTrack.id)
  //       .then(() => {
  //         console.log("Comments re-fetched after adding a new comment");
  //         setCommentAddedFlag(false);
  //       })
  //       .catch(error => {
  //         console.error("Failed to fetch comments after adding new one:", error);
  //         setCommentAddedFlag(false);
  //       });
  //   }
  // }, [commentAddedFlag, currentTrack?.id]);

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

      setIsLoadingMarkers(true);

      try {
        const response = await fetch(
          `/api/comments?trackId=${trackId}&page=${page}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch comments: ${response.statusText}`);
        }

        const fetchedComments: _Comment[] = await response.json();

        if (!Array.isArray(fetchedComments)) {
          console.error(
            "Expected an array of comments, received:",
            typeof fetchedComments
          );
          setIsLoadingMarkers(false);
          return;
        }

        setComments(fetchedComments);

        const extractedMarkers = fetchedComments
          .filter((comment) => comment.marker)
          .map((comment) => ({
            id: comment.marker?.id || 0,
            commentId: comment.id,
            time: comment.marker?.time || 0,
            trackId: comment.marker.trackId,
            createdAt: comment.marker.createdAt,
            waveSurferRegionID: comment.marker?.waveSurferRegionID ?? "",
            data: {
              customColor: comment.marker?.data?.customColor || "#FF0000",
              isVisible: true,
              isDraggable: true,
              isResizable: false
            }
          }));

        setMarkers(extractedMarkers);

        const newRegionCommentMap: Record<string, number> =
          extractedMarkers.reduce((map: Record<string, number>, marker) => {
            if (marker.waveSurferRegionID && marker.commentId) {
              map[marker.waveSurferRegionID] = marker.commentId;
            }
            return map;
          }, {});
        setRegionCommentMap(newRegionCommentMap);
        setIsLoadingMarkers(false);
      } catch (error) {
        console.error("Error fetching comments and markers:", error);
        setError("Failed to fetch comments and markers. Please try again.");
        setIsLoadingMarkers(false);
      }
    },
    [setComments, setMarkers, setRegionCommentMap, setError]
  );

  const addMarkerAndComment = async (
    trackId: number,
    content: string,
    time: number,
    color: string = "#FF0000"
  ) => {
    setIsCommentAdding(true);

    try {
      const response = await fetch(`/api/comments/with-marker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackId,
          content,
          time,
          color,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment with marker: ${response.statusText}`);
      }

      const data = await response.json();

      setComments((prev) => [data.comment, ...prev]);

      if (data.marker) {
        setMarkers((prev) => [data.marker, ...prev]);
      }

      return data.comment;
    } catch (error) {
      console.error("Error adding comment with marker:", error);
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
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update comment: ${response.statusText}`);
      }

      const updatedComment = await response.json();

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
      const response = await fetch(`/api/comments/${commentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }

      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
      return true;
    } catch (error) {
      console.error("Error deleting comment:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (currentTrack?.id) {
      fetchComments(currentTrack.id, 1);
    } else {
      setComments([]);
    }
  }, [currentTrack?.id, fetchComments]);

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
