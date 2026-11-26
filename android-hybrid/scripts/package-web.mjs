import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const hybridRoot = path.resolve(__dirname, '..');
const originalRoot = path.resolve(hybridRoot, '..');
const sourceDist = path.join(originalRoot, 'dist');
const targetWww = path.join(hybridRoot, 'www');
const bridgeSrc = path.join(__dirname, 'android-bridge.js');

// Production Cloud Backend URL (never exposes private Gemini API keys inside the APK)
const cloudApiBase = (
  process.env.ANDROID_CLOUD_API_BASE ||
  'https://ais-pre-cv6frxko6syihoou4kzoml-361675572354.asia-southeast1.run.app'
).replace(/\/+$/, '');

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('[Android Packager] Step 1: Building original website without altering source files...');
execSync('npm run build', { cwd: originalRoot, stdio: 'inherit' });

if (!fs.existsSync(sourceDist)) {
  throw new Error('Expected ../dist output after building original website.');
}

console.log('[Android Packager] Step 2: Copying build into android-hybrid/www...');
fs.rmSync(targetWww, { recursive: true, force: true });
copyDirRecursive(sourceDist, targetWww);

// Remove web PWA service worker inside offline APK bundle to avoid cache conflicts in WebView
for (const swFile of ['sw.js', 'registerSW.js']) {
  const candidate = path.join(targetWww, swFile);
  if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
}

// Copy zero-UI runtime bridge into www/android-bridge.js
fs.copyFileSync(bridgeSrc, path.join(targetWww, 'android-bridge.js'));

// Inject configuration & bridge cleanly into packaged www/index.html ONLY (never touches ../index.html)
const packagedIndexPath = path.join(targetWww, 'index.html');
if (fs.existsSync(packagedIndexPath)) {
  let html = fs.readFileSync(packagedIndexPath, 'utf-8');
  html = html.replace(/<script[^>]*registerSW\.js[^>]*><\/script>\s*/gi, '');
  const injection = `<script>window.__ANDROID_CLOUD_API_BASE__=${JSON.stringify(cloudApiBase)};</script>\n    <script src="/android-bridge.js"></script>\n  </head>`;
  if (!html.includes('/android-bridge.js')) {
    html = html.replace('</head>', injection);
  }
  fs.writeFileSync(packagedIndexPath, html, 'utf-8');
}

console.log(`[Android Packager] Packaged successfully into ${targetWww}`);
console.log(`[Android Packager] Cloud API backend configured: ${cloudApiBase}`);
