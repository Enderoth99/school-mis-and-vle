import {validateTimetable,expandLessons} from './timetable-engine.mjs';
import {students} from './school-data.mjs';

export function compileTeachingTimetable(project,existingClasses,existingTeachers,formTutors){
 const report=validateTimetable(project);
 if(!report.complete)throw Error('Only a complete timetable without clashes or missing compulsory periods can be applied to the MIS.');
 const known=new Set(students.map(s=>s.id));
 if(project.groups.some(g=>g.studentIds.some(id=>!known.has(id))))throw Error('The timetable contains an unknown student.');
 const resources=new Map(project.rooms.map(r=>[r.id,r])),subjects=new Map(project.subjects.map(s=>[s.id,s.name])),old=new Map(existingClasses.map(c=>[c.id,c])),classes=[],classForActivity=new Map();
 for(const a of project.activities){
  if(!a.weeklyCount)continue;
  const previous=(a.classId?old.get(a.classId):null)||existingClasses.find(c=>c.activityId===a.id),id=previous?.id||'scheduled-'+a.id,room=resources.get(project.placements[a.id+'#1'].roomId),subject=subjects.get(a.subjectId),cohort=a.groupIds[0];
  if(classes.some(c=>c.id===id))throw Error('A teaching group is represented by more than one timetable allocation.');
  const c={...(previous||{}),id,name:previous?.name||a.name,subject,subjects:previous?.kind==='primary'?previous.subjects:[subject],year:a.year,cohort,room:room.name,tag:previous?.tag||subject.split(' ').map(s=>s[0]).join('').slice(0,2).toUpperCase(),color:previous?.color||'blue',teacherId:a.teacherIds[0],teacherIds:[...a.teacherIds],kind:previous?.kind||'subject',enrollmentMode:previous?.enrollmentMode||'scheduled option group',studentIds:[...a.studentIds],activeTimetable:true,archivedTimetable:false,activityId:a.id};
  classes.push(c);classForActivity.set(a.id,id);
 }
 // Keep registration separate from the forty teaching periods.
 for(const c of existingClasses.filter(c=>c.kind==='registration'||c.kind==='primary'&&!classes.some(row=>row.id===c.id))){const group=project.groups.find(g=>g.id===c.cohort);if(group){const owner=project.teachers.find(t=>t.formIds?.includes(group.id))||project.teachers.find(t=>t.id===c.teacherId),room=resources.get(owner?.homeRoomId);classes.push({...c,teacherId:owner?.id||c.teacherId,name:group.name+' Homeroom',kind:'registration',subject:'Homeroom',subjects:['Homeroom'],room:room?.name||c.room,teacherIds:[owner?.id||c.teacherId],studentIds:[...group.studentIds],activeTimetable:true,archivedTimetable:false});}}
 const rows=[];
 for(const l of expandLessons(project)){
  const position=project.placements[l.id],start=project.periods.findIndex(r=>r.id===position.period);
  for(let offset=0;offset<l.duration;offset++){const period=project.periods[start+offset];rows.push({lessonId:l.id,classId:classForActivity.get(l.activityId),teacherIds:[...l.teacherIds],day:position.day,period:period.id,room:resources.get(position.roomId).name,from:period.start,to:period.end,double:l.duration===2});}
 }
 const teacherMap=new Map(existingTeachers.map(t=>[t.id,t]));
 for(const t of project.teachers){const old=teacherMap.get(t.id)||{},room=resources.get(t.homeRoomId);teacherMap.set(t.id,{...old,...t,firstName:t.firstName||old.firstName||t.name.split(' ')[0],username:t.username||old.username||t.name.toLowerCase().replaceAll(' ','.'),phase:t.phase||old.phase||'Secondary',area:t.area||old.area||'Planning staff',formIds:t.formIds||old.formIds||[],subjects:t.subjects||old.subjects||project.subjects.filter(s=>t.subjectIds?.includes(s.id)).map(s=>s.name),usualRoom:room?.name||'',synthetic:true});}
 const registrations=formTutors.filter(t=>project.groups.some(g=>g.id===t.groupId)).map(t=>{const c=classes.find(c=>c.cohort===t.groupId&&(c.kind==='registration'||c.kind==='primary'));if(!c)throw Error('Registration group missing for '+t.groupName);return{classId:c.id,teacherId:c.teacherId,period:'R',room:c.room,from:'08:15',to:'08:30'};});
 return {id:'wist-2026-27-integrated-v'+(project.integrationRevision||1),planningYear:'2026–27',testDate:'2026-11-02',report:{placed:report.placed,total:report.total,missingStudentPeriods:report.coverage.missingSlots,students:report.coverage.students.length},classes,teachers:[...teacherMap.values()],rows,registrations,periods:[['R','08:15','08:30'],...project.periods.map(r=>[r.id,r.start,r.end])]};
}
export function timetableDay(value){
 if(['mon','tue','wed','thu','fri'].includes(value))return value;
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value))return['sun','mon','tue','wed','thu','fri','sat'][new Date(value+'T12:00:00Z').getUTCDay()];
 return 'mon';
}
export function scheduledRows(snapshot,{teacherId,studentId,date}={}){
 const day=timetableDay(date);if(!['mon','tue','wed','thu','fri'].includes(day))return [];
 const mine=studentId?new Set(snapshot.classes.filter(c=>c.studentIds.includes(studentId)).map(c=>c.id)):null;
 const rows=snapshot.rows.filter(r=>r.day===day&&(teacherId?r.teacherIds.includes(teacherId):mine?.has(r.classId))).map(r=>({...r}));
 const registration=snapshot.registrations.find(r=>teacherId?r.teacherId===teacherId:mine?.has(r.classId));
 if(registration)rows.push({...registration});
 return rows.sort((a,b)=>snapshot.periods.findIndex(p=>p[0]===a.period)-snapshot.periods.findIndex(p=>p[0]===b.period));
}
