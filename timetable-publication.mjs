import {createHash} from 'node:crypto';
import {compileTeachingTimetable} from './dist/timetable-integration.mjs';
import {teachingClasses,teachers,formTutors,installPublishedTimetable,activeTimetableInfo} from './dist/teaching-data.mjs';
import {students,groups} from './dist/school-data.mjs';
import {capturePublishedCatalog} from './dist/managed-catalog.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status});
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requirePublisher(actor){if(actor?.id!=='report-reviewer'||actor.role!=='report-reviewer')throw fail(403,'Only a school administrator can publish the timetable.');}
export function publicationPreview(state,actor,input,catalog={}){
 requirePublisher(actor);
 if(input.expectedRevision!==state.revision)throw fail(409,'The shared draft changed. Reload it and review a new publication preview.');
 const blockers=[];let snapshot;
 const ids=new Set(state.project.groups.flatMap(g=>g.studentIds));
 const required=students.filter(s=>!['inactive','withdrawn'].includes(String(s.status||'').toLowerCase()));
 const missing=required.filter(s=>!ids.has(s.id));
 if(missing.length)blockers.push(`${missing.length} active students are missing. Publish a complete whole-school draft.`);
 const movedPupils=state.project.groups.flatMap(g=>g.studentIds.filter(id=>students.find(s=>s.id===id)?.cohort!==g.id));
 if(movedPupils.length)blockers.push('Update student tutor groups in Administration before publishing changed form memberships.');
 const missingGroups=groups.filter(g=>!state.project.groups.some(p=>p.id===g.id));
 if(missingGroups.length)blockers.push(`${missingGroups.length} tutor groups are missing from this draft.`);
 const catalogInactive=new Set((catalog.staff||[]).filter(t=>t.accountEnabled===false||t.status&&t.status!=='Active').map(t=>t.id));
 const invalidTeachers=state.project.activities.filter(a=>a.weeklyCount&&a.teacherIds.some(id=>catalogInactive.has(id)||!teachers.some(t=>t.id===id&&!['inactive','withdrawn'].includes(String(t.status||'').toLowerCase()))));
 if(invalidTeachers.length)blockers.push('Some lessons have teachers without an active MIS account. Create their accounts before publishing.');
 try{snapshot=compileTeachingTimetable(state.project,teachingClasses,teachers,formTutors);}catch(error){blockers.push(error.message);}
 if(snapshot){
  for(const c of snapshot.classes){const old=teachingClasses.find(o=>o.id===c.id);if(old?.activeTimetable&&(old.subject!==c.subject||old.year!==c.year))blockers.push('A saved class ID cannot be reused for a different subject or year: '+c.name+'. Create a new teaching allocation instead.');}
  const current=new Set(snapshot.classes.map(c=>c.id));
  snapshot.classes.push(...teachingClasses.filter(c=>!current.has(c.id)).map(c=>({...structuredClone(c),archivedTimetable:true})));
  snapshot.groups=state.project.groups.map(g=>({id:g.id,name:g.name,form:g.form}));
  snapshot.consumedEnrollments=Object.fromEntries((catalog.students||[]).filter(s=>Array.isArray(s.enrollmentClassIds)).map(s=>[s.id,JSON.stringify(s.enrollmentClassIds)]));
 }
 const previous=state.publication?.snapshot||activeTimetableInfo();
 const previousRows=new Set((previous?.rows||[]).map(digest));
 const changedLessons=snapshot?snapshot.rows.filter(r=>!previousRows.has(digest(r))).length:0;
 const signature=digest([state.revision,state.project,state.publication?.revision||0,catalog]);
 return{canPublish:blockers.length===0,blockers,draftRevision:state.revision,publicationRevision:state.publication?.revision||0,signature,summary:snapshot?{students:ids.size,groups:state.project.groups.length,teachers:state.project.teachers.length,classes:snapshot.classes.filter(c=>!c.archivedTimetable).length,weeklyPeriods:snapshot.rows.length,changedLessons}:null,snapshot};
}
export async function publishTimetable(store,actor,input,catalog){
 requirePublisher(actor);
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(input.operationId||''))throw fail(400,'A publication identifier is required.');
 return store.transact(next=>{
  if(next.publication?.operationId===input.operationId){if(next.publication.publishedBy.id!==actor.id||next.publication.signature!==input.signature)throw fail(409,'Publication identifier already used.');return publicationMetadata(next.publication);}
  const preview=publicationPreview(next,actor,input,catalog);
  if(input.expectedPublicationRevision!==preview.publicationRevision||input.signature!==preview.signature)throw fail(409,'The draft or school records changed after your preview. Review a new preview before publishing.');
  if(!preview.canPublish)throw fail(400,preview.blockers.join(' '));
  const revision=preview.publicationRevision+1;
  preview.snapshot.id='published-timetable-'+revision;
  next.publication={revision,draftRevision:next.revision,publishedAt:new Date().toISOString(),publishedBy:{id:actor.id,name:actor.name},operationId:input.operationId,signature:input.signature,snapshot:preview.snapshot};
  next.publicationHistory||=[];next.publicationHistory.unshift(publicationMetadata(next.publication));next.publicationHistory=next.publicationHistory.slice(0,30);
  return publicationMetadata(next.publication);
 });
}
export function publicationMetadata(p){if(!p)return null;const{snapshot,operationId,signature,...meta}=p;return structuredClone(meta);}
export function installPublication(store){const p=store.state.publication;if(p&&activeTimetableInfo()?.id!==p.snapshot.id){installPublishedTimetable(p.snapshot);capturePublishedCatalog(p.snapshot);}}
export function timetableForActor(store,actor){
 if(!actor||['parent','technician'].includes(actor.role))throw fail(403,'Sign in to view a timetable.');
 const snapshot=structuredClone(store.state.publication?.snapshot||activeTimetableInfo());
 if(snapshot&&actor.role==='student'){
  snapshot.classes=snapshot.classes.filter(c=>!c.archivedTimetable&&c.studentIds.includes(actor.id)).map(c=>({...c,studentIds:[actor.id]}));
  const ids=new Set(snapshot.classes.map(c=>c.id));snapshot.rows=snapshot.rows.filter(r=>ids.has(r.classId));snapshot.registrations=snapshot.registrations.filter(r=>ids.has(r.classId));
  const staffIds=new Set(snapshot.classes.flatMap(c=>c.teacherIds||[c.teacherId]));snapshot.teachers=snapshot.teachers.filter(t=>staffIds.has(t.id)).map(t=>({id:t.id,name:t.name,subjects:t.subjects}));delete snapshot.consumedEnrollments;delete snapshot.groups;
 }
 return{publication:publicationMetadata(store.state.publication),snapshot};
}
