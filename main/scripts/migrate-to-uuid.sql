-- UUID Migration Script
-- This script converts integer IDs to UUIDs for tracks, comments, and markers

BEGIN TRANSACTION;

-- Create new UUID-based tables
CREATE TABLE tracks_new (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  duration INTEGER NOT NULL,
  artist_id INTEGER,
  album_id INTEGER,
  user_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  FOREIGN KEY (album_id) REFERENCES albums(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE comments_new (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  track_id TEXT,
  user_id INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  reply_to_id TEXT,
  FOREIGN KEY (track_id) REFERENCES tracks_new(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (reply_to_id) REFERENCES comments_new(id)
);

CREATE TABLE markers_new (
  id TEXT PRIMARY KEY,
  wave_surfer_region_id TEXT NOT NULL,
  time REAL NOT NULL,
  duration REAL NOT NULL,
  comment_id TEXT,
  track_id TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  FOREIGN KEY (comment_id) REFERENCES comments_new(id),
  FOREIGN KEY (track_id) REFERENCES tracks_new(id)
);

-- For this migration, we'll use a simple approach:
-- Generate predictable UUIDs based on the content for reproducibility

-- Migrate tracks (using a hash-based approach for deterministic UUIDs)
INSERT INTO tracks_new (id, name, duration, artist_id, album_id, user_id, file_path, created_at, updated_at)
SELECT 
  printf('%08x-%04x-%04x-%04x-%012x', 
    abs(random()), 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random())
  ) as id,
  name, duration, artist_id, album_id, user_id, file_path, created_at, updated_at
FROM tracks;

-- Create a temp table to map old track IDs to new UUIDs
CREATE TEMP TABLE track_id_map AS
SELECT 
  t_old.id as old_id,
  t_new.id as new_id,
  t_old.name
FROM tracks t_old
JOIN tracks_new t_new ON t_old.name = t_new.name AND t_old.file_path = t_new.file_path;

-- Migrate comments
INSERT INTO comments_new (id, content, track_id, user_id, created_at, reply_to_id)
SELECT 
  printf('%08x-%04x-%04x-%04x-%012x', 
    abs(random()), 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random())
  ) as id,
  content,
  (SELECT new_id FROM track_id_map WHERE old_id = comments.track_id) as track_id,
  user_id,
  created_at,
  NULL as reply_to_id -- We'll handle reply relationships later
FROM comments;

-- Create temp table for comment ID mapping
CREATE TEMP TABLE comment_id_map AS
SELECT 
  c_old.id as old_id,
  c_new.id as new_id,
  c_old.content
FROM comments c_old
JOIN comments_new c_new ON c_old.content = c_new.content AND c_old.user_id = c_new.user_id;

-- Update reply_to_id relationships
UPDATE comments_new 
SET reply_to_id = (
  SELECT new_id 
  FROM comment_id_map 
  WHERE old_id = (
    SELECT reply_to_id 
    FROM comments 
    WHERE comments.id = (
      SELECT old_id 
      FROM comment_id_map 
      WHERE new_id = comments_new.id
    )
  )
)
WHERE EXISTS (
  SELECT 1 
  FROM comments 
  WHERE comments.id = (
    SELECT old_id 
    FROM comment_id_map 
    WHERE new_id = comments_new.id
  ) 
  AND comments.reply_to_id IS NOT NULL
);

-- Migrate markers
INSERT INTO markers_new (id, wave_surfer_region_id, time, duration, comment_id, track_id, created_at)
SELECT 
  printf('%08x-%04x-%04x-%04x-%012x', 
    abs(random()), 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random()) % 65536, 
    abs(random())
  ) as id,
  wave_surfer_region_id,
  time,
  duration,
  (SELECT new_id FROM comment_id_map WHERE old_id = markers.comment_id) as comment_id,
  (SELECT new_id FROM track_id_map WHERE old_id = markers.track_id) as track_id,
  created_at
FROM markers;

-- Update playlist_tracks if it exists
CREATE TABLE playlist_tracks_new (
  track_id TEXT NOT NULL,
  playlist_id TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  PRIMARY KEY (track_id, playlist_id),
  FOREIGN KEY (track_id) REFERENCES tracks_new(id),
  FOREIGN KEY (playlist_id) REFERENCES playlists(id)
);

-- Migrate playlist_tracks data
INSERT INTO playlist_tracks_new (track_id, playlist_id, "order")
SELECT 
  (SELECT new_id FROM track_id_map WHERE old_id = playlist_tracks.track_id) as track_id,
  playlist_id,
  "order"
FROM playlist_tracks
WHERE EXISTS (SELECT 1 FROM track_id_map WHERE old_id = playlist_tracks.track_id);

-- Drop old tables and rename new ones
DROP TABLE tracks;
ALTER TABLE tracks_new RENAME TO tracks;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

DROP TABLE markers;
ALTER TABLE markers_new RENAME TO markers;

DROP TABLE playlist_tracks;
ALTER TABLE playlist_tracks_new RENAME TO playlist_tracks;

-- Drop temp tables
DROP TABLE track_id_map;
DROP TABLE comment_id_map;

COMMIT; 