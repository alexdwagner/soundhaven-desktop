export interface Track {
  id: number;
  name: string;
  duration: number;
  artistId?: number | null;
  albumId?: number | null;
  userId: number;
  filePath: string;
  createdAt: Date | number | string;
  updatedAt: Date | number | string;
  // Optionally, add more fields as needed
} 