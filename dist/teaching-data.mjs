import {students,groups,yearLabel,studentsForGroup} from './school-data.mjs';
import {ACTIVE_PROJECT} from './timetable-active-config.mjs';
import {compileTeachingTimetable,scheduledRows} from './timetable-integration.mjs';
import {schoolPeriods} from './school-week.mjs';

export const TEACHING_VERSION=1;
const primaryNames=['Emma Carter','Oliver Grant','Maya Collins','Amir West','Sofia Hart','Noah Clarke','Layla Mason','Adam Fox','Grace Turner','Leo Palmer','Nina Shaw','Ethan Cooper','Zara Miles','Oscar Wells','Hana Blake','Felix Ward','Isla Sutton','Yusuf Cole','Eva Bryant','Luca Flynn','Meera Dawson','Arjun Fletcher','Alina Stone','Daniel Price','Freya Walsh','Omar Spencer','Chloe Lawson','Isaac Webb','Anika Porter','Rohan Foster','Lara Rhodes','Adrian Knight'];
const secondaryNames=['Daniel Brooks','Sofia Bennett','Amira Reed','Leo Harrison','Maya Gibson','Omar Hughes','Nora Wallace','Ethan Sullivan','Zara Campbell','Arjun Hayes','Layla Ellis','Felix Murray','Hana Russell','Noah Morgan','Eva Chapman','Yusuf Parker','Isla Freeman','Adam Warren','Meera Kennedy','Oliver Ross','Alina Simpson','Rohan Mitchell','Grace Anderson','Luca Davidson','Nina Howard','Isaac Hughes','Anika Walsh','Cameron Dean'];
export const curriculumAreas=[
  {id:'english',name:'English',count:3,subjects:['English','English Literature','EAL']},
  {id:'mathematics',name:'Mathematics',count:3,subjects:['Mathematics']},
  {id:'science',name:'Science',count:4,subjects:['Science','Biology','Chemistry','Physics']},
  {id:'humanities',name:'Humanities',count:3,subjects:['History','Geography','Global Perspectives','Psychology']},
  {id:'computing',name:'Computing and ICT',count:2,subjects:['Computing','Computer Science','ICT']},
  {id:'business',name:'Business and economics',count:2,subjects:['Business Studies','Economics','Accounting']},
  {id:'arts',name:'Creative and performing arts',count:3,subjects:['Art','Drama','Music','Textiles']},
  {id:'languages',name:'Modern languages',count:3,subjects:['French','Russian']},
  {id:'uzbek',name:'Uzbek studies',count:3,subjects:['Uzbek Language','Uzbek History','Uzbek Culture']},
  {id:'wellbeing',name:'PE and wellbeing',count:2,subjects:['PE','PSHE']},
];
const makeTeacher=(name,extra)=>({id:'t-'+name.toLowerCase().replaceAll(' ','-'),name,firstName:name.split(' ')[0],username:name.toLowerCase().replaceAll(' ','.'),synthetic:true,...extra});
const primaryGroups=groups.filter(g=>typeof g.year!=='number'||g.year<=6);
const secondaryGroups=groups.filter(g=>typeof g.year==='number'&&g.year>=7);
let staffIndex=0;
export const teachers=[...primaryGroups.map((g,i)=>makeTeacher(primaryNames[i],{phase:String(g.year).startsWith('FS')?'Early years':'Primary',area:'Primary class teaching',areaId:'primary',formIds:[g.id],subjects:String(g.year).startsWith('FS')?['Communication and Language','Physical Development','Personal, Social and Emotional Development','Literacy','Mathematics','Understanding the World','Expressive Arts and Design']:['English','Mathematics','Science','Humanities','Art','Music','Computing','PE','PSHE']})),...curriculumAreas.flatMap(area=>Array.from({length:area.count},()=>makeTeacher(secondaryNames[staffIndex++],{phase:'Secondary',area:area.name,areaId:area.id,formIds:[],subjects:area.subjects})))];
const secondaryTeachers=teachers.filter(t=>t.phase==='Secondary');
export const formTutors=groups.map(g=>{const teacher=primaryGroups.includes(g)?teachers.find(t=>t.formIds.includes(g.id)):secondaryTeachers[secondaryGroups.indexOf(g)];if(!teacher.formIds.includes(g.id))teacher.formIds.push(g.id);return{groupId:g.id,groupName:g.name,teacherId:teacher.id};});
export const teacherById=id=>teachers.find(t=>t.id===id);
export const teacherByUsername=username=>teachers.find(t=>t.username===String(username).trim().toLowerCase());
const areaCounters={};
const ownerFor=subject=>{const area=curriculumAreas.find(a=>a.subjects.includes(subject));if(!area)throw new Error(`Unallocated subject ${subject}`);const pool=teachers.filter(t=>t.areaId===area.id);return pool[(areaCounters[area.id]=(areaCounters[area.id]??-1)+1)%pool.length];};
const subjectIds={'Business Studies':'business','Computer Science':'computerscience','English Literature':'englishliterature','Global Perspectives':'globalperspectives','Uzbek Language':'uzbeklanguage','Uzbek History':'uzbekhistory','Uzbek Culture':'uzbekculture'};
const subjectTag=subject=>({'Computing':'CS','Computer Science':'CS','Mathematics':'MA','Business Studies':'BS','Economics':'EC','English':'EN','Science':'SC'}[subject]||subject.split(' ').map(word=>word[0]).join('').slice(0,2).toUpperCase());
const colorFor=area=>({english:'orange',mathematics:'blue',science:'green',humanities:'purple',computing:'blue',business:'orange',arts:'purple',languages:'green',uzbek:'green',wellbeing:'blue'}[area]||'green');
const subjectClass=(subject,g,extra={})=>{
 const teacher=ownerFor(subject),slug=subjectIds[subject]||subject.toLowerCase().replaceAll(' ','');
 return {id:`${slug}${g.id}`,name:`${subject} ${g.name}`,subject,subjects:[subject],year:g.year,cohort:g.id,room:`${teacher.areaId.toUpperCase().slice(0,3)} ${String(teachers.indexOf(teacher)%8+1).padStart(2,'0')}`,tag:subjectTag(subject),color:colorFor(teacher.areaId),teacherId:teacher.id,kind:'subject',enrollmentMode:'form',studentIds:studentsForGroup(g.id).map(s=>s.id),...extra};
};
const classes=[];
for(const g of primaryGroups){const teacher=teacherById(formTutors.find(f=>f.groupId===g.id).teacherId);classes.push({id:`primary${g.id}`,name:`${g.name} · Class teaching`,subject:'Primary curriculum',subjects:teacher.subjects,year:g.year,cohort:g.id,room:`PRI ${g.name}`,tag:'PR',color:'green',teacherId:teacher.id,kind:'primary',enrollmentMode:'form',studentIds:studentsForGroup(g.id).map(s=>s.id)});}
for(const g of secondaryGroups){const teacher=teacherById(formTutors.find(f=>f.groupId===g.id).teacherId);for(const [kind,subject,prefix,room] of [['registration','Homeroom','homeroom',`Form ${g.name}`],['assembly','Assembly','assembly','Main hall']])classes.push({id:`${prefix}${g.id}`,name:`${g.name} ${subject}`,subject,subjects:[subject],year:g.year,cohort:g.id,room,tag:kind==='registration'?'HR':'AS',color:'green',teacherId:teacher.id,kind,enrollmentMode:'form',studentIds:studentsForGroup(g.id).map(s=>s.id)});}
const lowerSubjects=['English','Mathematics','Science','Computing','History','Geography','Global Perspectives','Art','Drama','Music','French','Russian','Uzbek Language','Uzbek History','Uzbek Culture','PE','PSHE'];
const upperSubjects=['English','Mathematics','Russian','Uzbek Language','Uzbek History','Uzbek Culture','PE','PSHE'];
const optionProfiles={'10a':['Biology','Chemistry','Art'],'10b':['Business Studies','Accounting','Computer Science'],'10c':['Economics','Geography','History'],'11a':['Biology','Chemistry','Physics','Art'],'11b':['Business Studies','Economics','Accounting','Computer Science']};
for(const g of secondaryGroups.filter(g=>g.year<=11)){
 for(const subject of [...(g.year<=9?lowerSubjects:upperSubjects),...(optionProfiles[g.id]||[])]){
  let extra={};
  if(subject==='English'||subject==='Mathematics'){
   const yearForms=groups.filter(f=>f.year===g.year),index=yearForms.findIndex(f=>f.id===g.id),yearStudents=students.filter(s=>s.year===g.year);
   extra={name:`${subject} ${yearLabel(g.year)} · Set ${g.form}`,enrollmentMode:'mixed set',studentIds:yearStudents.filter((_,i)=>i%yearForms.length===index).map(s=>s.id)};
  }
  classes.push(subjectClass(subject,g,extra));
 }
}
const sixthFormBlocks=[['Mathematics','English Literature','Geography'],['Biology','Economics','Business Studies'],['Physics','Chemistry','Computer Science','Psychology']];
for(const g of secondaryGroups.filter(g=>g.year>=12)){
 classes.push(subjectClass('PSHE',g));
 sixthFormBlocks.forEach((choices,block)=>choices.forEach((subject,index)=>{
  const members=studentsForGroup(g.id).filter((_,i)=>(i+block)%choices.length===index).map(s=>s.id);
  classes.push(subjectClass(subject,g,{name:`${subject} ${yearLabel(g.year)} · Block ${'ABC'[block]}`,enrollmentMode:'option block',block:'ABC'[block],studentIds:members}));
 }));
}
export const teachingClasses=classes;
export const classesForTeacher=id=>teachingClasses.filter(c=>c.teacherId===id||c.teacherIds?.includes(id));
export const studentsForTeacher=id=>{const memberIds=new Set(classesForTeacher(id).flatMap(c=>c.studentIds));return students.filter(s=>memberIds.has(s.id));};
export const classesForStudent=id=>teachingClasses.filter(c=>c.studentIds.includes(id));
let activeSnapshot=null;
export const activeTimetableInfo=()=>activeSnapshot;
export function installTeachingTimetable(project){
 const compiled=compileTeachingTimetable(project,teachingClasses,teachers,formTutors);
 const labels=new Map(project.groups.map(g=>[g.id,g]));
 for(const group of groups){const label=labels.get(group.id);if(label){group.name=label.name;if(label.form)group.form=label.form;}}
 for(const student of students){const group=groups.find(g=>g.id===student.cohort);if(group){student.groupName=group.name;student.form=group.form;}}
 for(const tutor of formTutors){const label=labels.get(tutor.groupId);if(label)tutor.groupName=label.name;}
 teachingClasses.splice(0,teachingClasses.length,...compiled.classes);
 teachers.splice(0,teachers.length,...compiled.teachers);
 schoolPeriods.splice(0,schoolPeriods.length,...compiled.periods);
 activeSnapshot=compiled;return compiled;
}
export function timetableForStudent(id,date){return activeSnapshot?scheduledRows(activeSnapshot,{studentId:id,date}):null;}
export function timetableForTeacher(id,date){
 if(activeSnapshot)return scheduledRows(activeSnapshot,{teacherId:id,date});
 const mine=classesForTeacher(id),registration=mine.find(c=>c.kind==='registration'||c.kind==='primary'),subjects=mine.filter(c=>c.kind==='subject'||c.kind==='primary');
 const sequence=subjects.length?subjects:mine.filter(c=>c.kind!=='assembly');
 if(!sequence.length)return[];
 return [...(registration?[{period:'R',classId:registration.id}]:[]),...['1','2','4','5','6','8'].slice(0,Math.max(1,Math.min(6,sequence.length===1?6:sequence.length))).map((period,i)=>({period,classId:sequence[i%sequence.length].id}))];
}
export const baselineTeachingClasses=structuredClone(teachingClasses);
export const baselineTeachers=structuredClone(teachers);
if(ACTIVE_PROJECT)installTeachingTimetable(ACTIVE_PROJECT);
