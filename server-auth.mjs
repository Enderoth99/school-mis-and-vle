import {parentAccount,parentActor,PARENT_TEST_PASSWORD} from './dist/parent-accounts.mjs';
import {sameOrigin,sessionCookieFlags} from './request-security.mjs';
import {REPORT_REVIEWER} from './dist/report-config.mjs';
import {resolveTestAccount} from './dist/test-accounts.mjs';
import {randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {studentAccount,studentActor} from './dist/student-accounts.mjs';
import {teacherById} from './dist/teaching-data.mjs';

// Public, deliberately shared fixture password. Never a real school credential.
export const TEST_PASSWORD='WistTest2026!';
const salt=randomBytes(16),passwordHash=scryptSync(TEST_PASSWORD,salt,32),parentHash=scryptSync(PARENT_TEST_PASSWORD,salt,32);
const SESSION_MS=8*60*60*1000;
export function createAuth({credentials,registry}={}){
 const sessions=new Map(),lastLogins=new Map();
 const sessionTeacher=req=>{const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('wist_session='))?.slice(13);const session=sessions.get(token);if(!session)return null;if(session.expires<Date.now()){sessions.delete(token);return null;}if(session.accountVersion!==undefined&&registry?.version(session.teacherId)!==session.accountVersion)return null;if(registry)return registry.actor(session.teacherId);if(session.studentVersion!==undefined&&credentials?.version(session.teacherId)!==session.studentVersion)return null;return parentActor(session.teacherId)||studentActor(session.teacherId)||(session.teacherId===REPORT_REVIEWER.id?REPORT_REVIEWER:teacherById(session.teacherId)||null);};
 const send=(res,status,data,extra={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra});res.end(JSON.stringify(data));};
 return {sessionTeacher,lastLoginFor:id=>lastLogins.get(id)||null,async handle(req,res,pathname){
  if(!pathname.startsWith('/api/'))return false;
  if(pathname==='/api/session'&&req.method==='GET'){const teacher=sessionTeacher(req);send(res,teacher?200:401,teacher?{teacher}:{error:'Sign in to a test teacher account.'});return true;}
  if(['/api/login','/api/logout'].includes(pathname)&&req.method==='POST'){
   const origin=req.headers.origin;if(!sameOrigin(req)){send(res,403,{error:'This request must come from the local test site.'});return true;}
   if(pathname==='/api/logout'){const token=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('wist_session='))?.slice(13);sessions.delete(token);send(res,200,{ok:true},{'Set-Cookie':`wist_session=; ${sessionCookieFlags()}; Max-Age=0`});return true;}
   try{
    let body='';for await(const chunk of req){body+=chunk.toString();if(body.length>4096){send(res,413,{error:'Login request too large.'});return true;}}
    const data=JSON.parse(body);const teacher=(registry?registry.resolve(data.username):resolveTestAccount(data.username)||studentAccount(data.username)||parentAccount(data.username));const supplied=scryptSync(String(data.password||''),salt,32);
    if(!teacher||(registry&&teacher.role!=='parent'?!await registry.verify(teacher,data.password):teacher.role==='student'?!await credentials?.verify(teacher.id,data.password):!timingSafeEqual(supplied,teacher.role==='parent'?parentHash:passwordHash))){send(res,401,{error:'Incorrect username or test password.'});return true;}
    const token=randomBytes(32).toString('hex');for(const [key,value] of sessions)if(value.expires<Date.now())sessions.delete(key);sessions.set(token,{teacherId:teacher.id,expires:Date.now()+SESSION_MS,...(teacher.role==='student'?{studentVersion:credentials.version(teacher.id)}:{}),...(registry?{accountVersion:registry.version(teacher.id)}:{})});lastLogins.set(teacher.id,new Date().toISOString());
    send(res,200,{teacher},{'Set-Cookie':`wist_session=${token}; ${sessionCookieFlags()}; Max-Age=${SESSION_MS/1000}`});return true;
   }catch{send(res,400,{error:'Enter a username and password.'});return true;}
  }
  send(res,404,{error:'Unknown test API endpoint.'});return true;
 }};
}
