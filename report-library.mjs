import {dailyAttendance} from './dist/attendance-tracking.mjs';
import {students,studentById,isDate,today,shiftDate} from './dist/model.mjs';
import {teachingClasses,teachers,classesForTeacher,studentsForTeacher,teacherById,timetableForTeacher} from './dist/teaching-data.mjs';
import {REPORT_REVIEWER} from './dist/report-config.mjs';
import {LIBRARY_REPORTS} from './dist/report-library-data.mjs';
import {sameOrigin} from './request-security.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const mean=values=>values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100:null;
const category=status=>status==='Not Taken'?'Not taken':status.startsWith('Absent')?'Absent':status.startsWith('Late')?'Late':status.startsWith('Left Early')?'Left early':'Present';
const count=marks=>['Present','Absent','Late','Left early','Not taken'].map(c=>marks.filter(r=>category(r.status)===c).length);
const dayNames={mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday'};

export function buildLibraryReport(actor,query,data){
 const def=LIBRARY_REPORTS.find(r=>r.id===query.reportId);if(!def)throw fail(404,'Choose a report from the library.');
 const admin=actor.id===REPORT_REVIEWER.id&&actor.role===REPORT_REVIEWER.role;
 let classes=admin?teachingClasses:classesForTeacher(actor.id),pupils=admin?students:studentsForTeacher(actor.id);
 if(query.classId){if(!classes.some(c=>c.id===query.classId))throw fail(403,'This teaching class is outside your allocation.');classes=classes.filter(c=>c.id===query.classId);}
 if(query.teacherId){if(!admin&&query.teacherId!==actor.id)throw fail(403,'Choose your own teacher account.');classes=classes.filter(c=>c.teacherId===query.teacherId||c.teacherIds?.includes(query.teacherId));}
 if(query.year)classes=classes.filter(c=>String(c.year)===String(query.year));
 const classIds=new Set(classes.map(c=>c.id)),memberIds=new Set(classes.flatMap(c=>c.studentIds));
 pupils=pupils.filter(s=>memberIds.has(s.id)&&(!query.year||String(s.year)===String(query.year))&&(!query.studentId||s.id===query.studentId));
 if(query.studentId&&!(admin?students:studentsForTeacher(actor.id)).some(s=>s.id===query.studentId))throw fail(403,'This student is outside your allocation.');
 const pupilIds=new Set(pupils.map(s=>s.id)),classMap=new Map(classes.map(c=>[c.id,c]));
 const from=query.from||today().slice(0,7)+'-01',to=query.to||today(),date=query.date||to;
 if(!isDate(from)||!isDate(to)||!isDate(date)||from>to||Date.parse(to)-Date.parse(from)>370*86400000)throw fail(400,'Choose a valid date range of up to one year.');
 const notes=[],result={reportId:def.id,title:def.title,category:def.category,from,to,scope:admin?'Whole-school selection':'Your allocated classes and students',columns:[],rows:[],notes,generatedAt:new Date().toISOString(),layout:'table'};
 const output=(columns,rows)=>Object.assign(result,{columns,rows});
 const registerList=Object.values(data.registers||{}),entries=registerList.filter(r=>r.date>=from&&r.date<=to&&classIds.has(r.classId)).flatMap(r=>r.records.filter(s=>pupilIds.has(s.studentId)).map(row=>({...row,date:r.date,period:r.period,classId:r.classId,teacherId:r.teacherId})));
 const className=id=>classMap.get(id)?.name||teachingClasses.find(c=>c.id===id)?.name||id;
 const person=id=>studentById(id),teacherName=id=>teacherById(id)?.name||'';
 const contacts=id=>{const p=data.people?.[id];return(p?.householdIds||[]).flatMap(key=>data.households?.[key]?.parentIds||[]).map(key=>data.people?.[key]).filter(Boolean);};
 const reportRows=Object.entries(data.reportRows||{}).filter(([key])=>key.startsWith((query.cycleId||'october-2026')+'|')).map(([,r])=>r);
 const averageFor=(classId,id)=>mean(Object.values(data.assessments||{}).filter(a=>a.classId===classId&&a.date>=from&&a.date<=to&&a.marks[id]!==undefined).map(a=>a.marks[id]/a.maximum*100));
 const gradeRows=()=>Object.values(data.assessments||{}).filter(a=>classIds.has(a.classId)&&a.date>=from&&a.date<=to).flatMap(a=>classMap.get(a.classId).studentIds.filter(id=>pupilIds.has(id)).map(id=>{const mark=a.marks[id],missed=a.missedStudentIds?.includes(id);return[person(id).studentNumber,person(id).name,person(id).yearLabel,person(id).groupName,className(a.classId),classMap.get(a.classId).subject,a.title,a.date,missed?'Missed':mark===undefined?'Not graded':mark,a.maximum,mark===undefined?'':Math.round(mark/a.maximum*10000)/100,mean(Object.values(a.marks).map(n=>n/a.maximum*100)),teacherName(a.teacherId),a.updatedAt||''];}));
 if(['standards','proficiencies'].includes(def.kind)){notes.push('No '+(def.kind==='standards'?'school standards or standards-based grades':'proficiency sets or proficiency results')+' have been configured in this demonstration. No results have been inferred from percentage marks.');return output(['Student ID','Student','Standard / proficiency','Result'],[]);}
 if(def.kind==='late-threshold'){
  const threshold=Number(query.threshold||3);if(!Number.isInteger(threshold)||threshold<1||threshold>1000)throw fail(400,'Choose a lateness threshold from 1 to 1,000.');
  const marks=(query.attendanceScope==='school'?registerList.filter(r=>r.period==='R'&&r.date>=from&&r.date<=to).flatMap(r=>r.records.filter(s=>pupilIds.has(s.studentId)).map(s=>({...s,date:r.date}))):entries).filter(r=>r.status.startsWith('Late'));
  return output(['Student ID','Student','Year','Class / form','Late marks','Dates'],pupils.map(s=>{const late=marks.filter(r=>r.studentId===s.id);return[s.studentNumber,s.name,s.yearLabel,s.groupName,late.length,[...new Set(late.map(r=>r.date))].join(', ')];}).filter(row=>row[4]>=threshold));
 }
 if(['class-absence-daily','class-absence-monthly'].includes(def.kind)){
  const absent=entries.filter(r=>r.status.startsWith('Absent')&&(def.kind==='class-absence-daily'?r.date===date:r.date.slice(0,7)===(query.month||date.slice(0,7))));
  if(def.kind==='class-absence-monthly')return output(['Student ID','Student','Teaching class','Absent marks','Dates'],classes.flatMap(c=>pupils.filter(s=>c.studentIds.includes(s.id)).map(s=>{const own=absent.filter(r=>r.classId===c.id&&r.studentId===s.id);return[s.studentNumber,s.name,c.name,own.length,[...new Set(own.map(r=>r.date))].join(', ')];})).filter(r=>r[3]));
  return output(['Student ID','Student','Teaching class','Date','Period','Code'],absent.map(r=>[person(r.studentId).studentNumber,person(r.studentId).name,className(r.classId),r.date,r.period,r.status]));
 }
 if(def.kind==='attendance-not-taken'){
  const rows=[],saved=new Map(registerList.map(r=>[[r.date,r.classId,r.period].join('|'),r])),staff=teachers.filter(t=>classes.some(c=>c.teacherId===t.id||c.teacherIds?.includes(t.id)));
  for(let day=from;day<=to;day=shiftDate(day,1))for(const t of staff)for(const l of timetableForTeacher(t.id,day)){if(!classIds.has(l.classId))continue;const c=classMap.get(l.classId),r=saved.get([day,l.classId,l.period].join('|')),members=c.studentIds.filter(id=>pupilIds.has(id)),missing=members.filter(id=>!r?.records.some(s=>s.studentId===id&&s.status!=='Not Taken')).length;if(missing)rows.push([day,l.period,c.name,t.name,missing,r?'Incomplete':'Not saved']);}
  return output(['Date','Period','Teaching class','Teacher','Students not recorded','Register status'],rows);
 }
 if(['attendance-teacher','attendance-codes','attendance-class','attendance-student'].includes(def.kind)){
  if(def.kind==='attendance-codes')return output(['Teaching class','Code','Marks'],classes.flatMap(c=>[...new Set(entries.filter(r=>r.classId===c.id).map(r=>r.status))].map(code=>[c.name,code,entries.filter(r=>r.classId===c.id&&r.status===code).length])));
  if(def.kind==='attendance-student')return output(['Student ID','Student','Teaching class','Present','Absent','Late','Left early','Not taken'],classes.flatMap(c=>pupils.filter(s=>c.studentIds.includes(s.id)).map(s=>[s.studentNumber,s.name,c.name,...count(entries.filter(r=>r.classId===c.id&&r.studentId===s.id))])));
  return output(['Teaching class','Teacher','Present','Absent','Late','Left early','Not taken'],classes.map(c=>[c.name,teacherName(c.teacherId),...count(entries.filter(r=>r.classId===c.id))]));
 }
 if(['grade-class','grade-year','grade-student','gradebook','grade-detail','grade-teacher','missing','missing-year'].includes(def.kind)){
  let rows=gradeRows();if(def.kind.startsWith('missing'))rows=rows.filter(r=>['Missed','Not graded'].includes(r[8]));notes.push('Percentages and class averages use saved assessment marks. Missed and ungraded results are excluded from averages.');
  return output(['Student ID','Student','Year','Class / form','Teaching class','Subject','Assessment','Date','Mark / status','Out of','Percentage','Assessment class average','Teacher','Updated'],rows);
 }
 if(['average-year','final-grades','published-grades','final-average'].includes(def.kind)){
  notes.push('Calculated averages are means of recorded assessment percentages. Final exam or semester weighting is not configured. A published grade is shown only where a report has actually been issued.');
  return output(['Student ID','Student','Year','Teaching class','Subject','Calculated assessment mean (%)','Reported attainment','Report status','Published attainment'],classes.filter(c=>c.kind==='subject'||c.kind==='primary').flatMap(c=>pupils.filter(s=>c.studentIds.includes(s.id)).map(s=>{const report=reportRows.find(r=>r.studentId===s.id&&r.classId===c.id),issued=data.issues?.[(query.cycleId||'october-2026')+'|'+s.id]?.at(-1)?.snapshot?.rows.find(r=>r.classId===c.id);return[s.studentNumber,s.name,s.yearLabel,c.name,c.subject,averageFor(c.id,s.id),report?.grade||'',report?.status||'Not entered',issued?.grade||''];})));
 }
 if(def.kind==='assignments'){
  const assessments=Object.values(data.assessments||{}).filter(a=>classIds.has(a.classId)&&a.date>=from&&a.date<=to).map(a=>[className(a.classId),a.title,a.date,'Assessment',a.maximum,teacherName(a.teacherId)]),assignments=(data.assignments||[]).filter(a=>classIds.has(a.classId)&&a.due>=from&&a.due<=to).map(a=>[className(a.classId),a.title,a.due,'Assignment',a.points,teacherName(classMap.get(a.classId).teacherId)]);
  return output(['Teaching class','Title','Date / due','Type','Maximum mark','Teacher'],[...assessments,...assignments]);
 }
 if(def.kind==='curriculum')return output(['Teaching class','Date','Lesson','Objective','Taught'],(data.lessonPlans||[]).filter(l=>classIds.has(l.classId)&&l.date>=from&&l.date<=to).map(l=>[className(l.classId),l.date,l.title,l.objective,l.taught?'Yes':'No']));
 if(['progress','comments'].includes(def.kind)){
  const rows=reportRows.filter(r=>classIds.has(r.classId)&&pupilIds.has(r.studentId)).map(r=>[person(r.studentId).studentNumber,person(r.studentId).name,className(r.classId),r.subject,r.grade,r.effort,r.comment,r.status,teacherName(r.teacherId)]);
  if(def.kind==='comments')for(const [key,h]of Object.entries(data.homerooms||{}))if(key.startsWith((query.cycleId||'october-2026')+'|')&&pupilIds.has(h.studentId)&&h.comment)rows.push([person(h.studentId).studentNumber,person(h.studentId).name,person(h.studentId).groupName,'Homeroom','','',h.comment,h.status,teacherName(h.teacherId)]);
  return output(['Student ID','Student','Teaching class','Subject','Attainment','Effort','Comment','Status','Teacher'],def.kind==='comments'?rows.filter(r=>r[6]):rows);
 }
 if(def.kind==='schedule'){
  const staff=teachers.filter(t=>(!query.teacherId||t.id===query.teacherId)&&classes.some(c=>c.teacherId===t.id));
  return output(['Teacher','Day','Period','From','To','Teaching class','Room','Students'],staff.flatMap(t=>Object.entries(dayNames).flatMap(([day,label])=>timetableForTeacher(t.id,day).filter(l=>classIds.has(l.classId)).map(l=>[t.name,label,l.period,l.from||'',l.to||'',className(l.classId),l.room||classMap.get(l.classId).room,classMap.get(l.classId).studentIds.length]))));
 }
 if(['emergency','school-absence-late','school-absent'].includes(def.kind)){
  const days=new Map();
  for(const r of registerList.filter(r=>r.date>=from&&r.date<=to))for(const row of r.records){if(!pupilIds.has(row.studentId))continue;const key=r.date+'|'+row.studentId;const item=days.get(key)||{date:r.date,studentId:row.studentId,entries:[]};item.entries.push({...row,period:r.period,updatedAt:r.updatedAt});days.set(key,item);}
  const daily=[...days.values()].map(r=>({...r,...dailyAttendance(r.entries)}));
  if(def.kind==='school-absence-late')return output(['Student ID','Student','Year','Date','Code','Arrival time'],daily.filter(row=>/^(Absent|Late)/.test(row.status)).map(row=>[person(row.studentId).studentNumber,person(row.studentId).name,person(row.studentId).yearLabel,row.date,row.status,row.time]));
  const status=s=>daily.find(r=>r.date===date&&r.studentId===s.id);
  return output(['Student ID','Student','Year','Class / form','Date','School attendance','Arrival time'],pupils.filter(s=>def.kind==='emergency'||status(s)?.status.startsWith('Absent')).map(s=>[s.studentNumber,s.name,s.yearLabel,s.groupName,date,status(s)?.status||'No record',status(s)?.time||'']));
 }
 if(def.kind==='users'){const accounts=admin?[...teachers,REPORT_REVIEWER]:[actor];return output(['Name','Username','Role / area','Last recorded login'],accounts.map(t=>[t.name,t.username,t.area,data.lastLoginFor?.(t.id)||'']));}
 if(['roster','roster-teacher','roster-teacher-alternate','roster-info'].includes(def.kind))return output(['Student ID','Student','Year','Class / form','Teaching class','Subject','Teacher',...(def.kind==='roster-info'?['Birthday','Student email','Parent / emergency contacts']:[])],classes.flatMap(c=>pupils.filter(s=>c.studentIds.includes(s.id)).map(s=>[s.studentNumber,s.name,s.yearLabel,s.groupName,c.name,c.subject,teacherName(c.teacherId),...(def.kind==='roster-info'?[s.dateOfBirth,s.schoolEmail,contacts(s.id).map(p=>p.name+' · '+p.phone+' · '+p.email).join('; ')]:[])])));
 if(['contact-email','contact-phone','contacts','pickup','trip'].includes(def.kind))return output(['Student ID','Student','Year','Class / form','Contact','Relationship','Phone','Email','Can collect','Address'],pupils.flatMap(s=>contacts(s.id).filter(p=>def.kind!=='pickup'||p.canCollect).map(p=>[s.studentNumber,s.name,s.yearLabel,s.groupName,p.name,p.relationship,p.phone,p.email,p.canCollect?'Yes':'No',p.address||''])));
 if(['mail-labels','envelopes','name-labels'].includes(def.kind)){result.layout=def.kind==='envelopes'?'envelopes':'labels';if(def.kind==='name-labels')return output(['Student','Year','Class / form'],pupils.map(s=>[s.name,s.yearLabel,s.groupName]));const seen=new Set();return output(['Household / contact','Address','Students'],pupils.flatMap(s=>{const household=data.people?.[s.id]?.householdIds?.[0];if(!household||seen.has(household))return [];seen.add(household);const parents=contacts(s.id);return[[parents.map(p=>p.name).join(' / '),parents[0]?.address||'',pupils.filter(p=>data.people?.[p.id]?.householdIds?.includes(household)).map(p=>p.name).join(', ')]];}));}
 if(def.kind==='birthdays'){const within=s=>{const monthDay=s.dateOfBirth.slice(5);return from.slice(5)<=to.slice(5)?monthDay>=from.slice(5)&&monthDay<=to.slice(5):monthDay>=from.slice(5)||monthDay<=to.slice(5);};return output(['Student ID','Student','Year','Class / form','Birthday'],pupils.filter(within).sort((a,b)=>a.dateOfBirth.slice(5).localeCompare(b.dateOfBirth.slice(5))).map(s=>[s.studentNumber,s.name,s.yearLabel,s.groupName,s.dateOfBirth]));}
 return output(['Student ID','Student','Year','Class / form'],pupils.map(s=>[s.studentNumber,s.name,s.yearLabel,s.groupName]));
}

export function createReportLibraryApi({attendance,grades,directory,reports},auth){
 return async(req,res,url)=>{
  if(url.pathname!=='/api/reporting/run')return false;
  const send=(status,value)=>res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(value));
  const actor=auth.sessionTeacher(req);if(!actor){send(401,{error:'Sign in to run reports.'});return true;}
  try{if(req.method!=='POST')throw fail(405,'Use the report filters to run a report.');if(!sameOrigin(req))throw fail(403,'Use the MIS page to run reports.');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1000000)throw fail(413,'Report selection is too large.');}const q=JSON.parse(raw);
   await Promise.all([attendance,grades,directory,reports].map(async store=>{await store.ready;await store.queue;}));
   send(200,buildLibraryReport(actor,q,{registers:attendance.state.registers,assessments:grades.state.assessments,people:directory.state.people,households:directory.state.households,reportRows:reports.state.rows,homerooms:reports.state.homerooms,issues:reports.state.issues,lessonPlans:Array.isArray(q.lessonPlans)?q.lessonPlans:[],assignments:Array.isArray(q.assignments)?q.assignments:[],lastLoginFor:auth.lastLoginFor}));
  }catch(error){send(error.status||400,{error:error.message});}return true;
 };
}
