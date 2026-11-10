import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {PlanningStore} from '../planning-store.mjs';
import {publicationPreview,publishTimetable,installPublication,timetableForActor} from '../timetable-publication.mjs';
import {installTeachingTimetable,timetableForStudent,timetableForTeacher,teachingClasses} from '../dist/teaching-data.mjs';
import {applyManagedCatalog} from '../dist/managed-catalog.mjs';
import {GradeStore} from '../grades-store.mjs';
const admin={id:'report-reviewer',role:'report-reviewer',name:'Administrator'};
const project=JSON.parse(await fs.readFile(new URL('../dist/timetable-integrated.json',import.meta.url)));
installTeachingTimetable(project);
function prepared(){const store=new PlanningStore();store.state.project=structuredClone(project);return store;}
function request(p){return{expectedRevision:p.draftRevision,expectedPublicationRevision:p.publicationRevision,signature:p.signature,operationId:'publication-test-operation'};}
test('publication is admin only, complete whole-school only and protects preview revisions',async()=>{
 const store=prepared();
 for(const actor of [null,{id:'teacher',role:'teacher'},{id:'forged',role:'report-reviewer'}]){
  assert.throws(()=>publicationPreview(store.state,actor,{expectedRevision:0}),e=>e.status===403);
  await assert.rejects(publishTimetable(store,actor,{},{}),e=>e.status===403);
 }
 let p=publicationPreview(store.state,admin,{expectedRevision:0});assert.equal(p.canPublish,true);assert.equal(p.summary.students,1000);
 await assert.rejects(publishTimetable(store,admin,{...request(p),signature:'stale'},{}),e=>e.status===409);
 await assert.rejects(publishTimetable(store,admin,{...request(p),expectedRevision:1},{}),e=>e.status===409);
 const lesson=Object.keys(store.state.project.placements).find(id=>!store.state.project.placements[id].locked);delete store.state.project.placements[lesson];
 p=publicationPreview(store.state,admin,{expectedRevision:0});assert.equal(p.canPublish,false);await assert.rejects(publishTimetable(store,admin,request(p),{}),e=>e.status===400);
 store.state.project=structuredClone(project);store.state.project.groups.pop();p=publicationPreview(store.state,admin,{expectedRevision:0});assert.equal(p.canPublish,false);
 assert.equal(store.state.publication,undefined);
});
test('published rooms and periods persist, update both schedules, and keep course IDs and grades intact',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'mis-publish-'));try{
 const store=prepared();store.filename=path.join(dir,'planning.json');
 const chosen=store.state.project.activities.find(a=>a.classId==='computing9a');assert(chosen);
 const place=store.state.project.placements[chosen.id+'#1'];const room=store.state.project.rooms.find(r=>r.id===place.roomId);room.name='Published computing room';
 const catalog={students:[{id:chosen.studentIds[0],enrollmentClassIds:['computing9a']}]};
 const p=publicationPreview(store.state,admin,{expectedRevision:0},catalog);assert(p.canPublish,p.blockers.join(' '));
 const before=teachingClasses.map(c=>c.id);
 const result=await publishTimetable(store,admin,request(p),catalog);assert.equal(result.revision,1);assert.equal((await publishTimetable(store,admin,request(p),catalog)).revision,1);
 assert(before.every(id=>store.state.publication.snapshot.classes.some(c=>c.id===id)));
 const restarted=new PlanningStore(store.filename);await restarted.ready;installPublication(restarted);applyManagedCatalog(catalog);
 const teacher=timetableForTeacher(chosen.teacherIds[0],place.day),student=timetableForStudent(chosen.studentIds[0],place.day);
 assert(teacher.some(r=>r.classId==='computing9a'&&r.room===room.name));assert(student.some(r=>r.classId==='computing9a'&&r.room===room.name));
 assert(teachingClasses.find(c=>c.id==='computing9a').studentIds.length>1,'old enrollment overrides cannot erase published rosters');
 const scoped=timetableForActor(restarted,{id:chosen.studentIds[0],role:'student'});assert(scoped.snapshot.classes.every(c=>c.studentIds.length===1));assert(scoped.snapshot.rows.every(r=>scoped.snapshot.classes.some(c=>c.id===r.classId)));
 assert.equal(restarted.state.publicationHistory.length,1);
 const grades=new GradeStore();grades.state.assessments={old:{id:'old',classId:'computing9a',teacherId:chosen.teacherIds[0],title:'Before publication',date:'2026-11-01',maximum:10,marks:{[chosen.studentIds[0]]:8},missedStudentIds:[]}};
 assert.equal((await grades.tracking(admin.id,chosen.studentIds[0])).entries[0].mark,8);
 }finally{await fs.rm(dir,{recursive:true,force:true});installTeachingTimetable(project);}
});

test('HTTP publication reaches separate staff/student sessions without rewriting school records',async()=>{
 const {createAppServer}=await import('../server.mjs');let gen=0;const map=new Map([['timetable-planning.json',{state:{version:1,revision:7,project:structuredClone(project),history:[]},generation:'0'}]]);
 const cloud={async load(k){return map.has(k)?structuredClone(map.get(k)):null;},async save(k,state,previous){if(map.get(k)?.generation!==previous?.generation)throw Object.assign(Error('Conflict'),{status:409});const value={state:structuredClone(state),generation:String(++gen)};map.set(k,value);return structuredClone(value);}};
 const server=createAppServer({planningFile:null,attendanceFile:null,gradesFile:null,messagesFile:null,reportsFile:null,directoryFile:null,classroomFile:null,credentialsFile:null,cloudBackend:cloud});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const call=async(route,cookie,body)=>{const r=await fetch(base+route,{headers:{cookie:cookie||'','Content-Type':'application/json'},...(body?{method:'POST',body:JSON.stringify(body)}:{})});return{status:r.status,data:await r.json()};};
 const login=async(username,password)=>{const r=await fetch(base+'/api/login',{method:'POST',body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 try{
  const ca=await login('admin','WistTest2026!'),ct=await login('noah.morgan','WistTest2026!'),cs=await login('100837','WistLearn2026!');
  assert.equal((await call('/api/planning/preview',ct,{expectedRevision:7})).status,403);
  assert.equal((await call('/api/planning/publish',cs,{expectedRevision:7})).status,403);
  const preview=await call('/api/planning/preview',ca,{expectedRevision:7});assert(preview.data.canPublish,JSON.stringify(preview));
  const keys=['grades.json','attendance.json','classroom.json'],before=keys.map(k=>JSON.stringify(map.get(k)));
  const published=await call('/api/planning/publish',ca,request(preview.data));assert.equal(published.status,200,JSON.stringify(published));
  assert.deepEqual(keys.map(k=>JSON.stringify(map.get(k))),before);
  for(const cookie of [ct,cs]){const response=await call('/api/classroom/timetable',cookie);assert.equal(response.status,200);assert.equal(response.data.snapshot.id,'published-timetable-1');assert.equal(response.data.publication.draftRevision,7);}
  const day=await call('/api/attendance/day?date=2026-11-02',ct);assert.equal(day.status,200);assert(day.data.lessons.length>0);
 }finally{await new Promise(resolve=>server.close(resolve));installTeachingTimetable(project);}
});
