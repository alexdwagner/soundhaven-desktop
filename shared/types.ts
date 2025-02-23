export interface ElectronAPI {
    send: (channel: string, data: any) => void;
    receive: (channel: string, callback: (data: any) => void) => void;
    test: () => string;
  }
  
  // src/types.ts - old, from webapp

export interface User {
    id: number;
    email: string;
    name?: string;
    createdAt: string;
    updatedAt: string;
    playlists: Playlist[];
    followedArtists: Artist[];
    refreshTokens: RefreshToken[];
  }
  
  export interface RefreshToken {
    id: number;
    token: string;
    userId: number;
    user: User;
    expiresIn: string;
  }
  
  export interface Artist {
    id: number;
    name: string;
    bio?: string;
    createdAt: string;
    updatedAt: string;
    albums: Album[];
    followers: User[];
  }
  
  export interface Album {
    id: number;
    name: string;
    releaseDate: string;
    artistId: number;
    artist: Artist;
    tracks: Track[];
  }
  
  export interface Track {
    id: number;
    name: string;
    duration: number;
    artistId?: number;
    artist?: Artist;
    albumId?: number;
    album?: Album;
    createdAt: string;
    updatedAt: string;
    playlists: Playlist[];
    genres: Genre[];
    filePath: string;
  }
  
  export interface Playlist {
    id: number;
    name: string;
    description?: string;
    userId: number;
    user: User;
    tracks?: Track[];
    TracksInPlaylist?: { track: Track }[];
  }
  
  export interface PlaylistItem {
    id: number;
    trackId: number;
    playlistId: number;
    track: Track;
    playlist: Playlist;
    position: number;
  }
  
  export interface Genre {
    id: number;
    name: string;
    tracks: Track[];
  }
  
  export interface TracksInPlaylist {
    track: Track;
    trackId: number;
    playlist: Playlist;
    playlistId: number;
  }
  
  export interface TracksInGenre {
    track: Track;
    trackId: number;
    genre: Genre;
    genreId: number;
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
    id: number;
    userName: string;
    content: string;
    trackId: number;
    userId: number;
    createdAt: Date;
    marker?: Marker; // marker is optional and should be of type Marker
    replies?: Comment[]; // Optional array of reply comments
    replyToId?: number; // Optional ID of the comment being replied to
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
    id: string | number; // Align with backend type but allow string for frontend unique identification
    time: number; // Time in seconds, aligns with the backend model
    commentId: number; // ID of the associated comment
    trackId: number; // ID of the associated track
    createdAt: string | Date; // Align with backend type, allowing string for potential JSON parsing
    waveSurferRegionID: string; // ID of the associated WaveSurfer.js region 
  
    // Additional properties for frontend functionality
    end?: number; // Optional, might not be needed if markers are single points in time
    data?: {
      userId?: number;
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
    userId: number; // Custom property for user ID
    sub?: string;   // Subject - standard JWT property, often used for user ID
    exp?: number;   // Expiration time
    iat?: number;   // Issued at time
  }
  
  