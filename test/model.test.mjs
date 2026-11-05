import test from 'node:test';
import assert from 'node:assert/strict';
import {seed,roster,keyFor,saveAttendance,saveGrades,updateReport,attendanceSummary,csv,load,STORAGE_KEY,isDate} from '../dist/model.mjs';
const date='2026-10-30';
const register=()=>roster('computing9a').map(s=>({studentId:s.id,status:'Present',note:'',time:''}));
test('registers remain independent by date, class and period',()=>{
 const s=seed(date),r=register();
 saveAttendance(s,{date,classId:'computing9a',period:'1',records:r});
 r[0].status='Absent (Excused)';
 saveAttendance(s,{date,classId:'computing9a',period:'2',records:r});
 assert.equal(s.attendance[keyFor(date,'computing9a','1')].records[0].status,'Present');
 assert.equal(s.attendance[keyFor(date,'computing9a','2')].records[0].status,'Absent (Excused)');
 assert.equal(s.attendance[keyFor('2026-10-31','computing9a','1')],undefined);
});
test('late arrivals require valid time; changing to present clears old time',()=>{
 const s=seed(date),r=register();r[0].status='Late (Excused)';
 assert.throws(()=>saveAttendance(s,{date,classId:'computing9a',period:'1',records:r}),/arrival time/);
 r[0].time='25:99';assert.throws(()=>saveAttendance(s,{date,classId:'computing9a',period:'1',records:r}),/arrival time/);
 r[0].time='09:03';saveAttendance(s,{date,classId:'computing9a',period:'1',records:r});
 r[0].status='Present';saveAttendance(s,{date,classId:'computing9a',period:'1',records:r});
 assert.equal(s.attendance[keyFor(date,'computing9a','1')].records[0].time,'');
});
test('rejects incomplete or duplicate rosters without changing saved state',()=>{
 const s=seed(date),before=JSON.stringify(s),r=register();r[1].studentId=r[0].studentId;
 assert.throws(()=>saveAttendance(s,{date,classId:'computing9a',period:'1',records:r}),/exactly once/);
 assert.equal(JSON.stringify(s),before);
});
test('attendance summary counts every status including early departures',()=>{
 const summary=attendanceSummary(['Present','Internal Inclusion','Late (Excused)','Absent (Unexcused)','Left Early (Excused)','Not Taken'].map(status=>({status})));
 assert.deepEqual(summary,{present:2,late:1,absent:1,early:1,untaken:1});
});
test('marks preserve zero and distinguish an ungraded student; reject out-of-range values',()=>{
 const s=seed(date),[a,b]=roster('computing9a');saveGrades(s,'a1',{[a.id]:'0',[b.id]:''});
 assert.equal(s.grades.a1[a.id],0);assert.equal(s.grades.a1[b.id],undefined);
 assert.throws(()=>saveGrades(s,'a1',{[a.id]:21}),/between 0 and 20/);
 assert.throws(()=>saveGrades(s,'a1',{'non-class-student':5}),/not in this class/);
});
test('teacher cannot edit approved or submitted reports or submit incomplete drafts',()=>{
 const s=seed(date),draft=s.reports.find(r=>r.status==='draft'),approved=s.reports.find(r=>r.status==='approved');
 assert.throws(()=>updateReport(s,approved.id,{grade:'A',effort:'Good',comment:'Sample'},false),/Only a draft/);
 assert.throws(()=>updateReport(s,draft.id,{grade:'',effort:'',comment:''},true),/at least 20/);
 updateReport(s,draft.id,{grade:'A',effort:'Good',comment:'Demonstrates clear progress and should practise tracing algorithms.'},true);
 assert.equal(draft.status,'pending');
 assert.throws(()=>updateReport(s,draft.id,{grade:'B',effort:'Good',comment:'changed'},false),/Only a draft/);
});
test('CSV escapes quotes/newlines and prevents formula execution',()=>{
 const out=csv([['name','note'],['Alex','a "quoted", value\nnext line'],['=HYPERLINK("x")',' @SUM(A1)']]);
 assert.ok(out.startsWith('\uFEFF'));assert.ok(out.includes('a ""quoted"", value\nnext line'));
 assert.ok(out.includes('"\'=HYPERLINK'));assert.ok(out.includes('"\' @SUM'));
});
test('saved state round-trips and malformed storage is never overwritten',()=>{
 let stored=JSON.stringify(seed(date));let writes=0;const storage={getItem:k=>(assert.equal(k,STORAGE_KEY),stored),setItem:()=>writes++};
 assert.equal(load(storage).reports.length,5440);stored='{broken';assert.throws(()=>load(storage));assert.equal(writes,0);
});
test('rejects impossible dates',()=>{assert.equal(isDate('2026-02-30'),false);assert.equal(isDate('2026-10-30'),true);});
