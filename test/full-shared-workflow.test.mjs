import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server.mjs';
import { roster } from '../dist/model.mjs';

function memoryBackend() {
  const data = new Map(); let revision = 0;
  return { data,
    async load(name) { return data.has(name) ? structuredClone(data.get(name)) : null; },
    async save(name, state, previous) {
      if (data.get(name)?.generation !== previous?.generation) throw Object.assign(Error('Conflict'), { status: 409 });
      const value = { state: structuredClone(state), generation: String(++revision), etag: String(revision) };
      data.set(name, value); return structuredClone(value);
    },
  };
}
async function start(backend) {
  const server = createAppServer({ attendanceFile: null, gradesFile: null, messagesFile: null, reportsFile: null, directoryFile: null, classroomFile: null, credentialsFile: null, cloudBackend: backend, basePath: '/wist-mis-testing', cookieName: '__session' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  assert.equal((await fetch(origin + '/healthz')).status, 200);
  return { server, origin, async close() { await new Promise(resolve => server.close(resolve)); } };
}
async function request(server, path, cookie, body, method = body ? 'POST' : 'GET', expected = 200) {
  const response = await fetch(server.origin + '/wist-mis-testing/api/' + path, { method, headers: { cookie: cookie || '', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const value = await response.json();
  assert.equal(response.status, expected, path + ': ' + JSON.stringify(value));
  return { value, response };
}
async function login(server, username, password = 'WistTest2026!') {
  const result = await request(server, 'login', null, { username, password });
  const cookie = result.response.headers.get('set-cookie').split(';')[0];
  assert(cookie.startsWith('__session=')); return cookie;
}

test('independent server/browser sessions share attendance, marks, student hand-in, feedback, files and optional MIS transfer', async () => {
  const backend = memoryBackend();
  let first = await start(backend), second = await start(backend);
  try {
    const teacher = await login(first, 'noah.morgan');
    const student = await login(second, '100837', 'WistLearn2026!');
    const peer = await login(second, '100838', 'WistLearn2026!');
    const register = { date: '2026-11-10', classId: 'computing9a', period: '4', expectedRevision: 0, records: roster('computing9a').map((s, i) => ({ studentId: s.id, status: i ? 'Present' : 'Late (Excused)', time: i ? '' : '11:09', note: '' })) };
    await request(first, 'attendance/register', teacher, register, 'PUT');
    const saved = (await request(second, 'attendance/context?date=2026-11-10&classId=computing9a&period=4', teacher)).value;
    assert.equal(saved.saved.records[0].time, '11:09');
    await request(second, 'attendance/register', teacher, register, 'PUT', 409);
    const assessment = (await request(first, 'grades/assessment', teacher, { classId: 'computing9a', title: 'Shared assessment', date: '2026-11-10', maximum: 20, marks: { 's-9a-1': 17 }, expectedRevision: 0 }, 'PUT')).value.assessment;
    const book = (await request(second, 'grades/class?classId=computing9a', teacher)).value;
    assert(book.assessments.some(a => a.id === assessment.id && a.marks['s-9a-1'] === 17));
    const task = (await request(first, 'classroom/create', teacher, { classId: 'computing9a', title: 'Shared hand-in', maximum: 20, description: 'Explain an algorithm.', status: 'published' })).value.result;
    const room = (await request(second, 'classroom/room?id=computing9a', student)).value;
    assert(room.assignments.some(a => a.id === task.id));
    await request(second, 'classroom/submit', student, { id: task.id, answer: 'My answer from another computer.', files: [{ name: 'answer.txt', data: Buffer.from('My work').toString('base64') }], expectedRevision: 0 });
    let detail = (await request(first, 'classroom/assignment?id=' + task.id, teacher)).value;
    assert.equal(detail.students.find(s => s.id === 's-9a-1').submission.files[0].name, 'answer.txt');
    const privateView = (await request(first, 'classroom/assignment?id=' + task.id, peer)).value;
    assert(privateView.students.every(s => s.id === 's-9a-2' && s.submission === null));
    await request(first, 'classroom/grade', teacher, { id: task.id, studentId: 's-9a-1', mark: 18, feedback: 'Well explained.', expectedRevision: 1 });
    detail = (await request(second, 'classroom/assignment?id=' + task.id, student)).value;
    assert.equal(detail.students[0].submission.mark, 18);
    let preview = (await request(first, 'classroom/mis-preview?id=' + task.id, teacher)).value;
    await request(first, 'classroom/transfer', teacher, { id: task.id, expectedGradeRevision: preview.expectedGradeRevision, students: preview.rows.map(r => ({ studentId: r.studentId, submissionRevision: r.submissionRevision })) });
    assert(Object.values(backend.data.get('grades.json').state.assessments).some(a => a.marks['s-9a-1'] === 18));
    await request(second, 'grades/class?classId=computing9a', student, null, 'GET', 403);
    // A cold restart must retain the session, records, work and feedback.
    await first.close(); first = await start(backend);
    await request(first, 'session', teacher);
    detail = (await request(first, 'classroom/assignment?id=' + task.id, student)).value;
    assert.equal(detail.students[0].submission.feedback, 'Well explained.');
    await request(first, 'logout', student, {});
    await request(second, 'session', student, null, 'GET', 401);
    const serialized = JSON.stringify(backend.data.get('sessions.json').state);
    assert(!serialized.includes(teacher.split('=')[1]));
    assert.equal((await fetch(first.origin + '/api/session')).status, 404);
    assert.equal((await fetch(first.origin + '/wist-mis-testing/.data/grades.json')).status, 404);
  } finally { await first.close(); await second.close(); }
});
