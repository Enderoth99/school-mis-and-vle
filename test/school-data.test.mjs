import test from 'node:test';
import assert from 'node:assert/strict';
import {students,groups,yearGroups,groupById,studentsForGroup,DATASET_VERSION} from '../dist/school-data.mjs';
import {classes,roster,seed,load,STORAGE_KEY,isDate} from '../dist/model.mjs';
import {readFile} from 'node:fs/promises';

test('exactly 1,000 unique synthetic students are assigned to 51 valid forms',()=>{
 assert.equal(students.length,1000);assert.equal(groups.length,51);assert.equal(yearGroups.length,15);
 for(const field of ['id','name','admissionNumber','schoolEmail'])assert.equal(new Set(students.map(s=>s[field])).size,1000,`${field} must be unique`);
 for(const s of students){assert.equal(s.synthetic,true);assert.ok(groupById(s.cohort));assert.equal(groupById(s.cohort).year,s.year);assert.ok(s.schoolEmail.endsWith('@wist-test.invalid'));}
});
test('four forms per FS1–Year 09, then three, two, one and one',()=>{
 for(const y of yearGroups){const count=y.year===10?3:y.year===11?2:y.year===12||y.year===13?1:4;assert.equal(groups.filter(g=>g.year===y.year).length,count);}
 assert.equal(studentsForGroup('12a').length,10);assert.equal(studentsForGroup('13a').length,10);
 assert.equal(groups.reduce((total,g)=>total+g.count,0),1000);
 for(const g of groups)assert.equal(studentsForGroup(g.id).length,g.count);
 assert.ok(new Set(groups.map(g=>g.count)).size>8,'form sizes should vary');
});
test('dates of birth match the expected age at the start of the academic year',()=>{
 for(const s of students){assert.ok(isDate(s.dateOfBirth));const age=2026-Number(s.dateOfBirth.slice(0,4))-(s.dateOfBirth.slice(5)>'08-31'?1:0);assert.equal(age,s.year==='FS1'?3:s.year==='FS2'?4:Number(s.year)+4);}
});
test('teacher classes use the correct form and all seed reports reference enrolled students',()=>{
 for(const c of classes){assert.ok(groupById(c.cohort));if(c.enrollmentMode==='form')assert.equal(roster(c.id).length,groupById(c.cohort).count);else assert.ok(roster(c.id).every(s=>s.year===c.year));}
 assert.equal(classes.find(c=>c.id==='computing7c').cohort,'7c');assert.equal(classes.find(c=>c.id==='economics10c').cohort,'10c');
 for(const report of seed('2026-10-30').reports)assert.ok(roster(report.classId).some(s=>s.id===report.studentId));
});
test('legacy test work migrates without resetting marks, reports, incidents or notes',()=>{
 const legacy={version:1,attendance:{'2026-10-30|computing7c|6':{classId:'computing7c',date:'2026-10-30',period:'6',records:Array.from({length:14},(_,i)=>({studentId:`s-7b-${i+1}`,status:'Present',time:'',note:i===0?'Keep this note':''}))}},assignments:[{id:'old-assignment',classId:'computing7c',points:20,title:'Keep assignment',due:'2026-10-30'}],grades:{'old-assignment':{'s-7b-1':0,'s-7b-2':17}},reports:[{id:'computing7c-s-7b-1',studentId:'s-7b-1',classId:'computing7c',status:'pending',comment:'Keep this report',grade:'A',effort:'Good'}],incidents:[{id:'old-incident',studentId:'s-7b-1',title:'Keep incident'}],events:[],lessons:[],favorites:[],reportHistory:[]};
 const original=JSON.stringify(legacy);let writes=0;const storage={getItem:key=>(assert.equal(key,STORAGE_KEY),original),setItem:()=>writes++};
 const updated=load(storage,'2026-10-30');assert.equal(updated.datasetVersion,DATASET_VERSION);assert.equal(writes,0);assert.equal(JSON.stringify(legacy),original);
 const records=Object.values(updated.attendance)[0].records;assert.equal(records.length,20);assert.equal(records[0].studentId,'s-7c-1');assert.equal(records[0].note,'Keep this note');assert.ok(records.slice(14).every(r=>r.status==='Not Taken'));
 assert.equal(updated.grades['old-assignment']['s-7c-1'],0);assert.equal(updated.grades['old-assignment']['s-7c-2'],17);assert.equal(updated.assignments[0].title,'Keep assignment');assert.equal(updated.incidents[0].studentId,'s-7c-1');
 const report=updated.reports.find(r=>r.id==='computing7c-s-7c-1');assert.equal(report.comment,'Keep this report');assert.equal(report.status,'pending');
 assert.equal(updated.reports.find(r=>r.id==='computing7c-s-7c-20').status,'draft');
 assert.deepEqual(load({getItem:()=>JSON.stringify(updated)},'2026-10-30'),updated,'migration must be idempotent');
});
test('generated JSON fixture matches the in-app population exactly',async()=>{
 const exported=JSON.parse(await readFile(new URL('../dist/data/students.json',import.meta.url),'utf8'));assert.deepEqual(exported.students,students);assert.deepEqual(exported.groups,groups);assert.equal(exported.studentCount,1000);
});
