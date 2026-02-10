import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const projectDir = '/vercel/share/v0-project';

try {
  console.log('[v0] Clearing npm cache...');
  try {
    execSync('npm cache clean --force', { stdio: 'pipe' });
  } catch (e) {
    console.log('[v0] Cache clear skipped');
  }

  console.log('[v0] Removing node_modules...');
  const nodeModulesPath = path.join(projectDir, 'node_modules');
  if (fs.existsSync(nodeModulesPath)) {
    fs.rmSync(nodeModulesPath, { recursive: true, force: true });
    console.log('[v0] Removed node_modules');
  }

  console.log('[v0] Installing dependencies with npm...');
  execSync('npm install', {
    cwd: projectDir,
    stdio: 'inherit'
  });

  console.log('[v0] Dependencies installed successfully!');
} catch (error) {
  console.error('[v0] Error during installation:', error.message);
  process.exit(1);
}
