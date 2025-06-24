export interface CreateCommentDto {
  trackId: number;
  userId: number;
  content: string;
  time?: number; // For marker
  color?: string; // For marker
  replyToId?: number;
} 