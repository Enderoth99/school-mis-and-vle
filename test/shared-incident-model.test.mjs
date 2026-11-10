import test from 'node:test';
import assert from 'node:assert/strict';
import { fields, documentValue } from '../demo/firestore-values.mjs';
import { memoryStore, compactRecord, expandRecord, profileScopes } from '../demo/shared-incident-model.mjs';
import { integratedSeed } from '../demo/integrated-seed.mjs';
import { readFile } from 'node:fs/promises';
import { teachers } from '../dist/teaching-data.mjs';
import { createSharedIncidents } from '../demo/shared-incidents.mjs';
const project = JSON.parse(await readFile(new URL('../dist/timetable-integrated.json', import.meta.url)));
const catalog = { people: integratedSeed(project)['directory.json'].people, staff: teachers };
const actor = teachers.find(t => t.username === 'noah.morgan');

test('Firestore values round-trip nested records, empty values and timestamps', () => {
  const data = { title: 'Reward', number: 24, percentage: 24.5, nothing: null, active: true, list: ['C1', false], map: {}, empty: [] };
  assert.deepEqual(documentValue({ fields: fields(data) }), data);
  assert.equal(documentValue({ fields: { savedAt: { timestampValue: '2026-11-10T10:00:00Z' } } }).savedAt, '2026-11-10T10:00:00Z');
});
test('remote records contain IDs and reconstruct current student and staff details', async () => {
  const store = memoryStore(catalog, { revision: 0, heads: {}, tutors: {} });
  const row = await store.save(actor, { id: 'shared-model-test-1', studentId: 's-9a-1', involvedIds: ['s-9a-2'], phase: 'Secondary', year: 9, groupId: '9a', level: 'R2', title: 'Teamwork', date: '2026-11-10', time: '10:00', location: 'Lab', description: 'Fictional teamwork reward.', followup: '' });
  const compact = compactRecord(row);
  assert.deepEqual(compact.studentIds, ['s-9a-1', 's-9a-2']);
  assert.equal(compact.pupil, undefined);
  const reconstructed = expandRecord({ ...compact, savedAt: row.savedAt }, store);
  assert.equal(reconstructed.pupil.name, 'Alex Ellis');
  assert.equal(reconstructed.involved[0].name, 'Jamie Hayes');
  assert.equal(reconstructed.reportedBy, actor.name);
});
test('shared access scopes include every student of assigned tutors and year heads', () => {
  const tutor = teachers.find(t => t.username === 'zara.campbell');
  const head = teachers.find(t => t.username === 'isla.freeman');
  const store = memoryStore(catalog, { revision: 1, tutors: {}, heads: { 9: head.id } });
  assert(profileScopes(store, tutor).includes('s-9a-1'));
  assert(profileScopes(store, head).includes('s-9d-1'));
  assert(!profileScopes(store, head).includes('s-8a-1'));
});
test('remote failure never falls back to saving an incident in browser-only storage', async () => {
  const originalLocation = globalThis.location;
  globalThis.location = { href: 'https://school.invalid/wist-mis-testing/' };
  try {
    let localCalls = 0;
    const adapter = createSharedIncidents({ config: { projectId: 'test', apiKey: 'test' }, fetcher: async () => { throw Error('network unavailable'); }, localFetch: async () => { localCalls++; return Response.json({}); }, storage: { getItem: () => null, setItem() {}, removeItem() {} } });
    const result = await adapter('/api/incidents/save', { method: 'POST', body: '{}' });
    assert.equal(result.status, 401);
    assert.equal(localCalls, 0);
  } finally { globalThis.location = originalLocation; }
});
