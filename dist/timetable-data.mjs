import {students,groups} from './school-data.mjs';
import {baselineTeachers as teachers,baselineTeachingClasses as teachingClasses} from './teaching-data.mjs';
import {OPTION_MODELS,optionModel,optionAssignments,OPTION_SOURCE} from './timetable-options.mjs';

// User-confirmed cycle structure; pupil option choices remain fictional examples.
export const TIMETABLE_SCOPES=[
 {id:'year9',label:'Year 09 pilot'},
 {id:'secondary',label:'Secondary · Years 07–13'},
 {id:'school',label:'Whole school · FS1–Year 13'},
];
export const WEEKLY_LESSON_TARGETS=Object.freeze({
 Assembly:1,English:5,Mathematics:6,Science:5,Computing:2,History:2,Geography:2,
 'Global Perspectives':0,Art:2,Drama:1,Music:2,French:2,Russian:3,
 'Uzbek Language':2,'Uzbek History':1,'Uzbek Culture':1,PE:2,PSHE:1,
 Biology:3,Chemistry:3,Physics:3,'Computer Science':3,'Business Studies':3,
 Economics:3,Accounting:3,'English Literature':4,Psychology:3,'Primary curriculum':38,
});
export const OPTION_BLOCK_CHOICES=Object.freeze(Object.fromEntries([10,11].map(year=>[year,OPTION_MODELS[0].blocks.map(b=>b.map(c=>c.subject))])));
const upperCore={Assembly:1,PE:2,PSHE:1};
const subjectId=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const palette=['#37648d','#487e64','#957349','#80658f','#44848c','#a45c61','#6b769d','#7c8152'];
const days=[['mon','Monday'],['tue','Tuesday'],['wed','Wednesday'],['thu','Thursday'],['fri','Friday']];
const periods=[['1','08:30','09:15'],['2','09:15','10:00'],['3','10:00','10:45'],['4','11:05','11:50'],['5','11:50','12:35'],['6','12:35','13:20'],['7','14:00','14:45'],['8','14:45','15:30']];
const scopeAllows=(scope,year)=>scope==='school'||typeof year==='number'&&(scope==='secondary'?year>=7:year===9);
const specialistType=subject=>['Science','Biology','Chemistry','Physics'].includes(subject)?'science':['Computing','Computer Science','ICT'].includes(subject)?'computing':subject==='Art'?'art':subject==='Music'?'music':subject==='Drama'?'drama':subject==='PE'?'sport':null;
const specialistRooms=[['science','Science lab',4],['computing','Computing lab',2],['art','Art studio',2],['music','Music room',2],['drama','Drama studio',1],['sport','Sports space',2]];
const pupilById=new Map(students.map(s=>[s.id,s]));
const groupsFor=ids=>[...new Set(ids.map(id=>pupilById.get(id).cohort))];

export function createTimetableProject({scope='year9',optionModels={10:'1',11:'1'}}={}){
 if(!TIMETABLE_SCOPES.some(s=>s.id===scope))throw Error('Choose Year 09, secondary or whole-school planning.');
 const selectedGroups=groups.filter(g=>scopeAllows(scope,g.year)),selectedStudents=students.filter(s=>scopeAllows(scope,s.year));
 const selectedClasses=teachingClasses.filter(c=>['primary','subject','assembly'].includes(c.kind)&&scopeAllows(scope,c.year));
 const activities=[],placements={},optionBlocks=[],optionEligibility={};
 const selectedModels=Object.fromEntries([10,11].map(year=>[year,optionModel(optionModels[year]||'1').id]));
 function addCanonical(c,hours){if(!hours)return;const duration=c.subject==='PE'?2:1,weeklyCount=hours/duration,assembly=c.kind==='assembly';activities.push({id:'act-'+c.id,classId:c.id,name:c.name,subjectId:subjectId(c.subject),teacherIds:[c.teacherId],groupIds:groupsFor(c.studentIds),studentIds:[...c.studentIds],roomIds:[],weeklyCount,duration,spread:c.kind!=='primary'&&weeklyCount<=5,year:c.year,enrollmentMode:c.enrollmentMode,source:'Existing MIS teaching allocation',...(assembly?{fixedSlots:[{day:'mon',period:'1'}]}:{})});}
 for(const c of selectedClasses){
  if(c.kind==='primary'){addCanonical(c,38);continue;}
  if(c.year>=10&&c.year<=11){addCanonical(c,upperCore[c.subject]||0);continue;}
  if(c.year>=12){addCanonical(c,c.kind==='assembly'?1:c.subject==='PSHE'?1:c.subject==='PE'?2:4);continue;}
  addCanonical(c,WEEKLY_LESSON_TARGETS[c.subject]||0);
 }
 // Primary PE is a class-teacher planning activity, not an invented MIS class.
 for(const g of selectedGroups.filter(g=>typeof g.year!=='number'||g.year<=6)){
  const c=selectedClasses.find(c=>c.kind==='primary'&&c.cohort===g.id),ids=[...c.studentIds];
  activities.push({id:'plan-pe-'+g.id,classId:null,sourceClassId:c.id,name:g.name+' · PE double',subjectId:'pe',teacherIds:[c.teacherId],groupIds:[g.id],studentIds:ids,roomIds:[],weeklyCount:1,duration:2,spread:true,year:g.year,enrollmentMode:'planning class teaching',source:'Planning-only PE block using the existing class teacher; no MIS class created'});
 }
 // Every sixth-form pupil has a weekly PE double even though no current PE class exists.
 for(const g of selectedGroups.filter(g=>typeof g.year==='number'&&g.year>=12)){
  const pool=teachers.filter(t=>t.phase==='Secondary'&&t.subjects.includes('PE')),ids=students.filter(s=>s.cohort===g.id).map(s=>s.id),owner=pool[(g.year-12)%pool.length];
  activities.push({id:'plan-pe-'+g.id,classId:null,name:g.name+' · PE double',subjectId:'pe',teacherIds:[owner.id],groupIds:[g.id],studentIds:ids,roomIds:[],weeklyCount:1,duration:2,spread:true,year:g.year,enrollmentMode:'planning form PE',source:'Planning-only PE block; existing PE-qualified curriculum teacher, no MIS class created'});
 }
 // Nine document blocks, four periods each; assembly/PSHE/PE fill four more.
 for(const year of [10,11]){
  const yearPupils=selectedStudents.filter(s=>s.year===year);if(!yearPupils.length)continue;
  yearPupils.forEach((p,i)=>optionEligibility[p.id]={nonUzbek:i%4===0,synthetic:true});
  const model=optionModel(selectedModels[year]),assignments=optionAssignments(model,yearPupils,optionEligibility);
  model.blocks.forEach((choices,index)=>{
   const letter='ABCDEFGHI'[index],blockId='option-'+year+'-'+letter,activityIds=[],usedTeachers=new Set();
   if(index>=7){
    const subject=choices[0].subject;
    for(const c of selectedClasses.filter(c=>c.year===year&&c.kind==='subject'&&c.subject===subject)){
     addCanonical(c,4);const a=activities.at(-1);a.blockId=blockId;a.science=false;a.nonUzbekOnly=false;activityIds.push(a.id);
    }
   }else choices.forEach((choice)=>{
    const {subject,teacherSubject}=choice,ids=yearPupils.filter(p=>assignments.get(p.id)[index]===subject).map(p=>p.id);
    const pool=teachers.filter(t=>t.phase==='Secondary'&&t.subjects.includes(teacherSubject));if(!pool.length)throw Error('No existing teacher can teach planning subject '+subject+'.');
    const teacherDemand=id=>activities.filter(a=>a.teacherIds.includes(id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0),owner=pool.filter(t=>!usedTeachers.has(t.id)).sort((a,b)=>teacherDemand(a.id)-teacherDemand(b.id)||a.id.localeCompare(b.id))[0];if(!owner)throw Error('Insufficient distinct teachers for '+model.name+' Block '+letter+'.');usedTeachers.add(owner.id);
    const canonical=teachingClasses.find(c=>c.subject===teacherSubject&&c.teacherId===owner.id&&c.year===year),id='plan-option-'+year+'-'+letter+'-'+subjectId(subject);activityIds.push(id);
    activities.push({id,classId:null,...(canonical?{sourceClassId:canonical.id}:{}),name:'Year '+year+' · Block '+letter+' · '+subject,subjectId:subjectId(subject),teacherIds:[owner.id],groupIds:groupsFor(ids),studentIds:ids,roomIds:[],weeklyCount:4,duration:1,spread:true,year,blockId,science:choice.science,nonUzbekOnly:choice.nonUzbekOnly,enrollmentMode:'planning option block',source:'Planning choices based on '+OPTION_SOURCE+' '+model.name+'; fictional memberships, no MIS enrollment changes',...(subject==='Textiles'?{staffingAssumption:'Art curriculum teacher used for Textiles pending specialist confirmation'}:{})});
   });
   optionBlocks.push({id:blockId,name:'Year '+year+' · Block '+letter,year,modelId:model.id,source:OPTION_SOURCE,activityIds,studentIds:yearPupils.map(s=>s.id),weeklyCount:4,duration:1,documentChoices:structuredClone(choices)});
  });
 }
 const selectedSubjects=[...new Set(activities.map(a=>a.subjectId))].sort(),subjectNames=new Map();for(const [name] of Object.entries(WEEKLY_LESSON_TARGETS))subjectNames.set(subjectId(name),name);for(const subject of OPTION_MODELS.flatMap(m=>m.blocks.flatMap(b=>b.map(c=>c.subject))))subjectNames.set(subjectId(subject),subject);
 const maxClassSize=Math.max(1,...activities.map(a=>a.studentIds.length));
 const rooms=selectedGroups.map(g=>({id:'room-'+g.id,name:g.name+' classroom',type:'general',capacity:Math.max(g.count,maxClassSize),blocked:[],groupId:g.id}));
 for(const [type,label,count] of specialistRooms){if(!activities.some(a=>specialistType(subjectNames.get(a.subjectId))===type))continue;for(let i=1;i<=count;i++)rooms.push({id:'room-'+type+'-'+i,name:label+' '+i,type,capacity:maxClassSize,blocked:[]});}
 const generalRoomIds=rooms.filter(r=>r.type==='general').map(r=>r.id);
 for(const a of activities){const canonical=a.classId&&teachingClasses.find(c=>c.id===a.classId),type=specialistType(subjectNames.get(a.subjectId));a.roomIds=canonical?.kind==='primary'||a.subjectId==='assembly'?['room-'+a.groupIds[0]]:type?rooms.filter(r=>r.type===type).map(r=>r.id):[...generalRoomIds];if(a.subjectId==='assembly')placements[a.id+'#1']={day:'mon',period:'1',roomId:a.roomIds[0],locked:true};}
 const selectedTeacherIds=new Set(activities.flatMap(a=>a.teacherIds)),warnings=[];
 for(const teacher of teachers.filter(t=>selectedTeacherIds.has(t.id))){const demand=activities.filter(a=>a.teacherIds.includes(teacher.id)).reduce((n,a)=>n+a.weeklyCount*a.duration,0);if(demand>40)warnings.push({kind:'teacher-capacity',teacherId:teacher.id,demand,capacity:40,message:teacher.name+' is allocated '+demand+' periods against 40 available. Additional staffing or revised allocations are required.'});}
 for(const [type,label] of specialistRooms){const demand=activities.filter(a=>specialistType(subjectNames.get(a.subjectId))===type).reduce((n,a)=>n+a.weeklyCount*a.duration,0),capacity=rooms.filter(r=>r.type===type).length*40;if(demand>capacity)warnings.push({kind:'room-capacity',type,demand,capacity,message:label+' demand is '+demand+' periods against '+capacity+' available. Current room supply is retained; facilities planning is required.'});}
 return{
  version:1,rulesVersion:3,optionModels:selectedModels,optionEligibility,optionSource:OPTION_SOURCE,id:'wist-timetable-'+scope,name:scope==='year9'?'WIST · Year 09 pilot':scope==='secondary'?'WIST · Secondary draft':'WIST · Whole-school draft',scope,
  days:days.map(([id,name])=>({id,name})),periods:periods.map(([id,start,end])=>({id,label:'Period '+id,start,end})),registration:{id:'R',start:'08:15',end:'08:30',outsideTeachingCycle:true},
  teachers:teachers.filter(t=>selectedTeacherIds.has(t.id)).map(t=>({id:t.id,name:t.name,area:t.area,blocked:[]})),
  subjects:selectedSubjects.map((id,i)=>({id,name:subjectNames.get(id)||id,color:palette[i%palette.length]})),
  rooms,groups:selectedGroups.map(g=>({id:g.id,name:g.name,year:g.year,studentIds:students.filter(s=>s.cohort===g.id).map(s=>s.id),blocked:[]})),activities,placements,optionBlocks,constraints:{maxTeacherDaily:8},warnings,
  notes:[
   'Rules version 3: 40 teaching periods per week through Year 11; registration 08:15–08:30 is additional and excluded from those 40.',
   'Break is 10:45–11:05 after Period 3; lunch is 13:20–14:00 after Period 6. PE is one consecutive double period in every year group.',
   'Years 07–09 follow the supplied common subject allocation. Global Perspectives is omitted because it is absent from that allocation; its MIS class is unchanged.',
   'Year 10/11 use nine four-period blocks A–I from Timetable options 2025_26.docx (36 periods), plus assembly 1, PSHE 1 and PE 2. English and mathematics preserve existing mixed-set rosters; other choices are fictional planning enrollments.',
   'Primary and early-years curriculum cards total 38 periods plus a PE double using their existing class teacher. Sixth-form subject enrollments are retained; free periods are allowed.',
   'Year 12/13 subjects have four lessons each; existing option memberships are preserved. The supplied nine-block document is applied to Years 10/11 only.',
   'Document choices enforce at least one science, one subject per block and the marked non-Uzbek restrictions. Eligibility flags are fictional test fixtures, not actual pupil nationality. Models 1–4 are selectable independently for Year 10 and Year 11. Textiles uses the Art curriculum teacher pending specialist confirmation.',
   'All existing pupil and staff IDs are retained. No extra staff or sports facilities are invented to hide resource shortages. Capacity warnings identify demand requiring school decisions.',
   'Assemblies are fixed Monday Period 1 in the form classroom for planning; final assembly locations require confirmation.',
   'This planning draft does not replace lesson registers, the existing sample timetable, or the published colleague-test demo.',
   ...warnings.map(w=>w.message),
  ],
 };
}
