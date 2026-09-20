import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockServer} from '../scripts/mock-server.mjs';
import {createSemanticClient} from '../src/remote.js';

test('mock implements search, recommend and feedback with stub headers', async t => {
  const mock=await createMockServer();t.after(()=>mock.close());
  const client=createSemanticClient({serverOrigin:mock.origin,originHeader:'http://127.0.0.1:41001',timeoutMs:1000});
  const input={query:'修复代码',context:{runtime:'local',os:'macos',arch:'arm64',dshVersion:'0.1.5-alpha.1',installed:[],locale:'zh'},constraints:{free:true}};
  const search=await client.search(input);
  assert.equal(search.mode,'stub');assert.equal(search.value.candidates.length,2);
  const recommend=await client.recommend(input);
  assert.equal(recommend.mode,'stub');assert.equal(recommend.value.recommendation.primary.matchPercent,92);
  const feedback=await client.feedback({requestId:recommend.value.meta.requestId,objectId:'cap.repo-master',action:'select'});
  assert.deepEqual(feedback.value,{ok:true});assert.equal(feedback.mode,'stub');assert.equal(typeof feedback.requestId,'string');
  assert.equal(mock.requests.length,3);
  assert(mock.requests.every(row=>row.origin==='http://127.0.0.1:41001'));
});

test('mock exposes noMatch and 429 as distinct negative cases', async t => {
  const mock=await createMockServer();t.after(()=>mock.close());
  const client=createSemanticClient({serverOrigin:mock.origin,originHeader:'http://127.0.0.1:41001',timeoutMs:1000});
  const base={context:{runtime:'local',os:'macos',arch:'arm64',dshVersion:'0.1.5-alpha.1',installed:[],locale:'zh'}};
  const noMatch=await client.recommend({...base,query:'no-match'});
  assert.equal(noMatch.value.recommendation.noMatch,true);assert.equal(noMatch.value.recommendation.primary,null);assert(noMatch.value.recommendation.alternatives.length>0);
  await assert.rejects(()=>client.recommend({...base,query:'trigger 429'}),error=>error.code==='SEMANTIC_RATE_LIMITED'&&error.status===429&&error.retryAfter==='7');
});

test('remote client rejects non-loopback cleartext origins', () => {
  assert.throws(()=>createSemanticClient({serverOrigin:'http://example.com',originHeader:'http://127.0.0.1:1'}),/secure or loopback/);
});
