import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingMarking,nextPendingStudent} from '../dist/marking-queue.mjs';
test('marking queue skips missing, saved drafts and returned work, then wraps to earlier unmarked submissions',()=>{
 const rows=[{id:'earlier',submission:{turnedInAt:'2026-11-01'}},{id:'missing'},{id:'draft',submission:{answer:'Not handed in'}},{id:'returned',submission:{turnedInAt:'2026-11-01',returnedAt:'2026-11-02'}},{id:'current',submission:{turnedInAt:'2026-11-01'}},{id:'later',submission:{turnedInAt:'2026-11-01'}}],before=structuredClone(rows);
 assert.deepEqual(pendingMarking(rows).map(x=>x.id),['earlier','current','later']);assert.equal(nextPendingStudent(rows,'current').id,'later');assert.equal(nextPendingStudent(rows,'later').id,'earlier');assert.equal(nextPendingStudent(rows,'unknown').id,'earlier');assert.deepEqual(rows,before);
});
test('queue refresh after returning the last mark stops, while a new resubmission becomes eligible again',()=>{
 const rows=[{id:'one',submission:{turnedInAt:'2026-11-01',returnedAt:'2026-11-02'}},{id:'two',submission:{turnedInAt:'2026-11-01'}}];assert.equal(nextPendingStudent(rows,'one').id,'two');rows[1].submission.returnedAt='2026-11-02';assert.equal(nextPendingStudent(rows,'two'),null);delete rows[0].submission.returnedAt;assert.equal(nextPendingStudent(rows,'two').id,'one');assert.equal(nextPendingStudent([],null),null);
});
