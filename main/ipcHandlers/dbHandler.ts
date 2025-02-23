import { ipcMain } from "electron";
import { db } from "../src/db"; // ✅ Points to the correct file
import { users, tracks, playlists } from "../src/schema"; // ✅ Adjusted
import { eq } from "drizzle-orm";

// Handle getting all tracks
ipcMain.handle("get-tracks", async () => {
  return db.select().from(tracks).all();
});

// Handle adding a new track
ipcMain.handle("add-track", async (_, trackData) => {
  return db.insert(tracks).values(trackData).run();
});

// Handle fetching all playlists
ipcMain.handle("get-playlists", async () => {
  return db.select().from(playlists).all();
});

// Handle user authentication (placeholder)
ipcMain.handle("get-user", async (_, email) => {
  return db.select().from(users).where(eq(users.email, email)).get();
});
