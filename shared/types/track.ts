export interface Track {
  id: string;
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
  // Unique ID for playlist track entries (when track is in a playlist)
  playlist_track_id?: number;
  // Optionally, add more fields as needed
} 