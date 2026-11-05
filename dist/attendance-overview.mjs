import {students,periods,isDate,classById} from './model.mjs';
import {teachers,studentsForTeacher,classesForTeacher,timetableForTeacher,teacherById} from './teaching-data.mjs';
export const attendanceCategory=status=>status.startsWith('Absent')?'absent':status.startsWith('Late')?'late':status.startsWith('Left Early')?'early':['Present','Internal Inclusion'].includes(status)?'present':'untaken';
export function attendanceOverview(registers,{date,teacherId,all=false}){
 if(!isDate(date))throw Error('Choose a valid attendance date.');
 const population=all?students:studentsForTeacher(teacherId),ids=new Set(population.map(s=>s.id)),mine=new Set(classesForTeacher(teacherId).map(c=>c.id));
 const saved=Object.values(registers).filter(r=>r.date===date),byStudent=new Map();
 for(const register of saved)for(const record of register.records){if(!ids.has(record.studentId))continue;const list=byStudent.get(record.studentId)||[];list.push({...record,classId:register.classId,className:classById(register.classId)?.name||register.classId,period:register.period,updatedAt:register.updatedAt,canOpen:mine.has(register.classId)});byStudent.set(record.studentId,list);}
 const totals={present:0,absent:0,late:0,early:0,untaken:0};
 const pupils=population.map(s=>{const entries=(byStudent.get(s.id)||[]).sort((a,b)=>periods.findIndex(p=>p[0]===a.period)-periods.findIndex(p=>p[0]===b.period)||a.updatedAt.localeCompare(b.updatedAt)),registration=entries.filter(e=>e.period==='R').at(-1)||null,schoolStatus=registration?.status||'Not Taken',base=attendanceCategory(schoolStatus),discrepancy=base!=='untaken'&&entries.some(e=>e.period!=='R'&&attendanceCategory(e.status)!=='untaken'&&((base==='absent')!==(attendanceCategory(e.status)==='absent')));totals[base]++;return{id:s.id,name:s.name,lastName:s.lastName,year:s.year,form:s.form,schoolStatus,arrival:registration?.time||'',entries,discrepancy};}).sort((a,b)=>a.lastName.localeCompare(b.lastName)||a.name.localeCompare(b.name));
 const lessons=new Map(),weekday=new Date(date+'T12:00:00Z').getUTCDay();
 if(![0,6].includes(weekday))for(const teacher of all?teachers:[teacherById(teacherId)].filter(Boolean))for(const l of timetableForTeacher(teacher.id,date))lessons.set(l.classId+'|'+l.period,{...l,scheduled:true});
 for(const r of saved)if(all||mine.has(r.classId))lessons.set(r.classId+'|'+r.period,{classId:r.classId,period:r.period,scheduled:lessons.has(r.classId+'|'+r.period)});
 const classTotals={complete:0,incomplete:0,untaken:0};
 const classes=[...lessons.values()].map(l=>{const c=classById(l.classId),r=saved.find(r=>r.classId===l.classId&&r.period===l.period),counts={present:0,absent:0,late:0,early:0,untaken:0};for(const id of c.studentIds)counts[attendanceCategory(r?.records.find(e=>e.studentId===id)?.status||'Not Taken')]++;const status=!r||counts.untaken===c.studentIds.length?'untaken':counts.untaken?'incomplete':'complete';classTotals[status]++;return{...l,name:c.name,teacher:teacherById(c.teacherId).name,teacherId:c.teacherId,year:c.year,status,counts,canOpen:mine.has(c.id),saved:Boolean(r)};}).sort((a,b)=>periods.findIndex(p=>p[0]===a.period)-periods.findIndex(p=>p[0]===b.period)||a.name.localeCompare(b.name));
 return{date,scope:all?'Whole school':'Your allocated students and classes',pupils,totals,classes,classTotals,periods};
}
