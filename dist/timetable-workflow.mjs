import {validateTimetable} from './timetable-engine.mjs';
import {teacherSubjects} from './timetable-manager-inputs.mjs';

export const WORKFLOW_STAGES=Object.freeze([
 {id:'setup',title:'School week'},
 {id:'data',title:'People & rooms'},
 {id:'options',title:'Student options'},
 {id:'loads',title:'Teaching loads'},
 {id:'availability',title:'Constraints'},
 {id:'checks',title:'Validate inputs'},
 {id:'board',title:'Generate & refine'},
].map(Object.freeze));

const list=value=>Array.isArray(value)?value:[];
const rows=value=>list(value).filter(row=>row&&typeof row==='object');
const sorted=value=>[...list(value)].sort();
const byId=value=>rows(value).sort((a,b)=>String(a.id)<String(b.id)?-1:String(a.id)>String(b.id)?1:0);
const pick=(row,keys)=>Object.fromEntries(keys.filter(key=>row?.[key]!==undefined).map(key=>[key,row[key]]));
const key=(day,period)=>day+'|'+period;
const clock=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
const hours=a=>Number.isInteger(a.weeklyCount)&&Number.isInteger(a.duration)?a.weeklyCount*a.duration:0;
const unique=items=>[...new Map(items.map(item=>[[item.target,item.id||'',item.message].join('|'),item])).values()];
const stable=value=>value===null||typeof value!=='object'?JSON.stringify(value):Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';

// A compact deterministic change marker, not an authentication/audit signature.
function fingerprint(value){const text=stable(value);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return 'mw1-'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+'-'+text.length;}
function activityFields(a){return {...pick(a,['id','name','subjectId','year','blockId','weeklyCount','duration','spread']),teacherIds:sorted(a.teacherIds),groupIds:sorted(a.groupIds),studentIds:sorted(a.studentIds),roomIds:sorted(a.roomIds),fixedSlots:list(a.fixedSlots).map(p=>pick(p,['day','period']))};}
function materials(project){
 const p=project||{},resourceOff=kind=>byId(p[kind]).map(r=>({id:r.id,blocked:sorted(r.blocked)}));
 return{
  setup:{...pick(p,['scope','planningYear']),days:rows(p.days).map(d=>pick(d,['id','name'])),periods:rows(p.periods).map(r=>pick(r,['id','start','end'])),registration:pick(p.registration,['id','start','end','outsideTeachingCycle'])},
  data:{teachers:byId(p.teachers).map(r=>({...pick(r,['id','name','area','planningOnly','duty','yearBands','committedLoad','committedBands']),...(Array.isArray(r.subjectIds)?{subjectIds:sorted(r.subjectIds)}:{})})),rooms:byId(p.rooms).map(r=>pick(r,['id','name','type','capacity'])),groups:byId(p.groups).map(r=>({...pick(r,['id','name','year']),studentIds:sorted(r.studentIds)})),subjects:byId(p.subjects).map(r=>pick(r,['id','name']))},
  options:{...pick(p,['rulesVersion','optionModels','optionSource','optionEligibility','demonstrationModel','planningYear']),blocks:byId(p.optionBlocks).map(b=>({...pick(b,['id','year','modelId','weeklyCount','duration','documentChoices']),activityIds:sorted(b.activityIds),studentIds:sorted(b.studentIds)})),activities:byId(p.activities).filter(a=>a.blockId).map(a=>({...pick(a,['id','subjectId','year','blockId','weeklyCount','duration']),studentIds:sorted(a.studentIds),groupIds:sorted(a.groupIds)}))},
  loads:{activities:byId(p.activities).map(activityFields),constraints:{...pick(p.constraints,['maxTeacherDaily']),schoolPolicy:p.schoolPolicy},teacherTimeOff:resourceOff('teachers')},
  availability:{teachers:resourceOff('teachers'),rooms:resourceOff('rooms'),groups:resourceOff('groups'),constraints:pick(p.constraints,['maxTeacherDaily'])},
  checks:{policy:p.schoolPolicy||1},
  board:{placements:Object.fromEntries(Object.entries(p.placements||{}).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([id,pos])=>[id,pick(pos,['day','period','roomId','locked'])]))},
 };
}
function safeReport(project,provided){if(provided)return provided;try{return validateTimetable(project);}catch(error){return{issues:[{kind:'invalid-data',message:'Unable to validate the input structure: '+error.message,lessonIds:[]}],placed:0,total:0,unplaced:[],complete:false};}}
function issueStage(issue){if(['weekly-load','specialist-allocation','class-size'].includes(issue.kind))return 'loads';if(['language-support','pshe-weekly'].includes(issue.kind))return 'availability';
 if(issue.kind.startsWith('option-')&&!['option-block-sync','option-block-partial'].includes(issue.kind))return 'options';
 if(['pe-double','curriculum-shortfall','curriculum-overload'].includes(issue.kind))return 'loads';
 if(issue.kind==='unknown-lesson')return 'checks';
 if(issue.kind!=='invalid-data')return null;
 const message=issue.message||'';
 if(/time.off|daily|unavailable/i.test(message))return 'availability';
 if(/^(Period|days|periods)/i.test(message))return 'setup';
 if(/^(Activity)/i.test(message)&&!/unknown (subject|group|student)/i.test(message))return 'loads';
 return 'data';
}
// Matches the assignment UI: planning declarations/current allocations, not verified credentials.
function capabilities(teacher,project){return new Set(teacherSubjects(project,teacher.id));}

export function workflowStatus(project,providedReport){
 const p=project||{},report=safeReport(p,providedReport),days=rows(p.days),periods=rows(p.periods),teachers=rows(p.teachers),rooms=rows(p.rooms),groups=rows(p.groups),activities=rows(p.activities),subjects=rows(p.subjects),blocks=rows(p.optionBlocks);
 const ownIssues=Object.fromEntries(WORKFLOW_STAGES.map(s=>[s.id,[]])),warnings=[];
 const add=(stage,message,id)=>ownIssues[stage].push({message,target:stage,...(id?{id}:{})});
 const warn=(message,target,id)=>warnings.push({message,target,...(id?{id}:{})});
 const teacherMap=new Map(teachers.map(t=>[t.id,t])),roomMap=new Map(rooms.map(r=>[r.id,r])),groupMap=new Map(groups.map(g=>[g.id,g])),subjectIds=new Set(subjects.map(s=>s.id));
 const capabilityProject={teachers,subjects,activities:activities.map(a=>({...a,teacherIds:list(a.teacherIds)}))};
 if(!days.length||!periods.length)add('setup','Add the teaching days and periods before reviewing the school week.');
 let end=-1;for(const period of periods){const start=clock(period.start),finish=clock(period.end);if(!Number.isFinite(start)||!Number.isFinite(finish)||start<end||finish<=start)add('setup','Teaching periods must have ordered, non-overlapping start and end times.',period.id);end=finish;}
 if(p.rulesVersion>=2&&days.length*periods.length!==40)add('setup','The school demonstration requires a 40-period teaching week.');
 if(!teachers.length)add('data','Add at least one teacher.');if(!rooms.length)add('data','Add at least one room.');if(!subjects.length)add('data','Add the subjects before assigning teaching loads.');
 for(const teacher of teachers)if(teacher.subjectIds!==undefined){if(!Array.isArray(teacher.subjectIds)||teacher.subjectIds.some(id=>typeof id!=='string')||new Set(teacher.subjectIds).size!==teacher.subjectIds.length)add('data',(teacher.name||teacher.id)+' needs a list of distinct curriculum subject IDs.',teacher.id);else if(teacher.subjectIds.some(id=>!subjectIds.has(id)))add('data',(teacher.name||teacher.id)+' has an unknown curriculum subject capability.',teacher.id);}
 for(const room of rooms)if(!Number.isInteger(room.capacity)||room.capacity<=0)add('data','Room '+(room.name||room.id)+' needs a positive whole-number capacity.',room.id);
 const pupilGroups=new Map();for(const group of groups)for(const id of list(group.studentIds)){if(pupilGroups.has(id))add('data','Student '+id+' is listed in more than one form.',group.id);pupilGroups.set(id,group.id);}
 const members=a=>Array.isArray(a.studentIds)?a.studentIds:[...new Set(list(a.groupIds).flatMap(id=>list(groupMap.get(id)?.studentIds)))];
 const eligible=a=>list(a.roomIds).length?list(a.roomIds).map(id=>roomMap.get(id)).filter(Boolean):rooms;
 if(!activities.length)add('loads','Add the teaching allocations before generating a timetable.');
 for(const a of activities){
  if(!list(a.teacherIds).length)add('loads','Assign a teacher to '+(a.name||a.id)+'.',a.id);
  for(const id of list(a.teacherIds))if(!teacherMap.has(id))add('data','Teaching allocation '+(a.name||a.id)+' references an unknown teacher.',a.id);
  for(const id of list(a.roomIds))if(!roomMap.has(id))add('data','Teaching allocation '+(a.name||a.id)+' references an unknown room.',a.id);
  for(const id of list(a.groupIds))if(!groupMap.has(id))add('data','Teaching allocation '+(a.name||a.id)+' references an unknown form.',a.id);
  if(!subjectIds.has(a.subjectId))add('data','Teaching allocation '+(a.name||a.id)+' references an unknown subject.',a.id);
  if(pupilGroups.size&&members(a).some(id=>!pupilGroups.has(id)))add('data','Teaching allocation '+(a.name||a.id)+' references a student outside the planning forms.',a.id);
  if(hours(a)>0&&!eligible(a).some(r=>r.capacity>=new Set(members(a)).size))add('loads','No eligible room is large enough for '+(a.name||a.id)+'.',a.id);
  for(const id of list(a.teacherIds)){const teacher=teacherMap.get(id),allowed=teacher&&capabilities(teacher,capabilityProject);if(allowed&&(allowed.size||Array.isArray(teacher.subjectIds))&&!['assembly',...(p.schoolPolicy?['pshe','language-support']:[])].includes(a.subjectId)&&!allowed.has(a.subjectId))add('loads',(teacher.name||id)+' is not assigned the planning curriculum capability for '+(subjects.find(s=>s.id===a.subjectId)?.name||a.subjectId)+'.',a.id);}
 }
 for(const block of blocks){const owners=new Map();for(const id of list(block.activityIds)){const a=activities.find(a=>a.id===id);if(!a)continue;for(const teacherId of list(a.teacherIds)){if(owners.has(teacherId))add('loads',(teacherMap.get(teacherId)?.name||teacherId)+' teaches two simultaneous alternatives in '+(block.name||block.id)+'.',block.id);owners.set(teacherId,id);}}}
 const dayLimit=Number.isInteger(p.constraints?.maxTeacherDaily)&&p.constraints.maxTeacherDaily>0?p.constraints.maxTeacherDaily:periods.length;
 const teacherLoads=teachers.map(teacher=>{const off=new Set(list(teacher.blocked)),required=activities.filter(a=>list(a.teacherIds).includes(teacher.id)).reduce((sum,a)=>sum+hours(a),0),available=days.reduce((sum,d)=>sum+Math.min(dayLimit,periods.filter(period=>!off.has(key(d.id,period.id))).length),0);if(required>available)add('loads',(teacher.name||teacher.id)+' has '+required+' teaching periods but only '+available+' available.',teacher.id);return{id:teacher.id,required,available};});
 const roomPools=new Map();
 for(const a of activities.filter(a=>hours(a)>0)){
  const pupils=new Set(members(a)).size,pool=eligible(a).filter(r=>r.capacity>=pupils),poolId=pool.map(r=>r.id).sort().join('|');if(poolId){if(!roomPools.has(poolId))roomPools.set(poolId,{rooms:pool,required:0});roomPools.get(poolId).required+=hours(a);}
  let starts=0,packCapacity=0;const valid=new Set(),availableDays=new Set();
  if(Number.isInteger(a.duration)&&a.duration>0&&a.duration<=periods.length&&list(a.teacherIds).length&&a.duration<=dayLimit){
   for(const d of days){const daily=[];for(let i=0;i+a.duration<=periods.length;i++){
    const span=periods.slice(i,i+a.duration);if(span.some((r,j)=>j&&clock(r.start)!==clock(span[j-1].end)))continue;
    const parts=span.map(r=>key(d.id,r.id));
    if(list(a.teacherIds).some(id=>parts.some(k=>list(teacherMap.get(id)?.blocked).includes(k)))||list(a.groupIds).some(id=>parts.some(k=>list(groupMap.get(id)?.blocked).includes(k))))continue;
    if(!pool.some(r=>parts.every(k=>!list(r.blocked).includes(k))))continue;
    starts++;daily.push(i);valid.add(key(d.id,periods[i].id));availableDays.add(d.id);
   }let next=0;for(const i of daily)if(i>=next){packCapacity++;next=i+a.duration;}}
  }
  const capacity=a.spread?Math.min(packCapacity,availableDays.size):packCapacity;
  if(!starts)add('availability',(a.name||a.id)+' has no valid starting slot under the current room, time-off and consecutive-period rules.',a.id);
  else if(a.weeklyCount>capacity)add('availability',(a.name||a.id)+' needs '+a.weeklyCount+' cards but its availability permits at most '+capacity+'.',a.id);
  for(const fixed of rows(a.fixedSlots))if(!valid.has(key(fixed.day,fixed.period)))add('availability','The fixed slot for '+(a.name||a.id)+' is unavailable.',a.id);
 }
 for(const {rooms:pool,required} of roomPools.values()){const available=pool.reduce((sum,r)=>sum+days.reduce((n,d)=>n+periods.filter(period=>!list(r.blocked).includes(key(d.id,period.id))).length,0),0);if(required>available)add('availability',pool.length===1?(pool[0].name||pool[0].id)+' is required for '+required+' periods but has '+available+' available.':pool.length+' eligible rooms are required for '+required+' periods but provide only '+available+'.',pool[0].id);}
 for(const i of list(report.issues)){
  const stage=issueStage(i);if(stage)add(stage,i.message,list(i.lessonIds)[0]);
  else if(!i.diagnostic&&i.kind!=='option-block-partial'&&list(i.lessonIds).length&&i.lessonIds.every(id=>p.placements?.[id]?.locked))add('availability','Unlock or resolve the fixed placements: '+i.message,list(i.lessonIds)[0]);
  else if(!i.diagnostic)warn(i.message,'board',list(i.lessonIds)[0]);
 }
 if(list(report.unplaced).length)warn(report.unplaced.length+' lesson cards are unassigned. This is allowed while preparing or regenerating a draft.','board');
 if(report.coverage?.missingSlots)warn(report.coverage.missingSlots+' compulsory student-periods are not yet covered. The timetable is not complete.','checks');
 const missingCaps=teachers.filter(t=>!capabilities(t,capabilityProject).size);if(missingCaps.length)warn(missingCaps.length+' planning teacher capability lists are unspecified; confirm their subject assignments.','data');
 const material=materials(p),signatures={};let prior=null;
 for(const stage of WORKFLOW_STAGES){signatures[stage.id]=fingerprint({stage:stage.id,prior,input:material[stage.id]});prior=signatures[stage.id];}
 const blockers=unique(WORKFLOW_STAGES.filter(s=>!['checks','board'].includes(s.id)).flatMap(s=>ownIssues[s.id]).concat(ownIssues.checks));
 const metrics={setup:{days:days.length,periodsPerDay:periods.length,weeklyPeriods:days.length*periods.length},data:{teachers:teachers.length,rooms:rooms.length,forms:groups.length,students:pupilGroups.size,subjects:subjects.length},options:{blocks:blocks.length},loads:{activities:activities.length,teacherLoads},availability:{fixedAllocations:activities.filter(a=>list(a.fixedSlots).length).length},checks:{blockers:blockers.length,warnings:unique(warnings).length},board:{placed:report.placed||0,total:report.total||0,unassigned:list(report.unplaced).length,missingStudentPeriods:report.coverage?.missingSlots||0}};
 const stages=WORKFLOW_STAGES.map((stage,index)=>{const issues=stage.id==='checks'||stage.id==='board'?blockers:unique(ownIssues[stage.id]),stored=p.managerWorkflow?.reviews?.[stage.id],reviewed=stored?.signature===signatures[stage.id]&&!issues.length&&(stage.id!=='board'||report.complete===true);let status=issues.length?'blocked':reviewed?'reviewed':stage.id==='checks'?'ready':'needs-review';if(stage.id==='board')status=report.complete?'complete':issues.length?'blocked':report.placed?'in-progress':'ready';return{...stage,status,reviewed,signature:signatures[stage.id],blockers:issues,metrics:metrics[stage.id],next:WORKFLOW_STAGES[index+1]?.id||'board'};});
 const inputReviewsComplete=stages.filter(s=>s.id!=='board').every(s=>s.reviewed);
 return{stages,preflight:{blockers,warnings:unique(warnings),canGenerate:blockers.length===0,inputReviewsComplete},inputReviewsComplete,nextStage:stages.find(s=>!s.reviewed)?.id||'board'};
}

export function reviewStage(project,stageId){
 const status=workflowStatus(project),stage=status.stages.find(s=>s.id===stageId);
 if(!stage)throw Error('Choose an existing manager workflow stage.');
 if(stage.blockers.length)throw Error('Resolve '+stage.title+' before review: '+stage.blockers[0].message);
 if(stageId==='board'&&stage.status!=='complete')throw Error('Finish all lessons and student coverage before reviewing the completed timetable.');
 const next=structuredClone(project);next.managerWorkflow={...(next.managerWorkflow||{}),reviews:{...(next.managerWorkflow?.reviews||{}),[stageId]:{signature:stage.signature,at:new Date().toISOString()}}};return next;
}
