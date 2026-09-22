import {RecommenderError,safeError} from './errors.js';

export const ROUTES=Object.freeze({
  recommend:'/api/hanamesh/recommender/recommend',
  feedback:'/api/hanamesh/recommender/feedback',
  history:'/api/hanamesh/recommender/history',
  details:'/api/hanamesh/recommender/open-details',
  install:'/api/hanamesh/recommender/install',
  invoke:'/api/hanamesh/recommender/invoke',
});
const routeSet=new Set(Object.values(ROUTES));
const feedbackActions=new Set(['select','install','open','dismiss']);
const invokeKinds=new Set(['app','plugin']);

function json(value,status=200,headers={}){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});}
function exactObject(value,keys){return value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(key=>keys.includes(key));}

export function requireSameCarrierOrigin(request){
  const origin=request.headers.get('origin'),host=request.headers.get('host'),site=request.headers.get('sec-fetch-site');let parsed;
  try{parsed=origin?new URL(origin):null;}catch{parsed=null;}
  if(!parsed||parsed.origin!==origin||!['http:','https:'].includes(parsed.protocol)||(host?parsed.host!==host:parsed.origin!==new URL(request.url).origin)||(site!==null&&site!=='same-origin'))throw new RecommenderError('RECOMMENDER_ORIGIN_DENIED',403);
}

async function requestBody(request){
  if(request.headers.get('content-type')?.split(';',1)[0]?.trim()!=='application/json')throw new RecommenderError('RECOMMENDER_INPUT_INVALID',415);
  const declared=Number(request.headers.get('content-length')??'0');if(Number.isFinite(declared)&&declared>8192)throw new RecommenderError('RECOMMENDER_INPUT_INVALID',413);
  const text=await request.text();if(Buffer.byteLength(text,'utf8')>8192)throw new RecommenderError('RECOMMENDER_INPUT_INVALID',413);
  try{return JSON.parse(text);}catch{throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);}
}

function recommendationInput(value){
  if(!exactObject(value,['query','locale','constraints','more'])||typeof value.query!=='string'||value.query.trim().length<1||value.query.length>500)throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  const locale=['zh','en','ja'].includes(value.locale)?value.locale:'en',constraints=value.constraints??{};
  if(!exactObject(constraints,['free','localOnly','noShell'])||Object.values(constraints).some(item=>typeof item!=='boolean'))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  if(value.more!==undefined&&(!Number.isSafeInteger(value.more)||value.more<1||value.more>20))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  return {query:value.query.trim(),locale,constraints,...(value.more===undefined?{}:{more:value.more})};
}

function feedbackInput(value){
  if(!exactObject(value,['requestId','objectId','action'])||typeof value.requestId!=='string'||typeof value.objectId!=='string'||!feedbackActions.has(value.action)||value.requestId.length>200||value.objectId.length>200)throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  return {requestId:value.requestId,objectId:value.objectId,action:value.action};
}

/** Market seat argument: duck-typed `{itemId?, packageName?}`; at least one identifier unless the caller allows none. */
function marketTarget(value,keys,requireIdentifier=true){
  if(!exactObject(value,keys))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  for(const field of ['itemId','packageName','appId']){const item=value[field];if(item!==undefined&&(typeof item!=='string'||item.length<1||item.length>200))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);}
  if(requireIdentifier&&value.itemId===undefined&&value.packageName===undefined)throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  return {...(value.itemId===undefined?{}:{itemId:value.itemId}),...(value.packageName===undefined?{}:{packageName:value.packageName})};
}

function detailsInput(value){
  const target=marketTarget(value,['url','itemId','packageName'],false);
  if(typeof value.url!=='string')throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  let parsed;try{parsed=new URL(value.url);}catch{throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);}
  if(parsed.origin!=='https://market.hanamesh.com'||parsed.search||parsed.hash||!/^\/hana\/[A-Za-z0-9._~-]+$/u.test(parsed.pathname))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  return {url:parsed.href,target};
}

function invokeInput(value){
  const target=marketTarget(value,['itemId','packageName','appId','kind']);
  if(!invokeKinds.has(value.kind))throw new RecommenderError('RECOMMENDER_INPUT_INVALID',400);
  return {kind:value.kind,appId:value.appId??target.packageName??target.itemId,target};
}

export function createRouteHandler({remote,history,context,openExternal,market,localInstalled}){
  if(!remote||!history||typeof context!=='function'||typeof openExternal!=='function'||!market||typeof localInstalled!=='function')throw new TypeError('Route dependencies are required.');
  /** Seat answer wins; the Loader projection is the pre-market fallback and only proves *loaded* entries. */
  const isInstalled=async target=>{
    const answer=await market.isInstalled(target.packageName??target.itemId);
    if(answer!==undefined)return {installed:answer,source:'market'};
    const ids=await localInstalled();
    return {installed:[target.packageName,target.itemId].some(item=>typeof item==='string'&&ids.includes(item)),source:'loader'};
  };
  return async request=>{try{
    const url=new URL(request.url);if(url.search||url.hash||!routeSet.has(url.pathname))return json({error:{code:'RECOMMENDER_NOT_FOUND'}},404);
    if(url.pathname===ROUTES.history){if(request.method!=='GET')return json({error:{code:'RECOMMENDER_METHOD_NOT_ALLOWED'}},405);return json({records:history.list()});}
    if(request.method!=='POST')return json({error:{code:'RECOMMENDER_METHOD_NOT_ALLOWED'}},405);requireSameCarrierOrigin(request);const body=await requestBody(request);
    if(url.pathname===ROUTES.recommend){
      const input=recommendationInput(body),localContext=await context(input.locale),result=await remote.recommend({query:input.query,context:localContext,constraints:input.constraints,...(input.more===undefined?{}:{more:input.more})});
      const requestId=result.value?.meta?.requestId??result.requestId;if(typeof requestId!=='string'||!result.value?.recommendation)throw new RecommenderError('SEMANTIC_RESPONSE_INVALID',502);
      await history.append({requestId,constraints:input.constraints,recommendation:result.value.recommendation});
      return json(result.value,200,{'x-hanamesh-semantic-mode':result.mode,'x-request-id':requestId});
    }
    if(url.pathname===ROUTES.feedback){const result=await remote.feedback(feedbackInput(body));return json(result.value,200,{'x-hanamesh-semantic-mode':result.mode,...(result.requestId?{'x-request-id':result.requestId}:{})});}
    if(url.pathname===ROUTES.install){const status=await market.install(marketTarget(body,['itemId','packageName']));return json({state:'install-started',status:status.status??null,restartRequired:status.status==='restart-required',via:'market'});}
    if(url.pathname===ROUTES.invoke){
      const input=invokeInput(body),state=await isInstalled(input.target);
      if(state.installed&&input.kind==='plugin')return json({state:'plugin-enabled',installed:true,kind:'plugin',startSession:true,source:state.source});
      if(state.installed){await market.openApp({appId:input.appId,...input.target});return json({state:'app-opened',installed:true,kind:'app',source:state.source});}
      const status=await market.install(input.target);
      return json({state:'install-started',installed:false,kind:input.kind,status:status.status??null,restartRequired:status.status==='restart-required',source:state.source});
    }
    const details=detailsInput(body);
    /** Details prefers the market entry; without the seat it degrades to the public catalog link. */
    if(market.has('open')&&Object.keys(details.target).length>0){await market.open(details.target);return json({opened:true,via:'market',url:details.url});}
    await openExternal(details.url);return json({opened:true,via:'browser',url:details.url});
  }catch(error){const safe=safeError(error);return json({error:{code:safe.code,message:safe.message}},safe.status,{...(safe.retryAfter?{'retry-after':safe.retryAfter}:{})});}};
}
