import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integratedSeed } from '../demo/integrated-seed.mjs';
import { stampIntegratedRelease } from '../demo/release.mjs';
import { exportIntegratedFixtures } from '../demo/integrated-exports.mjs';
import { teachers, teachingClasses } from '../dist/teaching-data.mjs';
import { csv } from '../dist/model.mjs';

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
await exportIntegratedFixtures(path.join(target, 'dist'));
await fs.writeFile(path.join(target, 'dist/data/teacher-accounts.csv'), csv([['Name','Username','Password','Area'], ...teachers.map(t => [t.name,t.username,'WistTest2026!',t.area])]));
await fs.writeFile(path.join(target, 'dist/data/teaching-groups.csv'), csv([['Class ID','Class','Subject','Teacher ID','Students'], ...teachingClasses.map(c => [c.id,c.name,c.subject,c.teacherId,c.studentIds.length])]));
await fs.writeFile(path.join(target, 'dist/data/student-group-memberships.csv'), csv([['Student ID','Class ID'], ...teachingClasses.flatMap(c => c.studentIds.map(id => [id,c.id]))]));
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
  // These deployment-specific notices describe server-backed saves. Keep planning draft
  // and browser capability warnings unchanged: those still refer to browser behaviour.
  const notices = [
    ['Demo records stay in this browser. Sign out and switch test accounts in this browser to test the full hand-in and marking workflow.', 'Classroom records are shared across computers. Teachers and students can use their own devices for assignments, hand-in and marking.'],
    ['Saves and password changes stay in this browser and do not synchronise between testers.', 'Saves and password changes are stored centrally and apply across test computers.'],
    ['Saved in this browser only', 'Saved to shared school records'],
    ['Changes are saved in this browser and are not shared with colleagues or other devices.', 'Changes are saved centrally and shared with the appropriate teachers, students and linked family accounts.'],
    ['To test a full hand-in and marking cycle, sign out and switch between the student and teacher test accounts in this same browser. The login page lists the accounts.', 'To test a full hand-in and marking cycle, use teacher and student accounts on separate computers or browser profiles. The login page lists the accounts.'],
    ['The free demo does not send email, connect external accounts, provide live document co-editing or synchronise devices.', 'This testing system does not send email, connect external accounts or provide live document co-editing.'],
    ['Saves remain in this browser.', 'Saves are shared across computers.'],
    ['Test records stay in this browser.', 'Records are read from the shared school system.'],
    ['No incidents recorded by you in this browser.', 'Open Incidents to view the shared incident and reward log.'],
    ['Test message saved locally', 'Test message saved to shared school records'],
    ['This demonstration saves in this browser.', 'Submitted choices are saved centrally.'],
    ['Changes stay in this browser. Switch accounts here to test the complete request workflow.', 'Changes are shared across computers. Staff and technicians can use their own devices to test the complete request workflow.'],
  ];
  for (const [before, after] of notices) source = source.replaceAll(before, after);
  if (name.endsWith('.html')) source = source.replace('PROTOTYPE · SAMPLE DATA', 'SHARED MIS & CLASSROOM · TEST DATA')
    .replace('<strong>60</strong> teacher', '<strong>' + project.teachers.length + '</strong> teacher')
    .replace('Attendance, assessments and reports are shared on the local server. Use fictional information.', 'Attendance, assessments, Classroom and school records are saved centrally. Use fictional information.')
    .replace('LOCAL TEST ENVIRONMENT', 'SHARED SCHOOL TEST ENVIRONMENT')
    .replace('Attendance, assessments and reports are shared on the local server. Other prototype records are stored in this browser. Use fictional school information.', 'Attendance, assessments, Classroom and school records are shared across computers. Use fictional information.');
  if (name === 'login.html') source = source.replace('</section></main>', '<p class="login-footnote"><a href="/wist-mis-browser-backup/login.html">Export earlier records saved only in this browser ↗</a></p></section></main>');
  await fs.writeFile(file, source);
}
await stampIntegratedRelease(path.join(target, 'dist'), {versionModules:false});
console.log('Built server-backed MIS at ' + target + ' with ' + Object.keys(seed['grades.json'].assessments).length + ' assessment fixtures. No browser API emulator included.');
