import {AttendanceStore} from './attendance-store.mjs';
import {readFile} from 'node:fs/promises';
import {students} from './dist/school-data.mjs';
import {studentActor,STUDENT_TEST_PASSWORD} from './dist/student-accounts.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function digest(password,salt){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256)));}
export class StudentCredentials extends AttendanceStore{
 constructor(filename){super(null);this.filename=filename;this.state={version:1,credentials:{},audit:[]};this.ready=this.readCredentials();this.ready.catch(()=>{});}
 async readCredentials(){if(!this.filename)return;try{this.state=JSON.parse(await readFile(this.filename,'utf8'));if(this.state.version!==1||!this.state.credentials||!Array.isArray(this.state.audit))throw Error('Invalid credential store.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 version(id){return this.state.credentials[id]?.version||0;}
 async verify(id,password){await this.ready;const record=this.state.credentials[id];if(!studentActor(id))return false;if(!record)return password===STUDENT_TEST_PASSWORD;if(typeof password!=='string'||password.length>128)return false;const hash=await digest(password,record.salt);let diff=0;for(let i=0;i<hash.length;i++)diff|=hash.charCodeAt(i)^record.hash.charCodeAt(i);return diff===0;}
 async reset(actor,{studentId,password}){if(this.accountRegistry)return this.accountRegistry.resetPassword(actor,{studentId,password});if(actor?.role!=='report-reviewer'||actor.id!=='report-reviewer')throw fail(403,'Only an administrator can reset student passwords.');if(!studentActor(studentId))throw fail(404,'Student not found.');if(typeof password!=='string'||password.length<8||password.length>128)throw fail(400,'Use a password of 8–128 characters.');const salt=hex(crypto.getRandomValues(new Uint8Array(24))),hash=await digest(password,salt);return this.transact(next=>{const version=(next.credentials[studentId]?.version||0)+1;next.credentials[studentId]={salt,hash,version,updatedAt:new Date().toISOString()};next.audit.push({studentId,actorId:actor.id,at:new Date().toISOString(),version});return{studentId,version};});}
 list(actor){if(actor?.role!=='report-reviewer'||actor.id!=='report-reviewer')throw fail(403,'Administrator access required.');return students.map(s=>({id:s.id,name:s.name,studentNumber:s.studentNumber,year:s.year,cohort:s.cohort,groupName:s.groupName,passwordChangedAt:this.accountRegistry?.directory.state.accountAuth?.[s.id]?.updatedAt||this.state.credentials[s.id]?.updatedAt||null}));}
}
