import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyAttendance} from '../dist/attendance-tracking.mjs';
import {AttendanceStore} from '../attendance-store.mjs';
import {ReportStore} from '../reports-store.mjs';
import {attendanceOverview} from '../dist/attendance-overview.mjs';
import {teachingClasses} from '../dist/teaching-data.mjs';
const id='s-9a-1',date='2026-11-02',homeroom=teachingClasses.find(c=>c.kind==='registration'&&c.studentIds.includes(id));
const row=(period,status,time='')=>({period,status,time,studentId:id});
test('any saved attendance evidence clears whole-day absence, with date and status boundaries',()=>{
 for(const morning of ['Absent (Excused)','Absent (Unexcused)','Not Taken'])for(const status of ['Present','Late (Excused)','Late (Unexcused)','Internal Inclusion','Left Early (Excused)']){
 const entries=[row('R',morning),row('2','Absent (Unexcused)'),row('8',status,status.startsWith('Late')?'14:48':'')],copy=structuredClone(entries);
 assert.equal(dailyAttendance(entries).status,status);assert.deepEqual(entries,copy);
 }
 assert.equal(dailyAttendance([row('R','Absent (Excused)'),row('8','Not Taken')]).status,'Absent (Excused)');
 assert.equal(dailyAttendance([row('R','Late (Unexcused)','08:45'),row('8','Present')]).time,'08:45');
 assert.equal(dailyAttendance([row('R','Present'),row('8','Absent (Unexcused)')]).status,'Present');
 assert.equal(dailyAttendance([]).status,'Not Taken');
});
test('corrected daily totals and report absence days recompute from saved lesson marks without altering morning history',async()=>{
 const attendance=new AttendanceStore(null),reports=new ReportStore(null,{attendance});
 attendance.state.registers={morning:{date,period:'R',classId:homeroom.id,records:[row('R','Absent (Unexcused)')],updatedAt:'2026-11-02T03:30:00Z'}};
 const view=()=>attendanceOverview(attendance.state.registers,{date,teacherId:'report-reviewer',all:true});
 assert.equal(view().totals.absent,1);
 attendance.state.registers.later={date,period:'4',classId:'computing9a',records:[row('4','Late (Excused)','11:09')],updatedAt:'2026-11-02T06:10:00Z'};
 assert.equal(view().totals.absent,0);assert.equal(view().totals.late,1);assert.equal(view().pupils.find(s=>s.id===id).arrival,'11:09');
 assert.equal(attendance.state.registers.morning.records[0].status,'Absent (Unexcused)');
 attendance.state.registers.next={date:'2026-11-03',period:'R',classId:homeroom.id,records:[row('R','Absent (Unexcused)')],updatedAt:'2026-11-03T03:30:00Z'};
 assert.equal((await reports.attendanceSummary(id,{from:date,to:'2026-11-03'})).absentDays,1);
 attendance.state.registers.later.records[0].status='Not Taken';assert.equal(view().totals.absent,1,'correcting the only presence mark restores the absence');
 assert.equal((await reports.attendanceSummary(id,{from:date,to:'2026-11-03'})).absentDays,2);
});
test('school absence exports exclude later arrivals and retain original lesson absences',async()=>{
 const {buildLibraryReport}=await import('../report-library.mjs'),{LIBRARY_REPORTS}=await import('../dist/report-library-data.mjs');
 const registers={r:{date,period:'R',classId:homeroom.id,records:[row('R','Absent (Unexcused)')]},lesson:{date,period:'4',classId:'computing9a',records:[row('4','Present')]}};
 const data={registers,assessments:{},people:{},households:{},reportRows:{},homerooms:{},issues:{}};
 const actor={id:'report-reviewer',role:'report-reviewer'},query={reportId:LIBRARY_REPORTS.find(r=>r.kind==='school-absent').id,classId:'computing9a',from:date,to:date};
 assert.equal(buildLibraryReport(actor,query,data).rows.length,0);
 registers.lesson.records[0].status='Absent (Unexcused)';assert.equal(buildLibraryReport(actor,query,data).rows.length,1);
 assert.equal(registers.r.records[0].status,'Absent (Unexcused)');
});
