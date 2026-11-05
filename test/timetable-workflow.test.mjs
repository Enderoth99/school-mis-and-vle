import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {WORKFLOW_STAGES,workflowStatus,reviewStage} from '../dist/timetable-workflow.mjs';
import {generateTimetable} from '../dist/timetable-engine.mjs';

function project(){return{
 version:1,id:'workflow-test',name:'Manager fixture',days:[{id:'mon',name:'Monday'},{id:'tue',name:'Tuesday'}],
 periods:[{id:'1',start:'08:30',end:'09:15'},{id:'2',start:'09:15',end:'10:00'},{id:'3',start:'10:20',end:'11:05'}],
 teachers:[{id:'t1',name:'Teacher One',subjectIds:['maths'],blocked:[]},{id:'t2',name:'Teacher Two',subjectIds:['maths'],blocked:[]}],
 rooms:[{id:'r1',name:'Room One',type:'general',capacity:20,blocked:[]},{id:'r2',name:'Room Two',type:'general',capacity:20,blocked:[]}],
 groups:[{id:'g1',name:'Form One',studentIds:['s1','s2'],blocked:[]}],subjects:[{id:'maths',name:'Mathematics'}],
 activities:[{id:'a',name:'Mathematics Form One',subjectId:'maths',teacherIds:['t1'],groupIds:['g1'],studentIds:['s1','s2'],roomIds:['r1','r2'],weeklyCount:2,duration:1,spread:false}],
 optionBlocks:[],placements:{},constraints:{maxTeacherDaily:3},
};}
const stage=(p,id)=>workflowStatus(p).stages.find(s=>s.id===id);
const reviewedInputs=p=>WORKFLOW_STAGES.filter(s=>s.id!=='board').reduce((next,s)=>reviewStage(next,s.id),p);
function optionProject(){const p=project();p.activities=[{...p.activities[0],id:'art',name:'Art choice',blockId:'b',studentIds:['s1']},{...p.activities[0],id:'music',name:'Music choice',blockId:'b',teacherIds:['t2'],studentIds:['s2']}];p.optionBlocks=[{id:'b',name:'Block A',year:10,activityIds:['art','music'],studentIds:['s1','s2'],weeklyCount:2,duration:1}];return p;}

test('manager workflow has seven distinct stages and does not mistake unplaced cards for invalid inputs',()=>{
 assert.deepEqual(WORKFLOW_STAGES.map(s=>s.id),['setup','data','options','loads','availability','checks','board']);
 const p=project(),before=structuredClone(p),s=workflowStatus(p);
 assert.deepEqual(p,before);assert.equal(s.preflight.canGenerate,true);assert.equal(s.inputReviewsComplete,false);assert.equal(s.nextStage,'setup');assert.equal(s.stages.find(s=>s.id==='checks').status,'ready');assert.equal(s.stages.find(s=>s.id==='board').status,'ready');assert.ok(s.preflight.warnings.some(w=>w.message.includes('unassigned')));
});
test('review records are immutable content reviews, while board review requires actual completion',()=>{
 const p=project(),before=structuredClone(p),next=reviewedInputs(p);
 assert.deepEqual(p,before);assert.equal(workflowStatus(next).inputReviewsComplete,true);assert.equal(workflowStatus(next).preflight.canGenerate,true);assert.equal(workflowStatus(next).nextStage,'board');
 for(const review of Object.values(next.managerWorkflow.reviews)){assert.match(review.signature,/^mw1-/);assert.ok(Number.isFinite(Date.parse(review.at)));}
 assert.throws(()=>reviewStage(next,'board'),/Finish all lessons/);assert.throws(()=>reviewStage(next,'unknown'),/existing/);
 const complete=generateTimetable(next).project,reviewed=reviewStage(complete,'board');assert.equal(stage(reviewed,'board').status,'complete');assert.equal(stage(reviewed,'board').reviewed,true);
});
test('input reviews survive placement changes and non-semantic metadata but invalidate downstream after data changes',()=>{
 const p=reviewedInputs(project()),placed=structuredClone(p);placed.placements['a#1']={day:'mon',period:'1',roomId:'r1',locked:false};
 assert.equal(workflowStatus(placed).inputReviewsComplete,true);
 placed.notes=['unrelated documentation'];placed.generationSummary={placed:1};placed.rooms[0].color='#fff';assert.equal(workflowStatus(placed).inputReviewsComplete,true);
 placed.teachers[0].name='Teacher Updated';const changed=workflowStatus(placed);
 assert.equal(changed.stages[0].reviewed,true);assert.ok(changed.stages.slice(1).every(s=>!s.reviewed));
});
test('review fingerprints ignore object key ordering and set ordering, but retain timetable period order',()=>{
 const p=reviewedInputs(project()),reordered=Object.fromEntries(Object.entries(p).reverse());
 reordered.teachers=[...p.teachers].reverse().map(t=>Object.fromEntries(Object.entries(t).reverse()));reordered.rooms=[...p.rooms].reverse();reordered.groups=p.groups.map(g=>({...g,studentIds:[...g.studentIds].reverse()}));reordered.activities=p.activities.map(a=>({...a,roomIds:[...a.roomIds].reverse(),studentIds:[...a.studentIds].reverse()}));
 assert.equal(workflowStatus(reordered).inputReviewsComplete,true);
 reordered.days=[...p.days].reverse();assert.equal(stage(reordered,'setup').reviewed,false);
});
test('option eligibility and pupil membership edits invalidate options and downstream reviews',()=>{
 const p=reviewedInputs(optionProject()),eligible=structuredClone(p);eligible.optionEligibility={s1:{nonUzbek:true}};
 assert.equal(stage(eligible,'data').reviewed,true);assert.equal(stage(eligible,'options').reviewed,false);assert.equal(stage(eligible,'loads').reviewed,false);
 const swapped=structuredClone(p);swapped.activities[0].studentIds=['s2'];swapped.activities[1].studentIds=['s1'];assert.equal(stage(swapped,'data').reviewed,true);assert.equal(stage(swapped,'options').reviewed,false);
 const model=structuredClone(p);model.demonstrationModel='1';model.planningYear='2026–27';assert.equal(stage(model,'options').reviewed,false);
});
test('teacher time off invalidates loads, constraints and validation without invalidating reviewed student options',()=>{
 const p=reviewedInputs(project());p.teachers[0].blocked=['mon|3'];
 assert.equal(stage(p,'options').reviewed,true);assert.equal(stage(p,'loads').reviewed,false);assert.equal(stage(p,'availability').reviewed,false);assert.equal(stage(p,'checks').reviewed,false);
});
test('preflight blocks missing references, invalid room capacity and invalid periods with actionable targets',()=>{
 const p=project();p.activities[0].teacherIds=['missing'];p.rooms[0].capacity=0;p.periods[1].start='08:40';
 const s=workflowStatus(p);assert.equal(s.preflight.canGenerate,false);assert.ok(s.preflight.blockers.some(b=>b.target==='setup'));assert.ok(s.preflight.blockers.some(b=>b.target==='data'&&b.id==='r1'));assert.ok(s.preflight.blockers.some(b=>b.message.includes('unknown teacher')));assert.throws(()=>reviewStage(p,'data'),/Resolve/);
});
test('preflight detects teacher capacity, explicit qualifications and repeated teachers inside parallel options',()=>{
 const p=project();p.activities[0].weeklyCount=7;assert.ok(workflowStatus(p).preflight.blockers.some(b=>b.target==='loads'&&b.message.includes('only 6 available')));
 const q=project();q.subjects.push({id:'english',name:'English'});q.teachers[0].subjectIds=['english'];assert.ok(workflowStatus(q).preflight.blockers.some(b=>b.target==='loads'&&b.message.includes('curriculum capability')));
 q.teachers[0].subjectIds=[];assert.ok(workflowStatus(q).preflight.blockers.some(b=>b.target==='loads'&&b.message.includes('curriculum capability')));
 const inferred=project();delete inferred.teachers[0].subjectIds;assert.equal(workflowStatus(inferred).preflight.canGenerate,true,'Existing planning allocations provide the same fallback eligibility as the assignment UI.');
 const option=optionProject();option.activities[1].teacherIds=['t1'];assert.ok(workflowStatus(option).preflight.blockers.some(b=>b.target==='loads'&&b.id==='b'&&b.message.includes('simultaneous')));
 const team=optionProject();team.activities[0].teacherIds=['t1','t2'];assert.ok(workflowStatus(team).preflight.blockers.some(b=>b.message.includes('simultaneous')));
});
test('availability checks catch impossible PE, fixed slots, spreading and aggregate eligible-room shortages',()=>{
 const p=project();p.activities[0].duration=2;p.rooms.forEach(r=>r.blocked=['mon|1','mon|2','tue|1','tue|2']);assert.ok(workflowStatus(p).preflight.blockers.some(b=>b.target==='availability'&&b.message.includes('no valid starting')));
 const q=project();q.activities[0].spread=true;q.activities[0].weeklyCount=3;assert.ok(workflowStatus(q).preflight.blockers.some(b=>b.message.includes('availability permits at most 2')));
 const fixed=project();fixed.activities[0].fixedSlots=[{day:'mon',period:'1'}];fixed.teachers[0].blocked=['mon|1'];assert.ok(workflowStatus(fixed).preflight.blockers.some(b=>b.message.includes('fixed slot')));
 const pool=project();pool.activities[0].roomIds=['r1'];pool.activities[0].weeklyCount=4;pool.activities.push({...pool.activities[0],id:'b',name:'Second group',teacherIds:['t2'],studentIds:[]});assert.ok(workflowStatus(pool).preflight.blockers.some(b=>b.target==='availability'&&b.message.includes('required for 8 periods')));
});
test('movable placement clashes warn but locked clashes prevent a misleading generate-ready state',()=>{
 const p=project();p.placements={'a#1':{day:'mon',period:'1',roomId:'r1',locked:false},'a#2':{day:'mon',period:'1',roomId:'r1',locked:false}};
 assert.equal(workflowStatus(p).preflight.canGenerate,true);assert.ok(workflowStatus(p).preflight.warnings.some(w=>w.target==='board'));
 Object.values(p.placements).forEach(pos=>pos.locked=true);assert.equal(workflowStatus(p).preflight.canGenerate,false);assert.ok(workflowStatus(p).preflight.blockers.some(b=>b.message.includes('fixed placements')));
});
test('the scheduled secondary demo can be regenerated but is not silently marked reviewed or complete',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('../dist/timetable-demo.json',import.meta.url))),s=workflowStatus(p);
 assert.equal(s.preflight.canGenerate,true);assert.equal(s.stages.find(s=>s.id==='board').status,'in-progress');assert.equal(s.stages.find(s=>s.id==='board').metrics.placed,702);assert.equal(s.stages.find(s=>s.id==='board').metrics.unassigned,67);assert.equal(s.inputReviewsComplete,false);assert.ok(s.stages.every(stage=>!stage.reviewed));
});
