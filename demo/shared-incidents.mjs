import { fields, encode, documentValue } from './firestore-values.mjs';
import { memoryStore, compactRecord, expandRecord, profileScopes } from './shared-incident-model.mjs';

const AUTH_KEY = 'school-mis-shared-incident-session-v1';
const failure = (status, message) => Object.assign(Error(message), { status });
const staff = actor => actor && !['student', 'parent', 'technician'].includes(actor.role);

export function createSharedIncidents({ config, fetcher, localFetch, storage = sessionStorage }) {
  const base = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
  const prefix = 'school_mis_incidents_v1';
  let refreshing;
  const readSession = () => { try { return JSON.parse(storage.getItem(AUTH_KEY)); } catch { return null; } };
  const persist = value => storage.setItem(AUTH_KEY, JSON.stringify(value));
  async function authCall(operation, body) {
    const response = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:${operation}?key=${config.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
    const value = await response.json();
    if (!response.ok) throw failure(response.status === 400 ? 401 : 503, 'Shared staff sign-in failed. Check your school login or try again.');
    return value;
  }
  async function token() {
    const session = readSession();
    if (!session) throw failure(401, 'Sign out and sign in again to use shared incidents.');
    if (session.expires > Date.now() + 60000) return session.idToken;
    refreshing ||= (async () => {
      const response = await fetcher(`https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }), signal: AbortSignal.timeout(20000) });
      const value = await response.json();
      if (!response.ok) { storage.removeItem(AUTH_KEY); throw failure(401, 'Your shared session expired. Sign in again.'); }
      persist({ ...session, idToken: value.id_token, refreshToken: value.refresh_token, expires: Date.now() + Number(value.expires_in) * 1000 });
      return value.id_token;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function request(path, options = {}) {
    const response = await fetcher(base + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token(), ...options.headers }, cache: 'no-store', signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (!response.ok) {
      const status = response.status;
      throw failure(status === 409 || status === 412 ? 409 : status, status === 409 || status === 412 ? 'This record changed elsewhere. Reload before saving; your draft is still open.' : status === 403 ? 'Your account does not have permission to access these incident records.' : status === 404 ? 'Shared incident setup is incomplete. Contact the administrator.' : 'Shared incidents are unavailable. No change has been saved.');
    }
    return result;
  }
  const get = path => request('/' + path);
  async function context() {
    const session = readSession();
    if (!session) throw failure(401, 'Sign out and sign in again to use shared incidents.');
    const [profileDoc, catalogDoc, rolesDoc] = await Promise.all([get(`${prefix}_staff/${session.uid}`), get(`${prefix}_config/catalog`), get(`${prefix}_config/roles`)]);
    const profile = documentValue(profileDoc), catalog = documentValue(catalogDoc), roles = documentValue(rolesDoc);
    catalog.people = JSON.parse(catalog.peopleJSON);
    if (!profile.active) throw failure(403, 'This staff account is inactive.');
    return { profile, catalog, roles, rolesDoc, store: memoryStore(catalog, roles), actor: { id: profile.id, name: profile.name, role: profile.role } };
  }
  async function loadRecords(ctx) {
    const clauses = ctx.actor.role === 'report-reviewer' ? [null] : [
      { fieldFilter: { field: { fieldPath: 'teacherId' }, op: 'EQUAL', value: encode(ctx.actor.id) } },
      ...Array.from({ length: Math.ceil(ctx.profile.studentIds.length / 30) }, (_, i) => ({ fieldFilter: { field: { fieldPath: 'studentIds' }, op: 'ARRAY_CONTAINS_ANY', value: encode(ctx.profile.studentIds.slice(i * 30, i * 30 + 30)) } })),
    ];
    const rows = new Map();
    // Sequential queries avoid a burst when a year head has several form groups.
    for (const clause of clauses) {
      const values = await request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: prefix + '_records' }], ...(clause ? { where: clause } : {}) } }) });
      for (const value of values) if (value.document) { const record = documentValue(value.document); rows.set(record.id, expandRecord(record, ctx.store)); }
    }
    ctx.store.directory.state.incidentLedger.records = [...rows.values()];
  }
  async function save(ctx, input, legacy) {
    const record = await ctx.store.save(ctx.actor, input, legacy), payload = compactRecord(record);
    const name = `${prefix}_records/${record.id}`;
    const findExisting = async () => {
      const rows = await request(':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: { from: [{ collectionId: prefix + '_records' }], where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'teacherId' }, op: 'EQUAL', value: encode(ctx.actor.id) } },
        { fieldFilter: { field: { fieldPath: 'id' }, op: 'EQUAL', value: encode(record.id) } },
      ] } } } }) });
      return rows.find(row => row.document)?.document;
    };
    const sameRecord = document => {
      const existing = documentValue(document);
      if (JSON.stringify(compactRecord(expandRecord(existing, ctx.store))) !== JSON.stringify(payload)) throw failure(409, 'This request ID has already been saved with different details.');
      return expandRecord(existing, ctx.store);
    };
    const previous = await findExisting();
    if (previous) return sameRecord(previous);
    try {
      await request(':commit', { method: 'POST', body: JSON.stringify({ writes: [{ update: { name: base.slice('https://firestore.googleapis.com/v1/'.length) + '/' + name, fields: fields(payload) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: 'savedAt', setToServerValue: 'REQUEST_TIME' }] }] }) });
    } catch (error) {
      if (![403, 409].includes(error.status)) throw error;
      const existing = await findExisting();
      if (!existing) throw error;
      return sameRecord(existing);
    }
    return expandRecord(documentValue(await get(name)), ctx.store);
  }
  async function saveRecipients(ctx, input) {
    const result = await ctx.store.saveRecipients(ctx.actor, input);
    const roles = ctx.store.roles(), resource = base.slice('https://firestore.googleapis.com/v1/'.length);
    const writes = [{ update: { name: resource + `/${prefix}_config/roles`, fields: fields(roles) }, currentDocument: { updateTime: ctx.rolesDoc.updateTime } }];
    for (const person of ctx.catalog.staff) writes.push({ update: { name: resource + `/${prefix}_staff/${person.id}`, fields: fields({ studentIds: profileScopes(ctx.store, person) }) }, updateMask: { fieldPaths: ['studentIds'] }, currentDocument: { exists: true } });
    await request(':commit', { method: 'POST', body: JSON.stringify({ writes }) });
    return result;
  }
  async function incidentResponse(path, method, body) {
    const ctx = await context(), operation = path.pathname.split('/').pop();
    if (method === 'POST') {
      if (operation === 'migrate-browser') {
        const response = await localFetch('/api/incidents/backup');
        if (!response.ok) throw failure(503, 'Earlier browser records could not be loaded.');
        const backup = await response.json();
        let imported = 0;
        for (const record of backup.records.filter(row => row.teacherId === ctx.actor.id)) {
          await save(ctx, { ...record, phase: record.pupil.phase, year: record.pupil.year, groupId: record.pupil.groupId, involvedIds: record.involved.map(p => p.id) }, false);
          imported++;
        }
        return Response.json({ imported });
      }
      if (operation === 'save' || operation === 'import') return Response.json(await save(ctx, JSON.parse(body), operation === 'import'));
      if (operation === 'recipients') return Response.json(await saveRecipients(ctx, JSON.parse(body)));
      throw failure(405, 'Unsupported incident operation.');
    }
    if (method !== 'GET') throw failure(405, 'Unsupported incident operation.');
    if (operation === 'catalog') return Response.json({ ...ctx.store.catalog(ctx.actor), shared: true });
    if (operation === 'recipients') return Response.json(ctx.store.recipients(ctx.actor));
    await loadRecords(ctx);
    if (operation === 'records') return Response.json({ ...ctx.store.list(ctx.actor, Object.fromEntries(path.searchParams)), shared: true });
    if (operation === 'backup') return Response.json({ shared: true, records: ctx.store.directory.state.incidentLedger.records, ...(ctx.actor.role === 'report-reviewer' ? { roles: ctx.roles } : {}) });
    if (operation === 'spreadsheet') return new Response(ctx.store.spreadsheet(ctx.actor), { headers: { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="incidents-and-rewards.csv"' } });
    throw failure(404, 'Incident operation not found.');
  }
  return async function sharedFetch(input, init = {}) {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      const path = new URL('https://portal.invalid' + url.pathname.replace(/^\/[^/]+\/api\//, '/api/') + url.search);
      const method = (init.method || input.method || 'GET').toUpperCase();
      const body = init.body ?? (typeof input !== 'string' && input instanceof Request ? await input.clone().text() : '');
      if (path.pathname === '/api/logout') { storage.removeItem(AUTH_KEY); return localFetch(input, init); }
      if (path.pathname === '/api/login' && method === 'POST') {
        storage.removeItem(AUTH_KEY);
        const local = await localFetch(input, init), result = await local.clone().json();
        if (!local.ok || !staff(result.teacher)) return local;
        try {
          const credentials = JSON.parse(body);
          const value = await authCall('signInWithPassword', { email: result.teacher.username.toLowerCase() + '@school-mis.invalid', password: credentials.password, returnSecureToken: true });
          if (value.localId !== result.teacher.id) throw failure(403, 'The shared staff identity does not match this account.');
          persist({ uid: value.localId, idToken: value.idToken, refreshToken: value.refreshToken, expires: Date.now() + Number(value.expiresIn) * 1000 });
        } catch (error) { await localFetch('/api/logout'); throw error; }
        return local;
      }
      if (path.pathname === '/api/session') {
        const response = await localFetch(input, init), value = await response.clone().json();
        if (response.ok && staff(value.teacher) && readSession()?.uid !== value.teacher.id) return Response.json({ error: 'Sign in again to connect shared incidents.' }, { status: 401 });
        return response;
      }
      if (path.pathname.startsWith('/api/incidents/')) return await incidentResponse(path, method, body);
      return localFetch(input, init);
    } catch (error) { return Response.json({ error: error.message || 'Shared incidents could not be reached. No change was saved.' }, { status: error.status || 503 }); }
  };
}
