import {initialize,demoFetch,needsSeed} from './demo-api.mjs';
const originalFetch=window.fetch.bind(window),prefix=new URL('./',import.meta.url).pathname;
const loading=document.createElement('div');loading.className='demo-loading';loading.textContent='Preparing your fictional school demo…';document.body.append(loading);
try{
 let seed;if(await needsSeed()){const response=await originalFetch(prefix+'demo-seed.json');if(!response.ok)throw Error('Could not load fictional demo records.');seed=await response.json();}await initialize(seed);
 window.fetch=(input,init)=>{const url=new URL(typeof input==='string'?input:input.url,location.href);return url.origin===location.origin&&(url.pathname.startsWith(prefix+'api/')||url.pathname.startsWith('/api/'))?demoFetch(input,init):originalFetch(input,init);};
 document.addEventListener('click',async event=>{const a=event.target.closest('a[href]');if(!a)return;const url=new URL(a.href);if(url.origin!==location.origin||!url.pathname.startsWith(prefix+'api/messages/attachment'))return;event.preventDefault();const r=await fetch(url.href);if(!r.ok){loading.textContent='The test attachment could not be opened.';document.body.append(loading);return;}const blob=URL.createObjectURL(await r.blob()),download=document.createElement('a');download.href=blob;download.download=r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1]||'test-attachment';download.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);});
 loading.remove();await import(location.pathname.endsWith('login.html')?'./login.mjs':'./app.mjs');
}catch(error){loading.textContent='The demo could not start: '+error.message+' Please allow browser storage and reload this page.';}
