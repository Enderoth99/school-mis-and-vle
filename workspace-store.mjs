import { seed, isDate } from './dist/model.mjs';
import { mergeTeacherState, scopedState } from './dist/teacher-scope.mjs';
import { sameOrigin } from './request-security.mjs';
const failure = (status, message) => Object.assign(Error(message), { status });
function staff(actor) {
  if (!actor || ['student', 'parent', 'technician'].includes(actor.role)) throw failure(403, 'Teacher access required.');
}
export class WorkspaceStore {
  constructor(directory) { this.directory = directory; }
  read(actor) {
    staff(actor);
    const state = this.directory.state.workspaceState || seed();
    return { state: scopedState(structuredClone(state), actor.id), revision: this.directory.state.workspaceRevisions?.[actor.id] || 0 };
  }
  async save(actor, { state, expectedRevision }, initialImport = false) {
    staff(actor);
    if (!state || ['assignments','lessons','events','incidents','reports','favorites','reportHistory'].some(key => !Array.isArray(state[key]) || state[key].length > 30000) || !state.attendance || !state.grades) throw failure(400, 'Invalid teacher workspace.');
    for (const row of [...state.assignments, ...state.lessons]) {
      if (typeof row.id !== 'string' || row.id.length > 120 || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 160) throw failure(400, 'Enter a valid lesson or assignment title.');
    }
    for (const row of state.assignments) if (!isDate(row.due) || !Number.isFinite(row.points) || row.points <= 0 || row.points > 10000) throw failure(400, 'Invalid assignment date or maximum mark.');
    for (const row of state.lessons) if (!isDate(row.date) || typeof row.objective !== 'string' || row.objective.length > 10000 || typeof row.taught !== 'boolean') throw failure(400, 'Invalid lesson plan.');
    for (const row of state.events) if (!isDate(row.date) || typeof row.title !== 'string' || !row.title.trim() || row.title.length > 160) throw failure(400, 'Invalid calendar event.');
    return this.directory.transact(next => {
      const revision = next.workspaceRevisions?.[actor.id] || 0;
      if (initialImport && revision > 0) return this.read(actor);
      if (!Number.isInteger(expectedRevision) || revision !== expectedRevision) throw failure(409, 'Your workspace changed on another computer. Reload before saving; your draft is still open.');
      const root = next.workspaceState || seed();
      try { next.workspaceState = mergeTeacherState(root, state, actor.id); }
      catch (error) { throw failure(403, error.message); }
      next.workspaceRevisions ||= {};
      next.workspaceRevisions[actor.id] = revision + 1;
      return { state: scopedState(structuredClone(next.workspaceState), actor.id), revision: revision + 1 };
    });
  }
}
export function createWorkspaceApi(directory, auth) {
  const store = new WorkspaceStore(directory);
  return async (req, res, url) => {
    if (!['/api/workspace', '/api/workspace/import'].includes(url.pathname)) return false;
    const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
    try {
      const actor = auth.sessionTeacher(req); staff(actor);
      if (req.method === 'GET' && url.pathname === '/api/workspace') send(200, store.read(actor));
      else if (['PUT','POST'].includes(req.method)) {
        if (!sameOrigin(req)) throw failure(403, 'Use the school portal.');
        let body = '';
        for await (const part of req) { body += part; if (body.length > 8000000) throw failure(413, 'Teacher workspace is too large.'); }
        send(200, await store.save(actor, JSON.parse(body), url.pathname.endsWith('/import')));
      } else throw failure(405, 'Unsupported workspace operation.');
    } catch (error) { send(error.status || 400, { error: error.message }); }
    return true;
  };
}
