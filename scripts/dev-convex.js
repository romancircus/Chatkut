#!/usr/bin/env node

/**
 * Start Convex dev server with environment variables from .env.local
 * This ensures Cloudflare credentials are available to the backend
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load .env.local file
const envPath = path.join(__dirname, '..', '.env.local');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env.local file not found!');
  console.error('Please create .env.local with your Cloudflare credentials.');
  process.exit(1);
}

// Parse .env.local
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = {};

envContent.split('\n').forEach(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || !line.trim()) return;

  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    let value = valueParts.join('=').trim();
    // Remove inline comments (everything after # that's not inside quotes)
    const hashIndex = value.indexOf('#');
    if (hashIndex > 0) {
      value = value.substring(0, hashIndex).trim();
    }
    envVars[key.trim()] = value;
  }
});

// Verify critical variables
const requiredVars = [
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_STREAM_TOKEN',
  'CLOUDFLARE_R2_ACCESS_KEY',
  'CLOUDFLARE_R2_SECRET_KEY'
];

const missing = requiredVars.filter(v => !envVars[v]);
if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log(`   CLOUDFLARE_ACCOUNT_ID: ${envVars.CLOUDFLARE_ACCOUNT_ID.substring(0, 8)}...`);
console.log(`   CLOUDFLARE_STREAM_TOKEN: ${envVars.CLOUDFLARE_STREAM_TOKEN.substring(0, 8)}...`);
console.log(`   CLOUDFLARE_R2_ACCESS_KEY: ${envVars.CLOUDFLARE_R2_ACCESS_KEY.substring(0, 8)}...`);
console.log('');
console.log('📋 Total environment variables set:', Object.keys(envVars).length);
console.log('🚀 Starting Convex dev server...\n');

// Start Convex with environment variables
const convex = spawn('npx', ['convex', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...envVars
  }
});

convex.on('exit', (code) => {
  process.exit(code);
});

// Handle termination
process.on('SIGINT', () => {
  convex.kill('SIGINT');
  process.exit(0);
});
