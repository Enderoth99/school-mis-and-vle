export const incidentLevels = ['C1', 'C2', 'C3', 'R1', 'R2', 'R3'];

export function incidentPhase(year) {
  return Number(year) >= 7 ? 'Secondary' : 'Primary';
}

export function incidentYears(pupils, phase) {
  const years = new Map();
  for (const pupil of pupils) {
    if (incidentPhase(pupil.year) === phase) years.set(String(pupil.year), pupil.yearLabel);
  }
  return [...years].sort(([a], [b]) => {
    const order = value => value === 'FS1' ? -2 : value === 'FS2' ? -1 : Number(value);
    return order(a) - order(b);
  });
}

export function incidentCSV(records) {
  const rows = [['Record ID', 'Date', 'Time', 'Phase', 'Year', 'Tutor group', 'Student ID', 'Student number', 'Student name', 'Level', 'Type', 'Incident / reward', 'Location', 'Details', 'Follow-up', 'Involved student IDs', 'Involved student names', 'Involved tutor groups', 'Reported by', 'Saved at']];
  for (const record of records) {
    const pupil = record.pupil;
    rows.push([record.id, record.date, record.time, pupil.phase, pupil.yearLabel, pupil.groupName, pupil.id, pupil.studentNumber, pupil.name, record.level, record.level.startsWith('R') ? 'Reward' : 'Incident', record.title, record.location, record.description, record.followup, record.involved.map(p => p.id).join('; '), record.involved.map(p => p.name).join('; '), record.involved.map(p => p.groupName).join('; '), record.reportedBy, record.savedAt]);
  }
  return '\uFEFF' + rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n');
}
