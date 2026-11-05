// Canonical fictional household relationships shared by Directory and family logins.
import {students} from './school-data.mjs';
export const guardianNames=['Amina','Farid','Lina','Arman','Nadia','Kamran','Sara','Timur','Maya','Omar','Leila','Daniyar','Elena','Aziz','Sofia','Rustam'];
export function createFamilyLinks(population=students){const paired=new Set(),families=[];for(let i=0;i<population.length;i++){if(paired.has(i))continue;const childIds=[population[i].id];paired.add(i);if(i<200&&population[i+600]){childIds.push(population[i+600].id);paired.add(i+600);}const n=families.length+1,id='household-'+String(n).padStart(4,'0'),parents=[0,1].map(j=>{const index=(n-1)*2+j+1;return{id:'guardian-'+String(index).padStart(4,'0'),recordNumber:300000+index,name:guardianNames[(index-1)%guardianNames.length]+' '+population[i].lastName,index};});families.push({id,index:n,anchorIndex:i,childIds,parents});}return families;}
export const familyLinks=createFamilyLinks();
