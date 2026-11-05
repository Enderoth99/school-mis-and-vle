import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {installTeachingTimetable,teachingClasses,teachers} from '../dist/teaching-data.mjs';
import {students} from '../dist/school-data.mjs';
import {studentAccount} from '../dist/student-accounts.mjs';
import {ClassroomStore,learningClass} from '../classroom-store.mjs';
test('the complete integrated timetable supplies a learning roster for all 1,000 numeric accounts',async()=>{const project=JSON.parse(await fs.readFile(new URL('../dist/timetable-integrated.json',import.meta.url),'utf8'));installTeachingTimetable(project);const store=new ClassroomStore(null);assert.equal(students.length,1000);assert.equal(teachers.length,80);for(const s of students){const actor=studentAccount(String(s.studentNumber));assert.equal(actor.id,s.id);const rooms=store.classes(actor);assert.ok(rooms.length>0,'Missing classrooms for '+s.name);assert.ok(rooms.every(c=>c.studentIds.includes(s.id)));}const summary=store.summary({id:'report-reviewer',role:'report-reviewer'});assert.equal(summary.classes.length,teachingClasses.filter(learningClass).length);assert.ok(summary.classes.every(c=>c.studentCount>0&&c.teacher));});
