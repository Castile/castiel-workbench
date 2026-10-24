import { packager } from '@electron/packager';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = await fs.mkdtemp(path.join(root, '.desktop-stage-'));
try {
  await fs.mkdir(path.join(stage, 'src/state'), { recursive: true });
  await fs.cp(path.join(root, 'desktop'), path.join(stage, 'desktop'), { recursive: true });
  await fs.cp(path.join(root, 'dist/client'), path.join(stage, 'dist/client'), { recursive: true });
  await fs.copyFile(path.join(root, 'src/state/document.js'), path.join(stage, 'src/state/document.js'));
  await fs.writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'castiel-workbench', productName: 'Castiel', version: '0.1.0', type: 'module', main: 'desktop/main.mjs' }));
  const meta = JSON.parse(await fs.readFile(path.join(root, 'node_modules/electron/package.json'), 'utf8'));
  const apps = await packager({ dir: stage, name: 'Castiel', appBundleId: 'com.castiel.workbench', appVersion: '0.1.0', platform: process.platform, arch: process.arch, electronVersion: meta.version, electronZipDir: process.env.CASTIEL_ELECTRON_ZIP_DIR, out: path.join(root, '../release'), overwrite: true, asar: true, prune: false });
  for (const folder of apps) {
    if (process.platform === 'darwin') {
      const signed = spawnSync('codesign', ['--force', '--deep', '--sign', '-', path.join(folder, 'Castiel.app')], { stdio: 'inherit' });
      if (signed.status !== 0) throw new Error('本地临时签名失败');
    }
    console.log('Desktop package:', folder);
  }
} finally { await fs.rm(stage, { recursive: true, force: true }); }
