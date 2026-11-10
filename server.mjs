import {PlanningStore,createPlanningApi} from './planning-store.mjs';
import {createWorkspaceApi} from './workspace-store.mjs';
import {createIncidentsApi} from './incidents-store.mjs';
import {createOptionsApi} from './option-choices.mjs';
import {createSupportApi} from './support-management.mjs';
import {AdminRegistry,createAdminApi} from './admin-registry.mjs';
import {createFamilyApi} from './family-portal.mjs';
import {ClassroomStore,createClassroomApi} from './classroom-store.mjs';
import {StudentCredentials} from './student-credentials.mjs';
import {createReportLibraryApi} from './report-library.mjs';
import {CloudJsonStorage,attachCloudPersistence} from './cloud-storage.mjs';
import {SessionStore} from './session-store.mjs';
import {DirectoryStore,createDirectoryApi} from './directory-store.mjs';
import {ReportStore} from './reports-store.mjs';
import {createReportsApi} from './reports-api.mjs';
import {MessageStore,createMessagesApi} from './messages-store.mjs';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {createAuth} from './server-auth.mjs';
import {AttendanceStore,createAttendanceApi} from './attendance-store.mjs';
import {GradeStore,createGradesApi} from './grades-store.mjs';

const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.csv':'text/csv; charset=utf-8'};
export function createAppServer({attendanceFile=path.resolve(root,'../.data/attendance.json'),gradesFile=path.resolve(root,'../.data/grades.json'),messagesFile=path.resolve(root,'../.data/messages.json'),reportsFile=path.resolve(root,'../.data/report-cards.json'),directoryFile=path.resolve(root,'../.data/directory.json'),classroomFile=path.resolve(root,'../.data/classroom.json'),credentialsFile=path.resolve(root,'../.data/student-credentials.json'),planningFile=path.resolve(root,'../.data/timetable-planning.json'),cloudBackend=null,basePath=process.env.WIST_BASE_PATH||'',cookieName=process.env.WIST_SESSION_COOKIE||'wist_session',seedDir=process.env.WIST_SEED_DIR}={}){
if(basePath&&!/^\/[a-z0-9-]+$/.test(basePath))throw Error('Invalid MIS base path.');
const sessionStore=cloudBackend?new SessionStore():undefined;
const credentials=new StudentCredentials(credentialsFile),directoryStore=new DirectoryStore(directoryFile),registry=new AdminRegistry(directoryStore,credentials);credentials.accountRegistry=registry;const auth=createAuth({credentials,registry,sessionStore,cookieName,features:cloudBackend?{sharedWorkspace:true}:undefined}),adminApi=createAdminApi(registry,auth),supportApi=createSupportApi(registry,auth),optionsApi=createOptionsApi(registry,auth),incidentsApi=createIncidentsApi(registry,auth),directoryApi=createDirectoryApi(directoryStore,auth);
const planningStore=new PlanningStore(planningFile),planningApi=createPlanningApi(planningStore,auth);
const workspaceApi=createWorkspaceApi(directoryStore,auth);
const messageStore=new MessageStore(messagesFile),messagesApi=createMessagesApi(messageStore,auth);
const gradesStore=new GradeStore(gradesFile),attendanceStore=new AttendanceStore(attendanceFile);
const classroom=new ClassroomStore(classroomFile,{grades:gradesStore}),classroomApi=createClassroomApi(classroom,credentials,auth);
const gradesApi=createGradesApi(gradesStore,auth);
const attendanceApi=createAttendanceApi(attendanceStore,auth);
const reportStore=new ReportStore(reportsFile,{grades:gradesStore,attendance:attendanceStore}),reportsApi=createReportsApi(reportStore,auth);
const libraryApi=createReportLibraryApi({attendance:attendanceStore,grades:gradesStore,directory:directoryStore,reports:reportStore},auth);
const familyApi=createFamilyApi({classroom,grades:gradesStore,attendance:attendanceStore,reports:reportStore,directory:directoryStore},auth);
const stores={'timetable-planning.json':planningStore,'classroom.json':classroom,'student-credentials.json':credentials,'attendance.json':attendanceStore,'grades.json':gradesStore,'messages.json':messageStore,'report-cards.json':reportStore,'directory.json':directoryStore};
if(sessionStore)stores['sessions.json']=sessionStore;
const ready=cloudBackend?(async()=>{const initialStates={};if(seedDir)for(const name of Object.keys(stores)){try{initialStates[name]=JSON.parse(await readFile(path.join(seedDir,name),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}}await attachCloudPersistence(stores,cloudBackend,initialStates);})():Promise.resolve();ready.catch(()=>{});let apiQueue=Promise.resolve();
async function handleApi(req,res,url){await ready;if(cloudBackend)await Promise.all(Object.values(stores).map(store=>store.refreshCloud()));await Promise.all([credentials.ready,classroom.ready,directoryStore.ready]);registry.apply();const actor=auth.sessionTeacher(req);if(actor?.role==='technician'&&!url.pathname.startsWith('/api/support/')&&!['/api/session','/api/logout','/api/login'].includes(url.pathname)){res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Technician access is limited to technical support.'}));return;}if(await supportApi(req,res,url))return;if(actor?.role==='parent'&&!url.pathname.startsWith('/api/family/')&&!['/api/session','/api/logout','/api/login'].includes(url.pathname)){res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Parent access is limited to the family portal.'}));return;}if(await familyApi(req,res,url))return;if(actor?.role==='student'&&!url.pathname.startsWith('/api/classroom/')&&!['/api/session','/api/logout','/api/login'].includes(url.pathname)){res.writeHead(403,{'Content-Type':'application/json'}).end(JSON.stringify({error:'Student access is limited to Classroom.'}));return;}if(await planningApi(req,res,url))return;if(await workspaceApi(req,res,url))return;if(await incidentsApi(req,res,url))return;if(await adminApi(req,res,url))return;if(await optionsApi(req,res,url))return;if(await classroomApi(req,res,url))return;if(await libraryApi(req,res,url))return;if(await directoryApi(req,res,url))return;if(await reportsApi(req,res,url))return;if(await messagesApi(req,res,url))return;if(await gradesApi(req,res,url))return;if(await attendanceApi(req,res,url))return;await auth.handle(req,res,url.pathname);}

return http.createServer(async (req,res) => {
  try {
    const url=new URL(req.url,'http://localhost');
    let pathname = decodeURIComponent(url.pathname);
    if(pathname==='/healthz'){await ready;res.writeHead(200,{'Content-Type':'text/plain'}).end('ok');return;}
    if(basePath){if(pathname===basePath||pathname.startsWith(basePath+'/')){pathname=pathname.slice(basePath.length)||'/';url.pathname=pathname;}else{res.writeHead(404).end('Not found');return;}}
    if(pathname.startsWith('/api/')){if(cloudBackend){const work=apiQueue.then(()=>handleApi(req,res,url));apiQueue=work.catch(()=>{});await work;}else await handleApi(req,res,url);return;}
    if(pathname==='/'||pathname==='/index.html'){await ready;if(cloudBackend){await Promise.all([sessionStore,credentials,directoryStore].map(store=>store.refreshCloud()));registry.apply();}if(!auth.sessionTeacher(req)){res.writeHead(302,{Location:basePath+'/login.html','Cache-Control':'no-store'}).end();return;}}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!target.startsWith(root + path.sep)) {res.writeHead(403).end();return;}
    const content = await readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    res.end(req.method==='HEAD'?undefined:content);
  } catch(error) {if(!res.headersSent){const api=req.url.startsWith('/api/')||basePath&&req.url.startsWith(basePath+'/api/');res.writeHead(api?(error.status||503):404,{'Content-Type':api?'application/json':'text/plain'}).end(api?JSON.stringify({error:'Shared service unavailable. Your draft has not been saved.'}):'Not found');}} 
});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const server=createAppServer({cloudBackend:process.env.WIST_STORAGE_BUCKET?new CloudJsonStorage(process.env.WIST_STORAGE_BUCKET):null});server.listen(Number(process.env.PORT || 4317),process.env.HOST||'127.0.0.1',()=>console.log(`Teacher workspace: http://127.0.0.1:${server.address().port}`));
}
