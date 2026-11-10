import { AttendanceStore } from './attendance-store.mjs';
import { normalizeTimetableDraft } from './dist/timetable-draft-model.mjs';
import { validateTimetable } from './dist/timetable-engine.mjs';
import { createDemonstrationProject } from './dist/timetable-school-rules.mjs';
import { ACTIVE_PROJECT } from './dist/timetable-active-config.mjs';
import { sameOrigin } from './request-security.mjs';
import { createHash } from 'node:crypto';
const fail = (status, message) => Object.assign(Error(message), { status });
function staff(actor) { if (!actor || ['student','parent','technician'].includes(actor.role)) throw fail(403, 'Timetable planning is available to school staff only.'); }
export class PlanningStore extends AttendanceStore {
  constructor(filename = null) {
    super(null); this.filename = filename;
    this.state = { version: 1, revision: 0, project: structuredClone(ACTIVE_PROJECT || createDemonstrationProject()), history: [] };
    this.ready = this.read(); this.ready.catch(() => {});
  }
  async read() {
    if (!this.filename) return;
    const { readFile } = await import('node:fs/promises');
    try {
      const saved = JSON.parse(await readFile(this.filename, 'utf8'));
      if (saved.version !== 1 || !Number.isInteger(saved.revision) || !saved.project) throw Error('Invalid shared timetable draft store.');
      this.state = saved;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  readDraft(actor, meta = false) {
    staff(actor);
    const { revision, updatedAt = null, updatedBy = null, history } = this.state;
    return { revision, updatedAt, updatedBy, history: structuredClone(history || []), ...(!meta ? { project: structuredClone(this.state.project) } : {}) };
  }
  async saveDraft(actor, input) {
    staff(actor);
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0 || !/^[A-Za-z0-9_-]{8,100}$/.test(input.operationId || '')) throw fail(400, 'A valid draft revision and save identifier are required.');
    let project;
    try {
      project = normalizeTimetableDraft(structuredClone(input.project));
      const report = validateTimetable(project);
      const invalid = report.issues.find(issue => ['invalid-data','unknown-lesson'].includes(issue.kind));
      if (invalid) throw Error(invalid.message);
    } catch (error) { throw fail(400, error.message || 'Invalid timetable draft.'); }
    const hash = createHash('sha256').update(JSON.stringify(project)).digest('hex');
    return this.transact(next => {
      if (next.lastSave?.operationId === input.operationId) {
        if (next.lastSave.actorId !== actor.id || next.lastSave.hash !== hash) throw fail(409, 'This save identifier was already used for different changes.');
        return { revision: next.revision, updatedAt: next.updatedAt, updatedBy: next.updatedBy };
      }
      if (next.revision !== input.expectedRevision) throw fail(409, 'Another computer saved a newer timetable draft. Your changes are retained locally. Reload the shared draft before replacing it.');
      const updatedAt = new Date().toISOString(), updatedBy = { id: actor.id, name: actor.name };
      next.project = project; next.revision++;
      next.updatedAt = updatedAt; next.updatedBy = updatedBy;
      next.lastSave = { operationId: input.operationId, actorId: actor.id, hash };
      next.history ||= [];
      next.history.unshift({ revision: next.revision, updatedAt, updatedBy, name: String(project.name || '').slice(0,160) });
      next.history = next.history.slice(0,30);
      return { revision: next.revision, updatedAt, updatedBy };
    });
  }
}
export function createPlanningApi(store, auth) {
  return async (req, res, url) => {
    if (url.pathname !== '/api/planning/draft') return false;
    const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
    try {
      const actor = auth.sessionTeacher(req); staff(actor);
      await store.ready;
      if (req.method === 'GET') send(200, store.readDraft(actor, url.searchParams.get('meta') === '1'));
      else if (req.method === 'PUT') {
        if (!sameOrigin(req)) throw fail(403, 'Use the school portal to save a timetable draft.');
        const chunks = []; let size = 0;
        for await (const part of req) { const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part); size += bytes.length; if (size > 6000000) throw fail(413, 'Choose a timetable draft up to 6 MB.'); chunks.push(bytes); }
        send(200, await store.saveDraft(actor, JSON.parse(Buffer.concat(chunks).toString('utf8'))));
      } else throw fail(405, 'Unsupported draft operation.');
    } catch (error) { send(error.status || 400, { error: error.message }); }
    return true;
  };
}
