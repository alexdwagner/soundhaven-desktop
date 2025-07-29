import React, { createContext } from 'react';
import { _Comment, Marker } from '../../../../shared/types';

// Define the context type interface
export interface CommentsContextType {
  comments: _Comment[];
  setComments: (comments: _Comment[] | ((prev: _Comment[]) => _Comment[])) => void;
  markers: Marker[];
  setMarkers: (markers: Marker[] | ((prev: Marker[]) => Marker[])) => void;
  fetchComments: (trackId: number, page?: number, limit?: number) => Promise<_Comment[]>;
  fetchCommentsAndMarkers: (trackId: number, page?: number, limit?: number) => Promise<void>;
  addComment: (trackId: number, userId: number, content: string, token: string) => Promise<void>;
  addMarkerAndComment: (trackId: number, content: string, time: number, color?: string) => Promise<_Comment>;
  editComment: (commentId: number, content: string) => Promise<_Comment>;
  deleteComment: (commentId: number) => Promise<boolean>;
  selectedCommentId: number | null;
  setSelectedCommentId: (id: number | null) => void;
  selectedRegionId: string | null;
  setSelectedRegionId: (id: string | null) => void;
  regionCommentMap: Record<string, number>;
  setRegionCommentMap: (map: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
  isLoadingComments: boolean;
  commentsError: string | null;
}

// Initialize the context with proper typing
const CommentsContext = createContext<CommentsContextType | undefined>(undefined);

export default CommentsContext;