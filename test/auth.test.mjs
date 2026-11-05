import test from 'node:test';
import assert from 'node:assert/strict';
import {createAppServer} from '../server.mjs';
import {TEST_PASSWORD} from '../server-auth.mjs';
import {teachers} from '../dist/teaching-data.mjs';

test('login, session identity, invalid credentials and logout work for all 60 accounts',async()=>{
 const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 try{
  assert.equal((await fetch(base+'/api/session')).status,401);
  const root=await fetch(base+'/',{redirect:'manual'});assert.equal(root.status,302);assert.equal(root.headers.get('location'),'/login.html');
  const login=async(username,password=TEST_PASSWORD,extra={})=>fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({username,password})});
  assert.equal((await login(teachers[0].username,'wrong-password')).status,401);assert.equal((await login('unknown.teacher')).status,401);
  assert.equal((await login(teachers[0].username,TEST_PASSWORD,{Origin:'https://unrelated.example'})).status,403);
  const cookies=[];
  for(const teacher of teachers){const response=await login(teacher.username);assert.equal(response.status,200,teacher.username);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);cookies.push(cookie.split(';')[0]);const identity=await(await fetch(base+'/api/session',{headers:{Cookie:cookies.at(-1)}})).json();assert.equal(identity.teacher.id,teacher.id);}
  assert.equal((await fetch(base+'/',{headers:{Cookie:cookies[0]}})).status,200);
  assert.equal((await fetch(base+'/api/logout',{method:'POST',headers:{Cookie:cookies[0]}})).status,200);
  assert.equal((await fetch(base+'/api/session',{headers:{Cookie:cookies[0]}})).status,401);
  assert.equal((await fetch(base+'/api/session',{headers:{Cookie:cookies[1]}})).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
