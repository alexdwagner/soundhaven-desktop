import { Database } from 'sqlite3';
import * as path from 'path';

// Create a direct database connection to the dist directory
const dbPath = path.join(__dirname, '..', 'dist', 'db.sqlite');
const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ SQLite database connected successfully');
  }
});

// Promise-based wrapper
const dbAsync = {
  run: (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  },

  get: (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

async function seedTestTrack() {
  try {
    // First, get the test user ID
    const testUser = await dbAsync.get(
      'SELECT * FROM users WHERE email = ?',
      ['test@example.com']
    );

    if (!testUser) {
      console.log('Test user not found. Please run seed:test-user first.');
      return;
    }

    // Check if test track already exists
    const existingTrack = await dbAsync.get(
      'SELECT * FROM tracks WHERE name = ?',
      ['Careless Whisper']
    );

    if (existingTrack) {
      console.log('Test track already exists');
      return;
    }

    // Create a test track using the careless whisper file
    // Store a URL path that the frontend can use to access the file
    const testTrackPath = '/audio/careless_whisper.mp3';
    
    await dbAsync.run(
      'INSERT INTO tracks (name, duration, user_id, file_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      ['Careless Whisper', 300, testUser.id, testTrackPath, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
    );

    console.log('Test track "Careless Whisper" created successfully');
    console.log('File path:', testTrackPath);
  } catch (error) {
    console.error('Error seeding test track:', error);
  } finally {
    db.close();
    process.exit(0);
  }
}

seedTestTrack(); 