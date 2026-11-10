import { formTutors } from './dist/teaching-data.mjs';
import { incidentCSV, incidentLevels, incidentPhase } from './dist/incident-model.mjs';
import { sameOrigin } from './request-security.mjs';

const failure = (status, message) => Object.assign(Error(message), { status });
const isAdmin = actor => actor?.role === 'report-reviewer';
const text = (value, maximum) => String(value ?? '').trim().slice(0, maximum);

function requireStaff(actor) {
  if (!actor || ['student', 'parent', 'technician'].includes(actor.role)) {
    throw failure(403, 'School staff access is required.');
  }
}

export class IncidentStore {
  constructor(registry) {
    this.registry = registry;
    this.directory = registry.directory;
  }

  pupils() {
    return Object.values(this.directory.state.people)
      .filter(person => person.kind === 'student' && person.status === 'Active')
      .map(person => this.snapshot(person));
  }

  snapshot(person) {
    return {
      id: person.id, name: person.name, studentNumber: person.recordNumber,
      year: person.year, yearLabel: person.yearLabel || 'Year ' + person.year,
      groupId: person.cohort, groupName: person.groupName, phase: incidentPhase(person.year),
    };
  }

  roles(state = this.directory.state) {
    return state.incidentRoles || { revision: 0, heads: {}, tutors: {} };
  }

  responsibilities(actor) {
    const roles = this.roles();
    const groupIds = new Set(formTutors.filter(tutor => tutor.teacherId === actor.id).map(tutor => tutor.groupId));
    for (const [groupId, teacherId] of Object.entries(roles.tutors)) {
      groupIds.delete(groupId);
      if (teacherId === actor.id) groupIds.add(groupId);
    }
    return { groupIds: [...groupIds], years: Object.entries(roles.heads).filter(([, id]) => id === actor.id).map(([year]) => year) };
  }

  canRead(actor, record) {
    if (isAdmin(actor) || record.teacherId === actor.id) return true;
    const scope = this.responsibilities(actor);
    return [record.pupil, ...record.involved].some(pupil => {
      const current = this.directory.state.people[pupil.id];
      return scope.groupIds.includes(current?.cohort || pupil.groupId)
        || scope.years.includes(String(current?.year ?? pupil.year));
    });
  }

  catalog(actor) {
    requireStaff(actor);
    return { pupils: this.pupils(), levels: incidentLevels, admin: isAdmin(actor) };
  }

  list(actor, query = {}) {
    requireStaff(actor);
    let records = (this.directory.state.incidentLedger?.records || []).filter(record => this.canRead(actor, record));
    if (query.inbox === 'true') {
      const scope = this.responsibilities(actor);
      records = records.filter(record => [record.pupil, ...record.involved].some(pupil => {
        const current = this.directory.state.people[pupil.id];
        return scope.groupIds.includes(current?.cohort || pupil.groupId) || scope.years.includes(String(current?.year ?? pupil.year));
      }));
    }
    const search = text(query.q, 120).toLowerCase();
    if (search) records = records.filter(record => [record.title, record.pupil.name, record.pupil.groupName, record.level, ...record.involved.map(p => p.name)].join(' ').toLowerCase().includes(search));
    if (query.level) records = records.filter(record => record.level === query.level);
    records = records.slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id));
    const total = records.length;
    const requestedPage = Number(query.page || 1);
    const page = Math.min(Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage : 1), Math.max(1, Math.ceil(total / 20)));
    return { records: structuredClone(records.slice((page - 1) * 20, page * 20)), total, page, pages: Math.max(1, Math.ceil(total / 20)), responsibilities: this.responsibilities(actor) };
  }

  spreadsheet(actor) {
    requireStaff(actor);
    return incidentCSV((this.directory.state.incidentLedger?.records || []).filter(record => this.canRead(actor, record)));
  }

  async save(actor, input, legacy = false) {
    requireStaff(actor);
    const id = text(input.id, 100);
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id)) throw failure(400, 'A valid request ID is required.');
    const level = legacy ? ({ Low: 'C1', Moderate: 'C2', High: 'C3' }[input.severity] || 'C1') : input.level;
    if (!incidentLevels.includes(level)) throw failure(400, 'Choose C1, C2, C3, R1, R2 or R3.');
    const date = text(input.date, 10), time = text(input.time, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T12:00Z')) || new Date(date + 'T12:00Z').toISOString().slice(0, 10) !== date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw failure(400, 'Enter a valid date and time.');
    const title = text(input.title, 120), description = text(input.description, 3000), location = text(input.location, 100), followup = text(input.followup, 2000);
    if (!title || !description || !location) throw failure(400, 'Enter the incident, location and details.');
    const involvedIds = input.involvedIds || [];
    if (!Array.isArray(involvedIds) || involvedIds.length > 100 || new Set(involvedIds).size !== involvedIds.length || involvedIds.includes(input.studentId)) throw failure(400, 'Choose distinct involved students, excluding the main student.');
    if (legacy && !isAdmin(actor) && input.teacherId !== actor.id) throw failure(403, 'Import only your own previous incident records.');
    return this.directory.transact(next => {
      const people = [input.studentId, ...involvedIds].map(studentId => next.people[studentId]);
      if (people.some(person => !person || person.kind !== 'student' || !legacy && person.status !== 'Active')) throw failure(400, 'Choose students from the current student list.');
      const pupil = this.snapshot(people[0]);
      if (!legacy && (input.phase !== pupil.phase || String(input.year) !== String(pupil.year) || input.groupId !== pupil.groupId)) throw failure(400, 'Choose a phase, year, tutor group and a student belonging to that group.');
      const record = { id, studentId: pupil.id, pupil, involved: people.slice(1).map(person => this.snapshot(person)), level, title, description, location, followup, date, time, teacherId: legacy ? input.teacherId || actor.id : actor.id, reportedBy: legacy ? text(input.reportedBy, 150) || actor.name : actor.name };
      next.incidentLedger ||= { version: 1, records: [] };
      const existing = next.incidentLedger.records.find(row => row.id === id);
      if (existing) {
        if (!isAdmin(actor) && existing.teacherId !== actor.id) throw failure(403, 'This saved incident belongs to another staff member.');
        const payload = ({ savedAt, ...row }) => row;
        if (legacy || JSON.stringify(payload(existing)) === JSON.stringify(record)) return structuredClone(existing);
        throw failure(409, 'This request ID has already been saved with different details.');
      }
      record.savedAt = new Date().toISOString();
      next.incidentLedger.records.push(record);
      next.incidentLedger.spreadsheetCSV = incidentCSV(next.incidentLedger.records);
      return structuredClone(record);
    });
  }

  recipients(actor) {
    requireStaff(actor);
    if (!isAdmin(actor)) throw failure(403, 'Administrator access is required.');
    const pupils = this.pupils();
    const groups = [...new Map(pupils.map(p => [p.groupId, { id: p.groupId, name: p.groupName, year: p.year }])).values()];
    const roles = this.roles();
    return { ...structuredClone(roles), groups, defaultTutors: Object.fromEntries(formTutors.map(t => [t.groupId, t.teacherId])), staff: Object.values(this.directory.state.people).filter(p => p.kind === 'staff' && p.status === 'Active' && p.accountEnabled !== false && !p.supportTechnician).map(p => ({ id: p.id, name: p.name })) };
  }

  async saveRecipients(actor, input) {
    this.recipients(actor);
    return this.directory.transact(next => {
      const roles = this.roles(next);
      if (input.expectedRevision !== roles.revision) throw failure(409, 'Recipient assignments changed. Reload before saving.');
      const catalog = this.recipients(actor), years = new Set(catalog.groups.map(g => String(g.year))), groupIds = new Set(catalog.groups.map(g => g.id)), staffIds = new Set(catalog.staff.map(t => t.id));
      for (const [map, allowed] of [[input.heads, years], [input.tutors, groupIds]]) {
        if (!map || typeof map !== 'object' || Array.isArray(map) || Object.entries(map).some(([key, value]) => !allowed.has(key) || value !== '' && !staffIds.has(value))) throw failure(400, 'Choose current staff and valid year or tutor groups.');
      }
      next.incidentRoles = { revision: roles.revision + 1, heads: { ...input.heads }, tutors: { ...input.tutors }, updatedAt: new Date().toISOString(), updatedBy: actor.id };
      return { revision: next.incidentRoles.revision };
    });
  }
}

export function createIncidentsApi(registry, auth) {
  const store = new IncidentStore(registry);
  return async (req, res, url) => {
    if (!url.pathname.startsWith('/api/incidents/')) return false;
    const send = (status, data) => res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end(JSON.stringify(data));
    try {
      const actor = auth.sessionTeacher(req);
      requireStaff(actor);
      const operation = url.pathname.split('/').pop();
      if (req.method === 'GET') {
        if (operation === 'spreadsheet') res.writeHead(200, { 'Content-Type': 'text/csv;charset=utf-8', 'Content-Disposition': 'attachment; filename="incidents-and-rewards.csv"', 'Cache-Control': 'no-store' }).end(store.spreadsheet(actor));
        else if (operation === 'catalog') send(200, store.catalog(actor));
        else if (operation === 'backup') send(200, {
          records: structuredClone((registry.directory.state.incidentLedger?.records || []).filter(record => store.canRead(actor, record))),
          ...(isAdmin(actor) ? { roles: structuredClone(store.roles()) } : {}),
        });
        else if (operation === 'records') send(200, store.list(actor, Object.fromEntries(url.searchParams)));
        else if (operation === 'recipients') send(200, store.recipients(actor));
        else throw failure(404, 'Incident operation not found.');
      } else if (req.method === 'POST' && ['save', 'import', 'recipients'].includes(operation)) {
        if (!sameOrigin(req)) throw failure(403, 'Use the school portal.');
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 100000) throw failure(413, 'Incident request is too large.'); }
        const input = JSON.parse(body);
        send(200, operation === 'recipients' ? await store.saveRecipients(actor, input) : await store.save(actor, input, operation === 'import'));
      } else throw failure(405, 'Unsupported incident operation.');
    } catch (error) { send(error.status || 400, { error: error.message }); }
    return true;
  };
}
