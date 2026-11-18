import dotenv from 'dotenv';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

dotenv.config();

// MongoDB backup: mongodump if available, else JSON collection dump via mongoose.
// Usage: npm run backup
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'backups', new Date().toISOString().slice(0, 10));

const run = async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/madina-bazar';
  try {
    execSync(`mongodump --uri="${uri}" --out="${outDir}"`, { stdio: 'inherit' });
    console.log(`✅ Backup complete: ${outDir}`);
  } catch (e) {
    console.error('❌ mongodump not available — install MongoDB Database Tools for automated backups.');
    console.error('   Manual fallback: mongoexport per collection, or Atlas scheduled snapshots.');
    process.exitCode = 1;
  }
};

run();
