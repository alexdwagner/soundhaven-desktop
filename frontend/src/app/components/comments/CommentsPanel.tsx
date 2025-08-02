import React, { useState, useEffect, useCallback } from 'react';
// import Image from 'next/image';
import InfiniteScroll from 'react-infinite-scroll-component';

import { useAuth } from '@/app/contexts/AuthContext';
import { useComments } from '@/app/hooks/useComments';
import { usePlayback } from '@/app/hooks/UsePlayback';
import { useRef } from 'react';

import CommentBlock from './CommentBlock';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';

interface CommentsPanelProps {
  trackId: number;
  show: boolean;
  onClose: () => void;
  comments?: Comment[];
  addComment?: (trackId: number, userId: number, content: string, token: string) => Promise<void>;
  regionsRef: React.MutableRefObject<RegionsPlugin | null>;
  waveSurferRef: React.MutableRefObject<WaveSurfer | null>;
  handleCommentClick?: (commentId: number) => void;
  onSelectComment: (commentId: number) => void;
  // setIsCommentInputFocused: (isFocused: boolean) => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  trackId,
  show,
  onClose,
  regionsRef,
  waveSurferRef,
  onSelectComment,
  // setIsCommentInputFocused,
}) => {
  // console.log("🔴 [COMMENTS PANEL] Rendered with props:", {
  //   trackId,
  //   show,
  //   onClose: typeof onClose,
  //   onCloseFunction: onClose.toString().substring(0, 100)
  // });

  const { user, token, loading: authLoading } = useAuth();
  // TODO: Refactor so CommentsProvider handles newComment and setNewComment.
  const {
    comments,
    setComments,
    markers,
    addComment,
    addMarkerAndComment,
    editComment,
    deleteComment,
    fetchCommentsAndMarkers,
    selectedCommentId,
    regionCommentMap,
    handleSelectComment,
  } = useComments(waveSurferRef, regionsRef);

  const [newComment, setNewComment] = useState<string>('');
  const commentBlockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [isCommentInputFocused, setIsCommentInputFocused] = useState(false); // Local state for input
  const { setIsCommentInputFocused: setIsFocusedFromContext } = usePlayback();
  const [isPostingComment, setIsPostingComment] = useState(false);
  
  // Debug: Monitor show prop changes
  useEffect(() => {
    console.log('🔴 [COMMENTS PANEL] show prop changed to:', show);
  }, [show]);
  
  // Debug: Monitor onClose function changes
  // useEffect(() => {
  //   console.log('🔴 [COMMENTS PANEL] onClose function changed:', {
  //     type: typeof onClose,
  //     functionString: onClose.toString().substring(0, 150)
  //   });
  // }, [onClose]);
  
  // Edit modal state
  const [editingComment, setEditingComment] = useState<any | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [isEditingComment, setIsEditingComment] = useState(false);

  // Update PlaybackContext when local state changes
  useEffect(() => {
    setIsFocusedFromContext(isCommentInputFocused);
  }, [isCommentInputFocused, setIsFocusedFromContext]);

  // Function to assign a ref to the ref object
  const setCommentBlockRef = (element: HTMLDivElement | null, id: number) => {
    if (element) {
      commentBlockRefs.current[id] = element;
    }
  };

  // const [hasMore, setHasMore] = useState<boolean>(true);
  // const [page, setPage] = useState<number>(1);
  // const [limit] = useState<number>(10);

  const commentsArray = comments || [];
  // const commentsArray = [{id: 1, userName: "Test User", content: "This is a test comment."}];


  // Comments and markers are now fetched by CommentsProvider when track changes
  // No need to duplicate the fetch here

  // Temporarily disabled to prevent overwriting hardcoded test markers
  // useEffect(() => {
  //   if (trackId > 0) {
  //     const fetchData = async () => { // Ensures `await` can be used
  //       await fetchCommentsAndMarkers(trackId, 1, 10);
  //     }

  //     fetchData(); // Call the async function 
  //   }
  // }, [trackId]);

  useEffect(() => {
    if (selectedCommentId && commentBlockRefs.current[selectedCommentId]) {
      // Scroll the selected comment into view
      const selectedElement = commentBlockRefs.current[selectedCommentId];
      selectedElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center', // Adjust to 'nearest' if 'center' causes issues
      });
    }
  }, [selectedCommentId]);

  // Submitting new comments
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newComment.trim() || !token || !user) return;

    setIsPostingComment(true);

    try {
      // Use addMarkerAndComment instead of addComment to ensure consistency
      // Set time to 0 for comments not associated with a specific time position
      await addMarkerAndComment(trackId, newComment.trim(), 0, '#4F46E5');
      setNewComment('');
      console.log('Comment with marker posted successfully, state updated automatically');
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setIsPostingComment(false);
    }
  };

  // Load more comments (for infinite scroll)
  // const loadMoreComments = () => {
  //   setPage(prevPage => prevPage + 1);
  // };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === ' ') {
      event.stopPropagation();
    }
  };

  const handleCommentClick = useCallback((commentId: number) => {
    if (!waveSurferRef.current || !regionsRef.current) return;

    const regions = regionsRef.current.getRegions();
    const selectedRegion = regions.find((region) =>
      Object.entries(regionCommentMap).some(([regionId, cId]) => cId === commentId && region.id === regionId)
    );

    if (selectedRegion) {
      // Seek to the region's position in the track
      try {
        const duration = waveSurferRef.current.getDuration();
        if (duration > 0) {
          const seekPosition = selectedRegion.start / duration;
          waveSurferRef.current.seekTo(seekPosition);
        }
      } catch (error) {
        console.warn('Could not seek to region position:', error);
      }
      
      // Try to update region color if the method exists
      try {
        if (selectedRegion.element && selectedRegion.element.style) {
          // Direct DOM manipulation as fallback
          selectedRegion.element.style.backgroundColor = 'rgba(0, 255, 0, 0.7)';
        }
      } catch (error) {
        console.warn('Could not update region color:', error);
      }
    }

    // Call the parent component's onSelectComment handler
    onSelectComment(commentId);
  }, [regionCommentMap, onSelectComment]);

  // Handle editing a comment
  const handleEditComment = (comment: any) => {
    setEditingComment(comment);
    setEditCommentText(comment.content);
  };

  // Handle deleting a comment
  const handleDeleteComment = async (commentId: number) => {
    try {
      await deleteComment(commentId);
      console.log('Comment deleted successfully');
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Handle submitting the edited comment
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCommentText.trim() || !editingComment) return;

    setIsEditingComment(true);

    try {
      await editComment(editingComment.id, editCommentText.trim());
      setEditingComment(null);
      setEditCommentText('');
      console.log('Comment edited successfully');
    } catch (error) {
      console.error('Error editing comment:', error);
    } finally {
      setIsEditingComment(false);
    }
  };

  // Handle canceling the edit
  const handleEditCancel = () => {
    setEditingComment(null);
    setEditCommentText('');
  };

  useEffect(() => {
    console.log('Selected Comment ID in CommentsPanel:', selectedCommentId);
  }, [selectedCommentId]);

  useEffect(() => {
    console.log('Comments:', comments);
  }, [comments]);

  if (authLoading) {
    return <div className="fixed top-0 right-0 h-full bg-red-500 w-64 shadow-lg p-4">Loading comments...</div>;
  }

  // console.log('CommentsPanel rendered, comments:', comments);

  // Detect if we're in mobile view (full screen mode)
  const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  
  return (
    <div className={`${isMobileView ? 'absolute inset-0' : 'fixed top-0 right-0 h-full'} bg-white shadow-lg transform transition-transform duration-300 z-50 w-full sm:w-80 md:w-96 lg:w-80 ${show ? 'translate-x-0 overflow-y-auto' : 'translate-x-full pointer-events-none'}`}>
      {/* Header with close button */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 relative z-50">
        <h3 className="text-sm font-medium text-gray-900">Comments</h3>
        <button 
          onClick={(e) => {
            console.log('🔴 [CLOSE BUTTON] Click event triggered');
            console.log('🔴 [CLOSE BUTTON] Event target:', e.target);
            console.log('🔴 [CLOSE BUTTON] Current target:', e.currentTarget);
            console.log('🔴 [CLOSE BUTTON] Event type:', e.type);
            console.log('🔴 [CLOSE BUTTON] Button element:', e.currentTarget.outerHTML.substring(0, 200));
            
            try {
              e.preventDefault();
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              console.log('🔴 [CLOSE BUTTON] Event handlers called successfully');
            } catch (eventError) {
              console.error('🔴 [CLOSE BUTTON] Error in event handling:', eventError);
            }
            
            console.log('🔴 [CLOSE BUTTON] About to call onClose function');
            console.log('🔴 [CLOSE BUTTON] onClose type:', typeof onClose);
            console.log('🔴 [CLOSE BUTTON] Current show prop:', show);
            
            try {
              const result = onClose();
              console.log('🔴 [CLOSE BUTTON] onClose() returned:', result);
              console.log('🔴 [CLOSE BUTTON] onClose called successfully');
            } catch (onCloseError) {
              console.error('🔴 [CLOSE BUTTON] Error calling onClose:', onCloseError);
              console.error('🔴 [CLOSE BUTTON] Error stack:', onCloseError.stack);
            }
            
            // Add a delay to check if state changed
            setTimeout(() => {
              console.log('🔴 [CLOSE BUTTON] Show prop after 100ms:', show);
            }, 100);
          }}
          onMouseDown={(e) => {
            console.log('🔴 [CLOSE BUTTON] Mouse down event');
            e.preventDefault();
            e.stopPropagation();
            e.nativeEvent.stopImmediatePropagation();
          }}
          onMouseUp={(e) => {
            console.log('🔴 [CLOSE BUTTON] Mouse up event');
          }}
          className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors z-[60] relative"
          aria-label="Close comments"
          type="button"
          style={{ position: 'relative', zIndex: 60, pointerEvents: 'auto', cursor: 'pointer' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <form onSubmit={handleSubmit} className={!user || !token ? 'opacity-50 pointer-events-none' : ''}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="w-full p-2 border"
            placeholder="Write a comment..."
            disabled={!user || !token}
            onFocus={() => setIsCommentInputFocused(true)}
            onBlur={() => setIsCommentInputFocused(false)}
          />
          <button type="submit" className="bg-blue-500 text-white p-2 rounded" disabled={!user || !token}>
            Post
          </button>
        </form>
        {isPostingComment && <div className="p-2 border">Loading comment...</div>}
        {comments.length > 0 ? (
          comments.map((comment: any, index: number) => (
            <React.Fragment key={comment.id}>
                <CommentBlock
                  comment={comment}
                  onSelectComment={handleSelectComment}
                  isSelected={comment.id === selectedCommentId}
                  handleCommentClick={handleCommentClick}
                  onEditComment={handleEditComment}
                  onDeleteComment={handleDeleteComment}
                  ref={(el) => setCommentBlockRef(el, comment.id)}
                  index={index}
                />
            </React.Fragment>
          ))
        ) : (
          <p>No comments yet.</p>
        )}
      </div>

      {/* Edit Comment Modal */}
      {editingComment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-medium mb-4">Edit Comment</h3>
            <form onSubmit={handleEditSubmit}>
              <textarea
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                placeholder="Edit your comment..."
                className="w-full p-3 border border-gray-300 rounded-md mb-4 resize-none"
                rows={3}
                autoFocus
                disabled={isEditingComment}
              />
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleEditCancel}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={isEditingComment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!editCommentText.trim() || isEditingComment}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isEditingComment ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommentsPanel;