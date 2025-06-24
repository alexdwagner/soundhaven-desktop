const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

// Connect to the database
const dbPath = path.join(process.cwd(), 'db.sqlite');
const db = new sqlite3.Database(dbPath);

// Helper function to hash password using bcrypt
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Helper function to run SQL with promises
function runSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper function to get data with promises
function getSQL(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');

    // Check if test user already exists
    let existingUser = await getSQL('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    
    if (!existingUser) {
      console.log('Creating test user...');
      const hashedPassword = await hashPassword('testpassword');
      const now = Math.floor(Date.now() / 1000);
      
      await runSQL(
        'INSERT INTO users (name, email, password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['Test User', 'test@example.com', hashedPassword, now, now]
      );
      console.log('Test user created successfully');
      // Fetch the user again to get the id
      existingUser = await getSQL('SELECT * FROM users WHERE email = ?', ['test@example.com']);
    } else {
      console.log('Test user already exists');
    }

    // Check if test track already exists
    const existingTrack = await getSQL('SELECT * FROM tracks WHERE name = ?', ['Careless Whisper']);
    
    if (!existingTrack) {
      console.log('Creating test track...');
      const now = Math.floor(Date.now() / 1000);
      
      // Use a URL path for the audio file
      const audioUrl = '/audio/careless-whisper.mp3';
      
      await runSQL(
        'INSERT INTO tracks (name, duration, file_path, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        ['Careless Whisper', 300, audioUrl, existingUser.id, now, now]
      );
      console.log('Test track created successfully');
    } else {
      console.log('Test track already exists');
    }

    // Seed a few test comments for the test track and user
    if (existingUser && existingTrack) {
      const now = Math.floor(Date.now() / 1000);
      const commentsToSeed = [
        'This is a seeded comment 1.',
        'Another seeded comment for testing.',
        'Third test comment!'
      ];
      for (const content of commentsToSeed) {
        // Check if comment already exists to avoid duplicates
        const existingComment = await getSQL('SELECT * FROM comments WHERE content = ? AND track_id = ? AND user_id = ?', [content, existingTrack.id, existingUser.id]);
        if (!existingComment) {
          await runSQL(
            'INSERT INTO comments (content, track_id, user_id, created_at) VALUES (?, ?, ?, ?)',
            [content, existingTrack.id, existingUser.id, now]
          );
          console.log(`Seeded comment: "${content}"`);
        } else {
          console.log(`Comment already exists: "${content}"`);
        }
      }
    } else {
      console.log('Cannot seed comments: test user or test track not found.');
    }

    // Verify the data
    const users = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM users', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const tracks = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM tracks', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('Database seeding completed!');
    console.log('Users:', users.length);
    console.log('Tracks:', tracks.length);
    console.log('Track data:', tracks);

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    db.close();
  }
}

seedDatabase(); 