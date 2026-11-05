import fs from 'node:fs/promises';
import path from 'node:path';
import {students,groups,yearGroups,DATASET_VERSION} from '../dist/school-data.mjs';
import {teachers,teachingClasses,teacherById,formTutors} from '../dist/teaching-data.mjs';
import {csv} from '../dist/model.mjs';
import {REPORT_REVIEWER} from '../dist/report-config.mjs';
export async function exportIntegratedFixtures(target){
 const write=(name,value)=>fs.writeFile(path.join(target,'data',name),typeof value==='string'?value:JSON.stringify(value));
 await write('students.json',{datasetVersion:DATASET_VERSION,synthetic:true,academicYear:'2026-2027',studentCount:students.length,groupCount:groups.length,groups,students});
 await write('student-classroom-logins.csv',csv([['Student','Student login number','Default test password','Class'],...students.map(s=>[s.name,s.studentNumber,'WistLearn2026!',s.groupName])]));
 await write('students.csv',csv([['Student ID','Admission number','First name','Last name','Year group','Form','Group','Date of birth','Test email','Status','Synthetic'],...students.map(s=>[s.studentNumber,s.admissionNumber,s.firstName,s.lastName,s.yearLabel,s.form,s.groupName,s.dateOfBirth,s.schoolEmail,s.status,'TRUE'])]));
 await write('form-sizes.csv',csv([['Year group','Form','Group','Students'],...groups.map(g=>[g.yearLabel,g.form,g.name,g.count])]));
 await write('population-summary.json',{studentCount:students.length,groupCount:groups.length,yearGroups:yearGroups.map(y=>({...y,forms:groups.filter(g=>g.year===y.year).map(g=>({form:g.form,name:g.name,students:g.count}))}))});
 await write('teacher-accounts.csv',csv([['Teacher','Username','Shared test password','Phase','Curriculum area','Usual classroom'],...[...teachers,REPORT_REVIEWER].map(t=>[t.name,t.username,'WistTest2026!',t.phase,t.area,t.role?'Whole-school administration':t.usualRoom||'Shared sports spaces'])]));
 await write('teaching-groups.csv',csv([['Class ID','Class','Subject','Teacher','Username','Room','Students'],...teachingClasses.map(c=>[c.id,c.name,c.subject,teacherById(c.teacherId).name,teacherById(c.teacherId).username,c.room,c.studentIds.length])]));
 const studentMap=new Map(students.map(s=>[s.id,s]));
 await write('student-group-memberships.csv',csv([['Student ID','Admission number','Student','Form group','Teaching group ID','Teaching group','Subject','Teacher','Username'],...teachingClasses.flatMap(c=>c.studentIds.map(id=>{const s=studentMap.get(id),t=teacherById(c.teacherId);return[s.studentNumber,s.admissionNumber,s.name,s.groupName,c.id,c.name,c.subject,t.name,t.username];}))]));
 await write('teaching-allocation.json',{teachingVersion:2,synthetic:true,teachers,formTutors,teachingGroups:teachingClasses});
}
