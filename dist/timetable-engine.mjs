import {generateOptionGrid} from './option-grid.mjs';
import {policyInputIssues,policyPlacementIssues,doublePreference} from './timetable-policy.mjs';
// WIST timetable constraints and bounded, deterministic scheduling.
// This is an independent heuristic solver, not ACTS source or its proprietary AI.
import {documentOptionIssues} from './timetable-options.mjs';
const clone=value=>structuredClone(value);
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const array=value=>Array.isArray(value)?value:[];
const clock=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
const slotKey=(day,period)=>day+'|'+period;
const resourceKey=(day,period,id)=>day+'|'+period+'|'+id;
const issue=(kind,message,lessonIds=[],position={})=>({kind,message,lessonIds,...(position.day?{day:position.day}:{}),...(position.period?{period:position.period}:{})});
const uniqueIssues=issues=>[...new Map(issues.map(i=>[[i.kind,[...i.lessonIds].sort().join(','),i.day||'',i.period||'',i.message].join('~'),i])).values()];

function compile(project){
 const errors=[];
 const mapRows=(name,required=true)=>{const rows=project?.[name];if(!Array.isArray(rows)||(required&&!rows.length)){errors.push(issue('invalid-data',`Add at least one valid ${name} record.`));return new Map();}const map=new Map();for(const row of rows){if(!row||typeof row.id!=='string'||!row.id.trim()||row.id.includes('|')||map.has(row.id)){errors.push(issue('invalid-data',`${name} must have unique, non-empty IDs without |.`));continue;}map.set(row.id,row);}return map;};
 const days=mapRows('days'),periods=mapRows('periods'),teachers=mapRows('teachers'),subjects=mapRows('subjects'),rooms=mapRows('rooms'),groups=mapRows('groups',false),activities=mapRows('activities',false);
 const periodList=[...periods.values()],periodOrder=new Map(periodList.map((p,i)=>[p.id,i])),students=new Set([...groups.values()].flatMap(g=>array(g.studentIds)));
 let previousEnd=-1;
 for(const p of periodList){const start=clock(p.start),end=clock(p.end);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||start<previousEnd)errors.push(issue('invalid-data',`Period ${p.id} must have valid, ordered, non-overlapping start and end times.`));previousEnd=end;}
 const validStrings=(value,label,ids)=>{if(!Array.isArray(value)||value.some(id=>typeof id!=='string')||new Set(value).size!==value.length){errors.push(issue('invalid-data',`${label} must be an array of distinct IDs.`,ids));return[];}return value;};
 for(const [type,map] of [['teacher',teachers],['room',rooms],['group',groups]])for(const row of map.values()){if(row.blocked!==undefined){for(const entry of validStrings(row.blocked,`${type} ${row.id} time off`,[])){const [day,period,...rest]=entry.split('|');if(rest.length||!days.has(day)||!periods.has(period))errors.push(issue('invalid-data',`${type} ${row.id} has an unknown time-off slot ${entry}.`));}}if(type==='room'&&(!Number.isInteger(row.capacity)||row.capacity<=0))errors.push(issue('invalid-data',`Room ${row.id} needs a positive whole-number capacity.`));if(type==='group'&&row.studentIds!==undefined)validStrings(row.studentIds,`Group ${row.id} student membership`,[]);}
 const daily=project?.constraints?.maxTeacherDaily;
 if(daily!==undefined&&(!Number.isInteger(daily)||daily<1))errors.push(issue('invalid-data','Maximum teacher periods per day must be a positive whole number.'));
 const lessons=[],lessonMap=new Map(),activityData=new Map();
 for(const activity of activities.values()){
  const ids=[activity.id],teacherIds=validStrings(activity.teacherIds,`Activity ${activity.id} teachers`,ids),groupIds=validStrings(activity.groupIds||[],`Activity ${activity.id} groups`,ids),roomIds=validStrings(activity.roomIds||[],`Activity ${activity.id} rooms`,ids);
  if(!teacherIds.length)errors.push(issue('invalid-data',`Activity ${activity.id} needs at least one teacher.`,ids));
  for(const [label,refs,map] of [['teacher',teacherIds,teachers],['group',groupIds,groups],['room',roomIds,rooms]])for(const id of refs)if(!map.has(id))errors.push(issue('invalid-data',`Activity ${activity.id} references unknown ${label} ${id}.`,ids));
  if(!subjects.has(activity.subjectId))errors.push(issue('invalid-data',`Activity ${activity.id} references an unknown subject.`,ids));
  const subjectName=String(subjects.get(activity.subjectId)?.name||activity.subjectId||'').toLowerCase().replace(/[^a-z]/g,'');if(['pe','physicaleducation'].includes(subjectName)&&activity.duration!==2)errors.push(issue('pe-double',`PE must be exactly two consecutive periods in ${activity.name||activity.id}.`,ids));
  if(!Number.isInteger(activity.weeklyCount)||activity.weeklyCount<0||activity.weeklyCount>1000)errors.push(issue('invalid-data',`Activity ${activity.id} weekly count must be a whole number from 0 to 1000.`,ids));
  if(!Number.isInteger(activity.duration)||activity.duration<1||activity.duration>periodList.length)errors.push(issue('invalid-data',`Activity ${activity.id} duration must be a whole number within the school day.`,ids));
  const studentIds=own(activity,'studentIds')?validStrings(activity.studentIds,`Activity ${activity.id} students`,ids):[...new Set(groupIds.flatMap(id=>array(groups.get(id)?.studentIds)))];
  if(students.size)for(const id of studentIds)if(!students.has(id))errors.push(issue('invalid-data',`Activity ${activity.id} references unknown student ${id}.`,ids));
  if(activity.fixedSlots!==undefined&&(!Array.isArray(activity.fixedSlots)||activity.fixedSlots.length>activity.weeklyCount||activity.fixedSlots.some(p=>!p||!days.has(p.day)||!periods.has(p.period))))errors.push(issue('invalid-data',`Activity ${activity.id} has invalid fixed lesson positions.`,ids));
  const effective={...activity,teacherIds,groupIds,roomIds,studentIds,studentSet:new Set(studentIds),blockedTeachers:teacherIds.map(id=>teachers.get(id)).filter(Boolean),blockedGroups:groupIds.map(id=>groups.get(id)).filter(Boolean)};
  activityData.set(activity.id,effective);
  if(Number.isInteger(activity.weeklyCount)&&activity.weeklyCount>=0&&activity.weeklyCount<=1000)for(let ordinal=1;ordinal<=activity.weeklyCount;ordinal++){const lesson={...activity,id:activity.id+'#'+ordinal,activityId:activity.id,ordinal};lessons.push(lesson);lessonMap.set(lesson.id,{...effective,id:lesson.id,activityId:activity.id,ordinal});}
 }
 if(project?.optionBlocks!==undefined&&!Array.isArray(project.optionBlocks))errors.push(issue('option-block','Option blocks must be an array.'));const blocks=new Map();for(const block of array(project?.optionBlocks)){if(!block||typeof block.id!=='string'||!block.id||blocks.has(block.id)){errors.push(issue('option-block','Option blocks need distinct, non-empty IDs.'));continue;}blocks.set(block.id,block);const members=validStrings(block.activityIds,`Option block ${block.id} activities`,[]),pupils=validStrings(block.studentIds,`Option block ${block.id} students`,members);if(!members.length)errors.push(issue('option-block',`Option block ${block.id} needs at least one activity.`));if(!Number.isInteger(block.weeklyCount)||block.weeklyCount<1||block.weeklyCount>1000||!Number.isInteger(block.duration)||block.duration<1)errors.push(issue('option-block',`Option block ${block.id} needs a positive whole-number weekly count and duration.`,members));for(const id of members){const activity=activityData.get(id);if(!activity||activity.blockId!==block.id||activity.weeklyCount!==block.weeklyCount||activity.duration!==block.duration)errors.push(issue('option-block',`Option block ${block.name||block.id} must reference matching activities with the same weekly count and duration.`,members));if(activity)for(const studentId of activity.studentIds)if(!pupils.includes(studentId))errors.push(issue('option-choice',`Option block ${block.name||block.id} has a student outside its declared membership.`,members));}for(const studentId of pupils){const count=members.filter(id=>activityData.get(id)?.studentSet.has(studentId)).length;if(count!==1)errors.push(issue('option-choice',`Student ${studentId} must choose exactly one activity in option block ${block.name||block.id}; found ${count}.`,members));if(students.size&&!students.has(studentId))errors.push(issue('option-choice',`Option block ${block.name||block.id} references unknown student ${studentId}.`,members));}}for(const activity of activityData.values())if(activity.blockId&&(!blocks.has(activity.blockId)||!array(blocks.get(activity.blockId).activityIds).includes(activity.id)))errors.push(issue('option-block',`Activity ${activity.name||activity.id} references an unknown or mismatched option block.`,[activity.id]));
 errors.push(...policyInputIssues(project));
 errors.push(...documentOptionIssues(project,[...activityData.values()]));
 if(!project?.placements||typeof project.placements!=='object'||Array.isArray(project.placements))errors.push(issue('invalid-data','Placements must be an object keyed by lesson ID.'));
 for(const [id,position] of Object.entries(project?.placements||{})){if(!lessonMap.has(id))errors.push(issue('unknown-lesson',`Placement ${id} has no corresponding lesson.`,[id]));if(!position||typeof position!=='object'||Array.isArray(position))errors.push(issue('invalid-data',`Placement ${id} must specify a day, period and room.`,[id]));}
 return{project,blocks,days,periods,periodList,periodOrder,teachers,subjects,rooms,groups,activities,activityData,lessons,lessonMap,maxDaily:daily,errors:uniqueIssues(errors)};
}

function units(ctx,lesson,position){
 if(!position||typeof position!=='object'||!ctx.days.has(position.day)||!ctx.periods.has(position.period)||!ctx.rooms.has(position.roomId))return{slots:[],issues:[issue('outside-grid','Choose a valid school day, starting period and room.',[lesson.id],position||{})]};
 const index=ctx.periodOrder.get(position.period),parts=ctx.periodList.slice(index,index+lesson.duration);
 if(parts.length!==lesson.duration)return{slots:[],issues:[issue('outside-grid','This lesson extends beyond the last period of the day.',[lesson.id],position)]};
 if(!ctx.project.schoolPolicy?.doubleAcrossBreaks&&parts.some((p,i)=>i&&clock(p.start)!==clock(parts[i-1].end)))return{slots:[],issues:[issue('double-crosses-break','A multi-period lesson cannot cross a break or lunch gap.',[lesson.id],position)]};
 return{slots:parts.map(p=>p.id),issues:[]};
}
function staticCheck(ctx,lesson,position){
 const {slots,issues}=units(ctx,lesson,position);if(issues.length)return{slots,issues};
 const room=ctx.rooms.get(position.roomId),ids=[lesson.id],fixed=array(lesson.fixedSlots)[(lesson.ordinal||1)-1];if(fixed&&(fixed.day!==position.day||fixed.period!==position.period))issues.push(issue('fixed-slot',`${lesson.name||lesson.activityId} must stay in its fixed school slot.`,ids,position));
 if(lesson.roomIds.length&&!lesson.roomIds.includes(room.id))issues.push(issue('room-not-eligible',`${room.name||room.id} is not an eligible room for this lesson.`,ids,position));
 if(room.capacity<lesson.studentSet.size)issues.push(issue('room-capacity',`${room.name||room.id} holds ${room.capacity}; this lesson has ${lesson.studentSet.size} students.`,ids,position));
 for(const period of slots){const key=slotKey(position.day,period),at={day:position.day,period};
  if(array(room.blocked).includes(key))issues.push(issue('room-unavailable',`${room.name||room.id} is unavailable in this slot.`,ids,at));
  for(const teacher of lesson.blockedTeachers)if(array(teacher.blocked).includes(key))issues.push(issue('teacher-unavailable',`${teacher.name||teacher.id} is unavailable in this slot.`,ids,at));
  for(const group of lesson.blockedGroups)if(array(group.blocked).includes(key))issues.push(issue('group-unavailable',`${group.name||group.id} is unavailable in this slot.`,ids,at));
 }
 return{slots,issues};
}
const makeIndex=()=>({teachers:new Map(),rooms:new Map(),students:new Map(),emptyGroups:new Map(),teacherDays:new Map(),activityDays:new Map(),positions:new Map()});
const addTo=(map,key,id)=>{if(!map.has(key))map.set(key,new Set());map.get(key).add(id);};
const removeFrom=(map,key,id)=>{const value=map.get(key);if(!value)return;value.delete(id);if(!value.size)map.delete(key);};
function indexLesson(ctx,index,id,position,remove=false){
 const lesson=ctx.lessonMap.get(id);if(!lesson)return;const {slots}=units(ctx,lesson,position);if(!slots.length)return;const op=remove?removeFrom:addTo;
 for(const period of slots){op(index.rooms,resourceKey(position.day,period,position.roomId),id);for(const teacher of lesson.teacherIds)op(index.teachers,resourceKey(position.day,period,teacher),id);for(const student of lesson.studentIds)op(index.students,resourceKey(position.day,period,student),id);if(!lesson.studentIds.length)for(const group of lesson.groupIds)op(index.emptyGroups,resourceKey(position.day,period,group),id);}
 for(const teacher of lesson.teacherIds)op(index.teacherDays,slotKey(position.day,teacher),id);
 op(index.activityDays,slotKey(position.day,lesson.activityId),id);
 if(remove)index.positions.delete(id);else index.positions.set(id,position);
}
function buildIndex(ctx,placements){const index=makeIndex();for(const [id,position] of Object.entries(placements))indexLesson(ctx,index,id,position);return index;}
function studentCoverage(ctx,placements){
 const allSlots=[...ctx.days.keys()].flatMap(day=>[...ctx.periods.keys()].map(period=>({day,period}))),gridSize=allSlots.length,rows=[],seen=new Set(),occupied=new Map(),demand=new Map(),issues=[];
 for(const lesson of ctx.lessonMap.values())for(const id of lesson.studentIds)demand.set(id,(demand.get(id)||0)+lesson.duration);
 for(const [id,position] of Object.entries(placements)){const lesson=ctx.lessonMap.get(id);if(!lesson)continue;const spans=units(ctx,lesson,position);if(spans.issues.length)continue;for(const studentId of lesson.studentIds){if(!occupied.has(studentId))occupied.set(studentId,new Set());for(const period of spans.slots)occupied.get(studentId).add(slotKey(position.day,period));}}
 for(const group of ctx.groups.values()){
  if(group.year===undefined||group.year===null)continue;const members=[];
  for(const studentId of array(group.studentIds)){if(seen.has(studentId))continue;seen.add(studentId);const freeAllowed=[12,13].includes(group.year),covered=occupied.get(studentId)||new Set(),missing=allSlots.filter(s=>!covered.has(slotKey(s.day,s.period))),row={studentId,groupId:group.id,year:group.year,required:freeAllowed?0:gridSize,covered:covered.size,missing,freeAllowed};rows.push(row);members.push(row);}
  const required=members.filter(row=>row.required),missing=required.reduce((n,row)=>n+row.missing.length,0),short=required.filter(row=>(demand.get(row.studentId)||0)<gridSize),over=members.filter(row=>(demand.get(row.studentId)||0)>gridSize);
  const diagnostic=(kind,message)=>({...issue(kind,message),diagnostic:true,groupId:group.id});
  if(missing)issues.push(diagnostic('student-gaps',`${group.name||group.id}: ${missing} required student-period slots are not covered; only Years 12 and 13 may have free periods.`));
  if(short.length)issues.push(diagnostic('curriculum-shortfall',`${group.name||group.id}: ${short.length} students have fewer allocated lesson periods than the ${gridSize}-period grid.`));
  if(over.length)issues.push(diagnostic('curriculum-overload',`${group.name||group.id}: ${over.length} students have more allocated lesson periods than the ${gridSize}-period grid.`));
 }
 const requiredRows=rows.filter(row=>row.required);
 return{issues,summary:{requiredStudents:requiredRows.length,requiredSlots:requiredRows.reduce((n,row)=>n+row.required,0),coveredSlots:requiredRows.reduce((n,row)=>n+row.covered,0),missingSlots:requiredRows.reduce((n,row)=>n+row.missing.length,0),freeAllowedStudents:rows.filter(row=>!row.required).length,students:rows}};
}
function check(ctx,index,id,position,ignore=new Set()){
 const lesson=ctx.lessonMap.get(id);if(!lesson)return{ok:false,issues:[issue('unknown-lesson','This lesson is not in the project.',[id])],slots:[]};
 const result=staticCheck(ctx,lesson,position);if(result.issues.length)return{ok:false,...result};const issues=[],ignored=new Set([id,...ignore]),conflicts=(map,key)=>[...(map.get(key)||[])].filter(other=>!ignored.has(other));
 const collisions=new Map(),collect=(kind,others,message,at)=>{for(const other of others){const key=kind+'|'+other;if(!collisions.has(key))collisions.set(key,issue(kind,message,[id,other],at));}};
 for(const period of result.slots){const at={day:position.day,period};collect('room-clash',conflicts(index.rooms,resourceKey(position.day,period,position.roomId)),`${ctx.rooms.get(position.roomId).name||position.roomId} is already in use.`,at);for(const teacher of lesson.teacherIds)collect('teacher-clash',conflicts(index.teachers,resourceKey(position.day,period,teacher)),`${ctx.teachers.get(teacher)?.name||teacher} is already teaching another lesson.`,at);for(const student of lesson.studentIds)collect('student-clash',conflicts(index.students,resourceKey(position.day,period,student)),'A student is already assigned to another lesson in this slot.',at);if(!lesson.studentIds.length)for(const group of lesson.groupIds)collect('group-clash',conflicts(index.emptyGroups,resourceKey(position.day,period,group)),`${ctx.groups.get(group)?.name||group} is already assigned to another lesson.`,at);}
 issues.push(...collisions.values());
 if(lesson.blockId&&ctx.blocks.has(lesson.blockId)){const block=ctx.blocks.get(lesson.blockId),others=block.activityIds.map(id=>id+'#'+lesson.ordinal).filter(other=>other!==id&&!ignored.has(other)&&index.positions.has(other));for(const other of others){const placed=index.positions.get(other);if(placed.day!==position.day||placed.period!==position.period){issues.push(issue('option-block-sync',`All alternatives in ${block.name||block.id} must start together.`,[id,...others],position));break;}}}
 issues.push(...policyPlacementIssues(ctx,index,lesson,position,ignored));
 if(lesson.spread&&!ctx.project.schoolPolicy){const others=conflicts(index.activityDays,slotKey(position.day,lesson.activityId));if(others.length)issues.push(issue('spread','Spread this activity across different days.',[id,...others],position));}
 if(ctx.maxDaily)for(const teacher of lesson.teacherIds){const others=conflicts(index.teacherDays,slotKey(position.day,teacher)),load=others.reduce((n,other)=>n+ctx.lessonMap.get(other).duration,lesson.duration);if(load>ctx.maxDaily)issues.push(issue('teacher-load',`${ctx.teachers.get(teacher)?.name||teacher} exceeds ${ctx.maxDaily} teaching periods per day.`,[id,...others],position));}
 return{ok:!issues.length,issues,slots:result.slots};
}

function unitIds(ctx,id){const lesson=ctx.lessonMap.get(id),block=ctx.blocks.get(lesson?.blockId);return block?block.activityIds.map(activityId=>activityId+'#'+lesson.ordinal):[id];}
function bundleAssignment(ctx,index,ids,position,{selectedId=null,spend=()=>true}={}){
 const before=Object.fromEntries(ids.filter(id=>index.positions.has(id)).map(id=>[id,index.positions.get(id)])),assigned={},ordered=[...ids].sort((a,b)=>(a===selectedId?-1:b===selectedId?1:0)||(ctx.lessonMap.get(a)?.roomIds.length||ctx.rooms.size)-(ctx.lessonMap.get(b)?.roomIds.length||ctx.rooms.size));
 let firstIssues=[],budgetExceeded=false;
 for(const id of ids){const old=ctx.project.placements?.[id];if(old?.locked&&(old.day!==position.day||old.period!==position.period||id===selectedId&&position.roomId&&old.roomId!==position.roomId))return{ok:false,issues:[issue('locked','Unlock this lesson or its option-block partner before moving it.',ids,position)]};}
 for(const [id,old] of Object.entries(before))indexLesson(ctx,index,id,old,true);
 const choose=at=>{if(at===ordered.length)return true;const id=ordered[at],lesson=ctx.lessonMap.get(id),old=ctx.project.placements?.[id],forced=old?.locked?old.roomId:id===selectedId?position.roomId:null,eligible=lesson.roomIds.length?lesson.roomIds:[...ctx.rooms.keys()],preferred=old?.roomId&&eligible.includes(old.roomId)?[old.roomId,...eligible.filter(r=>r!==old.roomId)]:eligible,rooms=forced?[forced]:preferred;
  for(const roomId of rooms){if(!spend()){budgetExceeded=true;return false;}const proposed={day:position.day,period:position.period,roomId,locked:Boolean(old?.locked||id===selectedId&&position.locked)},result=check(ctx,index,id,proposed);if(!result.ok){if(!firstIssues.length)firstIssues=result.issues;continue;}assigned[id]=proposed;indexLesson(ctx,index,id,proposed);if(choose(at+1))return true;indexLesson(ctx,index,id,proposed,true);delete assigned[id];if(budgetExceeded)return false;}
  return false;
 };
 try{
  // Teacher/student conflicts cannot be fixed by trying other room permutations.
  // Check them before assigning any rooms, including conflicts inside the bundle.
  const occupiedTeachers=new Map(),occupiedStudents=new Map();
  for(const id of ordered){
   if(!spend())return{ok:false,issues:[issue('search-limit','Room-assignment search reached its limit.',ids,position)],budgetExceeded:true};
   const lesson=ctx.lessonMap.get(id),old=ctx.project.placements?.[id],forced=old?.locked?old.roomId:id===selectedId?position.roomId:null,rooms=forced?[forced]:lesson.roomIds.length?lesson.roomIds:[...ctx.rooms.keys()];
   let valid=null,staticIssues=[];
   for(const roomId of rooms){const proposed={...position,roomId},result=staticCheck(ctx,lesson,proposed);if(!result.issues.length){valid=proposed;break;}if(!staticIssues.length)staticIssues=result.issues;}
   if(!valid)return{ok:false,issues:staticIssues.length?staticIssues:[issue('room-not-eligible','No eligible room is available.',[id],position)]};
   const result=check(ctx,index,id,valid),nonRoom=result.issues.filter(i=>i.kind!=='room-clash');
   if(nonRoom.length)return{ok:false,issues:nonRoom};
   for(const period of result.slots)for(const [map,resources,kind] of [[occupiedTeachers,lesson.teacherIds,'teacher-clash'],[occupiedStudents,lesson.studentIds,'student-clash']])for(const resource of resources){const key=resourceKey(position.day,period,resource);if(map.has(key))return{ok:false,issues:[issue(kind,kind==='teacher-clash'?'An option-block teacher is assigned to two simultaneous alternatives.':'A student is assigned to two simultaneous alternatives.',[map.get(key),id],position)]};map.set(key,id);}
  }
  const ok=choose(0);return{ok,placements:ok?{...assigned}:undefined,issues:ok?[]:firstIssues.length?firstIssues:[issue(budgetExceeded?'search-limit':'option-block-room',budgetExceeded?'Room-assignment search reached its limit.':'No simultaneous room assignment is available for all alternatives.',ids,position)],budgetExceeded};}
 finally{for(const [id,p] of Object.entries(assigned))indexLesson(ctx,index,id,p,true);for(const [id,p] of Object.entries(before))indexLesson(ctx,index,id,p);}
}

export function expandLessons(project){return compile(project).lessons;}
export function lessonPlacementOptions(project,lessonId,{maxNodes=5000}={}){
 const ctx=compile(project),lesson=ctx.lessonMap.get(lessonId),valid=[],reasons=new Map();
 if(ctx.errors.length||!lesson)return{valid,reasons:ctx.errors.length?ctx.errors:[issue('unknown-lesson','Select an existing lesson card.')],tested:0,searchLimited:false};
 const index=buildIndex(ctx,project.placements),ids=unitIds(ctx,lessonId),limit=integerOption(maxNodes,5000,20000);let nodes=0,tested=0,searchLimited=false;
 for(const day of ctx.days.keys())for(const period of ctx.periods.keys()){
  if(nodes>=limit){searchLimited=true;break;}
  const candidate=bundleAssignment(ctx,index,ids,{day,period},{spend:()=>{if(nodes>=limit)return false;nodes++;return true;}});tested++;
  if(candidate.ok){const p=candidate.placements[lessonId];valid.push({day,period,roomId:p.roomId});}
  else for(const i of candidate.issues){if(i.kind==='search-limit'){searchLimited=true;continue;}if(!reasons.has(i.kind))reasons.set(i.kind,{kind:i.kind,message:i.message,count:0,lessonIds:[]});const row=reasons.get(i.kind);row.count++;row.lessonIds=[...new Set([...row.lessonIds,...i.lessonIds.filter(id=>!ids.includes(id))])].slice(0,8);}
 }
 return{valid,reasons:[...reasons.values()].sort((a,b)=>b.count-a.count),tested,searchLimited:searchLimited||nodes>=limit,nodes};
}
export function placementCheck(project,lessonId,proposed,{ignore=[]}={}){
 const ctx=compile(project);if(ctx.errors.length)return{ok:false,issues:ctx.errors};if(!ctx.lessonMap.has(lessonId))return{ok:false,issues:[issue('unknown-lesson','This lesson is not in the project.',[lessonId])]};if(!proposed)return{ok:false,issues:[issue('outside-grid','Choose a valid school day, starting period and room.',[lessonId])]};const index=buildIndex(ctx,Object.fromEntries(Object.entries(project.placements).filter(([id])=>!ignore.includes(id))));let checks=0;const result=bundleAssignment(ctx,index,unitIds(ctx,lessonId),proposed,{selectedId:lessonId,spend:()=>++checks<=5000});return{ok:result.ok,issues:result.issues};
}
export function validateTimetable(project){
 const ctx=compile(project),placements=project?.placements||{},index=buildIndex(ctx,placements),issues=[...ctx.errors];
 for(const [id,position] of Object.entries(placements))if(ctx.lessonMap.has(id))issues.push(...check(ctx,index,id,position).issues);
 for(const block of ctx.blocks.values())for(let ordinal=1;ordinal<=(Number.isInteger(block.weeklyCount)&&block.weeklyCount>0&&block.weeklyCount<=1000?block.weeklyCount:0);ordinal++){const members=array(block.activityIds).map(id=>id+'#'+ordinal),scheduled=members.filter(id=>own(placements,id));if(scheduled.length&&scheduled.length!==members.length)issues.push(issue('option-block-partial',`Schedule every alternative of ${block.name||block.id} together.`,members));}
 const coverage=studentCoverage(ctx,placements);issues.push(...coverage.issues);const unplaced=ctx.lessons.filter(l=>!own(placements,l.id)).map(l=>l.id),placed=ctx.lessons.length-unplaced.length,unique=uniqueIssues(issues);
 return{issues:unique,unplaced,placed,total:ctx.lessons.length,complete:!unique.length&&!unplaced.length,coverage:coverage.summary};
}
export function moveLesson(project,id,position){
 const ctx=compile(project);if(ctx.errors.length)throw Error(ctx.errors[0].message);if(!ctx.lessonMap.has(id))throw Error('This lesson is not in the project.');const ids=unitIds(ctx,id),next=clone(project);
 if(!position){if(ids.some(other=>project.placements[other]?.locked))throw Error('Unlock this lesson or its option-block partner before unplacing it.');for(const other of ids)delete next.placements[other];return next;}
 let checks=0;const result=bundleAssignment(ctx,buildIndex(ctx,project.placements),ids,position,{selectedId:id,spend:()=>++checks<=5000});if(!result.ok)throw Error(result.issues[0].message);Object.assign(next.placements,result.placements);return next;
}

const randomSource=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const shuffle=(items,random)=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
function integerOption(value,fallback,max){return Number.isInteger(value)&&value>0?Math.min(value,max):fallback;}

function generateBundles(ctx,original,fixed,limit,attemptLimit,finish){
 const allUnits=[],seen=new Set(),staticTimes=new Map();
 for(const [activityId,activity] of ctx.activityData){const times=new Set();for(const day of ctx.days.keys())for(const period of ctx.periods.keys())for(const roomId of activity.roomIds.length?activity.roomIds:ctx.rooms.keys()){if(!staticCheck(ctx,{...activity,fixedSlots:undefined,id:activityId+'#1',activityId,ordinal:1},{day,period,roomId}).issues.length){times.add(slotKey(day,period));break;}}staticTimes.set(activityId,times);}
 for(const lesson of ctx.lessons){if(seen.has(lesson.id))continue;const ids=unitIds(ctx,lesson.id);ids.forEach(id=>seen.add(id));if(ids.every(id=>own(fixed,id)))continue;const anchor=ids.map(id=>fixed[id]).find(Boolean),times=[...ctx.days.keys()].flatMap(day=>[...ctx.periods.keys()].map(period=>({day,period}))).filter(position=>(!anchor||anchor.day===position.day&&anchor.period===position.period)&&ids.every(id=>{const lesson=ctx.lessonMap.get(id),fixedSlot=array(lesson.fixedSlots)[lesson.ordinal-1];return staticTimes.get(lesson.activityId).has(slotKey(position.day,position.period))&&(!fixedSlot||fixedSlot.day===position.day&&fixedSlot.period===position.period);}));allUnits.push({id:lesson.blockId?lesson.blockId+'#'+lesson.ordinal:lesson.id,ids,times});}
 const existingReport=validateTimetable(original),baseline=existingReport.issues.some(i=>!i.diagnostic)?fixed:original.placements;
 let nodes=0,attempts=0,best={...original,placements:clone(baseline)},bestCount=Object.keys(baseline).length;
 const spend=()=>{if(nodes>=limit)return false;nodes++;return true;},remember=placements=>{const count=Object.keys(placements).length;if(count>bestCount){best={...original,placements:{...placements}};bestCount=count;}};
 const commit=(placements,index,assignments)=>{for(const [id,position] of Object.entries(assignments)){if(placements[id])indexLesson(ctx,index,id,placements[id],true);placements[id]=position;indexLesson(ctx,index,id,position);}};
 const revert=(placements,index,ids,previous)=>{for(const id of ids){if(placements[id])indexLesson(ctx,index,id,placements[id],true);delete placements[id];}for(const [id,position] of Object.entries(previous)){placements[id]=position;indexLesson(ctx,index,id,position);}};
 const search=(pending,placements,index,random)=>{remember(placements);if(!pending.length)return true;if(nodes>=limit)return false;const unit=pending[0],rest=pending.slice(1),previous=Object.fromEntries(unit.ids.filter(id=>placements[id]).map(id=>[id,placements[id]]));for(const position of shuffle(unit.times,random).sort((a,b)=>doublePreference(ctx,index,unit.ids,a)-doublePreference(ctx,index,unit.ids,b))){const candidate=bundleAssignment(ctx,index,unit.ids,position,{spend});if(candidate.ok){commit(placements,index,candidate.placements);if(search(rest,placements,index,random))return true;revert(placements,index,unit.ids,previous);}if(nodes>=limit)return false;}return false;};
 for(let attempt=0;attempt<attemptLimit&&nodes<limit;attempt++){attempts++;const random=randomSource(1777+104729*attempt),placements=clone(fixed),index=buildIndex(ctx,placements),pending=shuffle(allUnits,random).sort((a,b)=>a.times.length-b.times.length||b.ids.length-a.ids.length||ctx.lessonMap.get(b.ids[0]).duration-ctx.lessonMap.get(a.ids[0]).duration);
  if(pending.length<=30){if(search(pending,placements,index,random))return finish({...original,placements},{attempts,nodes,stopped:'complete'});continue;}
  for(const unit of pending){const candidates=shuffle(unit.times,random).sort((a,b)=>doublePreference(ctx,index,unit.ids,a)-doublePreference(ctx,index,unit.ids,b));for(const position of candidates){const candidate=bundleAssignment(ctx,index,unit.ids,position,{spend});if(candidate.ok){commit(placements,index,candidate.placements);remember(placements);break;}if(nodes>=limit)break;}if(nodes>=limit)break;}
  if(Object.keys(placements).length===ctx.lessons.length)return finish({...original,placements},{attempts,nodes,stopped:'complete'});
 }
 return finish(best,{attempts,nodes,stopped:nodes>=limit?'node-limit':'incomplete',unschedulableActivities:[...new Set(allUnits.filter(unit=>!unit.times.length).flatMap(unit=>unit.ids.map(id=>ctx.lessonMap.get(id).activityId)))]});
}

export function generateTimetable(project,{maxAttempts=8,maxNodes=100000}={}){
 const ctx=compile(project),original=clone(project),inputReport=validateTimetable(project),limit=integerOption(maxNodes,100000,1000000),attemptLimit=integerOption(maxAttempts,8,50);
 const finish=(next,extra)=>{const report=validateTimetable(next);return{project:next,report:{...report,...extra,...(extra.stopped==='complete'&&!report.complete?{stopped:'coverage-incomplete'}:{}),algorithm:'Bounded constraint search; no optimality guarantee.'}};};
 if(ctx.errors.length)return finish(original,{attempts:0,nodes:0,stopped:'invalid-data'});
 const fixed=Object.fromEntries(Object.entries(project.placements).filter(([,p])=>p.locked)),fixedProject={...project,placements:fixed},fixedReport=validateTimetable(fixedProject);
 if(fixedReport.issues.some(i=>!i.diagnostic&&i.kind!=='option-block-partial'))return finish(original,{attempts:0,nodes:0,stopped:'locked-conflict'});
 if(inputReport.complete)return finish(original,{attempts:0,nodes:0,stopped:'already-complete'});
 if(original.optionCollection){const structured=generateOptionGrid(original,{move:moveLesson,validate:validateTimetable},{maxNodes:Math.min(limit,5000)});if(structured)return structured;}
 if(ctx.blocks.size)return generateBundles(ctx,original,fixed,limit,attemptLimit,finish);
 const domains=new Map();
 for(const [id,activity] of ctx.activityData){const possible=[];for(const day of ctx.days.keys())for(const period of ctx.periods.keys())for(const roomId of activity.roomIds.length?activity.roomIds:ctx.rooms.keys()){const position={day,period,roomId,locked:false};if(!staticCheck(ctx,{...activity,fixedSlots:undefined,id:id+'#1',activityId:id},position).issues.length)possible.push(position);}domains.set(id,possible);}
 const lessonDomains=new Map(ctx.lessons.map(lesson=>{const fixedSlot=array(lesson.fixedSlots)[lesson.ordinal-1],base=domains.get(lesson.activityId);return[lesson.id,fixedSlot?base.filter(p=>p.day===fixedSlot.day&&p.period===fixedSlot.period):base];}));
 const baseline=inputReport.issues.some(i=>!i.diagnostic)?fixed:project.placements;
 let nodes=0,attempts=0,best={...clone(project),placements:clone(baseline)},bestCount=Object.keys(baseline).length;
 const free=ctx.lessons.filter(l=>!own(fixed,l.id));
 const remember=placements=>{if(Object.keys(placements).length>bestCount){best={...original,placements:{...placements}};bestCount=Object.keys(placements).length;}};
 // On smaller plans, most-constrained-first backtracking finds schedules that a
 // straight greedy pass cannot. The shared node budget bounds all attempts.
 const dfs=(placements,index,pending,random)=>{
  remember(placements);if(!pending.length)return true;if(nodes>=limit)return false;
  let selected=null,valid=null;
  for(const lesson of pending){const candidates=[];for(const position of shuffle(lessonDomains.get(lesson.id),random)){if(nodes>=limit)return false;nodes++;if(check(ctx,index,lesson.id,position).ok)candidates.push(position);}if(valid===null||candidates.length<valid.length){selected=lesson;valid=candidates;}if(!candidates.length)return false;if(candidates.length===1)break;}
  const remaining=pending.filter(l=>l.id!==selected.id);
  for(const position of valid){placements[selected.id]=position;indexLesson(ctx,index,selected.id,position);if(dfs(placements,index,remaining,random))return true;indexLesson(ctx,index,selected.id,position,true);delete placements[selected.id];if(nodes>=limit)return false;}
  return false;
 };
 for(let attempt=0;attempt<attemptLimit&&nodes<limit;attempt++){
  attempts++;const random=randomSource(1777+attempt*104729),placements=clone(fixed),index=buildIndex(ctx,placements);
  const pending=shuffle(free,random).sort((a,b)=>lessonDomains.get(a.id).length-lessonDomains.get(b.id).length||b.duration-a.duration||ctx.lessonMap.get(b.id).studentIds.length-ctx.lessonMap.get(a.id).studentIds.length);
  if(free.length<=60){if(dfs(placements,index,pending,random))return finish({...clone(project),placements},{attempts,nodes,stopped:'complete'});continue;}
  // Larger whole-school plans use bounded randomized restarts and limited
  // eviction repair. Every intermediate placement is conflict checked.
  const evictions=new Map();
  while(pending.length&&nodes<limit){const lesson=pending.shift(),candidates=shuffle(lessonDomains.get(lesson.id),random);let selected=null,repair=null;
   const dayLoads=new Map([...ctx.days.keys()].map(day=>[day,ctx.lessonMap.get(lesson.id).teacherIds.reduce((n,id)=>n+[...(index.teacherDays.get(slotKey(day,id))||[])].reduce((sum,other)=>sum+ctx.lessonMap.get(other).duration,0),0)]));
   candidates.sort((a,b)=>doublePreference(ctx,index,[lesson.id],a)-doublePreference(ctx,index,[lesson.id],b)||dayLoads.get(a.day)-dayLoads.get(b.day));
   for(const position of candidates){if(nodes>=limit)break;nodes++;const result=check(ctx,index,lesson.id,position);if(result.ok){selected=position;break;}if((evictions.get(lesson.id)||0)>=2)continue;const removable=new Set(result.issues.flatMap(i=>i.lessonIds).filter(id=>id!==lesson.id)),repairable=result.issues.every(i=>['teacher-clash','student-clash','group-clash','room-clash','spread','teacher-load'].includes(i.kind));if(repairable&&removable.size&&removable.size<=2&&[...removable].every(id=>!fixed[id]&&(evictions.get(id)||0)<2)&&(!repair||removable.size<repair.ids.size))repair={position,ids:removable};}
   if(!selected&&repair){for(const id of repair.ids){indexLesson(ctx,index,id,placements[id],true);delete placements[id];evictions.set(id,(evictions.get(id)||0)+1);pending.push(ctx.lessonMap.get(id));}if(check(ctx,index,lesson.id,repair.position).ok)selected=repair.position;}
   if(selected){placements[lesson.id]=selected;indexLesson(ctx,index,lesson.id,selected);remember(placements);}
  }
  if(Object.keys(placements).length===ctx.lessons.length)return finish({...clone(project),placements},{attempts,nodes,stopped:'complete'});
 }
 return finish(best,{attempts,nodes,stopped:nodes>=limit?'node-limit':'incomplete',unschedulableActivities:[...domains].filter(([,positions])=>!positions.length).map(([id])=>id)});
}
