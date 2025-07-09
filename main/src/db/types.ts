import { Database } from 'sqlite3';

export interface AsyncDatabase {
  all<T>(sql: string, ...params: any[]): Promise<T>;
  get<T>(sql: string, ...params: any[]): Promise<T>;
  run(sql: string, ...params: any[]): Promise<void>;
  exec(sql: string): Promise<void>;
} 