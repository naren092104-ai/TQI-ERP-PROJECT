import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendBuild = path.join(projectRoot, 'frontend', 'dist');
const vercelPublic = path.join(projectRoot, 'public');

if (!fs.existsSync(path.join(frontendBuild, 'index.html'))) {
  throw new Error('Frontend build is missing. Run the Vite build before preparing Vercel assets.');
}

fs.rmSync(vercelPublic, { recursive: true, force: true });
fs.cpSync(frontendBuild, vercelPublic, { recursive: true });
console.log(`Prepared Vercel static assets in ${vercelPublic}`);
