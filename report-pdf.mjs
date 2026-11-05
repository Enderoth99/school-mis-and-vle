import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./scripts/render-report.py',import.meta.url));
export function renderReportPdf(reports){return new Promise((resolve,reject)=>{const python=process.env.WIST_PYTHON||'python';const child=spawn(python,[script],{windowsHide:true,stdio:['pipe','pipe','pipe']}),buffers=[];let errors='',size=0,finished=false;const timeout=setTimeout(()=>{child.kill();done(Error('PDF generation timed out. Try a single student report.'));},60000);function done(error,value){if(finished)return;finished=true;clearTimeout(timeout);error?reject(error):resolve(value);}child.on('error',()=>done(Error('The report PDF runtime is unavailable. Configure WIST_PYTHON with Python and reportlab/pypdf installed.')));child.stdout.on('data',data=>{size+=data.length;if(size>30000000){child.kill();done(Error('The PDF is too large. Export fewer reports.'));}else buffers.push(data);});child.stderr.on('data',data=>errors=(errors+data).slice(-3000));child.on('close',code=>{if(code!==0)done(Error('PDF generation failed: '+errors));else done(null,Buffer.concat(buffers));});child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({reports:Array.isArray(reports)?reports:[reports]}));});}

