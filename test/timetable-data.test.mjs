import test from 'node:test';
import assert from 'node:assert/strict';
import {createTimetableProject,TIMETABLE_SCOPES,WEEKLY_LESSON_TARGETS,OPTION_BLOCK_CHOICES} from '../dist/timetable-data.mjs';
import {students,groups} from '../dist/school-data.mjs';
import {teachers,teachingClasses} from '../dist/teaching-data.mjs';
const demand=(project,id)=>project.activities.filter(a=>a.studentIds.includes(id)).reduce((sum,a)=>sum+a.weeklyCount*a.duration,0);

test('timetable scopes retain canonical identities and version the corrected school rules',()=>{
 const scopes={year9:{students:58,groups:4},secondary:{students:324,groups:19},school:{students:1000,groups:51}};
 for(const [scope,expected] of Object.entries(scopes)){
  const project=createTimetableProject({scope}),ids=project.groups.flatMap(g=>g.studentIds);
  assert.equal(project.rulesVersion,3);assert.equal(project.constraints.maxTeacherDaily,8);assert.equal(project.groups.length,expected.groups);assert.equal(ids.length,expected.students);assert.equal(new Set(ids).size,ids.length);
  for(const group of project.groups){assert.equal(group.name,groups.find(g=>g.id===group.id).name);for(const id of group.studentIds)assert.equal(students.find(s=>s.id===id).cohort,group.id);}
 }
 assert.equal(TIMETABLE_SCOPES.length,3);assert.throws(()=>createTimetableProject({scope:'other'}),/Choose/);
});
test('canonical teaching activities preserve rosters while new planning groups never impersonate MIS classes',()=>{
 for(const scope of ['year9','secondary','school']){
  const p=createTimetableProject({scope});assert.equal(new Set(p.activities.map(a=>a.id)).size,p.activities.length);
  for(const a of p.activities){
   if(a.classId){const canonical=teachingClasses.find(c=>c.id===a.classId);assert.ok(['primary','subject','assembly'].includes(canonical.kind));assert.deepEqual(a.studentIds,canonical.studentIds);assert.deepEqual(a.teacherIds,[canonical.teacherId]);}
   else {assert.equal(a.classId,null);assert.match(a.enrollmentMode,/planning/);assert.ok(a.source.includes('Planning')||a.source.includes('planning'));if(a.sourceClassId)assert.ok(teachingClasses.some(c=>c.id===a.sourceClassId));}
   assert.ok(a.teacherIds.every(id=>p.teachers.some(t=>t.id===id)));assert.ok(p.subjects.some(s=>s.id===a.subjectId));assert.deepEqual([...a.groupIds].sort(),[...new Set(a.studentIds.map(id=>students.find(s=>s.id===id).cohort))].sort());
  }
  assert.ok(p.teachers.every(t=>teachers.some(c=>c.id===t.id&&c.name===t.name)));
 }
});
test('every pupil through Year 11 has exactly forty teaching periods without invented frees',()=>{
 for(const scope of ['year9','secondary','school']){const p=createTimetableProject({scope});for(const group of p.groups)for(const id of group.studentIds){if(typeof group.year==='number'&&group.year>=12)continue;assert.equal(demand(p,id),40,id+' must have 40 periods');}}
 const p=createTimetableProject();assert.equal(p.activities.length,68);assert.equal(p.activities.reduce((sum,a)=>sum+a.weeklyCount*a.duration,0),160);assert.equal(p.activities.reduce((sum,a)=>sum+a.weeklyCount,0),156);assert.equal(WEEKLY_LESSON_TARGETS.English,5);assert.equal(WEEKLY_LESSON_TARGETS.Mathematics,6);assert.equal(WEEKLY_LESSON_TARGETS.Science,5);assert.equal(WEEKLY_LESSON_TARGETS['Global Perspectives'],0);assert.equal(p.activities.some(a=>a.subjectId==='global-perspectives'),false);
});
test('PE is one contiguous double in every year and primary aggregate demand is thirty-eight',()=>{
 const p=createTimetableProject({scope:'school'});for(const group of p.groups){const pe=p.activities.filter(a=>a.subjectId==='pe'&&a.groupIds.includes(group.id));assert.equal(pe.length,1);assert.equal(pe[0].weeklyCount,1);assert.equal(pe[0].duration,2);assert.deepEqual(pe[0].studentIds,group.studentIds);}
 const primary=p.activities.filter(a=>a.classId&&teachingClasses.find(c=>c.id===a.classId).kind==='primary');assert.equal(primary.length,32);for(const a of primary){assert.equal(a.weeklyCount,38);assert.equal(a.duration,1);assert.equal(a.spread,false);assert.equal(a.roomIds.length,1);assert.equal(p.rooms.find(r=>r.id===a.roomIds[0]).groupId,a.groupIds[0]);const pe=p.activities.find(pe=>pe.id==='plan-pe-'+a.groupIds[0]);assert.deepEqual(pe.teacherIds,a.teacherIds);assert.equal(pe.classId,null);}
});
test('Y10 and Y11 have nine four-period document blocks and four pastoral periods',()=>{
 const p=createTimetableProject({scope:'secondary'});assert.equal(p.optionBlocks.filter(b=>b.year<=11).length,18);
 for(const year of [10,11]){
  const pupils=p.groups.filter(g=>g.year===year).flatMap(g=>g.studentIds),blocks=p.optionBlocks.filter(b=>b.year===year);assert.equal(blocks.length,9);
  for(const id of pupils){assert.equal(p.activities.filter(a=>!a.blockId&&a.studentIds.includes(id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0),4);assert.equal(demand(p,id),40);}
  for(const [index,block] of blocks.entries()){
   assert.equal(block.weeklyCount,4);assert.equal(block.duration,1);assert.deepEqual(block.studentIds,pupils);
   const choices=block.activityIds.map(id=>p.activities.find(a=>a.id===id));assert.deepEqual([...new Set(choices.map(a=>p.subjects.find(s=>s.id===a.subjectId).name))],OPTION_BLOCK_CHOICES[year][index]);
   const ids=choices.flatMap(a=>a.studentIds);assert.equal(ids.length,pupils.length);assert.equal(new Set(ids).size,pupils.length);assert.deepEqual([...ids].sort(),[...pupils].sort());
   for(const a of choices){assert.equal(a.blockId,block.id);if(index<7)assert.equal(a.classId,null);assert.equal(a.weeklyCount,4);assert.equal(a.duration,1);assert.ok(a.teacherIds.every(id=>teachers.find(t=>t.id===id).subjects.includes(p.subjects.find(s=>s.id===a.subjectId).name==='Russian as a Second Language'?'Russian':p.subjects.find(s=>s.id===a.subjectId).name)));}
  }
 }
});
test('assemblies are fixed Monday P1 and registration remains outside the forty-period cycle',()=>{
 const p=createTimetableProject({scope:'secondary'}),assemblies=p.activities.filter(a=>a.subjectId==='assembly');assert.equal(assemblies.length,19);for(const a of assemblies){assert.equal(a.weeklyCount,1);assert.equal(a.duration,1);assert.deepEqual(a.fixedSlots,[{day:'mon',period:'1'}]);assert.deepEqual(p.placements[a.id+'#1'],{day:'mon',period:'1',roomId:a.roomIds[0],locked:true});}
 assert.equal(Object.keys(p.placements).length,19);assert.deepEqual(p.registration,{id:'R',start:'08:15',end:'08:30',outsideTeachingCycle:true});assert.ok(!p.periods.some(p=>p.id==='R'));
});
test('mixed sets and sixth-form options keep actual canonical pupil memberships',()=>{
 const p=createTimetableProject({scope:'secondary'}),english=p.activities.filter(a=>a.enrollmentMode==='mixed set'&&a.year===9&&a.subjectId==='english');assert.equal(english.length,4);assert.ok(english.every(a=>a.groupIds.length===4));const englishIds=english.flatMap(a=>a.studentIds);assert.equal(englishIds.length,58);assert.equal(new Set(englishIds).size,58);
 for(const year of [12,13])for(const block of ['A','B','C']){const optionIds=p.activities.filter(a=>a.year===year&&a.classId&&teachingClasses.find(c=>c.id===a.classId).block===block).flatMap(a=>a.studentIds);assert.equal(optionIds.length,10);assert.equal(new Set(optionIds).size,10);}
 for(const group of p.groups.filter(g=>g.year>=12))for(const id of group.studentIds)assert.ok(demand(p,id)<40,'Sixth-form frees remain allowed');assert.ok(p.notes.some(n=>n.includes('Year 12/13 subjects have four lessons each')));
});
test('rooms cover actual group size without inventing staffing or sports capacity to conceal shortages',()=>{
 const p=createTimetableProject({scope:'school'});for(const a of p.activities){assert.ok(a.roomIds.length);for(const id of a.roomIds){const r=p.rooms.find(r=>r.id===id);assert.ok(r);assert.ok(r.capacity>=a.studentIds.length);assert.deepEqual(r.blocked,[]);}}
 assert.equal(p.teachers.length,60);assert.equal(p.rooms.filter(r=>r.type==='sport').length,2);const sport=p.warnings.find(w=>w.kind==='room-capacity'&&w.type==='sport');assert.equal(sport.demand,102);assert.equal(sport.capacity,80);assert.deepEqual(p.warnings.filter(w=>w.kind==='teacher-capacity').map(w=>w.teacherId).sort(),p.teachers.filter(t=>p.activities.filter(a=>a.teacherIds.includes(t.id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0)>40).map(t=>t.id).sort());assert.ok(p.notes.some(n=>n.includes('No extra staff')));
});
test('corrected Period 3 precedes break and fixture arrays are independent clones',()=>{
 const a=createTimetableProject(),b=createTimetableProject();assert.equal(a.periods.length,8);assert.equal(a.periods.find(p=>p.id==='2').end,'10:00');assert.equal(a.periods.find(p=>p.id==='3').start,'10:00');assert.equal(a.periods.find(p=>p.id==='3').end,'10:45');assert.equal(a.periods.find(p=>p.id==='4').start,'11:05');assert.equal(a.periods.find(p=>p.id==='6').end,'13:20');assert.equal(a.periods.find(p=>p.id==='7').start,'14:00');a.teachers[0].blocked.push('mon|1');a.rooms[0].capacity=1;a.groups[0].studentIds.length=0;a.activities[0].roomIds.length=0;assert.deepEqual(b.teachers[0].blocked,[]);assert.ok(b.rooms[0].capacity>1);assert.equal(b.groups[0].studentIds.length,14);assert.ok(b.activities[0].roomIds.length);assert.equal(students.length,1000);
});

