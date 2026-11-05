// Transcribed from the user's Timetable options 2025_26.docx, TT Models 1–4.
const choice=(subject,{science=false,nonUzbekOnly=false,teacherSubject=subject}={})=>({subject,science,nonUzbekOnly,teacherSubject});
const S=subject=>choice(subject,{science:true}),N=(subject,teacherSubject=subject)=>choice(subject,{nonUzbekOnly:true,teacherSubject});
const B=()=>choice('Business Studies'),L=()=>choice('English Literature'),G=()=>choice('Global Perspectives'),U=()=>choice('Uzbek Language'),R=()=>choice('Russian as a Second Language',{teacherSubject:'Russian'});
const commonEnd=()=>[[choice('English')],[choice('Mathematics')]];
export const OPTION_MODELS=[
 {id:'1',name:'TT Model 1',blocks:[
  [choice('Economics'),S('Physics'),choice('History')],
  [B(),S('Chemistry'),choice('Computer Science')],
  [choice('Accounting'),S('Biology'),choice('Economics')],
  [L(),choice('ICT'),G()], [choice('Art'),choice('Geography'),B()],
  [U(),N('Global Perspectives'),R()], [choice('Russian'),N('French')],...commonEnd()]},
 {id:'2',name:'TT Model 2',blocks:[
  [choice('Accounting'),S('Physics'),choice('History')],
  [choice('Economics'),S('Chemistry'),choice('Computer Science')],
  [B(),S('Biology'),choice('Economics')],
  [L(),choice('ICT'),G()], [choice('Art'),choice('Geography'),B()],
  [U(),N('Global Perspectives'),N('French')], [choice('Russian'),N('Russian as a Second Language','Russian')],...commonEnd()]},
 {id:'3',name:'TT Model 3',blocks:[
  [choice('Accounting'),S('Physics'),choice('History')],
  [choice('Economics'),S('Chemistry'),choice('ICT')],
  [B(),S('Biology'),choice('Economics')],
  [L(),choice('Computer Science'),G()], [choice('Art'),choice('Geography'),B()],
  [U(),N('Global Perspectives'),N('French')], [choice('Russian'),N('Russian as a Second Language','Russian')],...commonEnd()]},
 {id:'4',name:'TT Model 4',blocks:[
  [choice('Economics'),S('Physics'),choice('History')],
  [B(),S('Chemistry'),choice('Computer Science')],
  [choice('Accounting'),S('Biology'),choice('Economics'),choice('French')],
  [L(),choice('ICT'),G()], [choice('Art'),choice('Geography'),B(),choice('Textiles',{teacherSubject:'Art'})],
  [U(),N('Global Perspectives')], [choice('Russian'),R()],...commonEnd()]},
];
export const optionModel=id=>{const model=OPTION_MODELS.find(m=>m.id===String(id));if(!model)throw Error('Choose timetable option model 1–4.');return model;};
export const OPTION_SOURCE='Timetable options 2025_26.docx';
export function optionAssignments(model,pupils,eligibility){
 // Fictional choices: one science in A/B/C, one subject in every block,
 // eligibility restrictions and no duplicate subject across different blocks.
 const counts=model.blocks.map(()=>new Map());
 const rows=new Map(pupils.map((p,i)=>{const chosen=new Set(),scienceIndex=i%3;const result=model.blocks.map((choices,index)=>{
  const eligible=choices.filter(c=>(!c.nonUzbekOnly||eligibility[p.id]?.nonUzbek===true)&&!chosen.has(c.subject));
  const pool=index<3?eligible.filter(c=>c.science===(index===scienceIndex)):eligible;
  if(!pool.length)throw Error('No valid test option choice for '+p.id+' in block '+'ABCDEFGHI'[index]+'.');
  const offset=(Math.floor(i/4)+i+index)%pool.length,rotated=[...pool.slice(offset),...pool.slice(0,offset)],selected=rotated.sort((a,b)=>(counts[index].get(a.subject)||0)-(counts[index].get(b.subject)||0))[0];counts[index].set(selected.subject,(counts[index].get(selected.subject)||0)+1);chosen.add(selected.subject);return selected.subject;
 });return[p.id,result];}));return rows;
}
export function documentOptionIssues(project,activities){
 if(project.optionSource!==OPTION_SOURCE)return [];activities=activities.filter(a=>!a.supportReservation);
 const issues=[],add=(kind,message,ids=[])=>issues.push({kind,message,lessonIds:ids});
 const subjectId=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 for(const year of [10,11]){
  const pupils=(project.groups||[]).filter(g=>g.year===year).flatMap(g=>g.studentIds||[]);if(!pupils.length)continue;
  let model;try{model=optionModel(project.optionModels?.[year]);}catch{add('option-model','Select a document option model for Year '+year+'.');continue;}
  model.blocks.forEach((choices,index)=>{
   const blockId='option-'+year+'-'+'ABCDEFGHI'[index],block=(project.optionBlocks||[]).find(b=>b.id===blockId);
   if(!block){add('option-model','Year '+year+' needs document block '+'ABCDEFGHI'[index]+'.');return;}
   for(const activity of activities.filter(a=>a.blockId===blockId)){
    const choice=choices.find(c=>subjectId(c.subject)===activity.subjectId);
    if(!choice)add('option-model',activity.name+' is not offered in '+model.name+' block '+'ABCDEFGHI'[index]+'.',[activity.id]);
    if(activity.weeklyCount!==4||activity.duration!==1)add('option-hours',activity.name+' requires four single teaching periods each week.',[activity.id]);
    if(choice?.nonUzbekOnly)for(const id of activity.studentIds||[])if(project.optionEligibility?.[id]?.nonUzbek!==true)add('option-eligibility','Student '+id+' is not marked eligible for '+choice.subject+' in block '+'ABCDEFGHI'[index]+'.',[activity.id]);
   }
  });
  for(const id of pupils){
   const selected=activities.filter(a=>a.year===year&&a.blockId&&a.studentIds?.includes(id));
   if(!selected.some(a=>['physics','chemistry','biology'].includes(a.subjectId)))add('option-science','Student '+id+' must select at least one science.',selected.map(a=>a.id));
   if(new Set(selected.map(a=>a.subjectId)).size!==selected.length)add('option-duplicate','Student '+id+' has selected the same subject in more than one block.',selected.map(a=>a.id));
  }
 }
 return issues;
}
