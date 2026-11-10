import {createIncidentsApi} from '../incidents-store.mjs';
import {createOptionsApi} from '../option-choices.mjs';
import {createSupportApi} from '../support-management.mjs';
import {AdminRegistry,createAdminApi} from '../admin-registry.mjs';
import {createFamilyApi} from '../family-portal.mjs';
import {parentAccount,parentActor,PARENT_TEST_PASSWORD} from '../dist/parent-accounts.mjs';
import {ClassroomStore,createClassroomApi} from '../classroom-store.mjs';
import {StudentCredentials} from '../student-credentials.mjs';
import {studentAccount,studentActor} from '../dist/student-accounts.mjs';
import {createReportLibraryApi} from '../report-library.mjs';
import {AttendanceStore,createAttendanceApi} from '../attendance-store.mjs';
import {GradeStore,createGradesApi} from '../grades-store.mjs';
import {MessageStore,createMessagesApi} from '../messages-store.mjs';
import {DirectoryStore,createDirectoryApi} from '../directory-store.mjs';
import {ReportStore} from '../reports-store.mjs';
import {createReportsApi} from '../reports-api.mjs';
import {teacherById} from '../dist/teaching-data.mjs';
import {REPORT_REVIEWER} from '../dist/report-config.mjs';
import {resolveTestAccount} from '../dist/test-accounts.mjs';
import {readFile,seedFiles} from './browser-fs.mjs';
const SESSION_KEY='wist-demo-teacher',PASSWORD='WistTest2026!';
let stores,handlers,credentials,registry,queue=Promise.resolve();
const withLock=work=>navigator.locks?navigator.locks.request('wist-demo-records',work):work();
function teacher(){const id=sessionStorage.getItem(SESSION_KEY);if(registry){if(sessionStorage.getItem('wist-account-version')!==registry.version(id))return null;return registry.actor(id);}const a=studentActor(id);if(a&&Number(sessionStorage.getItem('wist-student-version'))!==credentials?.version(id))return null;return a||parentActor(id)||(id===REPORT_REVIEWER.id?REPORT_REVIEWER:teacherById(id)||null);}
export async function needsSeed(){for(const name of ['attendance.json','grades.json','messages.json','directory.json','report-cards.json']){try{await readFile('/data/'+name);}catch(e){if(e.code==='ENOENT')return true;throw e;}}return false;}
export async function initialize(seed){if(seed)await withLock(()=>seedFiles(seed));const attendance=new AttendanceStore('/data/attendance.json'),grades=new GradeStore('/data/grades.json'),messages=new MessageStore('/data/messages.json'),directory=new DirectoryStore('/data/directory.json'),reports=new ReportStore('/data/report-cards.json',{grades,attendance});credentials=new StudentCredentials('/data/student-credentials.json');const classroom=new ClassroomStore('/data/classroom.json',{grades});stores=[attendance,grades,messages,directory,reports,credentials,classroom];await Promise.all(stores.map(s=>s.ready));registry=new AdminRegistry(directory,credentials);credentials.accountRegistry=registry;registry.apply();const auth={sessionTeacher:teacher,lastLoginFor:id=>sessionStorage.getItem('wist-demo-login-'+id)};handlers=[createIncidentsApi(registry,auth),createOptionsApi(registry,auth),createSupportApi(registry,auth),createAdminApi(registry,auth),createFamilyApi({classroom,grades,attendance,reports,directory},auth),createClassroomApi(classroom,credentials,auth),createReportLibraryApi({attendance,grades,directory,reports},auth),createAttendanceApi(attendance,auth),createGradesApi(grades,auth),createMessagesApi(messages,auth),createDirectoryApi(directory,auth),createReportsApi(reports,auth)];}
async function handle(input,init={}){const original=new URL(typeof input==='string'?input:input.url,location.href),url=new URL('https://demo.invalid'+original.pathname.replace(/^\/[^/]+\/api\//,'/api/')+original.search);const method=(init.method||input.method||'GET').toUpperCase(),body=init.body??(input instanceof Request?await input.text():'');
 for(const store of stores){try{store.state=JSON.parse(await readFile(store.filename));}catch(e){if(e.code!=='ENOENT')throw e;}}
 registry.apply();
 if(url.pathname==='/api/login'&&method==='POST'){const d=JSON.parse(body),actor=registry.resolve(d.username);if(!actor||(actor.role==='parent'?d.password!==PARENT_TEST_PASSWORD:!await registry.verify(actor,d.password)))return Response.json({error:'Incorrect username or test password.'},{status:401});sessionStorage.setItem(SESSION_KEY,actor.id);sessionStorage.setItem('wist-account-version',registry.version(actor.id));if(actor.role==='student')sessionStorage.setItem('wist-student-version',String(credentials.version(actor.id)));sessionStorage.setItem('wist-demo-login-'+actor.id,new Date().toISOString());return Response.json({teacher:actor});}
 if(url.pathname==='/api/logout'){sessionStorage.removeItem(SESSION_KEY);return Response.json({ok:true});}
 if(url.pathname==='/api/session')return teacher()?Response.json({teacher:teacher()}):Response.json({error:'Choose a fictional test account.'},{status:401});
 if(teacher()?.role==='technician'&&!url.pathname.startsWith('/api/support/'))return Response.json({error:'Technician access is limited to technical support.'},{status:403});
 if(teacher()?.role==='parent'&&!url.pathname.startsWith('/api/family/'))return Response.json({error:'Parent access is limited to the family portal.'},{status:403});
 if(teacher()?.role==='student'&&!url.pathname.startsWith('/api/classroom/'))return Response.json({error:'Student access is limited to Classroom.'},{status:403});
 const req={method,headers:{host:location.host},async *[Symbol.asyncIterator](){if(body)yield typeof body==='string'?body:new TextDecoder().decode(body);}};
 let response,code=200,headers={};const res={writeHead(status,values){code=status;headers=values;return this;},end(value){response=new Response(value??null,{status:code,headers});return this;}};
 for(const handler of handlers)if(await handler(req,res,url))return response;
 return Response.json({error:'Unknown browser-demo endpoint.'},{status:404});
}
export function demoFetch(input,init){const work=queue.then(()=>withLock(()=>handle(input,init)));queue=work.catch(()=>{});return work.catch(error=>Response.json({error:error.message||'Browser storage is unavailable; changes were not saved.'},{status:error.status||400}));}
