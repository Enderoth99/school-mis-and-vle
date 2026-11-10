import { IncidentStore } from '../incidents-store.mjs';

export function memoryStore(catalog, roles, records = []) {
  const directory = {
    state: { people: catalog.people, incidentRoles: roles, incidentLedger: { version: 1, records } },
    async transact(fn) { const next = structuredClone(this.state); const result = fn(next); this.state = next; return result; },
  };
  const store = new IncidentStore({ directory });
  if (catalog.defaultTutors) store.responsibilities = actor => {
    const roles = store.roles();
    const tutors = { ...catalog.defaultTutors, ...roles.tutors };
    return { groupIds: Object.entries(tutors).filter(([, id]) => id === actor.id).map(([group]) => group), years: Object.entries(roles.heads).filter(([, id]) => id === actor.id).map(([year]) => year) };
  };
  if (catalog.defaultTutors) {
    const original = store.recipients.bind(store);
    store.recipients = actor => ({ ...original(actor), defaultTutors: catalog.defaultTutors });
  }
  return store;
}

export function compactRecord(record) {
  const involvedIds = record.involved.map(p => p.id);
  return {
    id: record.id, studentId: record.studentId, involvedIds,
    studentIds: [record.studentId, ...involvedIds], level: record.level,
    title: record.title, description: record.description, location: record.location,
    followup: record.followup, date: record.date, time: record.time,
    teacherId: record.teacherId,
  };
}

export function expandRecord(row, store) {
  const pupils = new Map(store.pupils().map(p => [p.id, p]));
  return {
    ...row, pupil: pupils.get(row.studentId), involved: row.involvedIds.map(id => pupils.get(id)),
    reportedBy: store.directory.state.people[row.teacherId]?.name || 'School staff',
  };
}

export function profileScopes(store, staff) {
  const { groupIds, years } = store.responsibilities(staff);
  return store.pupils().filter(p => groupIds.includes(p.groupId) || years.includes(String(p.year))).map(p => p.id);
}
