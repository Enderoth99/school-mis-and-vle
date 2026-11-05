import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveTestAccount} from '../dist/test-accounts.mjs';
import {REPORT_REVIEWER} from '../dist/report-config.mjs';
test('demo admin and retained reviewer alias resolve to the same existing school-wide permission identity',()=>{
 for(const username of ['admin',' ADMIN ','report.reviewer'])assert.equal(resolveTestAccount(username),REPORT_REVIEWER);
 assert.equal(resolveTestAccount('noah.morgan').id,'t-noah-morgan');
 for(const username of ['admin@example.com','superadmin','',null,{}])assert.equal(resolveTestAccount(username),null);
});
