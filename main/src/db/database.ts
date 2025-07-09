import { Database } from 'sqlite3';
import { AsyncDatabase } from './types';
import path from 'path';

// Create an async wrapper around the sqlite3 database
export const dbAsync: AsyncDatabase = {
  all: <T>(sql: string, ...params: any[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err: Error | null, rows: T) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  get: <T>(sql: string, ...params: any[]): Promise<T> => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  run: (sql: string, ...params: any[]): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },

  exec: (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      db.exec(sql, (err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
};

// Get the correct database path
const getDatabasePath = () => {
  // Check if we're in the main directory
  if (process.cwd().endsWith('/main')) {
    return 'db.sqlite';
  }
  // Check if we're in the project root
  if (require('fs').existsSync(path.join(process.cwd(), 'main/db.sqlite'))) {
    return 'main/db.sqlite';
  }
  // Default fallback
  return path.join(__dirname, '../../db.sqlite');
};

// Initialize the database
const dbPath = getDatabasePath();
console.log(`📁 Database path: ${dbPath}`);
const db = new Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
}); 