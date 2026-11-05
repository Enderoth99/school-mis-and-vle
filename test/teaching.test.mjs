import test from 'node:test';
import assert from 'node:assert/strict';
import {students,groups} from '../dist/school-data.mjs';
import {teachers,teachingClasses,classesForTeacher,studentsForTeacher,teacherById,formTutors} from '../dist/teaching-data.mjs';
import {seed,roster} from '../dist/model.mjs';
import {scopedState,mergeTeacherState} from '../dist/teacher-scope.mjs';

test('60 unique accounts: one primary teacher per form and 28 secondary specialists',()=>{
 assert.equal(teachers.length,60);assert.equal(new Set(teachers.map(t=>t.username)).size,60);assert.equal(new Set(teachers.map(t=>t.id)).size,60);
 const primary=teachers.filter(t=>t.phase!=='Secondary');assert.equal(primary.length,32);assert.equal(teachers.filter(t=>t.phase==='Secondary').length,28);
 for(const t of primary){assert.equal(t.formIds.length,1);assert.equal(classesForTeacher(t.id).length,1);assert.ok(studentsForTeacher(t.id).every(s=>s.cohort===t.formIds[0]));}
 assert.equal(formTutors.length,51);assert.equal(new Set(formTutors.map(f=>f.groupId)).size,51);
 for(const g of groups)assert.ok(teacherById(formTutors.find(f=>f.groupId===g.id).teacherId));
});
test('every teaching group has one valid teacher and valid, unique student memberships',()=>{
 assert.equal(teachingClasses.length,353);assert.equal(new Set(teachingClasses.map(c=>c.id)).size,353);
 for(const c of teachingClasses){const teacher=teacherById(c.teacherId);assert.ok(teacher);assert.ok(c.studentIds.length);assert.equal(new Set(c.studentIds).size,c.studentIds.length);assert.ok(roster(c.id).every(s=>s.year===c.year));if(c.kind==='subject')assert.ok(teacher.subjects.includes(c.subject));}
 for(const student of students)assert.ok(teachingClasses.some(c=>c.studentIds.includes(student.id)));
 for(const teacher of teachers)assert.ok(classesForTeacher(teacher.id).length>0);
 assert.ok(teachers.filter(t=>t.phase==='Secondary').some(t=>new Set(classesForTeacher(t.id).filter(c=>c.kind==='subject').map(c=>c.subject)).size>=2));
});
test('mixed English/maths sets allocate each Y7–11 student exactly once per subject',()=>{
 for(const year of [7,8,9,10,11])for(const subject of ['English','Mathematics']){const sets=teachingClasses.filter(c=>c.year===year&&c.subject===subject),ids=sets.flatMap(c=>c.studentIds),pupils=students.filter(s=>s.year===year);assert.equal(ids.length,pupils.length);assert.equal(new Set(ids).size,pupils.length);assert.ok(sets.some(c=>new Set(roster(c.id).map(s=>s.cohort)).size>1));}
});
test('sixth-form students have one option per block, retaining ten students in each year',()=>{
 for(const year of [12,13]){const pupils=students.filter(s=>s.year===year);assert.equal(pupils.length,10);for(const student of pupils)for(const block of ['A','B','C'])assert.equal(teachingClasses.filter(c=>c.year===year&&c.block===block&&c.studentIds.includes(student.id)).length,1);}
});
test('teacher views and writes preserve other teachers records and reject foreign allocations',()=>{
 const root=seed('2026-10-30'),first=teachers[0],other=teachers[1],view=scopedState(root,first.id),own=classesForTeacher(first.id)[0],foreign=classesForTeacher(other.id)[0];
 assert.ok(view.reports.every(r=>r.classId===own.id));assert.ok(view.attendance[Object.keys(view.attendance)[0]]===undefined);
 view.assignments.push({id:'primary-test',classId:own.id,title:'Class work',due:'2026-10-30',points:10});
 const merged=mergeTeacherState(root,view,first.id);assert.ok(merged.assignments.some(a=>a.id==='a1'));assert.ok(merged.assignments.some(a=>a.id==='primary-test'));
 assert.deepEqual(scopedState(merged,other.id).reports,scopedState(root,other.id).reports);
 view.assignments.push({id:'forged',classId:foreign.id});assert.throws(()=>mergeTeacherState(root,view,first.id),/not allocated/);
});
