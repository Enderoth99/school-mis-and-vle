import {periods,roster,studentById,classById,keyFor,isDate,saveAttendance,validateAttendance} from './model.mjs';

export const periodIndex=period=>periods.findIndex(p=>p[0]===period);
export function previousAttendance(registers,{date,classId,period}){
 const members=new Set(roster(classId).map(s=>s.id)),before=periodIndex(period),latest=new Map();
 for(const [key,register] of Object.entries(registers)){
  if(register.date!==date||periodIndex(register.period)<0||periodIndex(register.period)>=before)continue;
  for(const record of register.records){
   if(!members.has(record.studentId)||record.status==='Not Taken')continue;
   const previous=latest.get(record.studentId);
   if(!previous||periodIndex(register.period)>periodIndex(previous.period)||(register.period===previous.period&&register.updatedAt>previous.updatedAt))latest.set(record.studentId,{...record,key,classId:register.classId,period:register.period,teacherId:register.teacherId||classById(register.classId)?.teacherId,updatedAt:register.updatedAt,revision:register.revision||0});
  }
 }
 return latest;
}
export function registerContext(registers,target){
 const {date,classId,period}=target;
 if(!isDate(date)||periodIndex(period)<0||!classById(classId))throw new Error('Choose a valid class, date and period.');
 const saved=registers[keyFor(date,classId,period)]||null,prior=previousAttendance(registers,target),start=periods[periodIndex(period)][1];
 const records=roster(classId).map(student=>{
  const previous=prior.get(student.id),existing=saved?.records.find(r=>r.studentId===student.id);
  if(existing)return {...existing,studentNumber:student.studentNumber};
  if(!previous)return{studentId:student.id,studentNumber:student.studentNumber,status:'Not Taken',note:'',time:''};
  const arrivedEarlier=previous.status.startsWith('Late')&&previous.time&&previous.time<start;
  return{studentId:student.id,studentNumber:student.studentNumber,status:arrivedEarlier?'Present':previous.status,note:'',time:arrivedEarlier?'':previous.time||'',prefilledFrom:{key:previous.key,period:previous.period,classId:previous.classId,teacherId:previous.teacherId,status:previous.status,time:previous.time||'',note:previous.note||'',revision:previous.revision}};
 });
 return{saved,records,revision:saved?.revision||0,prefilledCount:records.filter(r=>r.prefilledFrom).length};
}
export function normalizeRegister(target,{teacherId,revision=1,legacy=false}={}){
 const temporary={attendance:{}};
 if(legacy){if(!isDate(target.date)||periodIndex(target.period)<0)throw new Error('Invalid saved register.');validateAttendance(target.classId,target.records);}
 else saveAttendance(temporary,target);
 const records=target.records.map(record=>{
  const student=studentById(record.studentId);
  return{studentId:student.id,studentNumber:student.studentNumber,status:record.status,note:record.note,time:record.status.startsWith('Late')?record.time:'',...(record.prefilledFrom?{prefilledFrom:record.prefilledFrom}:{})};
 });
 return{date:target.date,classId:target.classId,period:target.period,teacherId,revision,updatedAt:new Date().toISOString(),complete:records.every(r=>r.status!=='Not Taken'),records};
}
export function attendanceReport(registers,{classId,from,to,scope='class'}){
 if(!isDate(from)||!isDate(to)||from>to||!classById(classId))throw new Error('Choose a valid report date range and class.');
 const members=new Set(roster(classId).map(s=>s.id));
 return Object.values(registers).filter(r=>r.date>=from&&r.date<=to&&(scope==='students'||r.classId===classId)).flatMap(register=>register.records.filter(r=>members.has(r.studentId)).map(record=>({...record,date:register.date,period:register.period,classId:register.classId,teacherId:register.teacherId,revision:register.revision,complete:register.complete}))).sort((a,b)=>a.date.localeCompare(b.date)||a.studentNumber-b.studentNumber||periodIndex(a.period)-periodIndex(b.period)||a.classId.localeCompare(b.classId));
}
