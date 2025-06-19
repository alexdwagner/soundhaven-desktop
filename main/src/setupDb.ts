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
        FOREIGN KEY (user_id) REFERENCES users(id)
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
        FOREIGN KEY (artist_id) REFERENCES artists(id)
      )
    `);

    // Create tracks table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tracks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Create playlist_tracks table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        track_id INTEGER NOT NULL,
        playlist_id TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        PRIMARY KEY (track_id, playlist_id),
        FOREIGN KEY (track_id) REFERENCES tracks(id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id)
      )
    `);

    // Create track_access table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS track_access (
        user_id INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('READ', 'EDIT', 'DELETE')),
        PRIMARY KEY (user_id, track_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (track_id) REFERENCES tracks(id)
      )
    `);

    // Create playlist_access table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS playlist_access (
        user_id INTEGER NOT NULL,
        playlist_id TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('READ', 'EDIT', 'DELETE')),
        PRIMARY KEY (user_id, playlist_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (playlist_id) REFERENCES playlists(id)
      )
    `);

    // Create genres table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS genres (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      )
    `);

    // Create tracks_in_genres table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS tracks_in_genres (
        track_id INTEGER NOT NULL,
        genre_id INTEGER NOT NULL,
        PRIMARY KEY (track_id, genre_id),
        FOREIGN KEY (track_id) REFERENCES tracks(id),
        FOREIGN KEY (genre_id) REFERENCES genres(id)
      )
    `);

    // Create comments table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        track_id INTEGER,
        user_id INTEGER NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        reply_to_id INTEGER,
        FOREIGN KEY (track_id) REFERENCES tracks(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (reply_to_id) REFERENCES comments(id)
      )
    `);

    // Create markers table
    await dbAsync.run(`
      CREATE TABLE IF NOT EXISTS markers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wave_surfer_region_id TEXT NOT NULL,
        time REAL NOT NULL,
        duration REAL NOT NULL,
        comment_id INTEGER,
        track_id INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (comment_id) REFERENCES comments(id),
        FOREIGN KEY (track_id) REFERENCES tracks(id)
      )
    `);

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