import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';

const root = resolve(process.argv[2] || 'build');
const types = {'.mjs':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.csv':'text/csv','.svg':'image/svg+xml','.png':'image/png'};
createServer(async (req, res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) return res.writeHead(405).end();
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + sep)) return res.writeHead(403).end();
    const body = await readFile(file);
    res.writeHead(200, {'Content-Type':types[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {res.writeHead(404).end('File not found');}
}).listen(8791, '127.0.0.1', () => console.log('Demo preview: http://127.0.0.1:8791/school-mis-and-vle/login.html'));
