import { execSync } from 'child_process';

console.log('[v0] Starting dependency installation...');

try {
  console.log('[v0] Running npm install...');
  execSync('npm install', { 
    cwd: '/vercel/share/v0-project',
    stdio: 'inherit'
  });
  console.log('[v0] Dependencies installed successfully');
} catch (error) {
  console.error('[v0] Error installing dependencies:', error.message);
  process.exit(1);
}
