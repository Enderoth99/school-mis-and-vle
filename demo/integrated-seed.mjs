import {installTeachingTimetable} from '../dist/teaching-data.mjs';
import {createDirectoryFixtures} from '../directory-data.mjs';
export function integratedSeed(project){
 const active=installTeachingTimetable(project),assessments={},dates=['2026-10-05','2026-10-12','2026-10-19','2026-10-26','2026-10-30'];let count=0;
 for(const c of active.classes.filter(c=>typeof c.year==='number'&&c.year>=7&&c.kind==='subject'))for(let i=0;i<5;i++){
  const id='integrated:'+c.id+':'+(i+1),maximum=[20,25,40,50,100][i],marks={},missedStudentIds=[];
  for(const [j,studentId] of c.studentIds.entries()){count++;if(count%20===0)missedStudentIds.push(studentId);else marks[studentId]=Math.round(maximum*(0.45+((j*13+i*7+c.id.length)%50)/100));}
  assessments[id]={id,classId:c.id,teacherId:c.teacherId,title:c.subject+' assessment '+(i+1),date:dates[i],maximum,marks,missedStudentIds,revision:1,createdAt:dates[i]+'T10:00:00.000Z',updatedAt:dates[i]+'T10:00:00.000Z',origin:'integrated-fictional-fixture'};
 }
 return{'attendance.json':{version:1,registers:{}},'grades.json':{version:1,assessments},'messages.json':{version:1,messages:[]},'report-cards.json':{version:1,rows:{},homerooms:{},issues:{},events:[]},'directory.json':createDirectoryFixtures()};
}
