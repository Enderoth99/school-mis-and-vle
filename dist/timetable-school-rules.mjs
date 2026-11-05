import {createTimetableProject} from './timetable-data.mjs';
import {expandLessons} from './timetable-engine.mjs';
import {studentById} from './model.mjs';
import {ACTIVE_PROJECT} from './timetable-active-config.mjs';
export const SCHOOL_RULES_VERSION=3;
function demoLabels(project){
 project.planningYear='2026–27';project.demonstrationModel='1';
 const scope=project.scope==='year9'?'Year 09 pilot':project.scope==='school'?'Whole school':'Secondary';
 project.name='WIST · 2026–27 demonstration · '+scope;
 project.notes=(project.notes||[]).filter(n=>!n.includes('Models 1–4 are selectable')&&!n.startsWith('Single demonstration using Model 1')).concat('Single demonstration using Model 1 from the 2025–26 source document, in preparation for 2026–27 option changes. Pupil choices remain fictional test data.');
 return project;
}
export function createDemonstrationProject({scope='year9'}={}){
 if(ACTIVE_PROJECT){const next=structuredClone(ACTIVE_PROJECT),allows=year=>scope==='school'||typeof year==='number'&&(scope==='secondary'?year>=7:year===9);next.scope=scope;next.groups=next.groups.filter(g=>allows(g.year));next.activities=next.activities.filter(a=>allows(a.year));next.optionBlocks=next.optionBlocks.filter(b=>allows(b.year));next.placements=Object.fromEntries(Object.entries(next.placements).filter(([id,p])=>p.locked&&next.activities.some(a=>id.startsWith(a.id+'#'))));delete next.generationSummary;next.managerWorkflow={reviews:{}};return demoLabels(next);}
 return demoLabels(createTimetableProject({scope,optionModels:{10:'1',11:'1'}}));
}
export function asDemonstrationProject(old){
 if(old.optionCollection||old.schoolPolicy)return old;if((old.rulesVersion||1)<SCHOOL_RULES_VERSION)return old;
 if(old.optionModels?.[10]==='1'&&old.optionModels?.[11]==='1')return demoLabels(structuredClone(old));
 return updateSchoolRules(old);
}
export function planningStudents(project){return project.groups.flatMap(group=>group.studentIds.map(id=>({id,name:studentById(id)?.name||id,groupId:group.id,groupName:group.name,year:group.year,blocked:group.blocked||[],freeAllowed:group.year===12||group.year===13})));}
export function updateSchoolRules(old){
 const next=createDemonstrationProject({scope:old.scope||'year9'});
 for(const kind of ['teachers','rooms','groups'])for(const row of next[kind]){const previous=old[kind]?.find(r=>r.id===row.id);if(previous){row.blocked=(previous.blocked||[]).filter(key=>{const [day,period]=key.split('|');return next.days.some(d=>d.id===day)&&next.periods.some(p=>p.id===period);});if(kind==='rooms'){row.capacity=previous.capacity;row.name=previous.name;}}}
 for(const room of old.rooms||[])if(!next.rooms.some(r=>r.id===room.id))next.rooms.push(structuredClone(room));
 for(const a of next.activities){const previous=old.activities?.find(r=>r.id===a.id);if(previous&&previous.teacherIds.every(id=>next.teachers.some(t=>t.id===id)))a.teacherIds=[...previous.teacherIds];}
 const previousLessons=new Map(expandLessons(old).map(l=>[l.id,l])),newLessons=new Map(expandLessons(next).map(l=>[l.id,l]));let preserved=0,revised=0;
 for(const [id,position] of Object.entries(old.placements||{})){const before=previousLessons.get(id),after=newLessons.get(id);if(after&&before?.duration===after.duration&&!after.blockId&&next.rooms.some(r=>r.id===position.roomId)&&!next.placements[id]){next.placements[id]=structuredClone(position);preserved++;}else revised++;}
 next.migration={fromRulesVersion:old.rulesVersion||1,preserved,revised,at:new Date().toISOString()};return next;
}
