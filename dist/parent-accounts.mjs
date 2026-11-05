import {familyLinks} from './family-data.mjs';
export const PARENT_TEST_PASSWORD='WistFamily2026!';
const parents=familyLinks.flatMap(f=>f.parents.map(p=>({...p,childIds:f.childIds})));
export function parentActor(id){const p=parents.find(p=>p.id===id);return p?{id:p.id,role:'parent',username:String(p.recordNumber),parentNumber:p.recordNumber,name:p.name,firstName:p.name.split(' ')[0],phase:'Parent',area:'Family portal',synthetic:true}:null;}
export function parentAccount(username){const p=parents.find(p=>String(p.recordNumber)===String(username).trim());return p?parentActor(p.id):null;}
export function parentExample(childId='s-9a-1'){return parentActor(parents.find(p=>p.childIds.includes(childId))?.id);}
