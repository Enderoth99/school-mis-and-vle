import fs from 'node:fs/promises';
import {baselineTeachers,baselineTeachingClasses} from '../dist/teaching-data.mjs';
const p=JSON.parse(await fs.readFile(new URL('./fixtures/integrated-timetable-v1.json',import.meta.url),'utf8'));
await fs.writeFile(new URL('../tmp/integrated-timetable-v1.json',import.meta.url),JSON.stringify(p));
const names={FS1:['Pre Nursery Bunnies','Pre Nursery Kittens','Nursery Giraffes','Nursery Zebras'],FS2:['Reception Macaws','Reception Peacocks','Reception Penguins','Reception Robins (demo)'],1:['Emus','Kangaroos','Kiwis','Koalas'],2:['Cheetahs','Orcas','Tigers','Whales'],3:['Dolphins','Fish','Leopards','Pandas'],4:['Hedgehogs','Lions','Lynx','Panthers'],5:['Falcons','Huskies','Owls','Sharks'],6:['Eagles','Foxes','Osprey','Wolves']};
const primary=p.groups.filter(g=>typeof g.year!=='number'||g.year<=6),groups=new Map(p.groups.map(g=>[g.id,g])),primaryIds=new Set(primary.map(g=>g.id));
for(const g of primary){const n=names[g.year]['abcd'.indexOf(g.id.at(-1))];g.name=typeof g.year==='number'?'Year '+g.year+' '+n:n;g.form=n.replace(/^(Pre Nursery|Nursery|Reception) /,'');g.nameSource=g.id==='fs2d'?'Fictional fourth Reception group; source lists three':'Classes.pdf current homeroom list, pages 24–30 and 44–47';}
const teachers=new Map(p.teachers.map(t=>{const original=baselineTeachers.find(b=>b.id===t.id);return[t.id,Object.assign(t,{...original,...t,subjects:t.subjects||original?.subjects||p.subjects.filter(s=>t.subjectIds?.includes(s.id)).map(s=>s.name)})];}));
const addSubject=(name,color='#487e64')=>{const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(!p.subjects.some(s=>s.id===id))p.subjects.push({id,name,color});return id;};
const pools={Russian:['Iris Bailey','Dmitri Stone','Anya Wilson'],'Uzbek Language':['Saida Bennett','Timur Lawson'],French:['Camille Hart','Julien Brooks'],Computing:['Hazel Foster','Elliot Quinn'],Music:['Aria Weston','Finn Harper','Clara Ellis'],Art:['Jasper Lane'],Library:['Olivia Page'],PE:['Max Rivers','Sana Collins','Luca Bennett']};
const staffPools=new Map();
for(const [subject,names]of Object.entries(pools)){const subjectId=addSubject(subject),staff=names.map(name=>{const id='t-'+name.toLowerCase().replaceAll(' ','-'),t={id,name,firstName:name.split(' ')[0],username:name.toLowerCase().replaceAll(' ','.'),phase:'Primary specialist',area:'Primary '+subject,areaId:'primary-'+subjectId,subjects:[subject],subjectIds:[subjectId],formIds:[],blocked:[],synthetic:true,planningOnly:false,integrationFixture:true};p.teachers.push(t);teachers.set(id,t);return t;});staffPools.set(subject,staff);}
const maxSize=Math.max(...p.activities.map(a=>a.studentIds.length));
const roomById=new Map(p.rooms.map(r=>[r.id,r]));
for(const g of primary)roomById.get('room-'+g.id).name=g.name+' classroom';
const primaryOwners=new Map(primary.map(g=>[g.id,baselineTeachingClasses.find(c=>c.kind==='primary'&&c.cohort===g.id).teacherId]));
for(const g of primary)teachers.get(primaryOwners.get(g.id)).homeRoomId='room-'+g.id;
const general=p.rooms.filter(r=>r.type==='general'&&!primaryIds.has(r.groupId));let generalIndex=0,scienceIndex=0,computingIndex=0,artsIndex=0;
function newRoom(t,type,label){const id='room-home-'+t.id;const r={id,name:t.name+' · '+label,type,capacity:maxSize,blocked:[],usualTeacherId:t.id,integrationFixture:true};p.rooms.push(r);roomById.set(id,r);return id;}
for(const t of p.teachers.filter(t=>t.phase==='Secondary')){
 if(t.subjects.includes('PE')){t.homeRoomId=newRoom(t,'general','PE / PSHE classroom');continue;}
 if(t.areaId==='science'){const index=++scienceIndex,r=p.rooms.find(r=>r.id==='room-science-'+index);if(!r)throw Error('Science room missing');t.homeRoomId=r.id;r.name=t.name+' · science lab';r.usualTeacherId=t.id;}
 else if(t.areaId==='computing'){const index=++computingIndex,r=p.rooms.find(r=>r.id==='room-computing-'+index);t.homeRoomId=r.id;r.name=t.name+' · computing lab';r.usualTeacherId=t.id;}
 else if(t.areaId==='arts'){t.homeRoomId=newRoom(t,'art','creative arts studio');artsIndex++;}
 else{const r=general[generalIndex++];if(!r)throw Error('General classroom missing');t.homeRoomId=r.id;r.name=t.name+' · '+t.area+' classroom';r.usualTeacherId=t.id;}
}
for(const [subject,staff]of staffPools)for(const t of staff)if(subject!=='PE')t.homeRoomId=newRoom(t,subject==='Computing'?'computing':subject==='Music'?'music':subject==='Art'?'art':'general',subject==='Library'?'library':subject+' room');
// Preserve the existing secondary week; give every non-PE teacher one usual room.
const secondary=p.activities.filter(a=>!primaryIds.has(a.groupIds[0]));
for(const a of secondary){const t=teachers.get(a.teacherIds[0]);if(a.subjectId!=='pe'){a.roomIds=[t.homeRoomId];for(const [id,pos]of Object.entries(p.placements))if(id.startsWith(a.id+'#'))pos.roomId=t.homeRoomId;}delete a.eligibleTeacherIds;}
p.activities=secondary;p.placements=Object.fromEntries(Object.entries(p.placements).filter(([id])=>secondary.some(a=>id.startsWith(a.id+'#'))));
const demands=new Map();
function add(g,subject,count,owner,options={}){const subjectId=addSubject(subject),id='primary-'+g.id+'-'+subjectId,rooms=subject==='PE'?p.rooms.filter(r=>r.type==='sport').map(r=>r.id):[owner.homeRoomId];p.activities.push({id,classId:null,name:g.name+' · '+subject,subjectId,teacherIds:[owner.id],groupIds:[g.id],studentIds:[...g.studentIds],roomIds:rooms,weeklyCount:subject==='PE'?count/2:count,duration:subject==='PE'?2:1,spread:count<=5,year:g.year,enrollmentMode:'primary form',source:'Fictional primary weekly allocation; subject names and group names informed by Classes.pdf',...options});demands.set(owner.id,(demands.get(owner.id)||0)+count);}
for(const g of primary){const owner=teachers.get(primaryOwners.get(g.id));
 const specialistHours=typeof g.year==='number'?{Russian:3,'Uzbek Language':2,French:2,Computing:2,Music:2,Art:1,Library:1,PE:2}:{Russian:2,'Uzbek Language':1,Music:2,Library:1,PE:2,...(g.year==='FS2'?{French:1,Computing:1}:{})};
 for(const [subject,count]of Object.entries(specialistHours)){const pool=staffPools.get(subject),t=[...pool].sort((a,b)=>(demands.get(a.id)||0)-(demands.get(b.id)||0)||a.id.localeCompare(b.id))[0];add(g,subject,count,t,{primarySpecialist:true});}
 const core=typeof g.year==='number'?{English:8,Mathematics:8,Science:5,Humanities:2,PSHE:2}:{'Early years curriculum':40-Object.values(specialistHours).reduce((a,b)=>a+b,0)};
 owner.subjects=Object.keys(core);owner.subjectIds=owner.subjects.map(s=>addSubject(s));
 for(const [subject,count]of Object.entries(core))add(g,subject,count,owner,{primaryCore:true,spread:false});
}
p.integrationRevision=2;p.primarySpecialists=true;p.roomPolicy='Secondary teachers use their usual rooms; primary core lessons use the form classroom. Specialist lessons use the specialist room; PE uses shared sports spaces.';
p.name='WIST · 2026–27 demonstration · Whole school';p.warnings=[];
p.notes=p.notes.filter(n=>!n.includes('38 periods')&&!n.includes('No extra staff')&&!n.startsWith('This planning draft does not replace'));
p.notes.push('Primary core and specialist lesson totals are illustrative demonstration allocations, not verified school weekly hour requirements. Group names follow current homerooms in Classes.pdf; Reception Robins is a fictional fourth group to retain the requested four-group structure.','Seventeen additional fictional primary specialists have test logins. Secondary non-PE teachers each have one usual room; primary core teachers keep their form classroom. PE retains shared sports venues.');
p.integrationResources.primarySpecialists=[...staffPools.values()].flat().map(t=>({id:t.id,name:t.name,username:t.username}));
await fs.writeFile(new URL('../tmp/primary-specialists-input.json',import.meta.url),JSON.stringify(p));
console.log(JSON.stringify({teachers:p.teachers.length,rooms:p.rooms.length,activities:p.activities.length,groups:primary.map(g=>g.name),primarySpecialistPeriods:[...demands].filter(([id])=>[...staffPools.values()].flat().some(t=>t.id===id)).map(([id,n])=>[teachers.get(id).name,n])}));
