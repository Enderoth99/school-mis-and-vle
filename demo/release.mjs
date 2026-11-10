import fs from 'node:fs/promises';
import path from 'node:path';
export const LOGIN_RELEASE='20261110-shared-planning-v1';
export function versionModuleReferences(source,release=LOGIN_RELEASE){
 return source.replace(/(['"])(\.\.?\/[^'"\s?]+\.mjs)\1/g,(_,quote,file)=>quote+file+'?v='+release+quote);
}
export async function stampIntegratedRelease(target){
 for(const name of await fs.readdir(target)){
  if(!/\.(mjs|html)$/.test(name))continue;
  const file=path.join(target,name);let source=await fs.readFile(file,'utf8');
  if(name.endsWith('.mjs'))source=versionModuleReferences(source);
  if(name.endsWith('.html'))source=source.replace('src="demo-bootstrap.mjs"','src="demo-bootstrap.mjs?v='+LOGIN_RELEASE+'"');
  if(name==='login.html')source=source.replace('<p class="eyebrow">FREE BROWSER DEMO</p>','<p class="eyebrow">IMPROVED MIS · 80 TEACHERS</p>').replace('<div class="login-demo"><h3>','<div class="login-demo"><p><button type="button" class="btn primary" id="use-admin-demo">Use admin test login</button></p><p>Administrator username: <strong>admin</strong></p><h3>');
  await fs.writeFile(file,source);
 }
}




