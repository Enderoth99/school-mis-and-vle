import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {unlink} from 'node:fs/promises';
import {AttendanceStore} from '../attendance-store.mjs';
import {classes,roster,students,keyFor} from '../dist/model.mjs';
import {createAppServer} from '../server.mjs';
import {TEST_PASSWORD} from '../server-auth.mjs';
import {teacherById} from '../dist/teaching-data.mjs';

const date='2026-11-02',first=classes.find(c=>c.id==='computing9a'),next=classes.find(c=>c.id==='science9a');
const records=id=>roster(id).map(s=>({studentId:s.id,status:'Present',note:'',time:''}));
const target=(classId,period,values=records(classId),expectedRevision=0)=>({date,classId,period,records:values,expectedRevision});

test('all 1,000 pupils have unique stable numeric tracking IDs, hidden from register labels',()=>{
 assert.equal(new Set(students.map(s=>s.studentNumber)).size,1000);assert.ok(students.every(s=>Number.isSafeInteger(s.studentNumber)));
});
test('a later teacher receives prior attendance by pupil ID, without duplicating earlier lateness',async()=>{
 const store=new AttendanceStore(null),values=records(first.id);values[0]={...values[0],status:'Late (Unexcused)',time:'08:42',note:'Earlier lesson note'};values[1].status='Absent (Excused)';
 await store.save(first.teacherId,target(first.id,'1',values));
 const context=await store.context(next.teacherId,{date,classId:next.id,period:'2'});
 assert.equal(context.prefilledCount,14);assert.equal(context.records[0].status,'Present');assert.equal(context.records[0].time,'');assert.equal(context.records[0].note,'');
 assert.equal(context.records[0].prefilledFrom.time,'08:42');assert.equal(context.records[0].prefilledFrom.teacherId,first.teacherId);assert.equal(context.records[1].status,'Absent (Excused)');
 assert.equal(context.records[0].studentNumber,roster(first.id)[0].studentNumber);
 const saved=await store.save(next.teacherId,target(next.id,'2',context.records));assert.equal(saved.complete,true);
 const report=await store.report(next.teacherId,{classId:next.id,from:date,to:date,scope:'students'});
 assert.equal(report.length,28);const pupilRows=report.filter(r=>r.studentId===values[0].studentId);assert.deepEqual(pupilRows.map(r=>r.status),['Late (Unexcused)','Present']);assert.equal(pupilRows[0].time,'08:42');assert.ok(pupilRows.every(r=>r.studentNumber===context.records[0].studentNumber));
});
test('saved lesson wins over prefill; earlier, same-period and other-day records never overwrite it',async()=>{
 const store=new AttendanceStore(null);await store.save(first.teacherId,target(first.id,'1'));
 let context=await store.context(next.teacherId,{date,classId:next.id,period:'2'});context.records[0].status='Absent (Unexcused)';await store.save(next.teacherId,target(next.id,'2',context.records));
 const previous=records(first.id);previous[0].status='Absent (Excused)';await store.save(first.teacherId,target(first.id,'1',previous,1));
 context=await store.context(next.teacherId,{date,classId:next.id,period:'2'});assert.equal(context.records[0].status,'Absent (Unexcused)');assert.equal(context.revision,1);
 const same=await store.context(next.teacherId,{date,classId:next.id,period:'1'});assert.ok(same.records.every(r=>r.status==='Not Taken'));
 const tomorrow=await store.context(next.teacherId,{date:'2026-11-03',classId:next.id,period:'4'});assert.ok(tomorrow.records.every(r=>r.status==='Not Taken'));
});
test('mixed teaching sets join by pupil ID rather than roster position',async()=>{
 const store=new AttendanceStore(null);await store.save(first.teacherId,target(first.id,'1'));
 const mixed=classes.find(c=>c.id==='english9a'),context=await store.context(mixed.teacherId,{date,classId:mixed.id,period:'2'}),ids=new Set(roster(first.id).map(s=>s.id));
 for(const record of context.records)assert.equal(record.status,ids.has(record.studentId)?'Present':'Not Taken');
});
test('complete registers, teaching ownership and concurrent save revisions are enforced',async()=>{
 const store=new AttendanceStore(null),incomplete=records(first.id);incomplete[0].status='Not Taken';
 await assert.rejects(store.save(first.teacherId,target(first.id,'1',incomplete)),/every student/);
 assert.equal((await store.context(first.teacherId,{date,classId:first.id,period:'1'})).saved,null);
 await assert.rejects(store.save(next.teacherId,target(first.id,'1')),error=>error.status===403);
 await store.save(first.teacherId,target(first.id,'1'));await assert.rejects(store.save(first.teacherId,target(first.id,'1')),error=>error.status===409);
 const changed=records(first.id);changed[0].status='Absent (Unexcused)';await store.save(first.teacherId,target(first.id,'1',changed,1));
 assert.equal((await store.context(first.teacherId,{date,classId:first.id,period:'1'})).revision,2);
});
test('shared attendance survives a server-store restart and preserves all lesson periods',async()=>{
 const filename=path.join(tmpdir(),'wist-attendance-'+randomUUID()+'.json');
 try{const store=new AttendanceStore(filename);await store.save(first.teacherId,target(first.id,'1'));await store.save(first.teacherId,target(first.id,'2'));
 const reopened=new AttendanceStore(filename);const report=await reopened.report(first.teacherId,{classId:first.id,from:date,to:date});assert.equal(report.length,28);assert.deepEqual([...new Set(report.map(r=>r.period))],['1','2']);}
 finally{await unlink(filename).catch(()=>{});await unlink(filename+'.tmp').catch(()=>{});}
});
test('legacy browser records migrate once and cannot replace a later shared save',async()=>{
 const store=new AttendanceStore(null),legacy={...target(first.id,'1'),updatedAt:'2026-11-02T01:00:00Z'};
 assert.equal((await store.importLegacy(first.teacherId,[legacy])).imported,1);assert.equal((await store.importLegacy(first.teacherId,[legacy])).imported,0);
 const mirrored=await store.owned(first.teacherId);assert.equal((await store.importLegacy(first.teacherId,mirrored)).imported,0);
 const changed=records(first.id);changed[0].status='Absent (Excused)';await store.save(first.teacherId,target(first.id,'1',changed,1));
 await store.importLegacy(first.teacherId,[{...legacy,updatedAt:'2026-11-02T22:00:00Z'}]);assert.equal((await store.context(first.teacherId,{date,classId:first.id,period:'1'})).records[0].status,'Absent (Excused)');
});
test('attendance API shares earlier lessons between authenticated teachers and protects writes',async()=>{
 const server=createAppServer({attendanceFile:null});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const request=async(url,cookie,method='GET',body)=>{const response=await fetch(base+url,{method,headers:{...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,data:await response.json()};};
 try{
  const login=async teacherId=>{const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:teacherById(teacherId).username,password:TEST_PASSWORD})});return response.headers.get('set-cookie').split(';')[0];};
  const previousCookie=await login(first.teacherId),nextCookie=await login(next.teacherId),query='/api/attendance/context?'+new URLSearchParams({date,classId:next.id,period:'2'});
  assert.equal((await request(query)).status,401);assert.equal((await request('/api/attendance/register',nextCookie,'PUT',target(first.id,'1'))).status,403);
  assert.equal((await request('/api/attendance/register',previousCookie,'PUT',target(first.id,'1'))).status,200);
  const context=await request(query,nextCookie);assert.equal(context.status,200);assert.equal(context.data.prefilledCount,14);
  assert.equal((await request('/api/attendance/register',nextCookie,'PUT',target(next.id,'2',context.data.records))).status,200);
  const report=await request('/api/attendance/report?'+new URLSearchParams({classId:next.id,from:date,to:date,scope:'students'}),nextCookie);assert.equal(report.data.entries.length,28);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
