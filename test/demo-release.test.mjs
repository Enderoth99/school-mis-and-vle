import test from 'node:test';
import assert from 'node:assert/strict';
import {versionModuleReferences} from '../demo/release.mjs';
test('release versions cover static imports, dynamic login loads and worker module URLs',()=>{
 const source=`import './demo-api.mjs';import('./login.mjs');new URL('./timetable-worker.mjs',import.meta.url);import './already.mjs?v=old';fetch('/api/login');`;
 const result=versionModuleReferences(source,'release-test');
 for(const file of ['demo-api','login','timetable-worker'])assert.ok(result.includes('./'+file+'.mjs?v=release-test'));
 assert.ok(result.includes('./already.mjs?v=old'));assert.ok(result.includes("fetch('/api/login')"));
 assert.equal(versionModuleReferences(result,'release-test'),result);
});
