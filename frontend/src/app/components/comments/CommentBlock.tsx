import React, { forwardRef } from 'react';
import { _Comment } from '../../../../../shared/types';

interface CommentBlockProps {
  comment: _Comment; // Using Comment type directly
  isSelected: boolean;
  onSelectComment: (commentId: number, index: number) => void;
  handleCommentClick: (commentId: number) => void;
  index: number;
}

const CommentBlock = forwardRef<HTMLDivElement, CommentBlockProps>(({
  comment,
  onSelectComment,
  isSelected,
  handleCommentClick,
  index
}, ref) => {

  const formatDate = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!date || isNaN(date.getTime())) { // Check if date is valid
      return 'Invalid date'; // Return a placeholder or fallback value
    }
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };  

  // Format marker time if present
  const markerTime = comment.marker?.time;
  const formatMarkerTime = (timeInSeconds?: number): string => {
    return timeInSeconds !== undefined
      ? `${Math.floor(timeInSeconds / 60)}:${('0' + Math.floor(timeInSeconds % 60)).slice(-2)}`
      : '';
  };


  return (
    <div
      ref={ref}
      className={`border-b border-gray-200 py-4 ${isSelected ? 'bg-gray-100' : 'bg-white'} cursor-pointer`}
      onClick={() => handleCommentClick(comment.id)}
    >
      <div className="font-bold">{comment.userName}</div>
      {markerTime !== undefined && (
        <div className="text-xs text-gray-400">Time: {formatMarkerTime(markerTime)}</div>
      )}
      <p className="mt-1">{comment.content}</p>
      <div className="text-sm text-gray-500 mt-2">{formatDate(new Date(comment.createdAt))}</div>
    </div>
  );
});

CommentBlock.displayName = 'CommentBlock';

export default CommentBlock;
