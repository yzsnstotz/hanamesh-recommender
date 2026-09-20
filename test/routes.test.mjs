import test from 'node:test';
import assert from 'node:assert/strict';
import {createRouteHandler,ROUTES} from '../src/routes.js';

const carrier='http://127.0.0.1:41001';
const headers={origin:carrier,'sec-fetch-site':'same-origin','content-type':'application/json'};

test('recommend route adds only the six-field context and stores a summary', async () => {
  const calls=[];const records=[];
  const remote={recommend:async input=>{calls.push(input);return {mode:'stub',value:{recommendation:{primary:null,alternatives:[],noMatch:true,confidence:0},candidates:[],meta:{requestId:'req-1',latencyMs:2,providers:{embedding:{name:'stub',mode:'stub'},decision:{name:'stub',mode:'stub'}}}}};}};
  const handler=createRouteHandler({remote,history:{append:async value=>records.push(value),list:()=>[]},context:async locale=>({runtime:'local',os:'macos',arch:'arm64',dshVersion:'0.1.5-alpha.1',installed:['one'],locale}),openExternal:async()=>{}});
  const response=await handler(new Request(carrier+ROUTES.recommend,{method:'POST',headers,body:JSON.stringify({query:'task',locale:'ja',constraints:{localOnly:true}})}));
  assert.equal(response.status,200);assert.equal(response.headers.get('x-hanamesh-semantic-mode'),'stub');
  assert.deepEqual(Object.keys(calls[0].context).sort(),['arch','dshVersion','installed','locale','os','runtime']);
  assert.equal(calls[0].context.locale,'ja');assert.equal(records.length,1);
});

test('feedback route forwards only request id, object id and action', async () => {
  const calls=[];const handler=createRouteHandler({remote:{feedback:async value=>{calls.push(value);return {mode:'stub',value:{ok:true}};}},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{}});
  const response=await handler(new Request(carrier+ROUTES.feedback,{method:'POST',headers,body:JSON.stringify({requestId:'req',objectId:'obj',action:'open',query:'leak'})}));
  assert.equal(response.status,400);assert.equal(calls.length,0);
});

test('details route only opens canonical market Hana URLs', async () => {
  const opened=[];const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async url=>opened.push(url)});
  const good=await handler(new Request(carrier+ROUTES.details,{method:'POST',headers,body:JSON.stringify({url:'https://market.hanamesh.com/hana/repo-master'})}));
  assert.equal(good.status,200);assert.deepEqual(opened,['https://market.hanamesh.com/hana/repo-master']);
  const bad=await handler(new Request(carrier+ROUTES.details,{method:'POST',headers,body:JSON.stringify({url:'https://evil.example/hana/x'})}));
  assert.equal(bad.status,400);assert.equal(opened.length,1);
});

test('mutating routes reject cross-origin browser requests', async () => {
  const handler=createRouteHandler({remote:{},history:{list:()=>[]},context:async()=>({}),openExternal:async()=>{}});
  const response=await handler(new Request(carrier+ROUTES.feedback,{method:'POST',headers:{...headers,origin:'https://evil.example'},body:'{}'}));
  assert.equal(response.status,403);
});
