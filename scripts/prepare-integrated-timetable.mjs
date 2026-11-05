import fs from 'node:fs/promises';
import {createDemonstrationProject} from '../dist/timetable-school-rules.mjs';
import {teacherSubjects} from '../dist/timetable-manager-inputs.mjs';
const project=createDemonstrationProject({scope:'school'});
project.teachers.push({id:'t-mila-reed',name:'Mila Reed',firstName:'Mila',username:'mila.reed',phase:'Secondary',area:'Mathematics',areaId:'mathematics',formIds:[],subjects:['Mathematics'],subjectIds:['mathematics'],blocked:[],synthetic:true,planningOnly:false,integrationFixture:true});
project.teachers.push({id:'t-rowan-hayes',name:'Rowan Hayes',firstName:'Rowan',username:'rowan.hayes',phase:'Secondary',area:'PE and wellbeing',areaId:'wellbeing',formIds:[],subjects:['PE','PSHE'],subjectIds:['pe','pshe'],blocked:[],synthetic:true,planningOnly:false,integrationFixture:true});
project.teachers.push({id:'t-theo-adams',name:'Theo Adams',firstName:'Theo',username:'theo.adams',phase:'Secondary',area:'English',areaId:'english',formIds:[],subjects:['English','English Literature','EAL'],subjectIds:['english','english-literature'],blocked:[],synthetic:true,planningOnly:false,integrationFixture:true});
const changes=[];
for(const year of [7,8,9]){
 const maths=project.activities.filter(a=>a.year===year&&a.subjectId==='mathematics');
 const counts=new Map();for(const a of maths)for(const id of a.teacherIds)counts.set(id,(counts.get(id)||0)+1);
 const duplicate=maths.filter(a=>a.teacherIds.some(id=>counts.get(id)>1)).at(-1);
 if(duplicate){changes.push({activityId:duplicate.id,from:duplicate.teacherIds,to:['t-mila-reed']});duplicate.teacherIds=['t-mila-reed'];}
}
for(const year of [10,11])for(const subject of ['pe','pshe']){
 const pool=['t-anika-walsh','t-cameron-dean','t-rowan-hayes'];
 project.activities.filter(a=>a.year===year&&a.subjectId===subject).forEach((a,index)=>{changes.push({activityId:a.id,from:a.teacherIds,to:[pool[index]]});a.teacherIds=[pool[index]];});
}
project.rooms.push({id:'room-sport-demo-3',name:'Demo sports space 3',type:'sport',capacity:60,blocked:[],planningOnly:false,integrationFixture:true});
project.rooms.push({id:'room-sport-demo-4',name:'Demo sports space 4',type:'sport',capacity:60,blocked:[],planningOnly:false,integrationFixture:true});
for(const a of project.activities.filter(a=>a.subjectId==='pe'))a.roomIds.push('room-sport-demo-3','room-sport-demo-4');
const primaryTeachers=new Set(project.activities.filter(a=>a.subjectId==='primary-curriculum').flatMap(a=>a.teacherIds));
for(const a of project.activities)a.eligibleTeacherIds=a.subjectId==='assembly'||typeof a.year!=='number'||a.year<=6?a.teacherIds:project.teachers.filter(t=>!primaryTeachers.has(t.id)&&teacherSubjects(project,t.id).includes(a.subjectId)).map(t=>t.id);
project.integrationResources={teachers:['Mila Reed · mila.reed · WistTest2026!','Rowan Hayes · rowan.hayes · WistTest2026!','Theo Adams · theo.adams · WistTest2026!'],rooms:['Demo sports space 3','Demo sports space 4'],changes};
project.notes.push('Full-school testing adds fictional teachers Mila Reed (mathematics), Theo Adams (English), Rowan Hayes (PE/PSHE), and Demo sports spaces 3 and 4. Upper-school PE/PSHE teachers are distributed across parallel form groups; existing pupil IDs and teaching-set memberships are unchanged.');
await fs.writeFile(new URL('../tmp/integrated-timetable-input.json',import.meta.url),JSON.stringify(project));
console.log(JSON.stringify({activities:project.activities.length,students:project.groups.flatMap(g=>g.studentIds).length,changes}));
