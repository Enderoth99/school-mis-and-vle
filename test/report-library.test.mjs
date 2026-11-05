import test from 'node:test';
import assert from 'node:assert/strict';
import {LIBRARY_REPORTS,REPORT_CATEGORIES,findLibraryReports} from '../dist/report-library-data.mjs';
import {buildLibraryReport} from '../report-library.mjs';
import {AttendanceStore} from '../attendance-store.mjs';
import {GradeStore} from '../grades-store.mjs';
import {DirectoryStore} from '../directory-store.mjs';
import {REPORT_REVIEWER} from '../dist/report-config.mjs';
import {teachingClasses,teacherByUsername,classesForTeacher} from '../dist/teaching-data.mjs';
import {students,groups,roster,seed} from '../dist/model.mjs';
import {incidentGroups,incidentStudents,validateIncidentSelection} from '../dist/incident-selection.mjs';
import {scopedState,mergeTeacherState} from '../dist/teacher-scope.mjs';
import {createAppServer} from '../server.mjs';
const actor=teacherByUsername('noah.morgan'),course=teachingClasses.find(c=>c.id==='computing9a'),date='2026-10-30';
const definition=kind=>LIBRARY_REPORTS.find(r=>r.kind===kind),query=kind=>({reportId:definition(kind).id,classId:course.id,from:'2026-10-01',to:date});
async function data(){const attendance=new AttendanceStore(null),grades=new GradeStore(null),directory=new DirectoryStore(null),pupils=roster(course.id);
 await attendance.save(actor.id,{classId:course.id,date,period:'4',expectedRevision:0,records:pupils.map((s,i)=>({studentId:s.id,status:i===0?'Absent (Excused)':i===1?'Late (Unexcused)':'Present',time:i===1?'11:09':'',note:''}))});
 await grades.save(actor.id,{classId:course.id,title:'Saved teacher assessment',date,maximum:20,marks:{[pupils[0].id]:15,[pupils[1].id]:0},missedStudentIds:[pupils[2].id],expectedRevision:0});
 return{registers:attendance.state.registers,assessments:grades.state.assessments,people:directory.state.people,households:directory.state.households,reportRows:{},homerooms:{},issues:{},lastLoginFor:id=>id===actor.id?'2026-10-30T08:00:00Z':''};}

test('the supplied catalogue contains all 49 uniquely identified reports in its ten source categories',()=>{
 assert.equal(LIBRARY_REPORTS.length,49);assert.equal(new Set(LIBRARY_REPORTS.map(r=>r.id)).size,49);assert.deepEqual(REPORT_CATEGORIES.map(c=>LIBRARY_REPORTS.filter(r=>r.category===c).length),[1,7,17,1,3,1,3,1,14,1]);assert.equal(findLibraryReports('MISSING ASSIGNMENTS').length,2);assert.equal(findLibraryReports('','Gradebook').length,17);
});
test('incident year and form selection excludes other classes and rejects stale or tampered pupils',()=>{
 const ownIds=new Set(classesForTeacher(actor.id).flatMap(c=>c.studentIds)),own=students.filter(s=>ownIds.has(s.id)),year='9',list=incidentGroups(own,groups,year);assert.ok(list.length);const g=list[0],members=incidentStudents(own,year,g.id);assert.ok(members.length);assert.ok(members.every(s=>s.cohort===g.id&&String(s.year)===year));assert.deepEqual(incidentStudents(own,'',g.id),[]);assert.deepEqual(incidentStudents(own,year,''),[]);
 validateIncidentSelection({year,groupId:g.id,studentId:members[0].id},own,groups);assert.throws(()=>validateIncidentSelection({year:'8',groupId:g.id,studentId:members[0].id},own,groups));const foreign=students.find(s=>s.cohort!==g.id);assert.throws(()=>validateIncidentSelection({year,groupId:g.id,studentId:foreign.id},own,groups));
});
test('library exports use saved attendance and teacher input marks, including zero and missed results',async()=>{
 const d=await data(),absence=buildLibraryReport(actor,query('class-absence-daily'),d);assert.equal(absence.rows.length,1);assert.equal(absence.rows[0][0],roster(course.id)[0].studentNumber);
 const grades=buildLibraryReport(actor,query('gradebook'),d);assert.equal(grades.rows.length,roster(course.id).length);assert.equal(grades.rows[0][10],75);assert.equal(grades.rows[1][10],0);assert.equal(grades.rows[2][8],'Missed');assert.equal(grades.rows[0][11],37.5);
 const missing=buildLibraryReport(actor,query('missing'),d);assert.equal(missing.rows.length,roster(course.id).length-2);
 const summary=buildLibraryReport(actor,query('attendance-class'),d);assert.deepEqual(summary.rows[0].slice(2),[roster(course.id).length-2,1,1,0,0]);
});
test('reports reject foreign classes and pupils, and distinguish unconfigured standards and unpublished grades',async()=>{
 const d=await data(),foreign=teachingClasses.find(c=>c.teacherId!==actor.id);assert.throws(()=>buildLibraryReport(actor,{...query('roster'),classId:foreign.id},d),e=>e.status===403);const pupil=students.find(s=>!classesForTeacher(actor.id).some(c=>c.studentIds.includes(s.id)));assert.throws(()=>buildLibraryReport(actor,{...query('roster'),studentId:pupil.id},d),e=>e.status===403);
 const standard=buildLibraryReport(actor,query('standards'),d);assert.deepEqual(standard.rows,[]);assert.ok(standard.notes[0].includes('No results have been inferred'));
 const final=buildLibraryReport(actor,query('final-grades'),d);assert.equal(final.rows[0][5],75);assert.equal(final.rows[0][8],'');
 assert.equal(buildLibraryReport(actor,query('users'),d).rows.length,1);
});
test('all 49 report variants return coherent tables; directory and schedule outputs retain stable IDs',async()=>{
 const d=await data();for(const report of LIBRARY_REPORTS){const result=buildLibraryReport(actor,{...query(report.kind),reportId:report.id},d);assert.ok(result.columns.length,report.title);assert.ok(result.rows.every(row=>row.length===result.columns.length),report.title);}
 const contacts=buildLibraryReport(actor,query('contacts'),d);assert.equal(contacts.rows.length,roster(course.id).length*2);assert.ok(contacts.rows.every(row=>roster(course.id).some(s=>s.studentNumber===row[0])));
 const scheduled=buildLibraryReport(actor,query('attendance-not-taken'),d);assert.ok(scheduled.rows.some(r=>r[5]==='Not saved'));
});
test('admin favourites persist independently and incident writes preserve other teachers’ records',()=>{
 const root=seed(date);root.incidents=[{id:'other',teacherId:actor.id,studentId:roster(course.id)[0].id,title:'Existing'}];const state=structuredClone(scopedState(root,REPORT_REVIEWER.id));state.favorites=['gradebook-1'];state.incidents.push({id:'admin',teacherId:REPORT_REVIEWER.id,studentId:roster(course.id)[1].id,title:'New'});const next=mergeTeacherState(root,state,REPORT_REVIEWER.id);assert.deepEqual(scopedState(next,REPORT_REVIEWER.id).favorites,['gradebook-1']);assert.equal(next.incidents.length,2);const damaged=structuredClone(state);damaged.incidents[0].title='Changed';assert.throws(()=>mergeTeacherState(root,damaged,REPORT_REVIEWER.id));assert.deepEqual(root.incidents[0].title,'Existing');
});
test('admin preferences preserve newer teaching records when seed timestamps or another tab have changed',()=>{
 const root=seed(date),state=structuredClone(scopedState(root,REPORT_REVIEWER.id));state.favorites=['student-information-1'];root.attendance[Object.keys(root.attendance)[0]].updatedAt='2026-10-31T12:00:00Z';root.incidents.push({id:'concurrent',teacherId:actor.id,studentId:roster(course.id)[0].id,title:'Saved in another tab'});state.assignments=[];
 const next=mergeTeacherState(root,state,REPORT_REVIEWER.id);assert.deepEqual(next.attendance,root.attendance);assert.deepEqual(next.assignments,root.assignments);assert.equal(next.incidents.length,1);assert.equal(next.incidents[0].id,'concurrent');assert.deepEqual(scopedState(next,REPORT_REVIEWER.id).favorites,['student-information-1']);
});
test('report runner HTTP endpoint requires a login and enforces the selected teacher allocation',async()=>{
 const server=createAppServer({attendanceFile:null,gradesFile:null,messagesFile:null,reportsFile:null,directoryFile:null});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;try{const req={method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(query('roster'))};assert.equal((await fetch(base+'/api/reporting/run',req)).status,401);const login=await fetch(base+'/api/login',{method:'POST',body:JSON.stringify({username:actor.username,password:'WistTest2026!'})}),cookie=login.headers.get('set-cookie').split(';')[0],response=await fetch(base+'/api/reporting/run',{...req,headers:{...req.headers,cookie}});assert.equal(response.status,200);assert.equal((await response.json()).rows.length,roster(course.id).length);const foreign=teachingClasses.find(c=>c.teacherId!==actor.id);assert.equal((await fetch(base+'/api/reporting/run',{...req,headers:{...req.headers,cookie},body:JSON.stringify({...query('roster'),classId:foreign.id})})).status,403);}finally{await new Promise(resolve=>server.close(resolve));}
});
