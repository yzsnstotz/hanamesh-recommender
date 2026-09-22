import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteHandler,ROUTES} from '../src/routes.js';
import {createMarketBridge} from '../src/market.js';

const carrier='http://127.0.0.1:41001';
const headers={origin:carrier,'sec-fetch-site':'same-origin','content-type':'application/json'};
const post=(path,body)=>new Request(carrier+path,{method:'POST',headers,body:JSON.stringify(body)});
const noMarket=createMarketBridge(()=>undefined);

test('recommend route adds only the six-field context and stores a summary', async () => {
  const calls=[];const records=[];
  const remote={recommend:async input=>{calls.push(input);return {mode:'stub',value:{recommendation:{primary:null,alternatives:[],noMatch:true,confidence:0},candidates:[],meta:{requestId:'req-1',latencyMs:2,providers:{embedding:{name:'stub',mode:'stub'},decision:{name:'stub',mode:'stub'}}}}};}};
  const handler=createRouteHandler({remote,history:{append:async value=>records.push(value),list:()=>[]},context:async locale=>({runtime:'local',os:'macos',arch:'arm64',dshVersion:'0.1.5-alpha.1',installed:['one'],locale}),openExternal:async()=>{},market:noMarket,localInstalled:async()=>[]});
  const response=await handler(post(ROUTES.recommend,{query:'task',locale:'ja',constraints:{localOnly:true}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('x-hanamesh-semantic-mode'),'stub');
  assert.deepEqual(Object.keys(calls[0].context).sort(),['arch','dshVersion','installed','locale','os','runtime']);
  assert.equal(calls[0].context.locale,'ja');assert.equal(records.length,1);
});

test('feedback route forwards only request id, object id and action', async () => {
  const calls=[];const handler=createRouteHandler({remote:{feedback:async value=>{calls.push(value);return {mode:'stub',value:{ok:true}};}},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:noMarket,localInstalled:async()=>[]});
  const response=await handler(post(ROUTES.feedback,{requestId:'req',objectId:'obj',action:'open',query:'leak'}));
  assert.equal(response.status,400);assert.equal(calls.length,0);
});

test('details route opens the market entry when the seat is there and the catalog link when it is not', async () => {
  const opened=[],market=[];
  const withSeat=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async url=>opened.push(url),market:createMarketBridge(()=>({open:target=>{market.push(target);}})),localInstalled:async()=>[]});
  const viaMarket=await withSeat(post(ROUTES.details,{url:'https://market.hanamesh.com/hana/repo-master',itemId:'repo-master',packageName:'repo-master'}));
  assert.equal(viaMarket.status,200);assert.equal((await viaMarket.json()).via,'market');
  assert.deepEqual(market,[{itemId:'repo-master',packageName:'repo-master'}]);assert.deepEqual(opened,[]);
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async url=>opened.push(url),market:noMarket,localInstalled:async()=>[]});
  const good=await handler(post(ROUTES.details,{url:'https://market.hanamesh.com/hana/repo-master',itemId:'repo-master'}));
  assert.equal(good.status,200);assert.equal((await good.json()).via,'browser');assert.deepEqual(opened,['https://market.hanamesh.com/hana/repo-master']);
  const bad=await handler(post(ROUTES.details,{url:'https://evil.example/hana/x',itemId:'x'}));
  assert.equal(bad.status,400);assert.equal(opened.length,1);
});

test('mutating routes reject cross-origin browser requests', async () => {
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:noMarket,localInstalled:async()=>[]});
  const response=await handler(new Request(carrier+ROUTES.feedback,{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'}));
  assert.equal(response.status,403);
});

test('install route goes through the market seat and reports a restart when the seat asks for one', async () => {
  const installs=[];
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:createMarketBridge(()=>({install:async target=>{installs.push(target);return {status:'restart-required'};}})),localInstalled:async()=>[]});
  const response=await handler(post(ROUTES.install,{itemId:'repo-master',packageName:'repo-master'}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{state:'install-started',status:'restart-required',restartRequired:true,via:'market'});
  assert.deepEqual(installs,[{itemId:'repo-master',packageName:'repo-master'}]);
  assert.equal((await handler(post(ROUTES.install,{}))).status,400);
});

// RC-11 state 1 of 3: an installed app is opened through the seat, never re-installed.
test('RC-11 invoke opens an installed app through the market seat', async () => {
  const opened=[],installs=[];
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:createMarketBridge(()=>({
    isInstalled:async name=>name==='vibe-app',openApp:async target=>{opened.push(target);},install:async target=>{installs.push(target);return {};},
  })),localInstalled:async()=>[]});
  const response=await handler(post(ROUTES.invoke,{itemId:'vibe',packageName:'vibe-app',appId:'vibe',kind:'app'}));
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{state:'app-opened',installed:true,kind:'app',source:'market'});
  assert.deepEqual(opened,[{appId:'vibe',itemId:'vibe',packageName:'vibe-app'}]);assert.deepEqual(installs,[]);
});

// RC-11 state 2 of 3: an installed plugin needs no market call, only a new session.
test('RC-11 invoke hands an installed plugin to a new session without installing again', async () => {
  const installs=[],opened=[];
  const seat={isInstalled:async name=>name==='repo-master',openApp:async t=>{opened.push(t);},install:async t=>{installs.push(t);return {};}};
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:createMarketBridge(()=>seat),localInstalled:async()=>[]});
  const response=await handler(post(ROUTES.invoke,{itemId:'repo-master',packageName:'repo-master',kind:'plugin'}));
  assert.deepEqual(await response.json(),{state:'plugin-enabled',installed:true,kind:'plugin',startSession:true,source:'market'});
  assert.deepEqual(installs,[]);assert.deepEqual(opened,[]);
  // Without isInstalled the Loader projection answers instead, and it still resolves to the same state.
  const fallback=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:createMarketBridge(()=>({install:async t=>{installs.push(t);return {};}})),localInstalled:async()=>['repo-master']});
  assert.deepEqual(await(await fallback(post(ROUTES.invoke,{packageName:'repo-master',kind:'plugin'}))).json(),{state:'plugin-enabled',installed:true,kind:'plugin',startSession:true,source:'loader'});
  assert.deepEqual(installs,[]);
});

// RC-11 state 3 of 3: nothing installed yet — install first, and say so honestly.
test('RC-11 invoke installs first when nothing is installed and never claims it is enabled', async () => {
  const installs=[],opened=[];
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:createMarketBridge(()=>({
    isInstalled:async()=>false,openApp:async t=>{opened.push(t);},install:async target=>{installs.push(target);return {status:'started'};},
  })),localInstalled:async()=>['something-else']});
  const response=await handler(post(ROUTES.invoke,{itemId:'repo-master',packageName:'repo-master',kind:'plugin'}));
  assert.deepEqual(await response.json(),{state:'install-started',installed:false,kind:'plugin',status:'started',restartRequired:false,source:'market'});
  assert.deepEqual(installs,[{itemId:'repo-master',packageName:'repo-master'}]);assert.deepEqual(opened,[]);
});

test('RC-11 degradation: without the seat invoke refuses readably, except for a plugin the Loader already shows', async () => {
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{},market:noMarket,localInstalled:async()=>['repo-master']});
  const missing=await handler(post(ROUTES.invoke,{itemId:'other',packageName:'other',kind:'plugin'}));
  assert.equal(missing.status,503);assert.equal((await missing.json()).error.code,'RECOMMENDER_MARKET_UNAVAILABLE');
  const app=await handler(post(ROUTES.invoke,{itemId:'repo-master',packageName:'repo-master',kind:'app'}));
  assert.equal(app.status,503);assert.equal((await app.json()).error.code,'RECOMMENDER_MARKET_UNAVAILABLE');
  const install=await handler(post(ROUTES.install,{packageName:'repo-master'}));
  assert.equal(install.status,503);assert.equal((await install.json()).error.code,'RECOMMENDER_MARKET_UNAVAILABLE');
  const plugin=await handler(post(ROUTES.invoke,{packageName:'repo-master',kind:'plugin'}));
  assert.equal(plugin.status,200);assert.equal((await plugin.json()).source,'loader');
  assert.equal((await handler(post(ROUTES.invoke,{packageName:'repo-master',kind:'runtime'}))).status,400);
});
