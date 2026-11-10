import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanningStore } from '../planning-store.mjs';
import { attachCloudPersistence } from '../cloud-storage.mjs';
import { createSharedPlanningClient } from '../dist/shared-planning-client.mjs';
import { teacherByUsername } from '../dist/teaching-data.mjs';
import { createAppServer } from '../server.mjs';
import http from 'node:http';
const noah = teacherByUsername('noah.morgan'), zara = teacherByUsername('zara.campbell');
function backend() { let gen = 0; const map = new Map(); return { map, async load(key) { return map.has(key) ? structuredClone(map.get(key)) : null; }, async save(key,state,previous) { if (map.get(key)?.generation !== previous?.generation) throw Object.assign(Error('Conflict'),{status:409}); const value={state:structuredClone(state),generation:String(++gen)};map.set(key,value);return structuredClone(value); } }; }
const until = async predicate => { for(let i=0;i<300&&!predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert(predicate(),'Operation did not settle'); };

test('two planning stores share drafts, reject stale writes and retain previous revisions', async()=>{
 const cloud=backend(),a=new PlanningStore(),b=new PlanningStore();
 await attachCloudPersistence({'timetable-planning.json':a},cloud);await attachCloudPersistence({'timetable-planning.json':b},cloud);
 const draft=a.readDraft(noah);draft.project.name='School shared draft';
 const input={project:draft.project,expectedRevision:0,operationId:'first-planning-operation'};
 const saved=await a.saveDraft(noah,input);assert.equal(saved.revision,1);
 assert.equal((await a.saveDraft(noah,input)).revision,1);
 const competing=b.readDraft(zara);competing.project.name='Stale computer';
 await assert.rejects(b.saveDraft(zara,{project:competing.project,expectedRevision:0,operationId:'second-planning-operation'}),e=>e.status===409);
 await b.refreshCloud();assert.equal(b.readDraft(zara).project.name,'School shared draft');
 await assert.rejects(b.saveDraft(zara,{...input,project:{...input.project,name:'Changed reused operation'}}),e=>e.status===409);
 const restarted=new PlanningStore();await attachCloudPersistence({'timetable-planning.json':restarted},cloud);
 assert.equal(restarted.readDraft(noah).revision,1);assert.equal(restarted.readDraft(noah).history[0].updatedBy.id,noah.id);
 assert.equal(restarted.readDraft(noah,true).project,undefined);
});
test('invalid projects, unauthorized roles and failed writes cannot damage the confirmed shared draft',async()=>{
 const cloud=backend(),store=new PlanningStore();await attachCloudPersistence({'timetable-planning.json':store},cloud);
 for(const role of ['student','parent','technician'])assert.throws(()=>store.readDraft({id:'test',role}),e=>e.status===403);
 const project=store.readDraft(noah).project;project.groups[0].year='WRONG';
 await assert.rejects(store.saveDraft(noah,{project,expectedRevision:0,operationId:'invalid-planning-operation'}),e=>e.status===400);
 const good=store.readDraft(noah).project;cloud.save=async()=>{throw Object.assign(Error('Offline'),{status:503});};
 await assert.rejects(store.saveDraft(noah,{project:good,expectedRevision:0,operationId:'offline-planning-operation'}),e=>e.status===503);
 assert.equal(store.readDraft(noah).revision,0);
});
test('client serialises rapid edits and saves the newest draft against the acknowledged revision',async()=>{
 let complete;const calls=[];
 const client=createSharedPlanningClient({request:async(write,body)=>{if(!write)return{revision:0,project:{name:'Original'}};calls.push(body);if(calls.length===1)return await new Promise(resolve=>{complete=resolve;});return{revision:2};}});
 await client.load();client.save({name:'First'});client.save({name:'Latest'});assert.equal(calls.length,1);
 complete({revision:1});await until(()=>!client.status().saving);
 assert.equal(calls[1].expectedRevision,1);assert.equal(calls[1].project.name,'Latest');assert.equal(client.status().revision,2);assert.equal(client.status().dirty,false);
});
test('uncertain network saves retry the original operation before newer changes',async()=>{
 const calls=[];let attempts=0;
 const client=createSharedPlanningClient({request:async(write,body)=>{if(!write)return{revision:0,project:{}};calls.push(body);if(++attempts===1)throw Error('Network lost after commit');return{revision:attempts===2?1:2};}});
 await client.load();client.save({name:'First'});await until(()=>!client.status().saving);client.save({name:'Newer'});
 assert.equal(calls.length,1);assert(client.status().dirty);await client.retry();
 assert.equal(calls[0].operationId,calls[1].operationId);assert.equal(calls[2].expectedRevision,1);assert.equal(calls[2].project.name,'Newer');assert.equal(client.status().dirty,false);
});
test('conflicts retain edits and never retry automatically; metadata checks do not replace the draft',async()=>{
 let remoteRevision=4,writeCount=0;
 const client=createSharedPlanningClient({request:async(write)=>{if(!write)return{revision:remoteRevision,project:{name:'Remote'}};writeCount++;throw Object.assign(Error('Another computer saved'),{status:409});}});
 await client.load();client.save({name:'My unsaved work'});await until(()=>!client.status().saving);assert(client.status().conflict);assert(client.status().dirty);
 await client.retry();assert.equal(writeCount,1);
 remoteRevision=5;const latest=await client.load();assert.equal(latest.revision,5);assert.equal(client.status().dirty,false);
 remoteRevision=6;await client.check();assert(client.status().remoteChanged);assert.equal(client.status().revision,5);
});
test('an older metadata response cannot mark a just-confirmed save as stale',async()=>{
 let readCount=0,releaseCheck;
 const client=createSharedPlanningClient({request:async write=>{if(write)return{revision:1};if(++readCount===1)return{revision:0,project:{}};return new Promise(resolve=>{releaseCheck=resolve;});}});
 await client.load();const check=client.check();client.save({name:'New save'});await until(()=>!client.status().saving);releaseCheck({revision:0});await check;assert.equal(client.status().remoteChanged,false);assert.equal(client.status().revision,1);
});
test('HTTP planning draft saves are shared across independent servers and staff sessions, with role and conflict checks',async()=>{
 const cloud=backend(),servers=[];
 async function start(){const server=createAppServer({planningFile:null,attendanceFile:null,gradesFile:null,messagesFile:null,reportsFile:null,directoryFile:null,classroomFile:null,credentialsFile:null,cloudBackend:cloud});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));servers.push(server);const base='http://127.0.0.1:'+server.address().port;assert.equal((await fetch(base+'/healthz')).status,200);return base;}
 async function login(base,username,password='WistTest2026!'){const r=await fetch(base+'/api/login',{method:'POST',body:JSON.stringify({username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
 try{const a=await start(),b=await start(),ca=await login(a,'noah.morgan'),cb=await login(b,'zara.campbell');
 const first=await(await fetch(a+'/api/planning/draft',{headers:{cookie:ca}})).json();const stale=structuredClone(first);first.project.name='Cross-computer planning';
 const input={project:first.project,expectedRevision:first.revision,operationId:'http-planning-operation'};
 assert.equal((await fetch(a+'/api/planning/draft',{method:'PUT',headers:{cookie:ca},body:JSON.stringify(input)})).status,200);
 const latest=await(await fetch(b+'/api/planning/draft',{headers:{cookie:cb}})).json();assert.equal(latest.project.name,'Cross-computer planning');assert.equal(latest.revision,1);
 assert.equal((await fetch(b+'/api/planning/draft',{method:'PUT',headers:{cookie:cb},body:JSON.stringify({project:stale.project,expectedRevision:0,operationId:'stale-http-planning-operation'})})).status,409);
 const pupil=await login(b,'100837','WistLearn2026!');assert.equal((await fetch(b+'/api/planning/draft',{headers:{cookie:pupil}})).status,403);
 assert.equal((await fetch(b+'/api/planning/draft')).status,403);
 latest.project.name='Ўзбекистон · Расписание';
 const bytes=Buffer.from(JSON.stringify({project:latest.project,expectedRevision:1,operationId:'unicode-http-planning-operation'})),cut=bytes.indexOf(Buffer.from('Ў'))+1;
 const code=await new Promise((resolve,reject)=>{const r=http.request(b+'/api/planning/draft',{method:'PUT',headers:{cookie:cb,'Content-Type':'application/json'}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});r.on('error',reject);r.setNoDelay(true);r.write(bytes.subarray(0,cut));setTimeout(()=>r.end(bytes.subarray(cut)),5);});
 assert.equal(code,200);assert.equal((await(await fetch(a+'/api/planning/draft',{headers:{cookie:ca}})).json()).project.name,latest.project.name);
 }finally{await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));}
});
