// Freeze the previous browser-based incident backend before the final copy.
// Reversible with "unfreeze". Source records and unrelated Learning Hub rules remain intact.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fields } from '../demo/firestore-values.mjs';
const action = process.argv[2];
if (!['freeze', 'unfreeze'].includes(action)) throw Error('Choose freeze or unfreeze.');
const project = process.env.MIS_FIREBASE_PROJECT || 'economics-monopoly';
const token = (process.platform === 'win32' ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d','/s','/c','gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true }) : execFileSync('gcloud', ['auth','print-access-token'], { encoding: 'utf8' })).trim();
async function api(url, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'x-goog-user-project': project, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw Error('Incident transition failed: ' + response.status + ' ' + (result.error?.message || 'Request failed'));
  return result;
}
const release = await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`);
const ruleset = await api('https://firebaserules.googleapis.com/v1/' + release.rulesetName);
await fs.mkdir(new URL('../tmp/', import.meta.url), { recursive: true });
const backup = new URL('../tmp/firestore-before-full-cutover.json', import.meta.url);
try { await fs.writeFile(backup, JSON.stringify(ruleset, null, 2), { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST') throw error; }
const files = ruleset.source.files.map(file => {
  if (!file.content.includes('function misProfile()') || file.content.includes('function misFrozen()')) return file;
  const create = 'allow create: if misStaff() && validMisIncident(request.resource.data, id);';
  const update = "allow update: if misAdmin() && id == 'roles'";
  if (!file.content.includes(create) || !file.content.includes(update)) throw Error('Review the current incident rules before transitioning.');
  return { name: file.name, content: file.content.replace('function misProfile()', 'function misFrozen() { return exists(/databases/$(database)/documents/school_mis_incidents_v1_config/cutover) && get(/databases/$(database)/documents/school_mis_incidents_v1_config/cutover).data.frozen == true; }\n  function misProfile()')
    .replace(create, 'allow create: if misStaff() && !misFrozen() && validMisIncident(request.resource.data, id);')
    .replace(update, update + ' && !misFrozen()') };
});
if (JSON.stringify(files) !== JSON.stringify(ruleset.source.files)) {
  const next = await api(`https://firebaserules.googleapis.com/v1/projects/${project}/rulesets`, { source: { files } });
  await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore`, { release: { name: release.name, rulesetName: next.name } }, 'PATCH');
}
await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/school_mis_incidents_v1_config/cutover`, { fields: fields({ frozen: action === 'freeze', updatedAt: new Date().toISOString() }) }, 'PATCH');
console.log('Previous incident backend is ' + (action === 'freeze' ? 'read-only. Refresh old browser tabs after Learning Hub cutover.' : 'writable again.'));
