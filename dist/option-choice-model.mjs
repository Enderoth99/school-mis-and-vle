import {optionModel} from './timetable-options.mjs';
export const choiceModel=optionModel('3');
export const choiceKey=(block,subject)=>block+'|'+subject;
export function optionSections(index,cohortSize){return index>=5?Math.max(1,Math.ceil(cohortSize/24)):1;}
export function optionCounts(records){const counts={};for(const r of Object.values(records))r.choices.forEach((s,i)=>{const key=choiceKey(i,s);counts[key]=(counts[key]||0)+1;});return counts;}
export function validateChoices({choices,records={},studentId,cohortSize}){
 if(!Array.isArray(choices)||choices.length!==choiceModel.blocks.length)throw Error('Choose one subject from every block.');
 choices.forEach((s,i)=>{if(!choiceModel.blocks[i].some(c=>c.subject===s))throw Error('Choose a valid subject in Option '+(i+1)+'.');});
 if(new Set(choices).size!==choices.length)throw Error('You cannot choose the same subject in two blocks.');
 if(!choices.some(s=>['Physics','Chemistry','Biology'].includes(s)))throw Error('Choose at least one science: Physics, Chemistry or Biology.');
 const others=Object.fromEntries(Object.entries(records).filter(([id])=>id!==studentId)),counts=optionCounts(others);
 choices.forEach((s,i)=>{if((counts[choiceKey(i,s)]||0)>=24*optionSections(i,cohortSize))throw Error(s+' in Option '+(i+1)+' is full. Choose another subject or ask the options manager.');});return true;
}
