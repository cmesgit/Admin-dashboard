import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSessionLoader } from './adminSession.js';
const fail = status => Object.assign(new Error('request failed'), {response:{status}});
test('a changed learner identity cannot restore a cached admin interface', async () => {
  const load = adminSessionLoader({get: async () => ({data:{email:'learner@example.test',roles:['STUDENT']}})});
  assert.equal(await load(), null);
});
test('expired access refreshes once across simultaneous bootstrap calls', async () => {
  let gets=0, refreshes=0;
  const admin={roles:['ADMIN'],feature_flags:{content_studio_enabled:true}};
  const load=adminSessionLoader({get: async () => {if(++gets===1)throw fail(401);return {data:admin};},post:async()=>{refreshes++;}});
  const [a,b]=await Promise.all([load(),load()]);
  assert.equal(a,admin);assert.equal(b,admin);assert.equal(refreshes,1);assert.equal(gets,2);
});
test('invalid refresh ends the admin session; an outage remains retryable', async () => {
  assert.equal(await adminSessionLoader({get:async()=>{throw fail(401);},post:async()=>{throw fail(401);}})(),null);
  let tries=0;
  const load=adminSessionLoader({get:async()=>{if(++tries===1)throw new Error('offline');return {data:{roles:['admin']}};}});
  await assert.rejects(load(), /offline/);
  assert.deepEqual(await load(),{roles:['admin']});
});
test('server failure during refresh is not misclassified as logout', async () => {
  const load=adminSessionLoader({get:async()=>{throw fail(401);},post:async()=>{throw fail(503);}});
  await assert.rejects(load(), e=>e.response.status===503);
});
