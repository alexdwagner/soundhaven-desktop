-- Migration: Allow duplicate tracks in playlists
-- This changes the playlist_tracks table to use an auto-incrementing ID as primary key
-- instead of a composite primary key, allowing the same track to be added multiple times

-- Create new table with the correct structure
CREATE TABLE IF NOT EXISTS playlist_tracks_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  track_id TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
  FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
);

-- Copy existing data from old table to new table
INSERT INTO playlist_tracks_new (track_id, playlist_id, "order", created_at)
SELECT track_id, playlist_id, "order", created_at FROM playlist_tracks;

-- Drop the old table
DROP TABLE playlist_tracks;

-- Rename the new table to the original name
ALTER TABLE playlist_tracks_new RENAME TO playlist_tracks;

-- Create index for performance (but not unique to allow duplicates)
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track_id ON playlist_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order ON playlist_tracks("order"); 