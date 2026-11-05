import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemonstrationProject} from '../dist/timetable-school-rules.mjs';
import {teacherSubjects,savePlanningTeacher,assignTeachingLoad,studentChoices,updateStudentChoices} from '../dist/timetable-manager-inputs.mjs';
import {teachingClasses,teachers as misTeachers} from '../dist/teaching-data.mjs';
import {validateTimetable} from '../dist/timetable-engine.mjs';
const fixture=()=>createDemonstrationProject({scope:'secondary'});
const allocated=(p,blockId,subject)=>p.activities.find(a=>a.blockId===blockId&&a.subjectId===subject);
const candidate=(p,a)=>p.teachers.find(t=>!a.teacherIds.includes(t.id)&&teacherSubjects(p,t.id).includes(a.subjectId));
const put=(p,a,locked=false)=>p.placements[a.id+'#1']={day:'tue',period:'2',roomId:a.roomIds[0],locked};
const demand=(p,id)=>p.activities.filter(a=>a.studentIds.includes(id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0);

test('planning teaching eligibility derives existing curriculum areas, aliases and declared overrides',()=>{
 const p=fixture(),english=p.teachers.find(t=>t.id==='t-daniel-brooks'),languages=p.teachers.find(t=>t.id==='t-alina-simpson');
 assert.ok(teacherSubjects(p,english.id).includes('english-literature'));
 assert.ok(teacherSubjects(p,languages.id).includes('russian-as-a-second-language'));
 assert.deepEqual(teacherSubjects(p,'missing'),[]);
 english.subjectIds=['english'];assert.deepEqual(teacherSubjects(p,english.id),['english']);
 english.subjectIds=[];assert.deepEqual(teacherSubjects(p,english.id),[]);
});
test('planning teachers can be added and edited without changing MIS identities or creating accounts',()=>{
 const p=fixture(),before=structuredClone(p),misBefore=structuredClone(misTeachers);
 const next=savePlanningTeacher(p,{name:'Alex Timetable Test',area:'Humanities',subjectIds:['history','geography']});
 const added=next.teachers.at(-1);assert.match(added.id,/^plan-teacher-/);assert.equal(added.planningOnly,true);assert.ok(!('username' in added));assert.ok(!('password' in added));assert.deepEqual(added.blocked,[]);assert.deepEqual(p,before);assert.deepEqual(misTeachers,misBefore);
 added.blocked=['fri|8'];added.custom={comment:'Preserve this'};
 const edited=savePlanningTeacher(next,{id:added.id,name:'Alex Timetable Planner',area:'Humanities',subjectIds:['history']});assert.equal(edited.teachers.at(-1).id,added.id);assert.deepEqual(edited.teachers.at(-1).blocked,['fri|8']);edited.teachers.at(-1).custom.comment='changed';assert.equal(next.teachers.at(-1).custom.comment,'Preserve this');
 assert.throws(()=>savePlanningTeacher(p,{name:'',area:'Science',subjectIds:['science']}),/teacher name/);
 assert.throws(()=>savePlanningTeacher(p,{name:'Test',area:'Science',subjectIds:['unknown']}),/existing teaching subject/);
});
test('assigning several teaching loads changes ownership together and clears only affected placements',()=>{
 const p=fixture(),rows=p.activities.filter(a=>a.year===7&&a.subjectId==='science').slice(0,2),teacher=p.teachers.find(t=>teacherSubjects(p,t.id).includes('science')&&rows.every(a=>!a.teacherIds.includes(t.id)));
 rows.forEach(a=>put(p,a));const unaffected=p.activities.find(a=>a.year===8&&a.subjectId==='science');put(p,unaffected);const before=structuredClone(p),next=assignTeachingLoad(p,{activityIds:rows.map(a=>a.id),teacherId:teacher.id,roomIds:[]});
 assert.deepEqual(p,before);for(const a of rows){const result=next.activities.find(r=>r.id===a.id);assert.deepEqual(result.teacherIds,[teacher.id]);assert.deepEqual(result.studentIds,a.studentIds);assert.deepEqual(result.roomIds,a.roomIds);assert.equal(result.classId,a.classId);assert.ok(!next.placements[a.id+'#1']);}
 assert.deepEqual(next.placements[unaffected.id+'#1'],p.placements[unaffected.id+'#1']);
});
test('an option teacher change clears all partners and refuses locked partners atomically',()=>{
 const p=fixture(),a=allocated(p,'option-10-A','economics'),teacher=candidate(p,a),block=p.optionBlocks.find(b=>b.id===a.blockId);for(const id of block.activityIds)put(p,p.activities.find(a=>a.id===id));
 const before=structuredClone(p),next=assignTeachingLoad(p,{activityIds:[a.id],teacherId:teacher.id});assert.deepEqual(p,before);for(const id of block.activityIds)assert.ok(!next.placements[id+'#1']);
 p.placements[block.activityIds.at(-1)+'#1'].locked=true;const locked=structuredClone(p);assert.throws(()=>assignTeachingLoad(p,{activityIds:[a.id],teacherId:teacher.id}),/Unlock all placed lessons/);assert.deepEqual(p,locked);
});
test('quick assignment rejects unqualified teachers, simultaneous alternatives and unsuitable rooms',()=>{
 const p=fixture(),a=allocated(p,'option-10-C','accounting'),economics=allocated(p,'option-10-C','economics'),before=structuredClone(p);
 assert.throws(()=>assignTeachingLoad(p,{activityIds:[a.id],teacherId:economics.teacherIds[0]}),/two simultaneous alternatives/);
 assert.throws(()=>assignTeachingLoad(p,{activityIds:[a.id],teacherId:'t-noah-morgan'}),/not declared eligible/);
 assert.throws(()=>assignTeachingLoad(p,{activityIds:[a.id],teacherId:a.teacherIds[0],roomIds:['room-sport-1']}),/not eligible/);
 assert.deepEqual(p,before);
 const room=p.rooms.find(r=>r.id===a.roomIds[0]);room.capacity=1;assert.throws(()=>assignTeachingLoad(p,{activityIds:[a.id],teacherId:a.teacherIds[0],roomIds:[room.id]}),/too small/);
 assert.throws(()=>assignTeachingLoad(p,{activityIds:[],teacherId:a.teacherIds[0]}),/at least one/);
});
test('a repeated assignment is idempotent even when its unchanged lesson is locked',()=>{
 const p=fixture(),a=p.activities.find(a=>a.subjectId==='computing');put(p,a,true);const next=assignTeachingLoad(p,{activityIds:[a.id],teacherId:a.teacherIds[0],roomIds:[]});assert.deepEqual(next,p);assert.notEqual(next,p);
});
test('student choices expose nine blocks and preserve the canonical English and maths sets',()=>{
 const p=fixture(),rows=studentChoices(p,'s-10a-1');assert.equal(rows.length,9);assert.deepEqual(rows.map(r=>r.letter),[...'ABCDEFGHI']);assert.ok(rows.slice(0,7).every(r=>r.choices.length>=2));assert.ok(rows.slice(7).every(r=>r.choices.length===1));
 assert.throws(()=>studentChoices(p,'s-9a-1'),/Year 10 or Year 11/);assert.throws(()=>studentChoices(p,'unknown'),/Year 10 or Year 11/);
 const otherMath=p.activities.find(a=>a.blockId==='option-10-I'&&!a.studentIds.includes('s-10a-1'));
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-1',choices:{'option-10-I':otherMath.id},nonUzbek:true}),/teaching sets are preserved/);
});
test('editing a pupil option preserves identities, every block partition and forty periods',()=>{
 const p=fixture(),id='s-10a-1',target=allocated(p,'option-10-D','ict'),before=structuredClone(p),misBefore=structuredClone(teachingClasses);
 for(const activityId of p.optionBlocks.find(b=>b.id==='option-10-D').activityIds)put(p,p.activities.find(a=>a.id===activityId));const withPlaces=structuredClone(p);
 const next=updateStudentChoices(p,{studentId:id,choices:{'option-10-D':target.id},nonUzbek:true});assert.deepEqual(p,withPlaces);assert.deepEqual(teachingClasses,misBefore);assert.deepEqual(next.groups,before.groups);assert.equal(next.optionEligibility[id].synthetic,true);assert.equal(demand(next,id),40);
 for(const block of next.optionBlocks.filter(b=>b.year===10)){const ids=block.activityIds.flatMap(key=>next.activities.find(a=>a.id===key).studentIds);assert.equal(ids.length,block.studentIds.length);assert.equal(new Set(ids).size,block.studentIds.length);assert.deepEqual([...ids].sort(),[...block.studentIds].sort());}
 for(const a of next.activities.filter(a=>a.blockId==='option-10-D')){assert.ok(!next.placements[a.id+'#1']);const expected=next.groups.filter(g=>a.studentIds.some(id=>g.studentIds.includes(id))).map(g=>g.id);assert.deepEqual([...a.groupIds].sort(),expected.sort());}
 for(const a of p.activities.filter(a=>['option-10-H','option-10-I'].includes(a.blockId)))assert.deepEqual(next.activities.find(n=>n.id===a.id),a);
 assert.ok(!validateTimetable(next).issues.some(i=>!i.diagnostic));
});
test('student editing enforces science, duplicate subjects and restricted choices atomically',()=>{
 const p=fixture(),before=structuredClone(p);
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-1',choices:{'option-10-A':allocated(p,'option-10-A','history').id},nonUzbek:true}),/at least one science/);
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-3',choices:{'option-10-E':allocated(p,'option-10-E','business-studies').id},nonUzbek:false}),/same subject/);
 const french=allocated(p,'option-10-G','french');assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-2',choices:{'option-10-G':french.id},nonUzbek:false}),/not marked eligible/);assert.deepEqual(p,before);
 const eligible=updateStudentChoices(p,{studentId:'s-10a-2',choices:{'option-10-G':french.id},nonUzbek:true});assert.ok(eligible.activities.find(a=>a.id===french.id).studentIds.includes('s-10a-2'));assert.equal(demand(eligible,'s-10a-2'),40);
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-1',choices:{'option-11-A':p.optionBlocks.find(b=>b.id==='option-11-A').activityIds[0]}}),/student’s year/);
});
test('student option edits refuse locks and growing groups beyond their eligible room capacity',()=>{
 const p=fixture(),target=allocated(p,'option-10-D','ict'),partner=allocated(p,'option-10-D','english-literature');put(p,partner,true);const before=structuredClone(p);
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-1',choices:{'option-10-D':target.id},nonUzbek:true}),/Unlock all placed lessons/);assert.deepEqual(p,before);
 delete p.placements[partner.id+'#1'];for(const id of target.roomIds)p.rooms.find(r=>r.id===id).capacity=target.studentIds.length;
 assert.throws(()=>updateStudentChoices(p,{studentId:'s-10a-1',choices:{'option-10-D':target.id},nonUzbek:true}),/Review room capacities/);
});
