import {sha256} from '@noble/hashes/sha256';
export const randomUUID=()=>crypto.randomUUID();
export function createHash(algorithm){if(algorithm!=='sha256')throw Error('Unsupported demo digest.');let value='';return{update(input){value+=String(input);return this;},digest(encoding){const bytes=sha256(new TextEncoder().encode(value));return encoding==='hex'?[...bytes].map(b=>b.toString(16).padStart(2,'0')).join(''):bytes;}};}

