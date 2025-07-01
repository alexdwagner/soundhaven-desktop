import { promises as fs } from 'fs';
import * as path from 'path';
import { Database } from 'sqlite3';
import { promisify } from 'util';
import { MetadataService } from '../src/services/metadataService';

// Setup database
const dbPath = path.join(process.cwd(), 'db.sqlite');
console.log('Database path:', dbPath);

const db = new Database(dbPath);
const dbAsync = {
  get: promisify(db.get.bind(db)),
  all: promisify(db.all.bind(db)),
  run: promisify(db.run.bind(db))
};

interface Track {
  id: string;
  name: string;
  file_path: string;
  duration: number;
  bitrate: number | null;
  sample_rate: number | null;
  channels: number | null;
  year: number | null;
  genre: string | null;
  track_number: number | null;
}

async function backfillMetadata() {
  console.log('🎵 [BACKFILL] Starting metadata backfill process...');
  
  try {
    // Get all tracks from database
    const tracks = await dbAsync.all('SELECT * FROM tracks') as Track[];
    console.log(`🎵 [BACKFILL] Found ${tracks.length} tracks to process`);
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    for (const track of tracks) {
      processed++;
      console.log(`\n🎵 [BACKFILL] Processing ${processed}/${tracks.length}: ${track.name}`);
      console.log(`🎵 [BACKFILL] File path: ${track.file_path}`);
      
      try {
        // Check if track already has metadata
        if (track.bitrate !== null || track.duration > 0) {
          console.log(`🎵 [BACKFILL] Track already has metadata, skipping...`);
          continue;
        }
        
        // Construct full file path
        const fullPath = path.join(process.cwd(), track.file_path.replace(/^\/uploads\//, 'uploads/'));
        console.log(`🎵 [BACKFILL] Full file path: ${fullPath}`);
        
        // Check if file exists
        try {
          await fs.access(fullPath);
        } catch (error) {
          console.log(`❌ [BACKFILL] File not found: ${fullPath}`);
          errors++;
          continue;
        }
        
        // Extract metadata from file
        console.log(`🎵 [BACKFILL] Extracting metadata...`);
        const metadata = await MetadataService.extractFromFile(fullPath);
        console.log(`🎵 [BACKFILL] Extracted metadata:`, metadata);
        
        // Update database with extracted metadata
        await dbAsync.run(`
          UPDATE tracks 
          SET 
            name = ?,
            duration = ?,
            bitrate = ?,
            sample_rate = ?,
            channels = ?,
            year = ?,
            genre = ?,
            track_number = ?,
            updated_at = ?
          WHERE id = ?
        `, [
          metadata.title,
          metadata.duration,
          metadata.bitrate,
          metadata.sampleRate,
          metadata.channels,
          metadata.year,
          metadata.genre,
          metadata.trackNumber,
          Math.floor(Date.now() / 1000),
          track.id
        ]);
        
        console.log(`✅ [BACKFILL] Updated track ${track.name} with metadata`);
        updated++;
        
        // Process artists and albums if available
        if (metadata.artist) {
          console.log(`🎵 [BACKFILL] Processing artist: ${metadata.artist}`);
          
          // Find or create artist
          let artist = await dbAsync.get('SELECT id FROM artists WHERE name = ?', [metadata.artist]);
          
          if (!artist) {
            const result = await dbAsync.run(
              'INSERT INTO artists (name, created_at, updated_at) VALUES (?, ?, ?)',
              [metadata.artist, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)]
            );
            artist = { id: (result as any).lastID };
            console.log(`✅ [BACKFILL] Created new artist: ${metadata.artist} (ID: ${artist.id})`);
          } else {
            console.log(`✅ [BACKFILL] Found existing artist: ${metadata.artist} (ID: ${artist.id})`);
          }
          
          // Process album if available
          let albumId = null;
          if (metadata.album) {
            console.log(`🎵 [BACKFILL] Processing album: ${metadata.album}`);
            
            let album = await dbAsync.get(
              'SELECT id FROM albums WHERE name = ? AND artist_id = ?',
              [metadata.album, artist.id]
            );
            
            if (!album) {
              const result = await dbAsync.run(
                'INSERT INTO albums (name, release_date, artist_id) VALUES (?, ?, ?)',
                [metadata.album, metadata.year || Math.floor(Date.now() / 1000), artist.id]
              );
              album = { id: (result as any).lastID };
              console.log(`✅ [BACKFILL] Created new album: ${metadata.album} (ID: ${album.id})`);
            } else {
              console.log(`✅ [BACKFILL] Found existing album: ${metadata.album} (ID: ${album.id})`);
            }
            
            albumId = album.id;
          }
          
          // Update track with artist and album IDs
          await dbAsync.run(
            'UPDATE tracks SET artist_id = ?, album_id = ? WHERE id = ?',
            [artist.id, albumId, track.id]
          );
          
          console.log(`✅ [BACKFILL] Updated track with artist_id: ${artist.id}, album_id: ${albumId}`);
        }
        
      } catch (error) {
        console.error(`❌ [BACKFILL] Error processing track ${track.name}:`, error);
        errors++;
      }
    }
    
    console.log(`\n🎉 [BACKFILL] Metadata backfill completed!`);
    console.log(`📊 [BACKFILL] Summary:`);
    console.log(`   - Processed: ${processed} tracks`);
    console.log(`   - Updated: ${updated} tracks`);
    console.log(`   - Errors: ${errors} tracks`);
    
  } catch (error) {
    console.error('❌ [BACKFILL] Fatal error:', error);
  } finally {
    db.close();
  }
}

// Run the backfill
backfillMetadata().catch(console.error); 