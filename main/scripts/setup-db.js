#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up SoundHaven database...\n');

// Get the main directory (where this script should be run from)
const mainDir = process.cwd();
const dbPath = path.join(mainDir, 'db.sqlite');

// Step 1: Remove existing database if it exists
if (fs.existsSync(dbPath)) {
  console.log('🗑️  Removing existing database...');
  fs.unlinkSync(dbPath);
  console.log('✅ Existing database removed\n');
}

// Step 2: Run database setup
console.log('🔧 Creating database tables...');
try {
  execSync('yarn tsx src/setupDb.ts', { 
    stdio: 'inherit',
    cwd: mainDir 
  });
  console.log('✅ Database tables created\n');
} catch (error) {
  console.error('❌ Failed to create database tables:', error.message);
  process.exit(1);
}

// Step 3: Run database seeding
console.log('🌱 Seeding database with test data...');
try {
  execSync('node seed.js', { 
    stdio: 'inherit',
    cwd: mainDir 
  });
  console.log('✅ Database seeded successfully\n');
} catch (error) {
  console.error('❌ Failed to seed database:', error.message);
  process.exit(1);
}

// Step 4: Verify the database was created
if (fs.existsSync(dbPath)) {
  const stats = fs.statSync(dbPath);
  console.log(`✅ Database setup complete!`);
  console.log(`📁 Database location: ${dbPath}`);
  console.log(`📊 Database size: ${(stats.size / 1024).toFixed(1)} KB`);
} else {
  console.error('❌ Database file was not created!');
  process.exit(1);
}

console.log('\n🎉 Ready to run your SoundHaven app!'); 