import { incidentLevels, incidentPhase, incidentYears } from './incident-model.mjs';

export function createIncidentsUI({ e, actor, toast, render }) {
  let sequence = 0;
  let records = [];

  async function api(operation, body) {
    const response = await fetch('/api/incidents/' + operation, {
      credentials: 'same-origin', cache: 'no-store',
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      const result = await response.json();
      throw Error(result.error || 'The incident record could not be saved.');
    }
    return operation === 'spreadsheet' ? response.text() : response.json();
  }

  const options = (rows, selected = '') => rows.map(([value, label]) => '<option value="' + e(value) + '" ' + (String(value) === String(selected) ? 'selected' : '') + '>' + e(label) + '</option>').join('');
  const levelBadge = level => '<span class="badge ' + (level.startsWith('R') ? 'present' : level === 'C3' ? 'absent' : 'pending') + '">' + e(level) + '</span>';

  function page(params = new URLSearchParams()) {
    const token = ++sequence;
    queueMicrotask(async () => {
      try {
        const data = await api('records?' + params);
        const root = document.querySelector('#incidents-content');
        if (token !== sequence || !root) return;
        records = data.records;
        root.innerHTML = '<form class="support-toolbar" data-incident-search><label>Search<input name="q" value="' + e(params.get('q') || '') + '" placeholder="Student, tutor group or incident"></label><label>Level<select name="level"><option value="">All levels</option>' + options(incidentLevels.map(level => [level, level]), params.get('level')) + '</select></label><button class="btn">Search</button><span>' + data.total + ' saved records</span></form>' + table(data.records) + '<div class="actions">' + (data.page > 1 ? '<a class="btn" href="#/incidents?' + new URLSearchParams({ q: params.get('q') || '', level: params.get('level') || '', page: data.page - 1 }) + '">Previous</a>' : '') + '<span>Page ' + data.page + ' / ' + data.pages + '</span>' + (data.page < data.pages ? '<a class="btn" href="#/incidents?' + new URLSearchParams({ q: params.get('q') || '', level: params.get('level') || '', page: data.page + 1 }) + '">Next</a>' : '') + '</div>';
        root.querySelector('[data-incident-search]').onsubmit = event => {
          event.preventDefault();
          location.hash = '/incidents?' + new URLSearchParams(new FormData(event.currentTarget));
        };
        if (data.shared) {
          const note = document.createElement('p');
          note.className = 'vle-note';
          note.innerHTML = 'Shared across computers. <button class="btn small" data-incident-migrate>Import my earlier browser records</button>';
          root.prepend(note);
        }
        bindDetails(root, data.records);
      } catch (error) {
        const root = document.querySelector('#incidents-content');
        if (root && token === sequence) root.textContent = error.message;
      }
    });
    return '<section class="vle"><div class="learning-section-title"><h1>Incidents & rewards</h1><div class="actions"><button class="btn primary" data-incident-new>Record an incident / reward</button><button class="btn" data-incident-export>Download spreadsheet</button>' + (actor()?.role === 'report-reviewer' ? '<button class="btn" data-incident-recipients>Tutors & Heads of Year</button>' : '') + '</div></div><p>Entries are saved to the incident and reward spreadsheet log. Relevant tutors and Heads of Year see them on their Overview.</p><div id="incidents-content">Loading records…</div></section>';
  }

  function table(rows) {
    if (!rows.length) return '<p class="vle-note">No incident or reward records to show.</p>';
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th>Date</th><th>Student / tutor group</th><th>Level</th><th>Incident / reward</th><th>Involved</th><th>Reported by</th><th></th></tr></thead><tbody>' + rows.map(record => '<tr><td>' + e(record.date) + '<small>' + e(record.time) + '</small></td><td><strong>' + e(record.pupil.name) + '</strong><small>' + e(record.pupil.groupName) + '</small></td><td>' + levelBadge(record.level) + '</td><td>' + e(record.title) + '</td><td>' + (record.involved.length ? record.involved.map(pupil => e(pupil.name)).join(', ') : '—') + '</td><td>' + e(record.reportedBy) + '</td><td><button class="btn small" data-incident-record="' + e(record.id) + '">Details</button></td></tr>').join('') + '</tbody></table></div>';
  }

  function home() {
    queueMicrotask(async () => {
      const root = document.querySelector('#incident-home');
      if (!root) return;
      try {
        const data = await api('records?inbox=true');
        if (!root.isConnected) return;
        if (!data.responsibilities.groupIds.length && !data.responsibilities.years.length) { root.remove(); return; }
        root.innerHTML = '<div class="panel-head"><div><h2>Tutor & Head of Year updates</h2><p>' + data.total + ' incident and reward records for your students</p></div><a class="btn small" href="#/incidents?inbox=true">View all</a></div><div class="incident-home-scroll">' + table(data.records.slice(0, 5)) + '</div>';
        bindDetails(root, data.records);
      } catch (error) { if (root.isConnected) root.textContent = error.message; }
    });
    return '<section id="incident-home" class="panel" aria-live="polite">Loading tutor and year-group updates…</section>';
  }

  function bindDetails(root, rows) {
    root.querySelectorAll('[data-incident-record]').forEach(button => {
      button.onclick = () => detail(rows.find(record => record.id === button.dataset.incidentRecord));
    });
  }

  function dialog(title, body) {
    const element = document.createElement('dialog');
    element.className = 'incident-dialog';
    element.innerHTML = '<div class="learning-section-title"><h2>' + e(title) + '</h2><button type="button" class="btn" data-incident-close aria-label="Close incident dialog">Close</button></div>' + body;
    document.body.append(element);
    element.querySelector('[data-incident-close]').onclick = () => element.close();
    element.addEventListener('close', () => element.remove());
    element.showModal();
    return element;
  }

  function detail(record) {
    if (!record) return;
    dialog(record.title, '<p>' + levelBadge(record.level) + ' <strong>' + e(record.pupil.name) + '</strong> · ' + e(record.pupil.groupName) + '</p><p>' + e(record.date) + ' · ' + e(record.time) + ' · ' + e(record.location) + '</p><h3>Details</h3><p class="incident-description">' + e(record.description) + '</p><h3>Follow-up</h3><p class="incident-description">' + e(record.followup || 'None recorded') + '</p><h3>Involved students</h3><p>' + (record.involved.map(pupil => e(pupil.name) + ' · ' + e(pupil.groupName)).join('<br>') || 'None added') + '</p><p>Recorded by ' + e(record.reportedBy) + ' · ' + e(new Date(record.savedAt).toLocaleString('en-GB', { timeZone: 'Asia/Tashkent' })) + '</p>');
  }

  function picker(prefix, required = true) {
    return '<div class="incident-picker">' + [['phase', 'Primary / Secondary', [['', 'Choose a phase'], ['Primary', 'Primary'], ['Secondary', 'Secondary']]], ['year', 'Year group', [['', 'Choose a phase first']]], ['group', 'Tutor group', [['', 'Choose a year first']]], ['student', 'Student name', [['', 'Choose a tutor group first']]]].map(([key, label, rows]) => '<label class="field"><span>' + label + '</span><select data-picker="' + prefix + '" data-part="' + key + '" ' + (required ? 'required ' : '') + (key === 'phase' ? '' : 'disabled') + '>' + options(rows) + '</select></label>').join('') + '</div>';
  }

  function bindPicker(root, prefix, pupils, excluded = () => []) {
    const select = part => root.querySelector('[data-picker="' + prefix + '"][data-part="' + part + '"]');
    const reset = (part, placeholder) => { select(part).innerHTML = options([['', placeholder]]); select(part).disabled = true; };
    const studentOptions = () => {
      const members = pupils.filter(pupil => pupil.phase === select('phase').value && String(pupil.year) === select('year').value && pupil.groupId === select('group').value && !excluded().includes(pupil.id));
      select('student').innerHTML = options([['', 'Choose a student'], ...members.map(p => [p.id, p.name])]);
      select('student').disabled = !select('group').value;
    };
    select('phase').onchange = () => {
      select('year').innerHTML = options([['', 'Choose a year'], ...incidentYears(pupils, select('phase').value)]);
      select('year').disabled = !select('phase').value;
      reset('group', 'Choose a year first'); reset('student', 'Choose a tutor group first');
    };
    select('year').onchange = () => {
      const members = pupils.filter(pupil => pupil.phase === select('phase').value && String(pupil.year) === select('year').value);
      const groups = [...new Map(members.map(p => [p.groupId, p.groupName]))].sort((a, b) => a[1].localeCompare(b[1]));
      select('group').innerHTML = options([['', 'Choose a tutor group'], ...groups]);
      select('group').disabled = !select('year').value;
      reset('student', 'Choose a tutor group first');
    };
    select('group').onchange = studentOptions;
    return { value: () => ({ phase: select('phase').value, year: select('year').value, groupId: select('group').value, studentId: select('student').value }), refresh: studentOptions, student: select('student') };
  }

  async function open() {
    try {
      const catalog = await api('catalog');
      const requestId = 'incident-' + crypto.randomUUID();
      let involvedIds = [];
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const now = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
      const element = dialog('Record an incident / reward', '<form data-incident-form>' + picker('main') + '<div class="form-grid"><label class="field"><span>Level</span><select name="level" required>' + options(incidentLevels.map(level => [level, level.startsWith('R') ? level + ' · Reward' : level]), 'C1') + '</select></label><label class="field"><span>Incident / reward</span><input name="title" required maxlength="120"></label><label class="field"><span>Date</span><input name="date" type="date" required value="' + today + '"></label><label class="field"><span>Time</span><input name="time" type="time" required value="' + now + '"></label><label class="field full"><span>Location</span><input name="location" required maxlength="100"></label><label class="field full"><span>What happened?</span><textarea name="description" required maxlength="3000" rows="3"></textarea></label><label class="field full"><span>Follow-up action</span><textarea name="followup" maxlength="2000" rows="2"></textarea></label></div><details class="incident-involved"><summary>Involved · add other students</summary>' + picker('involved', false) + '<button class="btn small" type="button" data-involved-add>Add involved student</button></details><div class="incident-involved-tags" data-involved-tags></div><p class="error" role="alert" data-incident-error></p><p class="muted">Saved entries are added to the spreadsheet log and the relevant tutors’ and Heads of Year’s Overview.</p><button class="btn primary" type="submit">Save incident / reward</button></form>');
      const form = element.querySelector('form');
      const main = bindPicker(form, 'main', catalog.pupils);
      const involved = bindPicker(form, 'involved', catalog.pupils, () => [main.value().studentId, ...involvedIds]);
      const error = form.querySelector('[data-incident-error]');
      function paintInvolved() {
        form.querySelector('[data-involved-tags]').innerHTML = involvedIds.map(id => '<span>' + e(catalog.pupils.find(p => p.id === id)?.name) + ' <button type="button" class="text-button" data-involved-remove="' + e(id) + '" aria-label="Remove involved student">×</button></span>').join('');
        form.querySelectorAll('[data-involved-remove]').forEach(button => button.onclick = () => { involvedIds = involvedIds.filter(id => id !== button.dataset.involvedRemove); paintInvolved(); involved.refresh(); });
      }
      form.querySelector('[data-involved-add]').onclick = () => {
        const id = involved.value().studentId;
        if (!id || id === main.value().studentId || involvedIds.includes(id)) { error.textContent = 'Choose another student to add as involved.'; return; }
        involvedIds.push(id); error.textContent = ''; paintInvolved(); involved.refresh();
      };
      form.onsubmit = async event => {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await api('save', { ...Object.fromEntries(new FormData(form)), ...main.value(), involvedIds, id: requestId });
          element.close();
          toast('Saved to the incident and reward spreadsheet log.');
          render();
        } catch (failure) { error.textContent = failure.message; button.disabled = false; }
      };
    } catch (error) { toast(error.message); }
  }

  async function recipients() {
    try {
      const data = await api('recipients');
      const staffOptions = [['', 'Unassigned'], ...data.staff.map(staff => [staff.id, staff.name])];
      const years = [...new Set(data.groups.map(group => String(group.year)))];
      const element = dialog('Tutors & Heads of Year', '<p>These assignments control which entries appear on staff Overview screens. Tutor groups initially use the MIS tutor assignments.</p><form data-incident-roles><h3>Heads of Year</h3><div class="incident-role-scroll">' + years.map(year => '<label class="field"><span>' + e(year.startsWith('FS') ? year : 'Year ' + year) + '</span><select data-head-year="' + e(year) + '">' + options(staffOptions, data.heads[year]) + '</select></label>').join('') + '</div><details><summary>Tutor-group assignments</summary><div class="incident-role-scroll">' + data.groups.map(group => '<label class="field"><span>' + e(group.name) + '</span><select data-tutor-group="' + e(group.id) + '">' + options(staffOptions, Object.hasOwn(data.tutors, group.id) ? data.tutors[group.id] : data.defaultTutors[group.id]) + '</select></label>').join('') + '</div></details><p class="error" role="alert" data-role-error></p><button class="btn primary">Save recipients</button></form>');
      const form = element.querySelector('form');
      form.onsubmit = async event => {
        event.preventDefault(); const button = form.querySelector('button'); button.disabled = true;
        try {
          const heads = Object.fromEntries([...form.querySelectorAll('[data-head-year]')].map(select => [select.dataset.headYear, select.value]));
          const tutors = Object.fromEntries([...form.querySelectorAll('[data-tutor-group]')].map(select => [select.dataset.tutorGroup, select.value]));
          await api('recipients', { heads, tutors, expectedRevision: data.revision });
          element.close(); toast('Tutor and Head of Year recipients saved.'); render();
        } catch (error) { form.querySelector('[data-role-error]').textContent = error.message; button.disabled = false; }
      };
    } catch (error) { toast(error.message); }
  }

  async function migrate(legacyRecords) {
    for (const record of legacyRecords || []) {
      if (actor()?.role !== 'report-reviewer' && record.teacherId !== actor()?.id) continue;
      try { await api('import', { ...record, id: 'legacy-' + record.id, involvedIds: [] }); } catch (error) { toast('An older incident could not be imported: ' + error.message); }
    }
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-incident-new],[data-incident-export],[data-incident-recipients],[data-incident-migrate]');
    if (!button) return;
    if (button.hasAttribute('data-incident-new')) { void open(); return; }
    if (button.hasAttribute('data-incident-recipients')) { void recipients(); return; }
    button.disabled = true;
    try {
      if (button.hasAttribute('data-incident-migrate')) {
        const result = await api('migrate-browser', {});
        toast(result.imported + ' of your earlier browser records are now shared.');
        render();
        return;
      }
      const text = await api('spreadsheet');
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'incidents-and-rewards.csv'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  });

  return { page, home, open, migrate };
}
