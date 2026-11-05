const fail=(status,message)=>Object.assign(Error(message),{status});
const text=(value,max)=>String(value??'').trim().slice(0,max);
export function installClassMaterials(Store,{attachments,resourceURL}){Object.assign(Store.prototype,{
 async copyMaterial(actor,d){const source=this.materialForEdit(actor,d.id),target=this.check(actor,d.targetClassId,true),title=text(d.title,160);if(target.id===source.classId)throw fail(400,'Choose another allocated class.');if(!title)throw fail(400,'Give the copied material a title.');if(!/^[a-f0-9-]{36}$/i.test(d.operationId||''))throw fail(400,'Reopen the copy form before saving.');const signature=JSON.stringify({id:source.id,target:target.id,title,revision:d.expectedRevision}),operationKey=actor.id+'|'+d.operationId;return this.transact(next=>{
  const view=Object.create(this);view.state=next;const r=view.materialForEdit(actor,d.id),destination=view.check(actor,d.targetClassId,true),previous=next.materialCopyOperations?.[operationKey];
  if(previous){if(previous.signature!==signature)throw fail(409,'This copy request was used with different choices. Reopen the form.');return structuredClone(previous.result);}
  if(d.expectedRevision!==(r.revision||1))throw fail(409,'The source material changed. Reload before copying.');if(r.archived)throw fail(409,'Restore this material before copying it.');
  const id=crypto.randomUUID(),now=new Date().toISOString(),copy={id,classId:destination.id,title,body:r.body||'',topic:r.topic||'Class materials',provider:r.provider||'Class material',url:r.url||'',files:structuredClone(r.files||[]),author:actor.name,createdAt:now,revision:1,archived:false};next.resources[id]=copy;const result={id,classId:destination.id};next.materialCopyOperations??={};next.materialCopyOperations[operationKey]={signature,result,at:now};next.resourceAudit??=[];next.resourceAudit.push({action:'copy-material',sourceId:r.id,id,classId:destination.id,actorId:actor.id,revision:1,at:now});return result;
 });},
 materialForEdit(actor,id){if(!actor?.id||['student','parent'].includes(actor.role))throw fail(403,'Teacher access required.');const r=this.state.resources[id];if(!r)throw fail(404,'Class material not found.');this.check(actor,r.classId,true);return r;},
 async updateMaterial(actor,d){this.materialForEdit(actor,d.id);return this.transact(next=>{
  const view=Object.create(this);view.state=next;const r=view.materialForEdit(actor,d.id);
  if(d.expectedRevision!==(r.revision||1))throw fail(409,'This material changed. Reload before editing.');if(r.archived)throw fail(409,'Restore this material before editing it.');
  const title=text(d.title,160),body=text(d.body,10000),topic=text(d.topic,100)||'Class materials',url=resourceURL(d.url),files=d.files!==undefined?attachments(d.files):d.clearFiles===true||d.clearFiles==='on'?[]:r.files||[];
  if(!title||!body&&!url&&!files.length)throw fail(400,'Enter a title and add a document, description or HTTPS link.');
  Object.assign(r,{title,body,topic,url,files,revision:(r.revision||1)+1,updatedAt:new Date().toISOString(),updatedBy:actor.id});next.resourceAudit??=[];next.resourceAudit.push({action:'edit-material',id:r.id,classId:r.classId,actorId:actor.id,revision:r.revision,at:r.updatedAt});return structuredClone(r);
 });},
 async archiveMaterial(actor,d){this.materialForEdit(actor,d.id);if(![true,false,'true','false'].includes(d.archived))throw fail(400,'Choose archive or restore.');return this.transact(next=>{
  const view=Object.create(this);view.state=next;const r=view.materialForEdit(actor,d.id);if(d.expectedRevision!==(r.revision||1))throw fail(409,'This material changed. Reload before archiving or restoring.');const archived=d.archived===true||d.archived==='true';Object.assign(r,{archived,revision:(r.revision||1)+1,updatedAt:new Date().toISOString(),updatedBy:actor.id});next.resourceAudit??=[];next.resourceAudit.push({action:archived?'archive-material':'restore-material',id:r.id,classId:r.classId,actorId:actor.id,revision:r.revision,at:r.updatedAt});return{id:r.id,classId:r.classId,archived};
 });}
 });}
