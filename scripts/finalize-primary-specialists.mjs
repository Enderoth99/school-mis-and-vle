import fs from 'node:fs/promises';
import {validateTimetable} from '../dist/timetable-engine.mjs';
import {workflowStatus} from '../dist/timetable-workflow.mjs';
const p=JSON.parse(await fs.readFile(new URL('../tmp/primary-specialists-solved.json',import.meta.url),'utf8'));
const used=new Set(p.activities.flatMap(a=>a.roomIds));for(const t of p.teachers)if(t.homeRoomId)used.add(t.homeRoomId);p.rooms=p.rooms.filter(r=>used.has(r.id));
const r=validateTimetable(p),preflight=workflowStatus(p,r).preflight;
if(!r.complete||preflight.blockers.length)throw Error('A complete, clash-free timetable and clear input checks are required before activation.');
await fs.writeFile(new URL('../dist/timetable-integrated.json',import.meta.url),JSON.stringify(p));
console.log(JSON.stringify({placed:r.placed,total:r.total,students:r.coverage.students.length,missing:r.coverage.missingSlots,teachers:p.teachers.length,rooms:p.rooms.length}));
