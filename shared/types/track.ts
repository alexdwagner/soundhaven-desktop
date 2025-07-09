export interface Track {
  id: number;
  name: string;
  duration: number;
  artistId?: number | null;
  artistName?: string;
  artist?: { name: string };
  albumId?: number | null;
  albumName?: string;
  album?: { name: string };
  albumArtPath?: string;
  userId: number;
  filePath: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  year?: number;
  genre?: string;
  trackNumber?: number;
  createdAt: Date | number | string;
  updatedAt: Date | number | string;
  // Optionally, add more fields as needed
} 