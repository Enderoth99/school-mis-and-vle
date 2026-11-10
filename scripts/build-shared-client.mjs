// Static native client for Firebase Hosting; /api stays on the authenticated backend.
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
const source = path.resolve(process.argv[2] || 'build/full-shared-server/dist');
const target = path.resolve(process.argv[3] || 'build/full-shared-client/wist-mis-testing');
let release = process.argv[4];
if (release && !/^[a-zA-Z0-9-]+$/.test(release)) throw Error('Invalid client release.');
await fs.mkdir(target, { recursive: true });
if ((await fs.readdir(target)).length) throw Error('Build into an empty client directory.');
await fs.cp(source, target, { recursive: true });
for (const name of ['app.mjs','login.mjs','timetable-worker.mjs']) {
  await build({ entryPoints: [path.join(source,name)], outfile: path.join(target,name), bundle: true, minify: true, format: 'esm', platform: 'browser', target: 'es2022' });
}
if (!release) {
  const hash = createHash('sha256');
  for (const name of ['app.mjs','login.mjs','timetable-worker.mjs']) hash.update(await fs.readFile(path.join(target,name)));
  release = 'shared-' + hash.digest('hex').slice(0,16);
}
const appFile = path.join(target,'app.mjs');
await fs.writeFile(appFile, (await fs.readFile(appFile,'utf8')).replace(/(['"])(\.\/timetable-worker\.mjs)(?:\?v=[^'"]+)?\1/g, (_,quote,file) => quote+file+'?v='+release+quote));
for (const name of ['index.html','login.html']) {
  const file = path.join(target,name);
  const html = (await fs.readFile(file,'utf8')).replace(/src="(app|login)\.mjs"/g, (_,entry) => `src="${entry}.mjs?v=${release}"`);
  await fs.writeFile(file,html);
}
const html = await fs.readFile(path.join(target,'index.html'),'utf8');
if (html.includes('demo-bootstrap') || html.includes('demo-api')) throw Error('Do not publish the browser API emulator in the shared client.');
console.log('Built native shared client bundles at ' + target + '. API requests remain server-backed.');
