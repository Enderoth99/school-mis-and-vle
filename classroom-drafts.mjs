const fail=(status,message)=>Object.assign(Error(message),{status});
export function installClassroomDrafts(Store){Object.assign(Store.prototype,{
 drafts(actor,q={}){
  if(!actor?.id||['student','parent'].includes(actor.role))throw fail(403,'Teacher access required.');
  const classes=this.classes(actor),byClass=new Map(classes.map(c=>[c.id,c]));
  if(q.classId)this.check(actor,q.classId,true);
  if(q.kind&&!['unit','assignment','quiz'].includes(q.kind))throw fail(400,'Choose a valid draft type.');
  const raw=String(q.offset||'0');if(!/^\d{1,8}$/.test(raw))throw fail(400,'Choose a valid page.');
  const search=String(q.search||'').trim().slice(0,120).toLocaleLowerCase(),rows=[];
  const units=this.state.units||{},assignments=Object.values(this.state.assignments);
  for(const u of Object.values(units)){
   const c=byClass.get(u.classId);if(!c||u.status!=='draft')continue;
   const tasks=assignments.filter(a=>a.classId===u.classId&&a.learning?.unitId===u.id);
   rows.push({id:u.id,kind:'unit',title:u.title,classId:c.id,className:c.name,subject:c.subject,taskCount:tasks.length,selectedCount:u.publicationPlan?.assignmentIds?.filter(id=>tasks.some(a=>a.id===id)).length??tasks.length,planSaved:!!u.publicationPlan,updatedAt:u.updatedAt||''});
  }
  for(const a of assignments){
   const c=byClass.get(a.classId);if(!c||a.status!=='draft')continue;
   const candidate=units[a.learning?.unitId],u=candidate?.classId===c.id?candidate:null;
   rows.push({id:a.id,kind:a.kind==='quiz'?'quiz':'assignment',title:a.title,classId:c.id,className:c.name,subject:c.subject,due:a.due||'',maximum:a.maximum,unitId:u?.id||'',unitTitle:u?.title||'',unitDraft:u?.status==='draft'});
  }
  const counts={unit:0,quiz:0,assignment:0};rows.forEach(r=>counts[r.kind]++);
  const filtered=rows.filter(r=>(!q.classId||r.classId===q.classId)&&(!q.kind||r.kind===q.kind)&&(!search||[r.title,r.className,r.subject,r.unitTitle||''].join(' ').toLocaleLowerCase().includes(search))).sort((a,b)=>a.className.localeCompare(b.className)||a.title.localeCompare(b.title)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  const limit=12,total=filtered.length,requested=Number(raw),offset=total?Math.min(Math.floor(requested/limit)*limit,Math.floor((total-1)/limit)*limit):0;
  return{items:filtered.slice(offset,offset+limit),total,offset,limit,counts,classes:classes.map(c=>({id:c.id,name:c.name}))};
 }
 });}
