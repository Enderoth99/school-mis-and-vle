import {sameOrigin} from './request-security.mjs';
import {attendanceOverview} from './dist/attendance-overview.mjs';
import {REPORT_REVIEWER} from './dist/report-config.mjs';
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {classesForTeacher,timetableForTeacher} from './dist/teaching-data.mjs';
import {keyFor,isDate} from './dist/model.mjs';
import {registerContext,normalizeRegister,attendanceReport} from './dist/attendance-tracking.mjs';

const fail=(status,message)=>Object.assign(new Error(message),{status});
export class AttendanceStore{
 constructor(filename){this.filename=filename;this.state={version:1,registers:{}};this.queue=Promise.resolve();this.ready=this.read();this.ready.catch(()=>{});}
 async read(){if(!this.filename)return;try{const saved=JSON.parse(await readFile(this.filename,'utf8'));if(saved.version!==1||!saved.registers)throw new Error('Invalid attendance store.');this.state=saved;}catch(error){if(error.code!=='ENOENT')throw error;}}
 checkTeacher(teacherId,classId){if(!classesForTeacher(teacherId).some(c=>c.id===classId))throw fail(403,'This teaching group is not allocated to your account.');}
 async refreshCloud(){if(!this.cloud)return;const fresh=await this.cloud.backend.load(this.cloud.name,this.cloud.snapshot);if(!fresh)throw Object.assign(Error('Shared records are missing. No changes were saved.'),{status:503});this.cloud.snapshot=fresh;this.state=fresh.state;}
 async transact(change){const work=async()=>{await this.ready;await this.refreshCloud();const next=structuredClone(this.state),result=await change(next);if(this.cloud){this.cloud.snapshot=await this.cloud.backend.save(this.cloud.name,next,this.cloud.snapshot);}else if(this.filename){await mkdir(path.dirname(this.filename),{recursive:true});await writeFile(this.filename+'.tmp',JSON.stringify(next),'utf8');await rename(this.filename+'.tmp',this.filename);}this.state=next;return result;};const pending=this.queue.then(work,work);this.queue=pending.catch(()=>{});return pending;}
 async context(teacherId,target){this.checkTeacher(teacherId,target.classId);await this.ready;await this.queue;return registerContext(this.state.registers,target);}
 async save(teacherId,target){this.checkTeacher(teacherId,target.classId);return this.transact(next=>{const key=keyFor(target.date,target.classId,target.period),old=next.registers[key];if(!Number.isInteger(target.expectedRevision)||target.expectedRevision!==(old?.revision||0))throw fail(409,'This register was updated elsewhere. Your draft is still open; reload the saved register before replacing it.');const register=normalizeRegister(target,{teacherId,revision:(old?.revision||0)+1});next.registers[key]=register;return register;});}
 async importLegacy(teacherId,registers){const allowed=new Set(classesForTeacher(teacherId).map(c=>c.id));return this.transact(next=>{let imported=0,skipped=0;for(const source of registers){if(!allowed.has(source.classId)){skipped++;continue;}const key=keyFor(source.date,source.classId,source.period),old=next.registers[key],sourceStamp=source.legacyUpdatedAt||source.updatedAt||'';if(old&&!(old.origin==='browser-migration'&&sourceStamp>old.legacyUpdatedAt)){skipped++;continue;}const register=normalizeRegister(source,{teacherId,revision:(old?.revision||0)+1,legacy:true});next.registers[key]={...register,origin:'browser-migration',legacyUpdatedAt:sourceStamp};imported++;}return{imported,skipped};});}
 async day(teacherId,date){if(!isDate(date))throw Error('Choose a valid attendance date.');await this.ready;await this.queue;return timetableForTeacher(teacherId,date).map(lesson=>({...lesson,...registerContext(this.state.registers,{date,classId:lesson.classId,period:lesson.period})}));}
 async report(teacherId,query){if(teacherId!==REPORT_REVIEWER.id)this.checkTeacher(teacherId,query.classId);await this.ready;await this.queue;return attendanceReport(this.state.registers,query);}
 async overview(teacherId,date){await this.ready;await this.queue;return attendanceOverview(this.state.registers,{date,teacherId,all:teacherId===REPORT_REVIEWER.id});}
 async owned(teacherId){await this.ready;await this.queue;const allowed=new Set(classesForTeacher(teacherId).map(c=>c.id));return Object.values(this.state.registers).filter(r=>allowed.has(r.classId));}
}
export function createAttendanceApi(store,auth){
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 return async(req,res,url)=>{
  if(!url.pathname.startsWith('/api/attendance/'))return false;
  const teacher=auth.sessionTeacher(req);if(!teacher){send(res,401,{error:'Your test session has ended. Sign in again; your draft has not been saved.'});return true;}
  try{
   const query=Object.fromEntries(url.searchParams);
   if(req.method==='GET'){
    if(url.pathname==='/api/attendance/overview')send(res,200,await store.overview(teacher.id,query.date));
    else if(url.pathname==='/api/attendance/day')send(res,200,{lessons:await store.day(teacher.id,query.date)});
    else if(url.pathname==='/api/attendance/context')send(res,200,await store.context(teacher.id,query));
    else if(url.pathname==='/api/attendance/report')send(res,200,{entries:await store.report(teacher.id,query)});
    else if(url.pathname==='/api/attendance/owned')send(res,200,{registers:await store.owned(teacher.id)});
    else send(res,404,{error:'Unknown attendance endpoint.'});
    return true;
   }
   if(req.method==='PUT'||req.method==='POST'){
    if(!sameOrigin(req))throw fail(403,'Use the local MIS page to save attendance.');
    let text='';for await(const chunk of req){text+=chunk;if(text.length>1500000)throw fail(413,'Attendance request is too large.');}const body=JSON.parse(text);
    if(url.pathname==='/api/attendance/register'&&req.method==='PUT')send(res,200,{register:await store.save(teacher.id,body)});
    else if(url.pathname==='/api/attendance/import'&&req.method==='POST'&&Array.isArray(body.registers))send(res,200,await store.importLegacy(teacher.id,body.registers));
    else send(res,404,{error:'Unknown attendance endpoint.'});
    return true;
   }
   send(res,405,{error:'Unsupported attendance request.'});
  }catch(error){send(res,error.status||400,{error:error.message});}
  return true;
 };
}
