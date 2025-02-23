import { sqliteTable, text, integer, uniqueIndex, primaryKey, real } from "drizzle-orm/sqlite-core";


// 🎵 Users Table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  createdAt: integer("created_at").default(Date.now()),
  updatedAt: integer("updated_at").default(Date.now()),
});

// 🔑 Refresh Tokens Table
export const refreshTokens = sqliteTable("refresh_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").unique().notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  expiresIn: integer("expires_in").notNull(),
});

// 🎤 Artists Table
export const artists = sqliteTable("artists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  bio: text("bio"),
  createdAt: integer("created_at").default(Date.now()),
  updatedAt: integer("updated_at").default(Date.now()),
});

// 📀 Albums Table
export const albums = sqliteTable("albums", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  releaseDate: integer("release_date").notNull(),
  artistId: integer("artist_id").notNull().references(() => artists.id),
});

// 🎵 Tracks Table
export const tracks = sqliteTable("tracks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  duration: integer("duration").notNull(), // Duration in seconds
  artistId: integer("artist_id").references(() => artists.id),
  albumId: integer("album_id").references(() => albums.id),
  userId: integer("user_id").notNull().references(() => users.id),
  filePath: text("file_path").notNull(),
  createdAt: integer("created_at").default(Date.now()),
  updatedAt: integer("updated_at").default(Date.now()),
});

// 📂 Playlists Table
export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(), // Using UUID for Playlists
  name: text("name").notNull(),
  description: text("description"),
  userId: integer("user_id").notNull().references(() => users.id),
  order: integer("order").default(0),
});

// 🔗 Playlist-Tracks Many-to-Many Relationship
export const playlistTracks = sqliteTable(
  "playlist_tracks",
  {
    trackId: integer("track_id").notNull().references(() => tracks.id),
    playlistId: text("playlist_id").notNull().references(() => playlists.id),
    order: integer("order").default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.trackId, table.playlistId] }),
  })
);

// 🔗 Track Access Permissions
export const trackAccess = sqliteTable(
  "track_access",
  {
    userId: integer("user_id").notNull().references(() => users.id),
    trackId: integer("track_id").notNull().references(() => tracks.id),
    permission: text("permission", { enum: ["READ", "EDIT", "DELETE"] }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.trackId] }),
  })
);

// 🔗 Playlist Access Permissions
export const playlistAccess = sqliteTable(
  "playlist_access",
  {
    userId: integer("user_id").notNull().references(() => users.id),
    playlistId: text("playlist_id").notNull().references(() => playlists.id),
    permission: text("permission", { enum: ["READ", "EDIT", "DELETE"] }).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.playlistId] }),
  })
);

// 🎶 Genres Table
export const genres = sqliteTable("genres", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").unique().notNull(),
});

// 🔗 Tracks-Genres Many-to-Many Relationship
export const tracksInGenres = sqliteTable(
  "tracks_in_genres",
  {
    trackId: integer("track_id").notNull().references(() => tracks.id),
    genreId: integer("genre_id").notNull().references(() => genres.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.trackId, table.genreId] }),
  })
);

// 📝 Comments Table
export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  trackId: integer("track_id").references(() => tracks.id),
  userId: integer("user_id").notNull().references(() => users.id),
  createdAt: integer("created_at").default(Date.now()),
  replyToId: integer("reply_to_id").references((): any => comments.id), // Explicit return type
});

// 🔖 Markers Table (For Time-Stamps in Audio)
export const markers = sqliteTable("markers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  waveSurferRegionID: text("wave_surfer_region_id").notNull(),
  time: real("time").notNull(), // Time in seconds
  duration: real("duration").notNull(),
  commentId: integer("comment_id").references(() => comments.id),
  trackId: integer("track_id").references(() => tracks.id),
  createdAt: integer("created_at").default(Date.now()),
});
