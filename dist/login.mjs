import {supportAccounts} from './support-accounts.mjs';
import {parentExample,PARENT_TEST_PASSWORD} from './parent-accounts.mjs';
import {students} from './school-data.mjs';
import {REPORT_REVIEWER} from './report-config.mjs';
import {teachers,classesForTeacher} from './teaching-data.mjs';
const picker=document.querySelector('#demo-account');
const example=students.find(s=>s.id==='s-9a-1')||students[0];const box=document.createElement('p');box.innerHTML='Student test login: <strong>'+example.studentNumber+'</strong> · <strong>WistLearn2026!</strong><br><small>'+example.name+' · '+example.groupName+'</small>';picker.closest('label').after(box);const family=parentExample(example.id),familyBox=document.createElement('p');familyBox.innerHTML='Parent test login: <strong>'+family.username+'</strong> · <strong>'+PARENT_TEST_PASSWORD+'</strong><br><small>'+family.name+' · Parent of '+example.name+'</small>';box.after(familyBox);document.querySelector('#username').placeholder='Teacher username, student or parent number';
for(const phase of ['Early years','Primary','Primary specialist','Secondary']){
 const group=document.createElement('optgroup');group.label=phase;
 for(const teacher of teachers.filter(t=>t.phase===phase)){
  const option=document.createElement('option');option.value=teacher.username;
  option.textContent=`${teacher.name} · ${['Secondary','Primary specialist'].includes(phase)?teacher.area:classesForTeacher(teacher.id)[0].name}`;group.append(option);
 }
 picker.append(group);
}
{const group=document.createElement('optgroup');group.label='School administration';const option=document.createElement('option');option.value=REPORT_REVIEWER.username;option.textContent='Demo Administrator · Data, accounts and school management';group.append(option);picker.append(group);}
document.querySelector('#use-admin-demo')?.addEventListener('click',()=>{document.querySelector('#username').value='admin';document.querySelector('#password').value='WistTest2026!';document.querySelector('#login-error').textContent='';document.querySelector('#login-submit').focus();});
if(new URLSearchParams(location.search).get('account')==='admin')document.querySelector('#username').value='admin';
{const g=document.createElement('optgroup');g.label='Technical support';for(const t of supportAccounts){const o=document.createElement('option');o.value=t.username;o.textContent=t.name+' · Technician';g.append(o);}picker.append(g);}
picker.addEventListener('change',()=>{document.querySelector('#username').value=picker.value;document.querySelector('#password').focus();});
document.querySelector('#login-form').addEventListener('submit',async e=>{
 e.preventDefault();const error=document.querySelector('#login-error'),submit=document.querySelector('#login-submit');error.textContent='';submit.disabled=true;submit.textContent='Signing in…';
 try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({username:document.querySelector('#username').value,password:document.querySelector('#password').value})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign in failed.');if(result.teacher.role==='technician'){location.replace(new URL('./',location.href).pathname+'#/support');return;}if(result.teacher.role==='parent'){location.replace(new URL('./',location.href).pathname+'#/family');return;}if(result.teacher.role==='student'){location.replace(new URL('./',location.href).pathname+'#/classroom');return;}location.replace(result.teacher.role==='report-reviewer'?'/#/admin':'/#/home');}
 catch(err){error.textContent=err.message;submit.disabled=false;submit.textContent='Sign in →';}
});

const readySubmit=document.querySelector('#login-submit');readySubmit.disabled=false;readySubmit.textContent='Sign in →';
