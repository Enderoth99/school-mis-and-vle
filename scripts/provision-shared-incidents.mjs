// Uses the operator's short-lived gcloud identity; never writes an admin credential.
// Existing rules and shared role assignments are preserved. Fictional accounts only.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { integratedSeed } from '../demo/integrated-seed.mjs';
import { teachers, formTutors } from '../dist/teaching-data.mjs';
import { REPORT_REVIEWER } from '../dist/report-config.mjs';
import { fields, documentValue } from '../demo/firestore-values.mjs';
import { memoryStore, profileScopes } from '../demo/shared-incident-model.mjs';

const projectId = process.env.MIS_FIREBASE_PROJECT || 'economics-monopoly';
const root = new URL('../', import.meta.url), prefix = 'school_mis_incidents_v1';
const token = (process.platform === 'win32'
  ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true })
  : execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' })).trim();
async function api(url, body, method = body ? 'POST' : 'GET', allow404 = false) {
  const response = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, 'x-goog-user-project': projectId, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  if (allow404 && response.status === 404) return null;
  if (!response.ok) throw Error(`${method} ${new URL(url).hostname}: ${response.status} ${value.error?.message || 'Request failed'}`);
  return value;
}
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
const resource = `projects/${projectId}/databases/(default)/documents`;
const active = JSON.parse(await fs.readFile(new URL('dist/timetable-integrated.json', root)));
const people = integratedSeed(active)['directory.json'].people;
const staff = [...teachers, REPORT_REVIEWER].map(t => ({ id: t.id, name: t.name, username: t.username, role: t.role || 'teacher' }));
const catalog = { people: Object.fromEntries(Object.entries(people).filter(([, p]) => p.kind === 'student' || staff.some(t => t.id === p.id)).map(([id, p]) => [id, Object.fromEntries(['id','name','kind','status','recordNumber','year','yearLabel','cohort','groupName','accountEnabled','supportTechnician'].filter(key => p[key] !== undefined).map(key => [key, p[key]]))])), staff, studentIds: Object.values(people).filter(p => p.kind === 'student' && p.status === 'Active').map(p => p.id) };
const existingRoles = await api(`${base}/${prefix}_config/roles`, null, 'GET', true);
catalog.defaultTutors = Object.fromEntries(formTutors.map(t => [t.groupId, t.teacherId]));
const roles = existingRoles ? documentValue(existingRoles) : { revision: 0, heads: {}, tutors: {} };
const store = memoryStore(catalog, roles);
// Provision only missing accounts; do not reset passwords on subsequent runs.
const users = await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?maxResults=1000`);
const known = new Set((users.users || []).map(u => u.localId));
let created = 0;
for (const person of staff) if (!known.has(person.id)) {
  await api(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, { localId: person.id, email: person.username + '@school-mis.invalid', password: 'WistTest2026!', displayName: person.name, emailVerified: true });
  created++;
}
const { people: catalogPeople, ...catalogFields } = catalog;
const writes = [{ update: { name: resource + `/${prefix}_config/catalog`, fields: fields({ ...catalogFields, peopleJSON: JSON.stringify(catalogPeople) }) } }];
if (!existingRoles) writes.push({ update: { name: resource + `/${prefix}_config/roles`, fields: fields(roles) }, currentDocument: { exists: false } });
else writes.push({ update: { name: resource + `/${prefix}_config/roles`, fields: fields(roles) }, currentDocument: { updateTime: existingRoles.updateTime } });
for (const person of staff) {
  const old = await api(`${base}/${prefix}_staff/${person.id}`, null, 'GET', true);
  if (!old) writes.push({ update: { name: resource + `/${prefix}_staff/${person.id}`, fields: fields({ ...person, active: true, studentIds: profileScopes(store, person) }) }, currentDocument: { exists: false } });
  else writes.push({ update: { name: old.name, fields: fields({ studentIds: profileScopes(store, person) }) }, updateMask: { fieldPaths: ['studentIds'] }, currentDocument: { updateTime: old.updateTime } });
}
await api(base + ':commit', { writes });
const release = await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`);
const current = await api(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
await fs.mkdir(new URL('tmp/', root), { recursive: true });
await fs.writeFile(new URL('tmp/firestore-rules-before-shared-incidents.json', root), JSON.stringify(current, null, 2));
const snippet = await fs.readFile(new URL('demo/shared-incidents.rules', root), 'utf8');
const files = current.source.files.map(file => {
  if (!file.content.includes('service cloud.firestore')) return file;
  if (file.content.includes(snippet.trim())) return file;
  if (file.content.includes('function misProfile()')) throw Error('Shared incident rules differ; review and update them explicitly.');
  const marker = 'match /{document=**}';
  const at = file.content.indexOf(marker);
  if (at < 0) throw Error('Cannot safely locate the default deny rule.');
  return { name: file.name, content: file.content.slice(0, at) + snippet + '\n  ' + file.content.slice(at) };
});
const ruleset = await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/rulesets`, { source: { files } });
await api(`https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`, { release: { name: release.name, rulesetName: ruleset.name } }, 'PATCH');
// Disable self-registration, leaving only the pre-provisioned demo staff accounts.
await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=client.permissions.disabledUserSignup`, { client: { permissions: { disabledUserSignup: true } } }, 'PATCH');
const web = JSON.parse(await fs.readFile(new URL('tmp/firebase-web-config.json', root), 'utf8'));
await fs.writeFile(new URL('demo/shared-config.json', root), JSON.stringify({ projectId, apiKey: web.apiKey, authDomain: web.authDomain }, null, 2) + '\n');
console.log(`Shared incident store ready: ${staff.length} staff profiles, ${created} new fictional sign-ins, ${catalog.studentIds.length} pupils. Existing Learning Hub rules preserved.`);
