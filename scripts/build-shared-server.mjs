import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integratedSeed } from '../demo/integrated-seed.mjs';
import { stampIntegratedRelease } from '../demo/release.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = path.resolve(process.argv[2] || 'build/full-shared-server');
const base = process.argv[3] || '/wist-mis-testing/';
if (!/^\/[a-z0-9-]+\/$/.test(base)) throw Error('Use a single safe MIS base path.');
await fs.mkdir(target, { recursive: true });
if ((await fs.readdir(target)).length) throw Error('Build into an empty directory.');
for (const name of await fs.readdir(root)) if (name.endsWith('.mjs') || ['package.json', 'Dockerfile', '.dockerignore'].includes(name)) await fs.copyFile(path.join(root, name), path.join(target, name));
await fs.cp(path.join(root, 'dist'), path.join(target, 'dist'), { recursive: true });
await fs.mkdir(path.join(target, 'scripts'), { recursive: true });
await fs.copyFile(path.join(root, 'scripts/render-report.py'), path.join(target, 'scripts/render-report.py'));
const project = JSON.parse(await fs.readFile(path.join(root, 'dist/timetable-integrated.json')));
const seed = integratedSeed(project);
await fs.writeFile(path.join(target, 'dist/timetable-active-config.mjs'), 'export const ACTIVE_PROJECT=' + JSON.stringify(project) + ';\n');
const seedDir = path.join(target, 'deploy/seed');
await fs.mkdir(seedDir, { recursive: true });
for (const [name, state] of Object.entries(seed)) await fs.writeFile(path.join(seedDir, name), JSON.stringify(state));
// Keep the original browser namespace so prior data is still recoverable after cutover.
for (const name of await fs.readdir(path.join(target, 'dist'))) {
  if (!/\.(mjs|html)$/.test(name)) continue;
  const file = path.join(target, 'dist', name);
  let source = await fs.readFile(file, 'utf8');
  source = source.replaceAll('/api/', base + 'api/').replaceAll("'/login.html'", "'" + base + "login.html'")
    .replaceAll("'/#/home'", "'" + base + "#/home'").replaceAll("'/#/admin'", "'" + base + "#/admin'")
    .replaceAll("'/#/cards'", "'" + base + "#/cards'")
    .replaceAll('wist-teacher-prototype-v1', 'wist-mis-integrated-prototype-v2')
    .replaceAll('wist-timetable-planning-v1', 'wist-integrated-timetable-planning-v2');
  if (name.endsWith('.html')) source = source.replace('PROTOTYPE · SAMPLE DATA', 'SHARED MIS & CLASSROOM · TEST DATA')
    .replace('Attendance, assessments and reports are shared on the local server. Use fictional information.', 'Attendance, assessments, Classroom and school records are saved centrally. Use fictional information.')
    .replace('LOCAL TEST ENVIRONMENT', 'SHARED SCHOOL TEST ENVIRONMENT')
    .replace('Attendance, assessments and reports are shared on the local server. Other prototype records are stored in this browser. Use fictional school information.', 'Attendance, assessments, Classroom and school records are shared across computers. Use fictional information.');
  await fs.writeFile(file, source);
}
await stampIntegratedRelease(path.join(target, 'dist'));
console.log('Built server-backed MIS at ' + target + ' with ' + Object.keys(seed['grades.json'].assessments).length + ' assessment fixtures. No browser API emulator included.');
