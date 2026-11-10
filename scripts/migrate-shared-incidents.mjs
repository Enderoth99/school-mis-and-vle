// Copies existing Firestore incident records into a deployment seed or private shared store.
// Never deletes the source and never replaces existing shared-directory records.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { documentValue } from '../demo/firestore-values.mjs';
import { memoryStore, expandRecord } from '../demo/shared-incident-model.mjs';
import { incidentCSV } from '../dist/incident-model.mjs';

const target = process.argv[2];
if (!target) throw Error('Supply a directory.json deployment seed path.');
const project = process.env.MIS_FIREBASE_PROJECT || 'economics-monopoly';
const token = (process.platform === 'win32'
  ? execFileSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true })
  : execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' })).trim();
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
async function get(suffix) {
  const response = await fetch(base + suffix, { headers: { Authorization: 'Bearer ' + token, 'x-goog-user-project': project } });
  const result = await response.json();
  if (!response.ok) throw Error('Shared incident migration could not read the source: ' + response.status);
  return result;
}
const catalog = documentValue(await get('/school_mis_incidents_v1_config/catalog'));
catalog.people = JSON.parse(catalog.peopleJSON);
const roles = documentValue(await get('/school_mis_incidents_v1_config/roles'));
const store = memoryStore(catalog, roles), rows = [];
let pageToken;
do {
  const result = await get('/school_mis_incidents_v1_records?' + new URLSearchParams({ pageSize: '300', ...(pageToken ? { pageToken } : {}) }));
  for (const document of result.documents || []) rows.push(expandRecord(documentValue(document), store));
  pageToken = result.nextPageToken;
} while (pageToken);
const filename = path.resolve(target), directory = JSON.parse(await fs.readFile(filename));
const records = new Map((directory.incidentLedger?.records || []).map(row => [row.id, row]));
for (const row of rows) if (!records.has(row.id)) records.set(row.id, row);
directory.incidentLedger = { version: 1, records: [...records.values()], spreadsheetCSV: incidentCSV([...records.values()]) };
directory.incidentRoles ||= roles;
await fs.writeFile(filename, JSON.stringify(directory));
console.log('Preserved ' + rows.length + ' existing shared incidents and recipient assignments in ' + filename);
