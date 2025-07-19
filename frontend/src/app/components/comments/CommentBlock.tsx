import React, { forwardRef, useState, useEffect, useRef } from 'react';
import { _Comment } from '../../../../../shared/types';
import { useAuth } from '@/app/contexts/AuthContext';

interface CommentBlockProps {
  comment: _Comment; // Using Comment type directly
  isSelected: boolean;
  onSelectComment: (commentId: number, index: number) => void;
  handleCommentClick: (commentId: number) => void;
  onEditComment?: (comment: _Comment) => void;
  onDeleteComment?: (commentId: number) => void;
  index: number;
}

const CommentBlock = forwardRef<HTMLDivElement, CommentBlockProps>(({
  comment,
  onSelectComment,
  isSelected,
  handleCommentClick,
  onEditComment,
  onDeleteComment,
  index
}, ref) => {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Check if current user is the creator of this comment
  const isOwner = user && comment.userId === user.id;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const formatDateTime = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (!date || isNaN(date.getTime())) { // Check if date is valid
      return 'Invalid date'; // Return a placeholder or fallback value
    }
    
    // Format date as MM/DD/YY
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const dateString = `${month}/${day}/${year}`;
    
    // Format time as HH:MM AM/PM
    const timeString = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    return `${dateString} ${timeString}`;
  };  

  // Format marker time if present
  const markerTime = comment.marker?.time;
  const formatMarkerTime = (timeInSeconds?: number): string => {
    return timeInSeconds !== undefined
      ? `${Math.floor(timeInSeconds / 60)}:${('0' + Math.floor(timeInSeconds % 60)).slice(-2)}`
      : '';
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    onEditComment?.(comment);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    if (confirm('Are you sure you want to delete this comment?')) {
      onDeleteComment?.(comment.id);
    }
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };


  return (
    <div
      ref={ref}
      className={`border-b border-gray-200 py-4 cursor-pointer transition-all duration-200 relative ${
        isSelected 
          ? 'bg-blue-50 border-blue-200 shadow-md border-l-4 border-l-blue-500' 
          : 'bg-white hover:bg-gray-50'
      }`}
      onClick={() => handleCommentClick(comment.id)}
    >
      {/* Three-dot menu for comment owner */}
      {isOwner && (
        <div ref={menuRef} className="absolute top-2 right-2">
          <button
            onClick={handleMenuClick}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
            aria-label="Comment options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          
          {/* Dropdown menu */}
          {showMenu && (
            <div className="absolute top-8 right-0 bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[120px]">
              <button
                onClick={handleEdit}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-md"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 rounded-b-md"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      <div className="font-bold">{comment.userName}</div>
      {markerTime !== undefined && (
        <div className="text-xs text-gray-400">Time: {formatMarkerTime(markerTime)}</div>
      )}
      <p className="mt-1">{comment.content}</p>
      <div className="text-sm text-gray-500 mt-2">{formatDateTime(comment.createdAt)}</div>
    </div>
  );
});

CommentBlock.displayName = 'CommentBlock';

export default CommentBlock;
