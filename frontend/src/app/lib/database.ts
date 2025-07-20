import path from 'path';

// Database path relative to the Next.js app
const DB_PATH = path.join(process.cwd(), '..', 'main', 'db.sqlite');

console.log('📱 [Database] Database path:', DB_PATH);

// For now, let's create a simple file-based check
export async function connectToDatabase() {
  try {
    // Check if we can access the file system in the Next.js environment
    const fs = await import('fs');
    const dbExists = fs.existsSync(DB_PATH);
    
    console.log('📱 [Database] Database file exists:', dbExists);
    console.log('📱 [Database] Current working directory:', process.cwd());
    
    return {
      connected: dbExists,
      path: DB_PATH,
      message: dbExists ? 'Database file found' : 'Database file not found'
    };
  } catch (error) {
    console.error('📱 [Database] Connection error:', error);
    return {
      connected: false,
      path: DB_PATH,
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Real SQLite query interface
export async function queryDatabase(sql: string, params: any[] = []) {
  console.log('📱 [Database] Query attempt:', sql);
  console.log('📱 [Database] Params:', params);
  
  try {
    // Import sqlite3 dynamically for Next.js compatibility
    const sqlite3 = await import('sqlite3');
    const Database = sqlite3.default.Database;
    
    return new Promise((resolve, reject) => {
      const db = new Database(DB_PATH, sqlite3.default.OPEN_READONLY, (err) => {
        if (err) {
          console.error('📱 [Database] Connection error:', err);
          resolve({
            success: false,
            data: [],
            message: `Database connection failed: ${err.message}`
          });
          return;
        }
        
        console.log('📱 [Database] Successfully connected to SQLite database');
        
        // Execute the query
        db.all(sql, params, (err, rows) => {
          if (err) {
            console.error('📱 [Database] Query error:', err);
            resolve({
              success: false,
              data: [],
              message: `Query failed: ${err.message}`
            });
          } else {
            console.log('📱 [Database] Query successful, rows:', rows.length);
            console.log('📱 [Database] First row sample:', rows[0]);
            
            resolve({
              success: true,
              data: rows,
              message: `Query completed successfully, ${rows.length} rows returned`
            });
          }
          
          // Close the database connection
          db.close((err) => {
            if (err) {
              console.error('📱 [Database] Error closing database:', err);
            } else {
              console.log('📱 [Database] Database connection closed');
            }
          });
        });
      });
    });
    
  } catch (error) {
    console.error('📱 [Database] Import or execution error:', error);
    return {
      success: false,
      data: [],
      message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
} 