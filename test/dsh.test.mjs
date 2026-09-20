import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockServer} from '../scripts/mock-server.mjs';
import {inject,mountRecommender,historyDomainSpec} from '../src/dsh.js';

test('DSH adapter opens one storage domain and registers four exact local routes', async t => {
  const mock=await createMockServer();t.after(()=>mock.close());
  let snapshot=structuredClone(historyDomainSpec.global.initial),openedSpec;const registered=[],effects=[];
  const domain={global:{get:()=>structuredClone(snapshot),set:async value=>{snapshot=structuredClone(value);}},close:async()=>{domain.closed=true;}};
  const ctx={
    storageDomain:{open:async spec=>{openedSpec=spec;return domain;}},
    loader:{entries(){return [{id:'hanamesh-recommender',options:{name:'hanamesh-recommender'}}];}},
    webServer:{port:41001},
    connection:{fetch:{register:spec=>{registered.push(spec);return()=>{spec.disposed=true;};}}},
    effect(run){effects.push(run());},
  };
  const opened=[];await mountRecommender(ctx,{serverOrigin:mock.origin,timeoutMs:1000,dshVersion:'0.1.5-alpha.1'},{openExternal:async url=>opened.push(url)});
  assert.deepEqual(inject,['connection','storageDomain','loader','webServer']);
  assert.equal(openedSpec.name,'hanamesh_recommender');assert.equal(registered.length,4);assert(registered.every(row=>row.requestBody==='buffered'));
  const recommend=registered.find(row=>row.path.endsWith('/recommend'));
  const response=await recommend.fetch(new Request('http://127.0.0.1:41001'+recommend.path,{method:'POST',headers:{origin:'http://127.0.0.1:41001','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({query:'task',locale:'en',constraints:{}})}));
  assert.equal(response.status,200);assert.equal(snapshot.records.length,1);
  await effects.at(-1)();assert.equal(domain.closed,true);assert(registered.every(row=>row.disposed));
});

test('bundle patch stays one insert and carries configurable server origin', async () => {
  const patch=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../profile/cordis.patch.yml',import.meta.url),'utf8'));
  assert.equal((patch.match(/^\s*- id:/gm)??[]).length,1);
  assert.match(patch,/id: hanamesh-recommender/);assert.match(patch,/serverOrigin:/);
});
