import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Define the database file path
const dbPath = path.join(__dirname, "../soundhaven.db");

// Ensure the database directory exists
if (!fs.existsSync(dbPath)) {
  console.log("⚠️ Database file does not exist, creating one...");
}

// Initialize SQLite connection
const sqlite = new Database(dbPath, { verbose: console.log });

// Create a Drizzle ORM instance
export const db = drizzle(sqlite);

console.log("✅ SQLite Database Connected! File path:", dbPath);
