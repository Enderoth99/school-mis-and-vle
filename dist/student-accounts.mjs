import {students} from './school-data.mjs';
export const STUDENT_TEST_PASSWORD='WistLearn2026!';
export function studentActor(id){const s=students.find(s=>s.id===id);return s?{id:s.id,role:'student',username:String(s.studentNumber),studentNumber:s.studentNumber,name:s.name,firstName:s.firstName,year:s.year,cohort:s.cohort,groupName:s.groupName,phase:'Student',area:s.groupName,synthetic:true}:null;}
export function studentAccount(username){const s=students.find(s=>String(s.studentNumber)===String(username).trim());return s?studentActor(s.id):null;}
