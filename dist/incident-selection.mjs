export function incidentGroups(students,groups,year=''){
 const ids=new Set(students.filter(s=>!year||String(s.year)===year).map(s=>s.cohort));
 return groups.filter(g=>ids.has(g.id)&&(!year||String(g.year)===year));
}
export function incidentStudents(students,year,groupId){
 if(!year||!groupId)return [];
 return students.filter(s=>String(s.year)===year&&s.cohort===groupId).sort((a,b)=>a.name.localeCompare(b.name));
}
export function validateIncidentSelection(value,students,groups){
 if(!incidentGroups(students,groups,value.year).some(g=>g.id===value.groupId)||!incidentStudents(students,value.year,value.groupId).some(s=>s.id===value.studentId))throw Error('Choose a year, class and a student belonging to that class.');
}
