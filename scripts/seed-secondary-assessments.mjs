import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GradeStore} from '../grades-store.mjs';
import {classes,roster,students} from '../dist/model.mjs';
export const DEMO_SET='secondary-five-assessments-v1';
export const secondaryClasses=classes.filter(c=>Number(c.year)>=7&&Number(c.year)<=13&&c.kind==='subject');
const dates=['2026-09-04','2026-09-18','2026-10-02','2026-10-16','2026-10-30'];
const maxima=[20,25,40,50,100],labels=['Baseline','Skills check','Application','Progress check','Review'];
function hash(text){let value=2166136261;for(const character of text)value=Math.imul(value^character.charCodeAt(0),16777619);return value>>>0;}
export function demoAssessment(c,index){const maximum=maxima[index],marks={};for(const s of roster(c.id)){const base=48+hash(s.id+'|'+c.subject)%35,trend=(hash(c.subject+'|'+s.id)%7)-2,variation=(hash(s.id+'|'+c.id+'|'+index)%15)-7,percentage=Math.max(20,Math.min(98,base+trend*index+variation));marks[s.id]=Math.round(percentage/100*maximum);}return{classId:c.id,title:`Demo · ${c.subject} · ${index+1} ${labels[index]}`,date:dates[index],maximum,marks};}
export async function seedSecondaryAssessments(store){return store.transact(next=>{let created=0,skipped=0,studentResults=0;for(const c of secondaryClasses)for(let index=0;index<5;index++){const id=`demo-secondary-v1:${c.id}:${index+1}`;if(next.assessments[id]){if(next.assessments[id].classId!==c.id)throw Error('Demo assessment ID collision.');skipped++;continue;}const normalized=store.normalize(c.teacherId,demoAssessment(c,index),null);next.assessments[id]={...normalized,id,sourceId:id,synthetic:true,demoSet:DEMO_SET};created++;studentResults+=Object.keys(normalized.marks).length;}return{created,skipped,studentResults,teachingGroups:secondaryClasses.length,students:students.filter(s=>Number(s.year)>=7&&Number(s.year)<=13).length,assessmentsPerTeachingGroup:5};});}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const filename=fileURLToPath(new URL('../.data/grades.json',import.meta.url)),store=new GradeStore(filename);console.log(JSON.stringify(await seedSecondaryAssessments(store),null,2));}
