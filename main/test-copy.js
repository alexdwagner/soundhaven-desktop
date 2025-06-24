const fs = require('fs');
const path = require('path');

// Source file path (location in main/public)
const sourceFile = path.resolve(__dirname, 'public/careless_whisper.mp3');

// Destination file path (location where the server looks for it)
const destFile = path.resolve(process.cwd(), '../public/careless_whisper.mp3');

console.log('Checking paths:');
console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());
console.log('Source file path:', sourceFile);
console.log('Dest file path:', destFile);
console.log('Source exists:', fs.existsSync(sourceFile));

// Create destination directory if it doesn't exist
const destDir = path.dirname(destFile);
if (!fs.existsSync(destDir)) {
  console.log(`Creating directory: ${destDir}`);
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy the file
if (fs.existsSync(sourceFile)) {
  console.log(`Copying file from ${sourceFile} to ${destFile}`);
  fs.copyFileSync(sourceFile, destFile);
  console.log('Copy complete. File now exists at destination:', fs.existsSync(destFile));
} else {
  console.error('Source file not found');
} 