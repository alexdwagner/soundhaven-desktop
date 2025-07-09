import { PreprocessMigration } from '../utils/preprocessMigration';
import readline from 'readline';

async function runMigration() {
  const migration = new PreprocessMigration();
  
  try {
    // Get current status
    const status = await migration.getPreprocessingStatus();
    console.log('\nCurrent preprocessing status:');
    console.log('----------------------------');
    console.log(`Total tracks: ${status.total}`);
    console.log(`Processed: ${status.processed}`);
    console.log(`Unprocessed: ${status.unprocessed}`);
    console.log('----------------------------\n');

    if (status.unprocessed === 0) {
      console.log('✨ All tracks are already preprocessed!');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>(resolve => {
        rl.question('Would you like to force reprocess all tracks? (y/N) ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('👋 No action needed. Exiting...');
        return;
      }
    }

    // Create progress bar
    let progressBar = '';
    const updateProgress = (processed: number, total: number) => {
      const percent = Math.round((processed / total) * 100);
      const filled = Math.round((percent / 100) * 40);
      progressBar = '[' + '='.repeat(filled) + ' '.repeat(40 - filled) + ']';
      process.stdout.write(`\r${progressBar} ${percent}% (${processed}/${total})`);
    };

    // Run migration
    console.log('\n🚀 Starting preprocessing migration...\n');
    await migration.migrateExistingTracks({
      force: status.unprocessed === 0,
      batchSize: 5,
      onProgress: updateProgress
    });

    // Get final status
    const finalStatus = await migration.getPreprocessingStatus();
    console.log('\n\nFinal preprocessing status:');
    console.log('----------------------------');
    console.log(`Total tracks: ${finalStatus.total}`);
    console.log(`Successfully processed: ${finalStatus.processed}`);
    console.log(`Remaining unprocessed: ${finalStatus.unprocessed}`);
    console.log(`Failed: ${finalStatus.failed}`);
    console.log('----------------------------');

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
runMigration().then(() => {
  console.log('\n👋 Migration complete!');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
}); 