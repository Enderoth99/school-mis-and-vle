import {classesForTeacher,studentsForTeacher} from './teaching-data.mjs';
import {REPORT_REVIEWER} from './report-config.mjs';
import {students as schoolStudents} from './school-data.mjs';

export function scopedState(root,teacherId){
 if(teacherId===REPORT_REVIEWER.id){const preferences=root.teacherPreferences?.[teacherId]||{};return{...root,favorites:preferences.favorites||[],reportHistory:preferences.reportHistory||[]};}
 const classIds=new Set(classesForTeacher(teacherId).map(c=>c.id));
 const assignments=root.assignments.filter(a=>classIds.has(a.classId)),assignmentIds=new Set(assignments.map(a=>a.id));
 const preferences=root.teacherPreferences?.[teacherId]||{};
 return {...root,teacherPreferences:{[teacherId]:preferences},assignments,lessons:root.lessons.filter(l=>classIds.has(l.classId)),attendance:Object.fromEntries(Object.entries(root.attendance).filter(([,a])=>classIds.has(a.classId))),grades:Object.fromEntries(Object.entries(root.grades).filter(([id])=>assignmentIds.has(id))),reports:root.reports.filter(r=>classIds.has(r.classId)),events:root.events.filter(e=>e.fixed||e.teacherId===teacherId),incidents:root.incidents.filter(i=>i.teacherId===teacherId),favorites:preferences.favorites||[],reportHistory:preferences.reportHistory||[]};
}
export function mergeTeacherState(root,edited,teacherId){
 if(teacherId===REPORT_REVIEWER.id){
  // This workspace saves preferences and appends its own incidents. Always retain the latest
  // teaching records, including freshly seeded timestamps or another tab's newer saves.
  const foreign=root.incidents.filter(i=>i.teacherId!==teacherId),foreignEdited=edited.incidents.filter(i=>i.teacherId!==teacherId);
  if(foreignEdited.some(i=>!foreign.some(r=>r.id===i.id&&JSON.stringify(r)===JSON.stringify(i))))throw Error('Another staff member’s incident records cannot be changed.');
  if(edited.incidents.some(i=>!schoolStudents.some(s=>s.id===i.studentId)))throw Error('Choose an existing student.');
  const incidents=new Map(root.incidents.map(i=>[i.id,i]));for(const i of edited.incidents.filter(i=>i.teacherId===teacherId))if(!incidents.has(i.id))incidents.set(i.id,i);
  return{...structuredClone(root),incidents:structuredClone([...incidents.values()]),teacherPreferences:{...root.teacherPreferences,[teacherId]:{favorites:edited.favorites,reportHistory:edited.reportHistory}}};
 }
 const classIds=new Set(classesForTeacher(teacherId).map(c=>c.id)),studentIds=new Set(studentsForTeacher(teacherId).map(s=>s.id));
 const next=structuredClone(root);
 for(const key of ['assignments','lessons','reports']){
  if(edited[key].some(item=>!classIds.has(item.classId)))throw new Error('This class is not allocated to your account.');
  next[key]=[...root[key].filter(item=>!classIds.has(item.classId)),...edited[key]];
 }
 if(Object.values(edited.attendance).some(item=>!classIds.has(item.classId)))throw new Error('This register is not allocated to your account.');
 next.attendance={...Object.fromEntries(Object.entries(root.attendance).filter(([,item])=>!classIds.has(item.classId))),...edited.attendance};
 const ownAssignmentIds=new Set(next.assignments.filter(a=>classIds.has(a.classId)).map(a=>a.id));
 if(Object.keys(edited.grades).some(id=>!ownAssignmentIds.has(id)))throw new Error('This assignment is not allocated to your account.');
 next.grades={...Object.fromEntries(Object.entries(root.grades).filter(([id])=>!ownAssignmentIds.has(id))),...edited.grades};
 if(edited.incidents.some(i=>!studentIds.has(i.studentId)||(i.teacherId&&i.teacherId!==teacherId)))throw new Error('This student or incident is not allocated to your account.');
 next.incidents=[...root.incidents.filter(i=>i.teacherId!==teacherId),...edited.incidents.map(i=>({...i,teacherId}))];
 const fixed=root.events.filter(e=>e.fixed);
 if(JSON.stringify(edited.events.filter(e=>e.fixed))!==JSON.stringify(fixed))throw new Error('School calendar dates cannot be changed in a teacher account.');
 if(edited.events.some(e=>!e.fixed&&e.teacherId&&e.teacherId!==teacherId))throw new Error('This event belongs to another teacher.');
 next.events=[...fixed,...root.events.filter(e=>!e.fixed&&e.teacherId!==teacherId),...edited.events.filter(e=>!e.fixed).map(e=>({...e,teacherId}))];
 next.teacherPreferences={...root.teacherPreferences,[teacherId]:{favorites:edited.favorites,reportHistory:edited.reportHistory}};
 return next;
}
