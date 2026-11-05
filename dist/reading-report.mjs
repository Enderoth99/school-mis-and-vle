export function readingReportRows(data,{status='pending',search=''}={}){
 const query=String(search).trim().toLocaleLowerCase();
 return data.rows.filter(r=>(status==='all'||status==='pending'&&r.pending>0||status==='complete'&&r.pending===0||status==='updated'&&r.updated>0)&&(!query||r.name.toLocaleLowerCase().includes(query)));
}
const cell=value=>{let text=String(value??'');if(/^\s*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
export function readingReportCSV(data,filters){return '\ufeff'+[['Class','Student','Confirmed','Available materials','To confirm','Updated since confirmation'],...readingReportRows(data,filters).map(r=>[data.className,r.name,r.confirmed,data.totalMaterials,r.pending,r.updated])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
