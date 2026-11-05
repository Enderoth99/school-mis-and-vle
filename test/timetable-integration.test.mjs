import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {installTeachingTimetable,teachingClasses,teachers,timetableForTeacher,timetableForStudent,teacherById,classesForTeacher} from '../dist/teaching-data.mjs';
import {students,roster,periods} from '../dist/model.mjs';
import {groups} from '../dist/school-data.mjs';
import {validateTimetable} from '../dist/timetable-engine.mjs';
import {AttendanceStore} from '../attendance-store.mjs';
import {DirectoryStore} from '../directory-store.mjs';
import {GradeStore} from '../grades-store.mjs';
import {integratedSeed} from '../demo/integrated-seed.mjs';
import {scopedState} from '../dist/teacher-scope.mjs';
import {seed,compactIntegratedWorkspace} from '../dist/model.mjs';
const project=JSON.parse(await fs.readFile(new URL('../dist/timetable-integrated.json',import.meta.url)));
const active=installTeachingTimetable(project),dates=['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06'];

test('current primary homeroom names propagate without changing any pupil membership or tracking ID',()=>{
 assert.deepEqual(groups.filter(g=>g.year===5).map(g=>g.name),['Year 5 Falcons','Year 5 Huskies','Year 5 Owls','Year 5 Sharks']);
 assert.deepEqual(groups.filter(g=>g.year===6).map(g=>g.name),['Year 6 Eagles','Year 6 Foxes','Year 6 Osprey','Year 6 Wolves']);
 assert.equal(groups.find(g=>g.id==='fs2d').name,'Reception Robins (demo)');
 for(const g of project.groups){const members=students.filter(s=>s.cohort===g.id);assert.deepEqual(members.map(s=>s.id),g.studentIds);for(const s of members){assert.equal(s.groupName,g.name);assert.ok(Number.isSafeInteger(s.studentNumber));}}
});

test('primary core teachers and all seventeen specialists have separate teaching allocations and stable room rules',async()=>{
 const staff=teachers.filter(t=>t.phase==='Primary specialist');assert.equal(staff.length,17);assert.equal(new Set(staff.map(t=>t.username)).size,17);
 for(const g of project.groups.filter(g=>typeof g.year!=='number'||g.year<=6)){
  const core=project.activities.filter(a=>a.groupIds[0]===g.id&&a.primaryCore),specialists=project.activities.filter(a=>a.groupIds[0]===g.id&&a.primarySpecialist),owner=core[0].teacherIds[0];
  assert.equal(new Set(core.flatMap(a=>a.teacherIds)).size,1);assert.ok(specialists.every(a=>!a.teacherIds.includes(owner)));
  for(const name of ['russian','uzbek-language','pe','music','library'])assert.ok(specialists.some(a=>a.subjectId===name));
  if(typeof g.year==='number')assert.deepEqual(core.map(a=>a.subjectId),['english','mathematics','science','humanities','pshe']);
  assert.equal([...core,...specialists].reduce((n,a)=>n+a.weeklyCount*a.duration,0),40);
 }
 for(const a of project.activities.filter(a=>a.subjectId!=='pe')){const t=project.teachers.find(t=>t.id===a.teacherIds[0]);assert.deepEqual(a.roomIds,[t.homeRoomId]);for(let i=1;i<=a.weeklyCount;i++)assert.equal(project.placements[a.id+'#'+i].roomId,t.homeRoomId);}
 const directory=new DirectoryStore(null);for(const t of staff){const p=await directory.person(t,t.id);assert.equal(p.username,t.username);assert.equal(p.usualRoom,t.usualRoom);assert.ok((await directory.schedule(t,t.id,dates[0])).lessons.every(l=>roster(l.classId).length===l.studentCount));}
});

test('full-school legacy report data can be migrated within the request limit after teacher scoping',()=>{
 const root=seed(dates[0]);root.reports=Array.from({length:10000},(_,i)=>{const c=teachingClasses[i%teachingClasses.length];return{classId:c.id,studentId:c.studentIds[0],comment:'x'.repeat(500),updatedAt:'2026-10-30T10:00:00Z'};});assert.ok(JSON.stringify({records:root.reports}).length>3000000);
 for(const t of teachers){const scoped=scopedState(root,t.id);assert.ok(JSON.stringify({records:scoped.reports}).length<3000000);assert.ok(scoped.reports.every(r=>classesForTeacher(t.id).some(c=>c.id===r.classId)));}
});

test('full integrated fixture is complete and every compulsory pupil period has exactly one lesson',()=>{
 const result=validateTimetable(project);assert.equal(result.complete,true);assert.equal(result.placed,2017);assert.equal(result.coverage.missingSlots,0);assert.equal(result.issues.length,0);assert.equal(teachers.length,80);
 for(const date of dates){
  for(const s of students){const rows=timetableForStudent(s.id,date),teaching=rows.filter(r=>r.period!=='R');assert.equal(new Set(rows.map(r=>r.period)).size,rows.length,s.id+' '+date);if(Number(s.year)<=11||String(s.year).startsWith('FS'))assert.equal(teaching.length,8,s.id+' '+date);for(const row of rows)assert.ok(roster(row.classId).some(p=>p.id===s.id));}
  for(const t of teachers){const rows=timetableForTeacher(t.id,date);assert.equal(new Set(rows.map(r=>r.period)).size,rows.length,t.name+' '+date);for(const row of rows)assert.ok(classesForTeacher(t.id).some(c=>c.id===row.classId));}
 }
 assert.deepEqual(timetableForTeacher(teachers[0].id,'2026-11-07'),[]);assert.equal(periods.find(p=>p[0]==='3')[1],'10:00');
});

test('assigned lessons feed the Directory, saved registers and next teacher prefill by stable pupil ID',async()=>{
 const directory=new DirectoryStore(null),attendance=new AttendanceStore(null),student=students.find(s=>s.year===10),rows=timetableForStudent(student.id,dates[0]).filter(r=>r.period!=='R');
 const first=rows[0],next=rows.find(r=>r.teacherIds[0]!==first.teacherIds[0]&&Number(r.period)>Number(first.period));assert.ok(next);
 const owner=teacherById(first.teacherIds[0]),profile=await directory.schedule(owner,student.id,dates[0]);assert.equal(profile.sample,false);assert.equal(profile.lessons.length,9);
 for(const l of profile.lessons){assert.ok(roster(l.classId).some(p=>p.id===student.id));assert.equal(l.room,timetableForStudent(student.id,dates[0]).find(r=>r.period===l.period).room);}
 const records=roster(first.classId).map(s=>({studentId:s.id,status:s.id===student.id?'Late (Excused)':'Present',time:s.id===student.id?'08:35':'',note:''}));
 await attendance.save(owner.id,{date:dates[0],classId:first.classId,period:first.period,expectedRevision:0,records});
 const context=await attendance.context(next.teacherIds[0],{date:dates[0],classId:next.classId,period:next.period}),p=context.records.find(r=>r.studentId===student.id);assert.equal(p.status,'Present');assert.equal(p.prefilledFrom.time,'08:35');assert.equal(p.studentNumber,student.studentNumber);
 const day=await attendance.day(owner.id,dates[0]);assert.equal(day.length,timetableForTeacher(owner.id,dates[0]).length);assert.ok(day.some(r=>r.saved?.complete));
});

test('new option groups support marks, student tracking and report assessment references',async()=>{
 const c=teachingClasses.find(c=>c.id.startsWith('scheduled-')&&c.kind==='subject'&&c.year===10),store=new GradeStore(null),pupil=roster(c.id)[0];assert.ok(pupil);
 await store.save(c.teacherId,{classId:c.id,title:'Integration test',date:'2026-10-30',maximum:20,marks:{[pupil.id]:15},expectedRevision:0});
 const tracking=await store.tracking(c.teacherId,pupil.id);assert.equal(tracking.entries[0].percentage,75);assert.equal(tracking.entries[0].classId,c.id);
 const {ReportStore}=await import('../reports-store.mjs'),reports=new ReportStore(null,{grades:store}),book=await reports.book(teacherById(c.teacherId),{cycleId:'october-2026',classId:c.id});assert.equal(book.rows.length,c.studentIds.length);assert.ok(book.rows.some(r=>r.studentId===pupil.id));
});

test('isolated demo seed covers every secondary course with five assessments and 5% missed results',()=>{
 const seed=integratedSeed(project),assessments=Object.values(seed['grades.json'].assessments),secondary=active.classes.filter(c=>typeof c.year==='number'&&c.year>=7&&c.kind==='subject');assert.equal(assessments.length,secondary.length*5);let cells=0,missed=0;
 for(const c of secondary){const entries=assessments.filter(a=>a.classId===c.id);assert.equal(entries.length,5);for(const a of entries){assert.equal(Object.keys(a.marks).length+a.missedStudentIds.length,c.studentIds.length);assert.ok([...Object.keys(a.marks),...a.missedStudentIds].every(id=>c.studentIds.includes(id)));cells+=c.studentIds.length;missed+=a.missedStudentIds.length;}}
 assert.equal(missed,Math.floor(cells/20));assert.deepEqual(seed['attendance.json'].registers,{});
 assert.ok(Object.values(seed['directory.json'].people).some(p=>p.id==='t-mila-reed'));
});

test('integrated workspace omits unused sample drafts and preserves actual report edits during compaction',()=>{
 const state=seed(dates[0]);assert.equal(state.reports.length,0);const edited={id:'entered',classId:'computing9a',studentId:'s-9a-1',status:'draft',grade:'B',effort:'Good',comment:'Teacher entered feedback',updatedAt:'2026-10-30T10:00:00Z'},imported={...edited,id:'imported',updatedAt:null};state.reports=[{status:'draft',grade:'',effort:'',comment:'',updatedAt:null},edited,imported];assert.deepEqual(compactIntegratedWorkspace(state).reports,[edited,imported]);assert.ok(JSON.stringify(seed(dates[0])).length<100000);
});
