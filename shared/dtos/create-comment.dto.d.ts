export interface CreateCommentDto {
    trackId: number;
    userId: number;
    content: string;
    time?: number;
    color?: string;
    replyToId?: number;
}
