export const pendingMarking=students=>(students||[]).filter(s=>s.submission?.turnedInAt&&!s.submission.returnedAt);
export function nextPendingStudent(students,currentId){
 const rows=students||[],index=rows.findIndex(s=>s.id===currentId),ordered=index<0?rows:[...rows.slice(index+1),...rows.slice(0,index+1)];
 return pendingMarking(ordered)[0]||null;
}
