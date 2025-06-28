import { Database } from 'sqlite3';
import * as path from 'path';
import { config } from './config';

// Database file path
const dbPath = path.isAbsolute(config.database.path)
  ? config.database.path
  : path.resolve(process.cwd(), config.database.path);

console.log('🗄️ [DB INIT] Config path:', config.database.path);
console.log('🗄️ [DB INIT] Process cwd:', process.cwd());
console.log('🗄️ [DB INIT] Resolved DB path:', dbPath);

// Create database connection
export const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('✅ SQLite database connected successfully');
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON', (err) => {
  if (err) {
    console.error('Error enabling foreign keys:', err);
  }
});

// Export a promise-based wrapper for easier use
export const dbAsync = {
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
