import { Database, RunResult } from 'sqlite3';
import { promisify } from 'util';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { FileManagementService } from './fileManagementService';
import { MetadataService } from './metadataService';

interface SyncMetadata {
  id: string;
  filePath: string;
  hash: string;
  lastModified: number;
  lastSynced: number | null;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
  version: number;
}

interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // in minutes
  maxConcurrentUploads: number;
  maxRetries: number;
  chunkSize: number; // in bytes
}

interface ChunkRow {
  chunk_index: number;
}

export class SyncService {
  private static readonly DB_PATH = path.join(process.cwd(), 'data', 'sync.db');
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private static readonly MAX_RETRIES = 3;
  private static readonly SYNC_INTERVAL = 5; // 5 minutes
  
  private db: Database;
  private config: SyncConfig;
  private syncQueue: Set<string>;
  private isSyncing: boolean;
  private syncTimer: NodeJS.Timeout | null;

  constructor() {
    this.db = new Database(SyncService.DB_PATH);
    this.syncQueue = new Set();
    this.isSyncing = false;
    this.syncTimer = null;
    
    this.config = {
      enabled: true,
      autoSync: true,
      syncInterval: SyncService.SYNC_INTERVAL,
      maxConcurrentUploads: 3,
      maxRetries: SyncService.MAX_RETRIES,
      chunkSize: SyncService.CHUNK_SIZE
    };
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    try {
      await this.createTables();
      await this.startAutoSync();
      console.log('✅ Sync service initialized');
    } catch (error) {
      console.error('❌ Error initializing sync service:', error);
      throw error;
    }
  }

  /**
   * Create necessary database tables
   */
  private async createTables(): Promise<void> {
    const run = promisify<string, any[]>(this.db.run.bind(this.db));
    
    await run(`
      CREATE TABLE IF NOT EXISTS sync_metadata (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        hash TEXT NOT NULL,
        last_modified INTEGER NOT NULL,
        last_synced INTEGER,
        sync_status TEXT NOT NULL,
        error_message TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        UNIQUE(file_path)
      )
    `);
    
    await run(`
      CREATE TABLE IF NOT EXISTS sync_chunks (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_hash TEXT NOT NULL,
        uploaded BOOLEAN NOT NULL DEFAULT 0,
        FOREIGN KEY(file_id) REFERENCES sync_metadata(id),
        UNIQUE(file_id, chunk_index)
      )
    `);
  }

  /**
   * Start auto-sync if enabled
   */
  private async startAutoSync(): Promise<void> {
    if (this.config.enabled && this.config.autoSync) {
      this.syncTimer = setInterval(
        () => this.syncPendingFiles(),
        this.config.syncInterval * 60 * 1000
      );
      
      // Initial sync
      await this.syncPendingFiles();
    }
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  /**
   * Add a file to the sync queue
   */
  async queueFileForSync(filePath: string): Promise<void> {
    try {
      const stats = await fs.promises.stat(filePath);
      const hash = await this.calculateFileHash(filePath);
      
      const metadata: SyncMetadata = {
        id: crypto.randomUUID(),
        filePath,
        hash,
        lastModified: stats.mtimeMs,
        lastSynced: null,
        syncStatus: 'pending',
        version: 1
      };
      
      await this.saveSyncMetadata(metadata);
      this.syncQueue.add(metadata.id);
      
      if (this.config.autoSync) {
        this.syncPendingFiles();
      }
    } catch (error) {
      console.error('❌ Error queuing file for sync:', error);
      throw error;
    }
  }

  /**
   * Calculate file hash for change detection
   */
  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data: Buffer | string) => {
        if (Buffer.isBuffer(data)) {
          hash.update(data);
        } else {
          hash.update(Buffer.from(data));
        }
      });
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Save sync metadata to database
   */
  private async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO sync_metadata (
          id, file_path, hash, last_modified, last_synced,
          sync_status, error_message, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          metadata.id,
          metadata.filePath,
          metadata.hash,
          metadata.lastModified,
          metadata.lastSynced,
          metadata.syncStatus,
          metadata.errorMessage,
          metadata.version
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Sync pending files
   */
  private async syncPendingFiles(): Promise<void> {
    if (this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      const pendingFiles = await this.getPendingFiles();
      
      // Process files in parallel up to maxConcurrentUploads
      const chunks = this.chunkArray(pendingFiles, this.config.maxConcurrentUploads);
      
      for (const chunk of chunks) {
        await Promise.all(chunk.map(file => this.syncFile(file)));
      }
    } catch (error) {
      console.error('❌ Error syncing pending files:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get pending files from database
   */
  private async getPendingFiles(): Promise<SyncMetadata[]> {
    const all = promisify<string, any[]>(this.db.all.bind(this.db));
    
    const rows = await all(`
      SELECT * FROM sync_metadata
      WHERE sync_status IN ('pending', 'error')
      ORDER BY last_modified ASC
    `);
    
    return (rows as any[]).map(row => ({
      id: row.id,
      filePath: row.file_path,
      hash: row.hash,
      lastModified: row.last_modified,
      lastSynced: row.last_synced,
      syncStatus: row.sync_status as SyncMetadata['syncStatus'],
      errorMessage: row.error_message,
      version: row.version
    }));
  }

  /**
   * Sync a single file
   */
  private async syncFile(metadata: SyncMetadata): Promise<void> {
    try {
      // Update status to syncing
      metadata.syncStatus = 'syncing';
      await this.saveSyncMetadata(metadata);
      
      // Check if file still exists
      if (!fs.existsSync(metadata.filePath)) {
        throw new Error('File no longer exists');
      }
      
      // Calculate current hash
      const currentHash = await this.calculateFileHash(metadata.filePath);
      
      // Check if file has changed
      if (currentHash !== metadata.hash) {
        metadata.hash = currentHash;
        metadata.version++;
      }
      
      // Split file into chunks and upload
      await this.uploadFileChunks(metadata);
      
      // Update sync status
      metadata.syncStatus = 'synced';
      metadata.lastSynced = Date.now();
      metadata.errorMessage = undefined;
      await this.saveSyncMetadata(metadata);
      
      this.syncQueue.delete(metadata.id);
      
    } catch (error) {
      console.error(`❌ Error syncing file ${metadata.filePath}:`, error);
      
      metadata.syncStatus = 'error';
      metadata.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.saveSyncMetadata(metadata);
    }
  }

  /**
   * Split file into chunks and upload
   */
  private async uploadFileChunks(metadata: SyncMetadata): Promise<void> {
    const fileSize = fs.statSync(metadata.filePath).size;
    const numChunks = Math.ceil(fileSize / this.config.chunkSize);
    
    // Get already uploaded chunks
    const uploadedChunks = await this.getUploadedChunks(metadata.id);
    
    for (let i = 0; i < numChunks; i++) {
      // Skip if chunk already uploaded
      if (uploadedChunks.has(i)) continue;
      
      const start = i * this.config.chunkSize;
      const end = Math.min(start + this.config.chunkSize, fileSize);
      
      // Read chunk
      const chunk = await this.readFileChunk(metadata.filePath, start, end);
      const chunkHash = crypto.createHash('sha256').update(chunk).digest('hex');
      
      // Upload chunk
      await this.uploadChunk(metadata, i, chunk, chunkHash);
    }
  }

  /**
   * Read a chunk of a file
   */
  private async readFileChunk(filePath: string, start: number, end: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = fs.createReadStream(filePath, { start, end: end - 1 });
      
      stream.on('data', (chunk: Buffer | string) => {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk));
        }
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Upload a single chunk
   */
  private async uploadChunk(
    metadata: SyncMetadata,
    chunkIndex: number,
    chunk: Buffer,
    chunkHash: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT OR REPLACE INTO sync_chunks (
          id, file_id, chunk_index, chunk_hash, uploaded
        ) VALUES (?, ?, ?, ?, 1)`,
        [
          crypto.randomUUID(),
          metadata.id,
          chunkIndex,
          chunkHash
        ],
        (err: Error | null) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Get set of uploaded chunk indices
   */
  private async getUploadedChunks(fileId: string): Promise<Set<number>> {
    return new Promise((resolve, reject) => {
      this.db.all<ChunkRow>(
        `SELECT chunk_index FROM sync_chunks
        WHERE file_id = ? AND uploaded = 1`,
        [fileId],
        (err: Error | null, rows: ChunkRow[]) => {
          if (err) reject(err);
          else resolve(new Set(rows.map(row => row.chunk_index)));
        }
      );
    });
  }

  /**
   * Helper to chunk array for parallel processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.stopAutoSync();
    
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
} 