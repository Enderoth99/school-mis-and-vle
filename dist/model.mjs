import {teachingClasses as classes,TEACHING_VERSION,teachers,teacherById,activeTimetableInfo} from './teaching-data.mjs';
import {schoolPeriods} from './school-week.mjs';
export {classes,TEACHING_VERSION,teachers,teacherById};
import {DATASET_VERSION,students,groups,yearGroups,yearLabel,groupById,studentsForGroup} from './school-data.mjs';
export {DATASET_VERSION,students,groups,yearGroups,yearLabel,groupById,studentsForGroup};
export const VERSION = 1;
export const STORAGE_KEY = 'wist-teacher-prototype-v1';
export const statuses = ['Not Taken','Present','Internal Inclusion','Absent (Excused)','Absent (Unexcused)','Late (Excused)','Late (Unexcused)','Left Early (Excused)','Left Early (Unexcused)'];
export const periods = schoolPeriods;
export const timetable = [{period:'R',classId:'homeroom11a'},{period:'1',classId:'business11b'},{period:'2',classId:'business11b'},{period:'4',classId:'computing9a'},{period:'5',classId:'economics10c'},{period:'6',classId:'computing7c'},{period:'8',classId:'computing7b'}];
export const classById = id => classes.find(c=>c.id===id);
export const studentById = id => students.find(s=>s.id===id);
export const roster = id => {const c=classById(id);return c?c.studentIds.map(studentById):[];};
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const keyFor = (date,classId,period) => `${date}|${classId}|${period}`;
export const isDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value+'T12:00:00')) && new Date(value+'T12:00:00').toISOString().slice(0,10)===value;
export function seed(date=today()) {
  const attendance={};
  for(const [index,lesson] of timetable.entries()) {
    if(index>3) continue;
    attendance[keyFor(date,lesson.classId,lesson.period)]={date,classId:lesson.classId,period:lesson.period,updatedAt:new Date().toISOString(),records:roster(lesson.classId).map((s,i)=>({studentId:s.id,status:i===0&&index!==2?'Absent (Excused)':i===1&&index===0?'Late (Unexcused)':'Present',note:'',time:i===1&&index===0?'08:22':''}))};
  }
  return {version:VERSION,datasetVersion:DATASET_VERSION,teachingVersion:TEACHING_VERSION,teacherPreferences:{},attendance,assignments:[{id:'a1',classId:'computing9a',title:'Algorithms and flowcharts',due:date,points:20,description:'Design and trace an algorithm using a flowchart.'},{id:'a2',classId:'business11b',title:'Business ownership case study',due:shiftDate(date,3),points:30,description:'Compare two ownership structures and justify your choice.'}],grades:{a1:Object.fromEntries(roster('computing9a').slice(0,8).map((s,i)=>[s.id,12+(i%8)]))},lessons:[{id:'l1',classId:'computing9a',title:'Thinking in algorithms',date,objective:'Use sequence, selection and iteration to solve a problem.',taught:false}],events:[{id:'e1',title:'School year starts',date:'2026-08-17',type:'School',fixed:true},{id:'e2',title:'Trimester 1 ends',date:'2026-12-18',type:'School',fixed:true},{id:'e3',title:'Department planning',date:shiftDate(date,3),time:'15:45',type:'Personal',teacherId:classById('computing9a').teacherId}],incidents:[],reports:activeTimetableInfo()?[]:classes.filter(c=>!['Homeroom','Assembly'].includes(c.subject)).flatMap(c=>roster(c.id).map((s,i)=>({id:`${c.id}-${s.id}`,studentId:s.id,classId:c.id,status:i<6?'draft':i<10?'pending':'approved',grade:i<6?'':'B',effort:i<6?'':'Good',comment:i<6?'':'This sample learner contributes well in class and should continue practising independent problem solving.',updatedAt:null}))),favorites:[],reportHistory:[]};
}
export function shiftDate(date,offset) {const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+offset);return d.toISOString().slice(0,10);}
export function validateAttendance(classId,records) {
  const ids=roster(classId).map(s=>s.id);
  if(!ids.length || records.length!==ids.length || new Set(records.map(r=>r.studentId)).size!==ids.length) throw new Error('The register must contain every student exactly once.');
  for(const r of records) {
    if(!ids.includes(r.studentId)||!statuses.includes(r.status))throw new Error('Invalid student or attendance status.');
    if(r.status.startsWith('Late') && !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time||''))throw new Error('Enter an arrival time for each late student.');
    if(typeof r.note!=='string'||r.note.length>1000)throw new Error('Attendance notes must be under 1,000 characters.');
  }
}
export function saveAttendance(state,{date,classId,period,records}) {
  if(!isDate(date)||!periods.some(p=>p[0]===period))throw new Error('Choose a valid date and lesson period.');
  validateAttendance(classId,records);
  if(records.some(r=>r.status==='Not Taken'))throw new Error('Record attendance for every student before saving.');
  const clean=records.map(r=>({...r,studentNumber:studentById(r.studentId).studentNumber,time:r.status.startsWith('Late')?r.time:''}));
  state.attendance[keyFor(date,classId,period)]={date,classId,period,records:clean,updatedAt:new Date().toISOString()};
}
export function attendanceSummary(records=[]) {return {present:records.filter(r=>r.status==='Present'||r.status==='Internal Inclusion').length,late:records.filter(r=>r.status.startsWith('Late')).length,absent:records.filter(r=>r.status.startsWith('Absent')).length,early:records.filter(r=>r.status.startsWith('Left Early')).length,untaken:records.filter(r=>r.status==='Not Taken').length};}
export function saveGrades(state,assignmentId,values) {
  const a=state.assignments.find(a=>a.id===assignmentId);if(!a)throw new Error('Assignment not found.');
  const allowed=roster(a.classId).map(s=>s.id),clean={};
  for(const [id,value] of Object.entries(values)){if(!allowed.includes(id))throw new Error('Student is not in this class.');if(value==='')continue;const n=Number(value);if(!Number.isFinite(n)||n<0||n>a.points)throw new Error(`Marks must be between 0 and ${a.points}.`);clean[id]=n;}
  state.grades[assignmentId]=clean;
}
export function updateReport(state,id,fields,submit=false) {
  const r=state.reports.find(r=>r.id===id);if(!r||r.status!=='draft')throw new Error('Only a draft report can be edited.');
  if(!['','A*','A','B','C','D','E','F','G','U'].includes(fields.grade)||!['','Excellent','Good','Developing','Needs support'].includes(fields.effort))throw new Error('Choose a valid grade and effort.');
  const comment=String(fields.comment||'').trim();if(comment.length>3000)throw new Error('Keep comments under 3,000 characters.');
  if(submit&&(!fields.grade||!fields.effort||comment.length<20))throw new Error('Add a grade, effort and a comment of at least 20 characters before submitting.');
  Object.assign(r,{grade:fields.grade,effort:fields.effort,comment,status:submit?'pending':'draft',updatedAt:new Date().toISOString()});
}
export function csv(rows) {return '\uFEFF'+rows.map(row=>row.map(value=>{let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');}
export function migrateDataset(saved,date=today()) {
  if(saved.datasetVersion===DATASET_VERSION)return saved;
  if(saved.datasetVersion!==undefined&&saved.datasetVersion!==1)throw new Error('This saved population uses an unsupported dataset version.');
  const next=structuredClone(saved);
  const oldForms={'7a':'7b','7b':'7c','10a':'10c'};
  const remap=id=>String(id).replace(/^s-(7a|7b|10a)-/,(_,form)=>`s-${oldForms[form]}-`);
  for(const register of Object.values(next.attendance)){
    const previous=new Map(register.records.map(record=>{const mapped={...record,studentId:remap(record.studentId)};return [mapped.studentId,mapped];}));
    const currentRoster=roster(register.classId);
    if(!currentRoster.length||[...previous.keys()].some(id=>!currentRoster.some(s=>s.id===id)))throw new Error('A saved register contains an unknown class or student; it has been preserved.');
    register.records=currentRoster.map(s=>previous.get(s.id)||{studentId:s.id,status:'Not Taken',note:'',time:''});
  }
  next.grades=Object.fromEntries(Object.entries(next.grades).map(([assignment,values])=>[assignment,Object.fromEntries(Object.entries(values).map(([id,value])=>[remap(id),value]))]));
  next.incidents=next.incidents.map(incident=>({...incident,studentId:remap(incident.studentId)}));
  const existing=new Map(next.reports.map(report=>{const mapped={...report,studentId:remap(report.studentId)};mapped.id=`${mapped.classId}-${mapped.studentId}`;return [mapped.id,mapped];}));
  next.reports=activeTimetableInfo()?[...existing.values()]:seed(date).reports.map(report=>existing.get(report.id)||{...report,status:'draft',grade:'',effort:'',comment:'',updatedAt:null});
  next.datasetVersion=DATASET_VERSION;
  return next;
}
export function migrateTeaching(saved,date=today()) {
  if(saved.teachingVersion===TEACHING_VERSION)return saved;
  const next=structuredClone(saved),existing=new Map(next.reports.map(r=>[r.id,r]));
  const legacyOwner=classById('computing9a').teacherId;
  next.reports=activeTimetableInfo()?[...existing.values()]:seed(date).reports.map(r=>existing.get(r.id)||{...r,status:'draft',grade:'',effort:'',comment:'',updatedAt:null});
  next.events=next.events.map(e=>e.fixed?e:{...e,teacherId:e.teacherId||legacyOwner});
  next.incidents=next.incidents.map(i=>({...i,teacherId:i.teacherId||legacyOwner}));
  next.teacherPreferences=next.teacherPreferences||{[legacyOwner]:{favorites:next.favorites||[],reportHistory:next.reportHistory||[]}};
  next.teachingVersion=TEACHING_VERSION;
  return next;
}
export function load(storage,date=today()) {
  const raw=storage.getItem(STORAGE_KEY);if(raw===null)return seed(date);
  const s=JSON.parse(raw);
  if(s.version!==VERSION||!s.attendance||!s.grades||!['assignments','lessons','events','incidents','reports','favorites','reportHistory'].every(k=>Array.isArray(s[k])))throw new Error('Saved prototype data could not be read. Export it before clearing browser storage.');
  return compactIntegratedWorkspace(migrateTeaching(migrateDataset(s,date),date));
}

// These exact, unedited placeholders were formerly generated for every course. Real edits and
// imported records remain; the authoritative report store is separate and is never touched here.
export function compactIntegratedWorkspace(state){
 if(!activeTimetableInfo())return state;
 const sample='This sample learner contributes well in class and should continue practising independent problem solving.';
 return{...state,reports:state.reports.filter(r=>!(r.updatedAt===null&&((r.status==='draft'&&r.grade===''&&r.effort===''&&r.comment==='')||(['pending','approved'].includes(r.status)&&r.grade==='B'&&r.effort==='Good'&&r.comment===sample))))};
}
