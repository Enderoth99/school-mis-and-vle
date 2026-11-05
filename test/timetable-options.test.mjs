import test from 'node:test';
import assert from 'node:assert/strict';
import {OPTION_MODELS,optionModel,documentOptionIssues} from '../dist/timetable-options.mjs';
import {createTimetableProject} from '../dist/timetable-data.mjs';
import {updateSchoolRules} from '../dist/timetable-school-rules.mjs';
import {validateTimetable,generateTimetable} from '../dist/timetable-engine.mjs';
const short={ 'Business Studies':'Business','English Literature':'Eng Lit','Computer Science':'CS','Global Perspectives':'GP','Uzbek Language':'Uzbek','Russian as a Second Language':'RSL'};
test('all four models match the document columns A–I, including repeated offerings',()=>{
 const expected=[
 ['Economics,Physics,History','Business,Chemistry,CS','Accounting,Biology,Economics','Eng Lit,ICT,GP','Art,Geography,Business','Uzbek,GP,RSL','Russian,French','English','Mathematics'],
 ['Accounting,Physics,History','Economics,Chemistry,CS','Business,Biology,Economics','Eng Lit,ICT,GP','Art,Geography,Business','Uzbek,GP,French','Russian,RSL','English','Mathematics'],
 ['Accounting,Physics,History','Economics,Chemistry,ICT','Business,Biology,Economics','Eng Lit,CS,GP','Art,Geography,Business','Uzbek,GP,French','Russian,RSL','English','Mathematics'],
 ['Economics,Physics,History','Business,Chemistry,CS','Accounting,Biology,Economics,French','Eng Lit,ICT,GP','Art,Geography,Business,Textiles','Uzbek,GP','Russian,RSL','English','Mathematics'],
 ];
 assert.deepEqual(OPTION_MODELS.map(m=>m.blocks.map(b=>b.map(c=>short[c.subject]||c.subject).join(','))),expected);
 assert.throws(()=>optionModel('5'),/1–4/);
 const restricted=OPTION_MODELS.map(m=>m.blocks.flatMap((b,i)=>b.filter(c=>c.nonUzbekOnly).map(c=>'ABCDEFGHI'[i]+':'+(short[c.subject]||c.subject))));
 assert.deepEqual(restricted,[['F:GP','G:French'],['F:GP','F:French','G:RSL'],['F:GP','F:French','G:RSL'],['F:GP']]);
});
test('all model fixtures give every Year10/11 pupil nine distinct subjects, science and forty periods',()=>{
 for(const model of OPTION_MODELS){const p=createTimetableProject({scope:'secondary',optionModels:{10:model.id,11:model.id}});
  assert.deepEqual(documentOptionIssues(p,p.activities),[]);
  for(const year of [10,11]){
   const blocks=p.optionBlocks.filter(b=>b.year===year);assert.equal(blocks.length,9);
   for(const b of blocks){assert.equal(b.weeklyCount,4);assert.equal(b.duration,1);assert.ok(b.activityIds.length);}
   for(const id of p.groups.filter(g=>g.year===year).flatMap(g=>g.studentIds)){
    const all=p.activities.filter(a=>a.studentIds.includes(id)),chosen=all.filter(a=>a.blockId);
    assert.equal(chosen.length,9);assert.equal(new Set(chosen.map(a=>a.subjectId)).size,9);
    assert.equal(all.reduce((n,a)=>n+a.weeklyCount*a.duration,0),40);
    assert.ok(chosen.some(a=>['biology','chemistry','physics'].includes(a.subjectId)));
    assert.ok(chosen.filter(a=>a.nonUzbekOnly).every(()=>p.optionEligibility[id].nonUzbek));
   }
  }
  assert.ok(!validateTimetable(p).issues.some(i=>!i.diagnostic));
 }
});
test('sixth-form teaching subjects have four periods while PE remains a double',()=>{
 const p=createTimetableProject({scope:'secondary'});
 for(const a of p.activities.filter(a=>a.year>=12))assert.equal(a.weeklyCount*a.duration,a.subjectId==='pe'?2:['assembly','pshe'].includes(a.subjectId)?1:4);
});
test('document rules reject ineligible choices, missing science, duplicate subjects and wrong hours',()=>{
 const p=createTimetableProject({scope:'secondary'}),restricted=p.activities.find(a=>a.nonUzbekOnly&&a.studentIds.length);
 p.optionEligibility[restricted.studentIds[0]].nonUzbek=false;
 assert.ok(validateTimetable(p).issues.some(i=>i.kind==='option-eligibility'));
 const q=createTimetableProject({scope:'secondary'}),science=q.activities.find(a=>a.science&&a.studentIds.length),id=science.studentIds[0];science.studentIds=science.studentIds.filter(s=>s!==id);
 assert.ok(validateTimetable(q).issues.some(i=>i.kind==='option-science'));
 const r=createTimetableProject({scope:'secondary'});r.activities.find(a=>a.blockId).weeklyCount=3;
 assert.ok(validateTimetable(r).issues.some(i=>i.kind==='option-hours'));
 assert.equal(generateTimetable(r,{maxAttempts:1,maxNodes:10}).report.complete,false);
 const d=createTimetableProject({scope:'secondary'}),pupil=d.optionBlocks[0].studentIds[0],selected=d.activities.filter(a=>a.blockId&&a.studentIds.includes(pupil));selected[1].subjectId=selected[0].subjectId;
 assert.ok(validateTimetable(d).issues.some(i=>i.kind==='option-duplicate'));
});
test('pinning the demonstration to Model 1 preserves availability and clears alternate-model placements',()=>{
 const old=createTimetableProject({scope:'secondary',optionModels:{10:'4',11:'3'}}),block=old.activities.find(a=>a.blockId),lesson=old.activities.find(a=>a.year===9&&a.subjectId==='computing');
 old.placements[block.id+'#1']={day:'tue',period:'2',roomId:block.roomIds[0],locked:true};old.placements[lesson.id+'#1']={day:'wed',period:'4',roomId:lesson.roomIds[0],locked:true};old.rooms[0].blocked=['fri|8'];const before=structuredClone(old);
 const next=updateSchoolRules(old);
 assert.deepEqual(old,before);assert.equal(next.optionModels[10],'1');assert.equal(next.optionModels[11],'1');assert.equal(next.planningYear,'2026–27');
 assert.ok(!next.placements[block.id+'#1']);assert.deepEqual(next.placements[lesson.id+'#1'],old.placements[lesson.id+'#1']);assert.deepEqual(next.rooms[0].blocked,['fri|8']);
 assert.ok(!next.subjects.some(s=>s.name==='Textiles'));assert.deepEqual(documentOptionIssues(next,next.activities),[]);
});

test('the single demonstration labels 2026–27 and retains existing Model 1 placements',async()=>{const {asDemonstrationProject,createDemonstrationProject}=await import('../dist/timetable-school-rules.mjs');const old=createTimetableProject({scope:'secondary'}),a=old.activities.find(a=>a.blockId);old.placements[a.id+'#1']={day:'tue',period:'2',roomId:a.roomIds[0],locked:true};const before=structuredClone(old),next=asDemonstrationProject(old);assert.deepEqual(old,before);assert.deepEqual(next.placements,old.placements);assert.deepEqual(next.activities,old.activities);assert.equal(next.demonstrationModel,'1');assert.equal(next.planningYear,'2026–27');assert.deepEqual(asDemonstrationProject(next),next);const fresh=createDemonstrationProject({scope:'secondary',optionModels:{10:'4',11:'4'}});assert.deepEqual(fresh.optionModels,{10:'1',11:'1'});assert.match(fresh.name,/2026–27 demonstration/);});
