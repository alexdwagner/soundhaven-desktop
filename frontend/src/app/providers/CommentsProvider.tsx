// CommentsProvider.tsx
import React, {
  FunctionComponent,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import CommentsContext from "@/contexts/CommentsContext";
import { PlaybackContext } from "@/contexts/PlaybackContext";
import { _Comment, Marker } from "../../types/types";
import { backendUrl } from "@/services/apiService";
// import { CommentsContextType } from '../../types/types';

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
  const [regionCommentMap, setRegionCommentMap] = useState<
    Record<string, number>
  >({});
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLoadingMarkers, setIsLoadingMarkers] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentAddedFlag, setCommentAddedFlag] = useState(false);
  const { currentTrack } = useContext(PlaybackContext);
  const [isCommentAdding, setIsCommentAdding] = useState(false);

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

  const fetchComments = async (
    trackId: number,
    page: number = 1,
    limit: number = 10
  ) => {
    // console.log(`fetchComments called with trackId: ${trackId}, page: ${page}, limit: ${limit}`);

    if (!trackId || trackId <= 0) {
      console.error("Invalid trackId, skipping fetchComments");
      return;
    }

    try {
      const response = await fetch(
        `${backendUrl}/comments?trackId=${trackId}&page=${page}&limit=${limit}`
      );
      // console.log("Raw response:", response); // Debugging: Log the raw response

      if (!response.ok) {
        throw new Error(`Failed to fetch comments: ${response.statusText}`);
      }

      const fetchedComments = await response.json();
      if (!Array.isArray(fetchedComments)) {
        console.error(
          "Expected an array of comments, received:",
          typeof fetchedComments
        );
        return;
      }

      // console.log("Fetched comments:", fetchedComments);
      setComments(fetchedComments); // Update comments state
    } catch (error) {
      console.error("Error fetching comments:", error);
    }
  };

  const fetchCommentsAndMarkers = useCallback(
    async (trackId: number, page: number = 1, limit: number = 10) => {
      // console.log(`fetchCommentsAndMarkers called with trackId: ${trackId}, page: ${page}, limit: ${limit}`);

      if (!trackId || trackId <= 0) {
        console.error("Invalid trackId, skipping fetchCommentsAndMarkers");
        return;
      }

      setIsLoadingMarkers(true);

      try {
        const response = await fetch(
          `${backendUrl}/comments?trackId=${trackId}&page=${page}&limit=${limit}`
        );
        console.log("Raw response from fetchCommentsAndMarkers:", response);

        if (!response.ok) {
          throw new Error(`Failed to fetch comments: ${response.statusText}`);
        }

        const fetchedComments: _Comment[] = await response.json();
        console.log("Fetched comments Array:", fetchedComments);

        if (!Array.isArray(fetchedComments)) {
          console.error(
            "Expected an array of comments, received:",
            typeof fetchedComments
          );
          setIsLoadingMarkers(false);
          return;
        }
        // console.log("Fetched comments:•", fetchedComments);

        console.log(
          "Comments array before updating state for fetchedComments:",
          fetchedComments
        );
        setComments(fetchedComments); // Update comments state
        console.log(
          "Updated fetchedComments array from fetchCommentsAndMarkers:",
          fetchedComments
        );

        const extractedMarkers = fetchedComments
          .filter((comment) => comment.marker)
          .map((comment) => ({
            id: comment.marker.id,
            time: comment.marker.time,
            commentId: comment.marker.commentId,
            trackId: comment.marker.trackId,
            createdAt: comment.marker.createdAt,
            waveSurferRegionID: comment.marker?.waveSurferRegionID ?? "",
          }));

        // Log extracted markers
        // console.log("Extracted markers:•", extractedMarkers);

        setMarkers(extractedMarkers); // Update markers state
        console.log(
          "Updated markers array from fetchCommentsAndMarkers:",
          extractedMarkers
        );

        const newRegionCommentMap: Record<string, number> =
          extractedMarkers.reduce((map: Record<string, number>, marker) => {
            if (marker.waveSurferRegionID && marker.commentId) {
              map[marker.waveSurferRegionID] = marker.commentId;
            }
            return map;
          }, {});
        setRegionCommentMap(newRegionCommentMap);
        setIsLoadingMarkers(false); // Set loading to false after everything is updated
      } catch (error) {
        console.error("Error fetching comments and markers:", error);
        setError("Failed to fetch comments and markers. Please try again.");
        setIsLoadingMarkers(false);
      }
    },
    [
      setIsLoadingMarkers,
      setComments,
      setMarkers,
      setRegionCommentMap,
      setError,
    ]
  );

  const addMarkerAndComment = async (
    trackId: number,
    content: string,
    time: number,
    duration: number,
    waveSurferRegionID: string,
    token: string,
  ) => {
    setIsCommentAdding(true);

    if (!token) {
      console.error("Token is not available or expired.");
      return null;
    }

    console.log(
      `Sending data * - trackId: ${trackId}, time: ${time}, type of time: ${typeof time}, waveSurferRegionID: ${waveSurferRegionID}`
    );

    try {
      const response = await fetch(`${backendUrl}/comments/with-marker`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          trackId,
          content,
          time,
          duration,
          waveSurferRegionID,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error("Error adding comment and marker:", responseData);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${responseData.message}`
        );
      }

      // Assuming responseData structure is { comment: Comment, marker: Marker }
      if (responseData.comment && responseData.marker) {
        // Correctly formatting the date and handling the marker
        const formattedComment = {
          ...responseData.comment,
          createdAt: new Date(responseData.comment.createdAt).toISOString(),
          marker: {
            ...responseData.marker,
            createdAt: new Date(responseData.marker.createdAt).toISOString(),
          },
        };

        setComments((prevComments) => [formattedComment, ...prevComments]);
        setMarkers((prevMarkers) => [formattedComment.marker, ...prevMarkers]);
        setRegionCommentMap((prevMap) => ({
          ...prevMap,
          [responseData.marker.waveSurferRegionID]: responseData.comment.id,
        }));

        console.log(
          "Updated comments array inside addMarkerAndComment, after setComments appends comment:",
          comments
        );

        return formattedComment;
      } else {
        console.error("Invalid response data structure", responseData);
        throw new Error("Invalid response data structure");
      }
    } catch (error) {
      console.error("Detailed error in addMarkerAndComment:", error);
      throw error; // Re-throw the error to be caught in the calling function
    } finally {
      setIsCommentAdding(false); // Reset loading state regardless of success or failure
    }
    console.log(
      "Updated comments array inside addMarkerAndComment, after setCommentIsAdding is set to false:",
      comments
    ); // Log for state change
  };

  const addComment = async (
    trackId: number,
    userId: number,
    content: string,
    token: string
  ) => {
    try {
      const response = await fetch(`${backendUrl}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trackId, userId, content }),
      });

      if (!response.ok) {
        const errorData = await response.json(); // Parse error details only if the response wasn't OK
        console.error("Error adding comment:", errorData);
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorData.message}`
        );
      }

      const newComment = await response.json();
      console.log("New comment added:", newComment);

      // Assuming setComments updates the state to reflect the newly added comment
      // and that your state structure aligns with the response structure
      setComments((prevComments) => [
        ...prevComments,
        {
          ...newComment,
          createdAt: new Date(newComment.createdAt).toISOString(),
        },
      ]);
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const editComment = async (commentId, content) => {
    try {
      const response = await fetch(`${backendUrl}/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to edit comment");
      const updatedComment = await response.json();
      setComments((prev) =>
        prev.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                content,
                createdAt: new Date(updatedComment.createdAt),
              }
            : comment
        )
      );
    } catch (error) {
      console.error("Error editing comment:", error);
    }
  };

  const deleteComment = async (commentId) => {
    try {
      const response = await fetch(`${backendUrl}/comments/${commentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete comment");
      setComments((prev) => prev.filter((comment) => comment.id !== commentId));
    } catch (error) {
      console.error("Error deleting comment:", error);
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
        editComment: async () => {},
        deleteComment: async () => {},
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
