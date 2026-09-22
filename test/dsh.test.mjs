import test from 'node:test';
import assert from 'node:assert/strict';
import {createMockServer} from '../scripts/mock-server.mjs';
import {inject,mountRecommender,marketResolver,historyDomainSpec,MARKET_SEAT} from '../src/dsh.js';
import {ROUTES} from '../src/routes.js';

function harness(){
  let snapshot=structuredClone(historyDomainSpec.global.initial),openedSpec;const registered=[],effects=[],gets=[];
  const domain={global:{get:()=>structuredClone(snapshot),set:async value=>{snapshot=structuredClone(value);}},close:async()=>{domain.closed=true;}};
  const ctx={
    storageDomain:{open:async spec=>{openedSpec=spec;return domain;}},
    loader:{entries(){return [{id:'hanamesh-recommender',options:{name:'hanamesh-recommender'}}];}},
    webServer:{port:41001},
    connection:{fetch:{register:spec=>{registered.push(spec);return()=>{spec.disposed=true;};}}},
    effect(run){effects.push(run());},
    get(name){gets.push(name);return ctx.services?.[name];},
    services:{},
  };
  return {ctx,domain,registered,effects,gets,state:()=>snapshot,spec:()=>openedSpec};
}

test('DSH adapter opens one storage domain and registers six exact local routes', async t => {
  const mock=await createMockServer();t.after(()=>mock.close());
  const {ctx,domain,registered,effects,state,spec}=harness();
  await mountRecommender(ctx,{serverOrigin:mock.origin,timeoutMs:1000,dshVersion:'0.1.5-alpha.1'},{openExternal:async()=>{}});
  assert.deepEqual(inject,['connection','storageDomain','loader','webServer']);
  assert.equal(inject.includes(MARKET_SEAT),false);
  assert.equal(spec().name,'hanamesh_recommender');assert.equal(registered.length,6);assert(registered.every(row=>row.requestBody==='buffered'));
  assert.deepEqual(registered.map(row=>row.path).sort(),Object.values(ROUTES).slice().sort());
  assert.deepEqual(registered.filter(row=>row.methods.includes('GET')).map(row=>row.path),[ROUTES.history]);
  const recommend=registered.find(row=>row.path.endsWith('/recommend'));
  const response=await recommend.fetch(new Request('http://127.0.0.1:41001'+recommend.path,{method:'POST',headers:{origin:'http://127.0.0.1:41001','sec-fetch-site':'same-origin','content-type':'application/json'},body:JSON.stringify({query:'task',locale:'en',constraints:{}})}));
  assert.equal(response.status,200);assert.equal(state().records.length,1);
  await effects.at(-1)();assert.equal(domain.closed,true);assert(registered.every(row=>row.disposed));
});

test('the market seat is read late through ctx.get and a late app-host is picked up without a reload', async t => {
  const mock=await createMockServer();t.after(()=>mock.close());
  const {ctx,registered,gets}=harness();
  await mountRecommender(ctx,{serverOrigin:mock.origin,timeoutMs:1000},{openExternal:async()=>{}});
  const invoke=registered.find(row=>row.path===ROUTES.invoke),headers={origin:'http://127.0.0.1:41001','sec-fetch-site':'same-origin','content-type':'application/json'};
  const call=()=>invoke.fetch(new Request('http://127.0.0.1:41001'+ROUTES.invoke,{method:'POST',headers,body:JSON.stringify({itemId:'vibe',packageName:'vibe-app',kind:'app'})}));
  const before=await call();
  assert.equal(before.status,503);assert.equal((await before.json()).error.code,'RECOMMENDER_MARKET_UNAVAILABLE');
  const opened=[];ctx.services[MARKET_SEAT]={isInstalled:async()=>true,openApp:async target=>{opened.push(target);}};
  const after=await call();
  assert.equal(after.status,200);assert.equal((await after.json()).state,'app-opened');assert.equal(opened.length,1);
  assert(gets.every(name=>name===MARKET_SEAT));
});

test('a context that refuses uninjected reads degrades instead of throwing', () => {
  const resolve=marketResolver({get(){throw new Error(`cannot get property "${MARKET_SEAT}" without inject`);}});
  assert.equal(resolve(),undefined);
  assert.equal(marketResolver({})(),undefined);
});

test('bundle patch stays one insert and carries configurable server origin', async () => {
  const patch=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../profile/cordis.patch.yml',import.meta.url),'utf8'));
  assert.equal((patch.match(/^\s*- id:/gm)??[]).length,1);
  assert.match(patch,/id: hanamesh-recommender/);assert.match(patch,/serverOrigin:/);
});
