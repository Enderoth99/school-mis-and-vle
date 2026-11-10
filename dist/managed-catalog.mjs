import {students,groups} from './school-data.mjs';
import {teachers,teachingClasses} from './teaching-data.mjs';
const originalStudents=new Map(students.map(s=>[s.id,structuredClone(s)])),originalTeachers=new Map(teachers.map(t=>[t.id,structuredClone(t)])),memberships=new Map(teachingClasses.map(c=>[c.id,[...c.studentIds]]));
let consumedEnrollments={};
export function capturePublishedCatalog(snapshot){memberships.clear();for(const c of snapshot.classes)memberships.set(c.id,[...c.studentIds]);for(const t of snapshot.teachers)originalTeachers.set(t.id,structuredClone(t));consumedEnrollments=snapshot.consumedEnrollments||{};}
export function applyManagedCatalog({students:rows=[],staff=[]}={}){
 for(let i=students.length-1;i>=0;i--){const s=students[i],old=originalStudents.get(s.id);if(!old&&s.managed)students.splice(i,1);else if(old&&s.managed)Object.assign(s,structuredClone(old),{managed:false});}
 for(let i=teachers.length-1;i>=0;i--){const t=teachers[i],old=originalTeachers.get(t.id);if(!old&&t.managed)teachers.splice(i,1);else if(old&&t.managed)Object.assign(t,structuredClone(old),{managed:false});}
 for(const c of teachingClasses){const base=memberships.get(c.id);if(base)c.studentIds.splice(0,c.studentIds.length,...base);}
 for(const row of rows){let s=students.find(s=>s.id===row.id);if(!s){s={...row,admissionNumber:row.schoolId,schoolEmail:row.email,synthetic:true,managed:true};students.push(s);}Object.assign(s,row,{managed:true});const g=groups.find(g=>g.id===s.cohort);if(g)Object.assign(s,{year:g.year,yearLabel:g.yearLabel,groupName:g.name,form:g.form});if(Array.isArray(row.enrollmentClassIds)&&JSON.stringify(row.enrollmentClassIds)!==consumedEnrollments[row.id])for(const c of teachingClasses){const i=c.studentIds.indexOf(s.id),included=row.enrollmentClassIds.includes(c.id);if(i>=0&&!included)c.studentIds.splice(i,1);if(i<0&&included)c.studentIds.push(s.id);}}
 for(const row of staff){let t=teachers.find(t=>t.id===row.id);if(!t){t={id:row.id,role:'teacher',formIds:[],subjects:[],synthetic:true};teachers.push(t);}Object.assign(t,row,{managed:true});}
}
