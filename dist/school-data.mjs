// Synthetic fixtures only. No records are derived from real pupils.
export const DATASET_VERSION = 2;
const allocation = [
  ['FS1', [15,17,16,18]],
  ['FS2', [16,18,17,19]],
  [1, [23,25,24,22]],
  [2, [24,22,25,23]],
  [3, [21,24,22,23]],
  [4, [23,21,24,22]],
  [5, [22,20,23,21]],
  [6, [21,23,20,22]],
  [7, [19,21,20,22]],
  [8, [18,20,19,21]],
  [9, [14,15,14,15]],
  [10, [18,19,17]],
  [11, [17,15]],
  [12, [10]],
  [13, [10]],
];
export const yearLabel = year => String(year).startsWith('FS') ? String(year) : `Year ${String(year).padStart(2,'0')}`;
export const yearGroups = allocation.map(([year,sizes])=>({year,value:String(year),label:yearLabel(year),total:sizes.reduce((a,b)=>a+b,0),groupCount:sizes.length}));
export const groups = allocation.flatMap(([year,sizes])=>sizes.map((count,index)=>({id:`${String(year).toLowerCase()}${'abcd'[index]}`,year,yearLabel:yearLabel(year),form:'ABCD'[index],name:`${yearLabel(year)} ${'ABCD'[index]}`,count})));
export const groupById = id => groups.find(group=>group.id===id);
// Preserve original demo identities while correcting the old B/C form mappings.
const legacyFirst = ['Alex','Jamie','Taylor','Jordan','Sam','Riley','Morgan','Casey','Robin','Avery','Charlie','Cameron','Drew','Quinn'];
const legacyLast = ['Parker','Reed','Ellis','Hayes','Bennett','Brooks','Harper','Morgan','Lane','Finch'];
const legacyForms = ['11a','11b','9a','10c','7c','7b','8a','8b','9b'];
const firstNames = ['Aziz','Malika','Daniel','Sofia','Akmal','Amira','Leo','Zara','Alisher','Madina','Adam','Layla','Timur','Nargiza','Oliver','Maya','Jasur','Diyora','Noah','Sara','Kamol','Dilnoza','Ethan','Aisha','Sardor','Sevara','Lucas','Nora','Behruz','Shahnoza','Arjun','Meera','Davron','Gulnoza','Aiden','Elena','Rustam','Nigina','Omar','Hana','Sanjar','Zarina','Liam','Isla','Bobur','Farida','Yusuf','Yasmin','Jamshid','Sabina','Hugo','Eva','Farrukh','Ravshan','Luca','Lina','Anvar','Munisa','Aaron','Chloe','Sherzod','Durdona','Isaac','Freya','Bekzod','Rayhona','Oscar','Inaya','Daler','Shirin','Adrian','Lara','Nodir','Nilufar','Rohan','Anika','Mansur','Kamila','Felix','Alina'];
const lastNames = ['Karimov','Saidova','Rahimov','Ismailova','Petrov','Ivanova','Chen','Wang','Patel','Sharma','Khan','Ahmed','Tanaka','Kim','Park','Garcia','Silva','Santos','Brown','Wilson','Davies','Hughes','Green','Walker','Bell','Wood','Adams','Baker','Hill','Scott','Young','King'];
const usedNames = new Set(legacyForms.flatMap((_,g)=>legacyFirst.map((first,i)=>`${first} ${legacyLast[(g+i)%legacyLast.length]}`)));
let generatedNameIndex=0;
function nextName(){for(;;){const i=generatedNameIndex++;const name=`${firstNames[i%firstNames.length]} ${lastNames[(i*13+Math.floor(i/firstNames.length))%lastNames.length]}`;if(!usedNames.has(name)){usedNames.add(name);return name;}if(i>=firstNames.length*lastNames.length)throw new Error('Synthetic name pool exhausted.');}}
let sequence=0;
export const students = groups.flatMap(group=>Array.from({length:group.count},(_,index)=>{
  const legacyIndex=legacyForms.indexOf(group.id);
  const name=legacyIndex>=0&&index<14?`${legacyFirst[index]} ${legacyLast[(legacyIndex+index)%legacyLast.length]}`:nextName();
  const [firstName,...surnameParts]=name.split(' '),number=++sequence;
  const age=group.year==='FS1'?3:group.year==='FS2'?4:Number(group.year)+4;
  const month=(number*7)%12+1,day=(number*11)%28+1,birthYear=2026-age-(month>=9?1:0);
  return {id:`s-${group.id}-${index+1}`,studentNumber:100000+number,admissionNumber:`TEST-${String(number).padStart(4,'0')}`,firstName,lastName:surnameParts.join(' '),name,year:group.year,yearLabel:group.yearLabel,cohort:group.id,form:group.form,groupName:group.name,dateOfBirth:`${birthYear}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,schoolEmail:`student${String(number).padStart(4,'0')}@wist-test.invalid`,status:'Active',synthetic:true};
}));
export const studentsForGroup = id => students.filter(student=>student.cohort===id);
