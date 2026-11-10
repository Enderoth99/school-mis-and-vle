// Serial autosave with retained drafts, optimistic revisions and retry-safe operation IDs.
export function createSharedPlanningClient({ request, changed = () => {}, saved = () => {}, uuid = () => crypto.randomUUID() }) {
  let revision = null, metadata = null, pending = null, retryOperation = null, active = null, saving = false, error = '', conflict = false, remoteChanged = false;
  const status = () => ({ revision, metadata, saving, dirty: Boolean(pending || retryOperation || active), error, conflict, remoteChanged });
  const emit = () => changed(status());
  async function load() {
    if (saving) throw Error('Wait for the current save before reloading.');
    const data = await request(false);
    revision = data.revision; metadata = data; pending = null; retryOperation = null; active = null;
    error = ''; conflict = false; remoteChanged = false; emit(); return data;
  }
  async function flush() {
    if (saving || conflict || remoteChanged || error || (!pending && !retryOperation) || revision === null) return;
    saving = true; error = ''; emit();
    while ((pending || retryOperation) && !conflict) {
      if(retryOperation){active=retryOperation;retryOperation=null;}else{active=pending;pending=null;}
      try {
        const result = await request(true, { project: active.project, expectedRevision: active.baseRevision, operationId: active.operationId });
        revision = result.revision; metadata = result;
        const completed = active; active = null;
        if (pending) pending.baseRevision = revision;
        else saved(result, completed.message);
        emit();
      } catch (failure) {
        // Keep the actual in-flight operation for idempotent retry after an uncertain response.
        // More recent edits remain queued separately and are sent only after it is confirmed.
        error = failure.message || 'The shared draft could not be saved.';
        conflict = failure.status === 409;
        retryOperation = active;
        active = null; break;
      }
    }
    saving = false; emit();
  }
  function save(project, message) {
    if (revision === null) throw Error('Load the shared timetable draft first.');
    pending = { project: structuredClone(project), message, operationId: uuid(), baseRevision: revision };
    emit(); void flush();
  }
  async function retry() {if(conflict||remoteChanged)return;error='';await flush();}
  async function check() {
    if (revision === null || saving || pending || retryOperation) return;
    try { const data = await request(false, null, true); if (data.revision > revision) { remoteChanged = true; metadata = data; emit(); } } catch { /* A failed check must never discard a working draft. */ }
  }
  return { load, save, retry, check, status };
}
