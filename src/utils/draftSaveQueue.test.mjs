import test from 'node:test';
import assert from 'node:assert/strict';
import { assertDraftAccepted, createSaveQueue, mergeSectionEdits } from './draftSaveQueue.js';

test('failed older values cannot overwrite newer typing or a cleared field', () => {
 const failed={hero:{heading:'Old',subhead:'Old subtitle'},faq:{heading:'Questions'}};
 const newer={hero:{heading:'Newest',subhead:''}};
 assert.deepEqual(mergeSectionEdits(failed,newer),{hero:{heading:'Newest',subhead:''},faq:{heading:'Questions'}});
 assert.equal(failed.hero.heading,'Old');
});

test('a newer save waits until the older request has finished', async () => {
 const queue=createSaveQueue(); const order=[];let release;
 const old=queue(async()=>{order.push('old started');await new Promise(resolve=>release=resolve);order.push('old finished')});
 const newer=queue(async()=>order.push('new started'));
 await Promise.resolve();assert.deepEqual(order,['old started']);release();await Promise.all([old,newer]);
 assert.deepEqual(order,['old started','old finished','new started']);
});

test('a failed request does not poison the queue or lose the newest edit', async () => {
 const queue=createSaveQueue();let pending={hero:{heading:'First'}};let fail;
 const first=queue(async()=>{const payload=pending;pending={};try{await new Promise((_,reject)=>fail=reject)}catch{pending=mergeSectionEdits(payload,pending);return false}});
 await Promise.resolve();pending={hero:{heading:'Newest'}};const second=queue(async()=>{const saved=pending;pending={};return saved});fail(Error('offline'));
 assert.equal(await first,false);assert.deepEqual(await second,{hero:{heading:'Newest'}});
 const rejected=queue(async()=>{throw Error('server failure')});await assert.rejects(rejected,/server failure/);assert.equal(await queue(async()=>true),true);
});

test("a partially rejected save cannot be treated as a successful save", () => {
  assert.throws(() => assertDraftAccepted({ saved_fields: 1, rejected: { hero: "Heading is too long." } }), /Heading is too long/);
  const accepted = { saved_fields: 1 };
  assert.equal(assertDraftAccepted(accepted), accepted);
});
