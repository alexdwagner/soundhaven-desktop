export interface Marker {
  id: string | number;
  time: number;
  trackId: number;
  commentId: number;
  createdAt: string | Date;
  waveSurferRegionID: string;
  end?: number;
  data?: {
    userId?: number;
    commentContent?: string;
    isVisible?: boolean;
    customColor?: string;
    isDraggable?: boolean;
    isResizable?: boolean;
  };
  update?: (options: { color: string }) => void;
}

export interface Comment {
  id: number;
  userName: string;
  content: string;
  trackId: number;
  userId: number;
  createdAt: Date | string;
  marker?: Marker;
  replies?: Comment[];
  replyToId?: number;
  replyTo?: Comment;
} 