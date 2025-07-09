import { Database } from 'sqlite3';
import { AsyncDatabase } from './types';

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

// Initialize the database
const db = new Database('main/db.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
}); 