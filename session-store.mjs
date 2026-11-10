import { AttendanceStore } from './attendance-store.mjs';
import { createHash } from 'node:crypto';

// Only token digests are persisted; the browser holds the random bearer token.
export const sessionDigest = token => createHash('sha256').update(token).digest('hex');
export class SessionStore extends AttendanceStore {
  constructor() { super(null); this.state = { version: 1, sessions: {}, lastLogins: {} }; }
  get(token) { return token ? this.state.sessions[sessionDigest(token)] : undefined; }
  lastLogin(id) { return this.state.lastLogins[id] || null; }
  async put(token, session) {
    return this.transact(next => {
      const now = Date.now();
      for (const [key, value] of Object.entries(next.sessions)) if (value.expires <= now) delete next.sessions[key];
      next.sessions[sessionDigest(token)] = session;
      next.lastLogins[session.teacherId] = new Date(now).toISOString();
    });
  }
  async remove(token) { if (token) await this.transact(next => { delete next.sessions[sessionDigest(token)]; }); }
}
