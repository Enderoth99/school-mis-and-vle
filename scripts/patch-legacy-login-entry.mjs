import fs from 'node:fs/promises';
import path from 'node:path';
const hub=process.argv[2];if(!hub)throw Error('Supply the Learning Hub dist folder.');
const helper=await fs.readFile(new URL('../demo/legacy-login-upgrade.mjs',import.meta.url),'utf8');
for(const legacy of ['wist-mis','wist-timetabling']){
 const folder=path.join(hub,legacy),file=path.join(folder,'login.html');let source=await fs.readFile(file,'utf8');
 if(!source.includes('legacy-login-upgrade.mjs'))source=source.replace('</head>','<script type="module" src="legacy-login-upgrade.mjs?v=20261031-admin-80"></script></head>');
 if(!source.includes('id="current-mis-link"'))source=source.replace('<h1>Welcome back.</h1>','<h1>Welcome back.</h1><p id="current-mis-link"><strong>Previous 60-teacher demo.</strong> <a href="/wist-mis-testing/login.html?account=admin&amp;release=20261031-admin-80">Open the improved 80-teacher MIS and admin login →</a></p>');
 await fs.writeFile(file,source);await fs.writeFile(path.join(folder,'legacy-login-upgrade.mjs'),helper);
 console.log('Added upgrade route to '+legacy+' login; existing bundles and records preserved.');
}
