import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { IncidentStore } from '../incidents-store.mjs';
import { DirectoryStore } from '../directory-store.mjs';
import { AdminRegistry } from '../admin-registry.mjs';
import { StudentCredentials } from '../student-credentials.mjs';
import { teacherByUsername, formTutors } from '../dist/teaching-data.mjs';
import { REPORT_REVIEWER as admin } from '../dist/report-config.mjs';
import { incidentLevels, incidentPhase, incidentYears } from '../dist/incident-model.mjs';
import { createAppServer } from '../server.mjs';

async function setup(filename = null) {
  const directory = new DirectoryStore(filename);
  const credentials = new StudentCredentials(null);
  await Promise.all([directory.ready, credentials.ready]);
  const registry = new AdminRegistry(directory, credentials);
  return { directory, registry, store: new IncidentStore(registry), reporter: teacherByUsername('noah.morgan') };
}

function input(pupil, changes = {}) {
  return { id: 'incident-' + crypto.randomUUID(), phase: pupil.phase, year: String(pupil.year), groupId: pupil.groupId, studentId: pupil.id, level: 'C2', title: 'Disruption during group work', date: '2026-11-10', time: '10:35', location: 'Room 201', description: 'Fictional test incident with a follow-up.', followup: 'Tutor discussion', involvedIds: [], ...changes };
}

test('four-step picker supports both phases, early years and all current school pupils', async () => {
  const { store, reporter } = await setup();
  const catalog = store.catalog(reporter);
  assert.equal(catalog.pupils.length, 1000);
  assert.deepEqual(catalog.levels, ['C1', 'C2', 'C3', 'R1', 'R2', 'R3']);
  assert.equal(incidentPhase('FS1'), 'Primary');
  assert.equal(incidentPhase('7'), 'Secondary');
  assert.deepEqual(incidentYears(catalog.pupils, 'Primary').map(([year]) => year), ['FS1', 'FS2', '1', '2', '3', '4', '5', '6']);
  assert.deepEqual(incidentYears(catalog.pupils, 'Secondary').map(([year]) => year), ['7', '8', '9', '10', '11', '12', '13']);
});

test('each incident/reward level saves a spreadsheet row and stable student references', async () => {
  const { store, reporter, directory } = await setup();
  const [primary] = store.pupils();
  for (const level of incidentLevels) await store.save(reporter, input(primary, { level }));
  const rows = store.list(reporter);
  assert.equal(rows.total, 6);
  assert.ok(rows.records.every(row => row.pupil.id === primary.id && row.pupil.studentNumber));
  assert.equal(directory.state.incidentLedger.records.length, 6);
  assert.ok(directory.state.incidentLedger.spreadsheetCSV.includes('Reward'));
  assert.ok(directory.state.incidentLedger.spreadsheetCSV.includes('Incident'));
});

test('tutor and Head of Year visibility includes other involved students, with ownership and role boundaries', async () => {
  const { store, reporter } = await setup();
  const pupils = store.pupils();
  const main = pupils.find(p => p.groupId === 'fs1a');
  const involved = pupils.find(p => p.groupId === '7a');
  const primaryTutorId = formTutors.find(t => t.groupId === main.groupId).teacherId;
  const involvedTutorId = formTutors.find(t => t.groupId === involved.groupId).teacherId;
  const head = teacherByUsername('isla.freeman');
  const unrelated = teacherByUsername('eva.chapman');
  await store.saveRecipients(admin, { expectedRevision: 0, heads: { '7': head.id }, tutors: {} });
  await store.save(reporter, input(main, { involvedIds: [involved.id] }));
  for (const id of [primaryTutorId, involvedTutorId, head.id]) {
    assert.equal(store.list({ id }, { inbox: 'true' }).total, 1);
  }
  assert.equal(store.list(unrelated).total, 0);
  assert.equal(store.list(reporter).total, 1);
  assert.equal(store.list(admin).total, 1);
  assert.ok(!store.spreadsheet(unrelated).includes('Disruption'));
  assert.throws(() => store.list({ role: 'student' }), error => error.status === 403);
  assert.throws(() => store.list({ role: 'technician' }), error => error.status === 403);
});

test('recipient changes are administrator-only, revision-checked and use current staff', async () => {
  const { store, reporter } = await setup();
  await assert.rejects(store.saveRecipients(reporter, {}), error => error.status === 403);
  await store.saveRecipients(admin, { expectedRevision: 0, heads: { '9': reporter.id }, tutors: { 'fs1a': reporter.id } });
  assert.ok(store.responsibilities(reporter).groupIds.includes('fs1a'));
  assert.ok(store.responsibilities(reporter).years.includes('9'));
  await assert.rejects(store.saveRecipients(admin, { expectedRevision: 0, heads: {}, tutors: {} }), error => error.status === 409);
  await assert.rejects(store.saveRecipients(admin, { expectedRevision: 1, heads: { '99': reporter.id }, tutors: {} }), error => error.status === 400);
  await assert.rejects(store.saveRecipients(admin, { expectedRevision: 1, heads: { '7': 'tech-sam-turner' }, tutors: {} }), error => error.status === 400);
});

test('invalid phase/year/group/student combinations and involved students fail without partial writes', async () => {
  const { store, reporter, directory } = await setup();
  const pupil = store.pupils()[0];
  for (const invalid of [{ phase: 'Secondary' }, { year: '9' }, { groupId: '7a' }, { level: 'High' }, { date: '2026-02-30' }, { time: '25:00' }, { studentId: 'missing' }, { involvedIds: ['missing'] }, { involvedIds: [pupil.id] }, { description: '' }]) {
    await assert.rejects(store.save(reporter, input(pupil, invalid)), error => error.status === 400);
  }
  assert.equal(directory.state.incidentLedger?.records.length || 0, 0);
});

test('duplicate submissions are idempotent and changed payloads with the same ID fail', async () => {
  const { store, reporter } = await setup();
  const request = input(store.pupils()[0]);
  const [first, second] = await Promise.all([store.save(reporter, request), store.save(reporter, request)]);
  assert.equal(first.id, second.id);
  assert.equal(store.list(reporter).total, 1);
  await assert.rejects(store.save(reporter, { ...request, title: 'Different' }), error => error.status === 409);
});

test('spreadsheet content and routing survive a restart, with CSV formula injection neutralised', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'school-incidents-test-'));
  const filename = path.join(folder, 'directory.json');
  const { store, reporter } = await setup(filename);
  await store.save(reporter, input(store.pupils()[0], { title: '=HYPERLINK("x")', description: 'Two lines\nwith, commas' }));
  const reopened = await setup(filename);
  assert.equal(reopened.store.list(reporter).total, 1);
  const csv = reopened.store.spreadsheet(reporter);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(csv.includes('"Two lines\nwith, commas"'));
  assert.equal(csv, reopened.directory.state.incidentLedger.spreadsheetCSV);
});

test('legacy records migrate once, preserve historical content and cannot expose another reporter record', async () => {
  const { store, reporter } = await setup();
  const pupil = store.pupils()[0];
  const legacy = { ...input(pupil), id: 'legacy-incident-123', teacherId: reporter.id, reportedBy: reporter.name, severity: 'High' };
  const saved = await store.save(reporter, legacy, true);
  await store.save(reporter, legacy, true);
  assert.equal(saved.level, 'C3');
  assert.equal(store.list(reporter).total, 1);
  const other = teacherByUsername('eva.chapman');
  await assert.rejects(store.save(other, { ...legacy, teacherId: other.id }, true), error => error.status === 403);
});

test('HTTP staff submission, spreadsheet export and student access restrictions use normal session routes', async () => {
  const server = createAppServer({ attendanceFile: null, gradesFile: null, messagesFile: null, reportsFile: null, directoryFile: null, classroomFile: null, credentialsFile: null });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = (route, cookie = '', body) => fetch(base + route, { method: body ? 'POST' : 'GET', headers: { cookie, origin: base, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    const login = async (username, password) => {
      const response = await request('/api/login', '', { username, password });
      return response.headers.get('set-cookie').split(';')[0];
    };
    const teacher = await login('noah.morgan', 'WistTest2026!');
    const catalog = await (await request('/api/incidents/catalog', teacher)).json();
    const saved = await request('/api/incidents/save', teacher, input(catalog.pupils[0], { level: 'R2' }));
    assert.equal(saved.status, 200);
    const csv = await request('/api/incidents/spreadsheet', teacher);
    assert.equal(csv.headers.get('content-type'), 'text/csv;charset=utf-8');
    assert.ok((await csv.text()).includes('R2'));
    const student = await login('100895', 'WistLearn2026!');
    assert.equal((await request('/api/incidents/records', student)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
