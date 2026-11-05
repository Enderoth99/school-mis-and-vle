import {teacherById} from './teaching-data.mjs';
import {documentOptionIssues} from './timetable-options.mjs';

const copy=project=>structuredClone(project);
const unique=values=>[...new Set(values)];
const slug=name=>String(name).toLowerCase().replace(/[^a-z0-9]+/g,'-');
const strings=(values,label)=>{if(!Array.isArray(values)||values.some(id=>typeof id!=='string')||new Set(values).size!==values.length)throw Error(label+' must contain distinct IDs.');return values;};
const clean=(value,label,max)=>{const text=String(value??'').trim();if(!text||text.length>max||/[\u0000-\u001f]/.test(text))throw Error('Enter '+label+' using 1–'+max+' characters.');return text;};
const activitiesFor=(project,ids)=>{strings(ids,'Teaching allocations');if(!ids.length)throw Error('Choose at least one teaching allocation.');const rows=ids.map(id=>project.activities.find(a=>a.id===id));if(rows.some(a=>!a))throw Error('Choose existing teaching allocations.');return rows;};

// Eligibility is a planning declaration, not certification or a change to MIS accounts.
export function teacherSubjects(project,teacherId){
 const teacher=project.teachers.find(t=>t.id===teacherId);if(!teacher)return [];
 const known=new Set(project.subjects.map(s=>s.id));
 if(Array.isArray(teacher.subjectIds))return unique(teacher.subjectIds.filter(id=>known.has(id)));
 const canonical=teacherById(teacherId),names=new Set((canonical?.subjects||[]).map(slug));
 if(names.has('russian'))names.add('russian-as-a-second-language');
 if(names.has('art'))names.add('textiles');
 return unique([...project.subjects.filter(s=>names.has(s.id)||names.has(slug(s.name))).map(s=>s.id),...project.activities.filter(a=>a.teacherIds.includes(teacherId)).map(a=>a.subjectId)]).filter(id=>known.has(id));
}

export function savePlanningTeacher(project,{id,name,area,subjectIds,duty,yearBands}={}){
 const previous=id?project.teachers.find(t=>t.id===id):null;
 if(id&&!previous)throw Error('Choose an existing planning teacher.');
 const nextName=clean(name??previous?.name,'a teacher name',100),nextArea=clean(area??previous?.area??'Planning staff','a curriculum area',100);
 const subjects=subjectIds??(previous?teacherSubjects(project,id):[]);strings(subjects,'Teaching subjects');
 if(!subjects.length||subjects.some(key=>!project.subjects.some(s=>s.id===key)))throw Error('Choose at least one existing teaching subject.');
 if(duty!==undefined&&!['Teacher','HOD','HOY'].includes(duty))throw Error('Choose Teacher, HOD or HOY.');if(yearBands!==undefined&&(!Array.isArray(yearBands)||!yearBands.length||yearBands.some(b=>!['primary','lower','igcse','as','a2'].includes(b))))throw Error('Choose at least one valid year band.');const next=copy(project),row={...(previous?structuredClone(previous):{}),id:previous?.id||'plan-teacher-'+crypto.randomUUID(),name:nextName,area:nextArea,subjectIds:[...subjects],duty:duty||previous?.duty||'Teacher',yearBands:yearBands||previous?.yearBands||['primary','lower','igcse','as','a2'],blocked:[...(previous?.blocked||[])],...(!previous?{planningOnly:true}:{})};
 if(previous)next.teachers=next.teachers.map(t=>t.id===row.id?row:t);else next.teachers.push(row);
 return next;
}

function changedAllocations(project,rows){
 const blockIds=new Set(rows.map(a=>a.blockId).filter(Boolean));
 return new Set([...rows.map(a=>a.id),...project.activities.filter(a=>blockIds.has(a.blockId)).map(a=>a.id)]);
}
function clearPlacements(project,affected){
 const matches=id=>[...affected].some(activityId=>id.startsWith(activityId+'#'));
 if(Object.entries(project.placements).some(([id,p])=>matches(id)&&p.locked))throw Error('Unlock all placed lessons in the affected activity or option block before changing this allocation.');
 project.placements=Object.fromEntries(Object.entries(project.placements).filter(([id])=>!matches(id)));
}

export function assignTeachingLoad(project,{activityIds,teacherId,roomIds}={}){
 if(roomIds!==undefined){strings(roomIds,'Eligible rooms');if(!roomIds.length)roomIds=undefined;}
 const rows=activitiesFor(project,activityIds),teacher=project.teachers.find(t=>t.id===teacherId);
 if(!teacher)throw Error('Choose an existing planning teacher.');
 const subjects=teacherSubjects(project,teacherId);
 for(const a of rows)if(!subjects.includes(a.subjectId))throw Error(teacher.name+' is not declared eligible to teach '+(project.subjects.find(s=>s.id===a.subjectId)?.name||a.subjectId)+'. Edit the teacher’s planning subjects first.');
 if(roomIds!==undefined){strings(roomIds,'Eligible rooms');if(!roomIds.length)throw Error('Choose at least one eligible room.');for(const a of rows)for(const id of roomIds){const room=project.rooms.find(r=>r.id===id);if(!room||!a.roomIds.includes(id))throw Error('The selected room is not eligible for '+a.name+'.');if(room.capacity<a.studentIds.length)throw Error(room.name+' is too small for '+a.name+'.');}}
 const changed=rows.filter(a=>a.teacherIds.length!==1||a.teacherIds[0]!==teacherId||roomIds!==undefined&&(a.roomIds.length!==roomIds.length||a.roomIds.some(id=>!roomIds.includes(id))));
 const next=copy(project);if(!changed.length)return next;if(project.schoolPolicy){const demand=(teacher.committedLoad||0)+project.activities.filter(a=>a.teacherIds.includes(teacherId)&&!changed.some(r=>r.id===a.id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0)+changed.reduce((n,a)=>n+a.weeklyCount*a.duration,0),cap=['HOD','HOY'].includes(teacher.duty)?24:30;if(demand>cap)throw Error(teacher.name+' would have '+demand+' periods; maximum '+cap+'.');}
 clearPlacements(next,changedAllocations(project,changed));
 const ids=new Set(changed.map(a=>a.id));
 next.activities=next.activities.map(a=>ids.has(a.id)?{...a,teacherIds:[teacherId],...(roomIds!==undefined?{roomIds:[...roomIds]}:{})}:a);
 for(const blockId of new Set(changed.map(a=>a.blockId).filter(Boolean))){const assigned=new Map();for(const a of next.activities.filter(a=>a.blockId===blockId))for(const id of a.teacherIds){if(assigned.has(id)&&assigned.get(id)!==a.id)throw Error((next.teachers.find(t=>t.id===id)?.name||id)+' cannot teach two simultaneous alternatives in '+blockId+'.');assigned.set(id,a.id);}}
 return next;
}

function studentGroup(project,studentId){
 const group=project.groups.find(g=>g.studentIds.includes(studentId));
 if(!group||![10,11].includes(group.year))throw Error('Choose a Year 10 or Year 11 student from this planning draft.');
 if(!['1','3'].includes(project.optionModels?.[group.year]))throw Error('Choose a configured option model.');
 return group;
}
export function studentChoices(project,studentId){
 const group=studentGroup(project,studentId);
 return (project.optionBlocks||[]).filter(b=>b.year===group.year).map(block=>{
  const rows=block.activityIds.map(id=>project.activities.find(a=>a.id===id));if(rows.some(a=>!a))throw Error('An option block references an unknown teaching allocation.');
  const selected=rows.filter(a=>a.studentIds.includes(studentId));if(selected.length!==1)throw Error('The student must have exactly one current choice in '+block.name+'.');
  const letter=block.id.split('-').at(-1),editable=/^[A-G]$/.test(letter);
  return{blockId:block.id,letter,selectedActivityId:selected[0].id,choices:(editable?rows:selected).map(a=>({id:a.id,name:project.subjects.find(s=>s.id===a.subjectId)?.name||a.name,subjectId:a.subjectId,nonUzbekOnly:Boolean(a.nonUzbekOnly)})),year:group.year};
 });
}

export function updateStudentChoices(project,{studentId,choices={},nonUzbek}={}){
 const group=studentGroup(project,studentId),current=studentChoices(project,studentId);
 if(!choices||typeof choices!=='object'||Array.isArray(choices))throw Error('Choose subjects from the student’s option blocks.');
 if(nonUzbek!==undefined&&typeof nonUzbek!=='boolean')throw Error('The planning eligibility flag must be true or false.');
 const next=copy(project),changed=[];
 for(const [blockId,activityId] of Object.entries(choices)){
  const block=current.find(b=>b.blockId===blockId);if(!block)throw Error('Choose a block in this student’s year.');
  if(block.selectedActivityId===activityId)continue;
  if(!/^[A-G]$/.test(block.letter))throw Error('English and mathematics teaching sets are preserved in this demonstration.');
  if(!block.choices.some(a=>a.id===activityId))throw Error('Choose a subject offered in '+blockId+'.');
  const target=next.activities.find(a=>a.id===activityId);
  for(const a of next.activities.filter(a=>a.blockId===blockId))a.studentIds=a.studentIds.filter(id=>id!==studentId);
  target.studentIds.push(studentId);changed.push(target);
 }
 next.optionEligibility||={};next.optionEligibility[studentId]={...(next.optionEligibility[studentId]||{}),...(nonUzbek!==undefined?{nonUzbek}:{}),synthetic:true};
 if(changed.length){
  const affected=changedAllocations(next,changed);clearPlacements(next,affected);
  for(const a of next.activities.filter(a=>affected.has(a.id)))a.groupIds=unique(a.studentIds.map(id=>next.groups.find(g=>g.studentIds.includes(id))?.id).filter(Boolean));
  for(const a of next.activities.filter(a=>affected.has(a.id)))for(const roomId of a.roomIds){const room=next.rooms.find(r=>r.id===roomId);if(!room||room.capacity<a.studentIds.length)throw Error('Review room capacities before increasing the group size for '+a.name+'.');}
 }
 const problems=documentOptionIssues(next,next.activities);
 if(problems.length)throw Error(problems[0].message);
 // The roster remains a partition of every block, including unchanged H/I sets.
 for(const block of next.optionBlocks.filter(b=>b.year===group.year))for(const id of block.studentIds){const count=block.activityIds.filter(key=>next.activities.find(a=>a.id===key)?.studentIds.includes(id)).length;if(count!==1)throw Error('Each student must have one subject in every option block.');}
 return next;
}
