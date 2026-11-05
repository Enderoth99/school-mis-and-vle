import {enrolledIds} from './classroom-workflow.mjs';
import {students} from './dist/school-data.mjs';
const fail=(status,message)=>Object.assign(Error(message),{status}),staff=a=>a?.id&&!['student','parent'].includes(a.role);
const key=(actor,assignmentId,studentId)=>actor.id+'|'+assignmentId+'|'+studentId;
function comments(value,max){if(value===undefined)return '';if(typeof value!=='string'||value.length>max)throw fail(400,'Keep feedback within '+max+' characters.');return value.trim();}
function marks(value,known,validate){if(value===undefined)return {};if(!value||typeof value!=='object'||Array.isArray(value))throw fail(400,'Check the draft marks.');const result={};for(const [id,n]of Object.entries(value)){const item=known.find(x=>x.id===id);if(!item||!validate(item,n))throw fail(400,'Check the draft marks.');result[id]=n;}return result;}
function content(a,d){
 const mark=d.mark===undefined||d.mark===''||d.mark===null?null:Number(d.mark);if(mark!==null&&(!Number.isFinite(mark)||mark<0||mark>a.maximum))throw fail(400,'Enter a draft mark between 0 and '+a.maximum+'.');
 const questions=a.kind==='quiz'?a.questions||[]:[],rubric=a.learning?.rubric||[];
 const questionMarks=marks(d.questionMarks,questions,(q,n)=>n===null||typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=q.points),rubricMarks=marks(d.rubricMarks,rubric,(r,n)=>typeof n==='number'&&r.levels.some(l=>l.points===n));
 const questionComments={};if(d.questionComments!==undefined){if(!d.questionComments||typeof d.questionComments!=='object'||Array.isArray(d.questionComments))throw fail(400,'Check question feedback.');for(const [id,text]of Object.entries(d.questionComments)){if(!questions.some(q=>q.id===id))throw fail(400,'Question feedback must belong to this quiz.');questionComments[id]=comments(text,2000);}}
 return{mark,feedback:comments(d.feedback,5000),questionMarks,rubricMarks,questionComments};
}
export function installMarkingDrafts(Store){Object.assign(Store.prototype,{
 markingDraftRows(actor){
  if(!staff(actor))throw fail(403,'Teacher access required.');const rows=[];
  for(const draft of Object.values(this.markingDraftBackup(actor))){
   let a,c;try{({a,c}=this.getAssignment(actor,draft.assignmentId,true));}catch{continue;}
   if(!enrolledIds(a,c).includes(draft.studentId))continue;
   const s=this.state.submissions[a.id+'|'+draft.studentId];
   rows.push({id:a.id,classId:c.id,className:c.name,title:a.title,studentId:draft.studentId,studentName:students.find(x=>x.id===draft.studentId)?.name||'Student',markingDraft:true,draftUpdatedAt:draft.updatedAt,stale:draft.submissionRevision!==s?.revision||draft.assignmentRevision!==a.revision,withdrawn:!s?.turnedInAt,returned:!!s?.returnedAt});
  }
  return rows.sort((a,b)=>b.draftUpdatedAt.localeCompare(a.draftUpdatedAt)||a.id.localeCompare(b.id)||a.studentId.localeCompare(b.studentId));
 },
 markingDraft(actor,a,studentId){if(!staff(actor))return null;this.check(actor,a.classId,true);const draft=this.state.markingDrafts?.[key(actor,a.id,studentId)];if(!draft)return null;const submission=this.state.submissions[a.id+'|'+studentId];return{...structuredClone(draft),stale:draft.submissionRevision!==submission?.revision||draft.assignmentRevision!==a.revision};},
 async saveMarkingDraft(actor,d){if(!staff(actor))throw fail(403,'Teacher access required.');const {a,c}=this.getAssignment(actor,d.id,true);if(!enrolledIds(a,c).includes(d.studentId))throw fail(403,'Student is not assigned this work.');const draftKey=key(actor,a.id,d.studentId);return this.transact(next=>{
  const view=Object.create(this);view.state=next;const current=view.getAssignment(actor,a.id,true).a,s=next.submissions[a.id+'|'+d.studentId],old=next.markingDrafts?.[draftKey];
  if(!s?.turnedInAt)throw fail(400,'The student must turn in work before you save marking.');
  if(d.expectedRevision!==s.revision||d.expectedAssignmentRevision!==current.revision)throw fail(409,'Student work or the task changed. Reload before saving marking.');
  if(d.expectedMarkingRevision!==(old?.revision||0))throw fail(409,'Your marking draft changed in another tab. Reload before saving.');
  const row={assignmentId:a.id,classId:a.classId,studentId:d.studentId,actorId:actor.id,submissionRevision:s.revision,assignmentRevision:current.revision,revision:(old?.revision||0)+1,updatedAt:new Date().toISOString(),content:content(current,d)};next.markingDrafts??={};next.markingDrafts[draftKey]=row;return{saved:true,revision:row.revision};
 });},
 markingDraftBackup(actor){if(!staff(actor))throw fail(403,'Teacher access required.');const classes=new Set(this.classes(actor).map(c=>c.id));return Object.fromEntries(Object.entries(this.state.markingDrafts||{}).filter(([,r])=>r.actorId===actor.id&&classes.has(r.classId)));}
 });}

