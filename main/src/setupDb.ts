import { dbAsync } from './db';

async function setupDatabase() {
  try {
    // Enable foreign keys
    await dbAsync.run('PRAGMA foreign_keys = ON');

    console.log('About to create users table...');
    // Create users table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);
    console.log('Users table created (or already exists).');

    // Create refresh_tokens table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        expires_in INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create artists table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS artists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        bio TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create albums table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        release_date INTEGER NOT NULL,
        artist_id INTEGER NOT NULL,
        album_art_path TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE
      )
    `);

    // Create tracks table - UPDATED to use TEXT PRIMARY KEY for UUID support
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        duration INTEGER NOT NULL,
        artist_id INTEGER,
        album_id INTEGER,
        user_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        bitrate INTEGER,
        sample_rate INTEGER,
        channels INTEGER,
        year INTEGER,
        genre TEXT,
        track_number INTEGER,
        album_art_path TEXT,
        waveform_data TEXT,
        preprocessed_chunks TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE SET NULL,
        FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create playlists table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        user_id INTEGER NOT NULL,
        "order" INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create playlist_tracks table - UPDATED to allow duplicate tracks with auto-incrementing ID
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        track_id TEXT NOT NULL,
        playlist_id TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      )
    `);

    // Create track_access table - UPDATED to use TEXT for track_id and CASCADE DELETE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS track_access (
        user_id INTEGER NOT NULL,
        track_id TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('read', 'EDIT', 'DELETE')),
        PRIMARY KEY (user_id, track_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )
    `);

    // Create playlist_access table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS playlist_access (
        user_id INTEGER NOT NULL,
        playlist_id TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('read', 'EDIT', 'DELETE')),
        PRIMARY KEY (user_id, playlist_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      )
    `);

    // Create genres table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS genres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Create tracks_in_genres table - UPDATED to use TEXT for track_id and CASCADE DELETE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tracks_in_genres (
        track_id TEXT NOT NULL,
        genre_id INTEGER NOT NULL,
        PRIMARY KEY (track_id, genre_id),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY (genre_id) REFERENCES genres(id) ON DELETE CASCADE
      )
    `);

    // Create tags table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT,
        type TEXT NOT NULL CHECK (type IN ('manual', 'auto', 'system')),
        confidence REAL,
        created_at INTEGER DEFAULT (unixepoch())
      )
    `);

    // Create track_tags table for many-to-many relationship
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS track_tags (
        track_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        PRIMARY KEY (track_id, tag_id),
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // Create comments table - UPDATED to use TEXT for track_id and CASCADE DELETE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        track_id TEXT,
        user_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        reply_to_id TEXT,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reply_to_id) REFERENCES comments(id) ON DELETE SET NULL
      )
    `);

    // Create markers table - UPDATED to use TEXT for track_id and CASCADE DELETE
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS markers (
        id TEXT PRIMARY KEY,
        wave_surfer_region_id TEXT NOT NULL,
        time REAL NOT NULL,
        duration REAL NOT NULL,
        comment_id TEXT,
        track_id TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (track_id) REFERENCES tracks(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_tracks_updated_at ON tracks(updated_at)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_tracks_artist_id ON tracks(artist_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_tracks_album_id ON tracks(album_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_playlist_tracks_order ON playlist_tracks("order")`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_comments_track_id ON comments(track_id)`);
    await dbAsync.run(`CREATE INDEX IF NOT EXISTS idx_comments_timestamp ON comments(timestamp)`);

    console.log('✅ Database tables created successfully!');
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  }
}

export { setupDatabase };

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => {
      console.log('✅ Database setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database setup failed:', error);
      process.exit(1);
    });
} 