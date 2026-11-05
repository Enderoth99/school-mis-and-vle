// Demo-only filesystem backed by IndexedDB. It never contacts a server API.
export const DB_NAME=typeof __WIST_DEMO_DB__==='string'?__WIST_DEMO_DB__:'wist-mis-browser-demo-v1';
let dbPromise;
export function database(){return dbPromise||=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
const key=p=>String(p).replaceAll('\\','/');
export async function readFile(filename){const db=await database();return new Promise((resolve,reject)=>{const r=db.transaction('files').objectStore('files').get(key(filename));r.onsuccess=()=>r.result===undefined?reject(Object.assign(Error('Demo file not found'),{code:'ENOENT'})):resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function writeFile(filename,value){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(String(value),key(filename));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Browser storage could not save.'));});}
export async function rename(from,to){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite'),store=tx.objectStore('files'),r=store.get(key(from));r.onsuccess=()=>{if(r.result===undefined){tx.abort();return;}store.put(r.result,key(to));store.delete(key(from));};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Demo save could not complete.'));});}
export async function mkdir(){}
export async function seedFiles(seed){for(const [name,value] of Object.entries(seed)){try{await readFile('/data/'+name);}catch(e){if(e.code!=='ENOENT')throw e;await writeFile('/data/'+name,JSON.stringify(value));}}}
