export interface ElectronAPI {
    send: (channel: string, data: any) => void;
    receive: (channel: string, callback: (data: any) => void) => void;
    test: () => string;
  }
  
  // src/types.ts - old, from webapp

export interface User {
    id: string;
    email: string;
    name?: string;
    createdAt: string;
    updatedAt: string;
    playlists: Playlist[];
    followedArtists: Artist[];
    refreshTokens: RefreshToken[];
  }
  
  export interface RefreshToken {
    id: string;
    token: string;
    userId: string;
    user: User;
    expiresIn: string;
  }
  
  export interface Artist {
    id: string;
    name: string;
    bio?: string;
    createdAt: string;
    updatedAt: string;
    albums: Album[];
    followers: User[];
  }
  
  export interface Album {
    id: string;
    name: string;
    releaseDate: string;
    artistId: string;
    artist: Artist;
    tracks: Track[];
  }
  
  export interface Track {
    id: string;
    name: string;
    duration: number;
    artistId?: string | number | null;
    artistName?: string | null;
    artist?: Artist;
    albumId?: string | number | null;
    albumName?: string | null;
    album?: Album;
    userId?: number;
    createdAt: string | number;
    updatedAt: string | number;
    playlists?: Playlist[];
    genres?: Genre[];
    filePath: string;
    // Audio metadata
    bitrate?: number | null;
    sampleRate?: number | null;
    channels?: number | null;
    year?: number | null;
    genre?: string | null;
    trackNumber?: number | null;
    // Unique ID for playlist track entries (when track is in a playlist)
    playlist_track_id?: number;
  }
  
  export interface Playlist {
    id: string;
    name: string;
    description?: string;
    userId: string;
    user: User;
    tracks?: Track[];
    TracksInPlaylist?: { track: Track }[];
  }
  
  export interface PlaylistItem {
    id: string;
    trackId: string;
    playlistId: string;
    track: Track;
    playlist: Playlist;
    position: number;
  }
  
  export interface Genre {
    id: string;
    name: string;
    tracks: Track[];
  }
  
  export interface TracksInPlaylist {
    track: Track;
    trackId: string;
    playlist: Playlist;
    playlistId: string;
  }
  
  export interface TracksInGenre {
    track: Track;
    trackId: string;
    genre: Genre;
    genreId: string;
  }
  
  export interface AudioControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    onSkipForward: () => void;
    onSkipBackward: () => void;
    onPlayNext: () => void;
    onPlayPrevious: () => void;
    onPlaybackSpeedChange: (speed: number) => void;
    onToggleFavorite: () => void;
    onVolumeChange: (volume: number) => void;
    isFavorite: boolean;
    playbackSpeed: number;
    volume: number;
    modalOpen: boolean;
  }
  
  export type TrackUpdatePayload = {
    [P in keyof Track]?: string;
  };
  
  export type _Comment = {
    id: string;
    userName: string;
    content: string;
    trackId: string;
    userId: string;
    createdAt: Date;
    marker?: Marker; // marker is optional and should be of type Marker
    replies?: Comment[]; // Optional array of reply comments
    replyToId?: string; // Optional ID of the comment being replied to
    replyTo?: Comment; // Optional Comment being replied to
  };
  
  // export interface CommentsContextType {
  //   newCommentInput: string;
  //   setNewCommentInput: React.Dispatch<React.SetStateAction<string>>;
  //   comments: _Comment[];
  //   setComments: React.Dispatch<React.SetStateAction<_Comment[]>>;
  //   fetchComments: (trackId: number, page?: number, limit?: number) => Promise<void>; 
  //   fetchCommentsAndMarkers: (trackId: number, page?: number, limit?: number) => Promise<void>;
  //   addComment: (trackId: number, userId: number, content: string, token: string) => Promise<void>;
  //   addMarkerAndComment: (trackId: number, content: string, time: number, waveSurferRegionID: string, token: string) => Promise<void>;
  //   editComment: (commentId: number, content: string) => Promise<void>;
  //   deleteComment: (commentId: number) => Promise<void>;
  //   markers: Marker[];
  //   setMarkers: (newMarkers: Marker[]) => void;
  //   selectedCommentId: number | null;
  //   setSelectedCommentId: React.Dispatch<React.SetStateAction<number | null>>;
  //   selectedRegionId: string | null;
  //   setSelectedRegionId: React.Dispatch<React.SetStateAction<string | null>>;
  //   regionCommentMap: Record<string, number>;
  //   setRegionCommentMap: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  //   handleSelectComment: (commentId: number) => void; 
  // }
  
  export interface Marker {
    id: string; // Use string for UUID consistency
    time: number; // Time in seconds, aligns with the backend model
    commentId: string; // ID of the associated comment
    trackId: string; // ID of the associated track
    createdAt: string | Date; // Align with backend type, allowing string for potential JSON parsing
    waveSurferRegionID: string; // ID of the associated WaveSurfer.js region 
  
    // Additional properties for frontend functionality
    end?: number; // Optional, might not be needed if markers are single points in time
    data?: {
      userId?: string;
      commentContent?: string;
      isVisible?: boolean;
      customColor?: string;
      isDraggable?: boolean;
      isResizable?: boolean;
      // Add other custom data as needed for your frontend logic
    };
    update?: (options: { color: string }) => void; // Optional, for WaveSurfer.js functionality
  }
  
  export type ErrorResponse = {
    message: string;
    errors?: { [key: string]: string[] };
  };
  
  export interface ApiError<T = unknown> extends Error {
    response?: {
      status?: number;
      statusText?: string;
      json?: () => Promise<T>;
    };
  }
  
  export interface DecodedToken {
    userId: string; // Custom property for user ID
    sub?: string;   // Subject - standard JWT property, often used for user ID
    exp?: number;   // Expiration time
    iat?: number;   // Issued at time
  }
  
  