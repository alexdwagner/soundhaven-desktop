import path from 'path';
import { PreprocessService } from '../services/preprocessService';
import { dbAsync } from '../db/database';
import { AsyncDatabase } from '../db/types';

interface Track {
  id: string;
  file_path: string;
  name: string;
  waveform_data: string | null;
  preprocessed_chunks: string | null;
}

interface DbResult {
  total: number;
  processed: number;
  unprocessed: number;
}

export class PreprocessMigration {
  private preprocessService: PreprocessService;
  private uploadsDir: string;

  constructor() {
    this.preprocessService = new PreprocessService();
    this.uploadsDir = path.join(process.cwd(), 'uploads');
  }

  /**
   * Check and preprocess all tracks that need it
   */
  public async migrateExistingTracks(options: {
    force?: boolean;
    batchSize?: number;
    onProgress?: (processed: number, total: number) => void;
  } = {}): Promise<void> {
    const {
      force = false,
      batchSize = 10,
      onProgress
    } = options;

    try {
      console.log('🔍 Scanning tracks for preprocessing...');

      // Get all tracks
      const result = await dbAsync.all<Track[]>(`
        SELECT id, file_path, name, waveform_data, preprocessed_chunks
        FROM tracks
        ${force ? '' : 'WHERE waveform_data IS NULL OR preprocessed_chunks IS NULL'}
      `);
      const tracks = result || [];

      console.log(`📝 Found ${tracks.length} tracks that need preprocessing`);

      // Process in batches
      for (let i = 0; i < tracks.length; i += batchSize) {
        const batch = tracks.slice(i, i + batchSize);
        await Promise.all(batch.map((track: Track) => this.preprocessTrack(track)));
        
        if (onProgress) {
          onProgress(Math.min(i + batchSize, tracks.length), tracks.length);
        }
        
        console.log(`✅ Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tracks.length / batchSize)}`);
      }

      console.log('✨ Migration complete!');

    } catch (error) {
      console.error('❌ Error during migration:', error);
      throw error;
    }
  }

  /**
   * Preprocess a single track
   */
  private async preprocessTrack(track: Track): Promise<void> {
    try {
      console.log(`🎵 Processing track: ${track.name}`);

      // Get absolute file path
      let filePath = track.file_path;
      if (filePath.startsWith('/uploads/')) {
        filePath = filePath.substring(9);
      } else if (filePath.startsWith('uploads/')) {
        filePath = filePath.substring(8);
      }
      filePath = path.join(this.uploadsDir, filePath);

      // Preprocess the track
      const preprocessedData = await this.preprocessService.preprocessAudio(filePath);

      // Update database
      await dbAsync.run(
        `UPDATE tracks 
         SET waveform_data = ?, 
             preprocessed_chunks = ?,
             updated_at = ?
         WHERE id = ?`,
        JSON.stringify(preprocessedData.waveformData),
        JSON.stringify(preprocessedData.chunks),
        Math.floor(Date.now() / 1000),
        track.id
      );

      console.log(`✅ Successfully processed: ${track.name}`);

    } catch (error) {
      console.error(`❌ Error processing track ${track.name}:`, error);
      // Continue with other tracks
    }
  }

  /**
   * Get preprocessing status for all tracks
   */
  public async getPreprocessingStatus(): Promise<{
    total: number;
    processed: number;
    unprocessed: number;
    failed: number;
  }> {
    const result = await dbAsync.get<DbResult>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN waveform_data IS NOT NULL AND preprocessed_chunks IS NOT NULL THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN waveform_data IS NULL OR preprocessed_chunks IS NULL THEN 1 ELSE 0 END) as unprocessed
      FROM tracks
    `);

    return {
      total: result?.total || 0,
      processed: result?.processed || 0,
      unprocessed: result?.unprocessed || 0,
      failed: 0 // We'll update this during migration
    };
  }
} 