import {RecommenderError} from './errors.js';

const paths={search:'/v1/capabilities/search',recommend:'/v1/capabilities/recommend',feedback:'/v1/capabilities/feedback'};

function checkedOrigin(value,label){
  let url;try{url=new URL(value);}catch{throw new TypeError(`${label} must be an absolute origin.`);}
  const loopback=(url.hostname==='127.0.0.1'||url.hostname==='localhost'||url.hostname==='[::1]');
  if(url.origin!==value||url.username||url.password||(!loopback&&url.protocol!=='https:')||(loopback&&!['http:','https:'].includes(url.protocol)))throw new TypeError(`${label} must be a secure or loopback canonical origin.`);
  return url.origin;
}

async function boundedJson(response){
  const declared=Number(response.headers.get('content-length')??'0');
  if(Number.isFinite(declared)&&declared>1024*1024)throw new RecommenderError('SEMANTIC_RESPONSE_INVALID',502);
  const text=await response.text();if(Buffer.byteLength(text,'utf8')>1024*1024)throw new RecommenderError('SEMANTIC_RESPONSE_INVALID',502);
  try{return JSON.parse(text);}catch{throw new RecommenderError('SEMANTIC_RESPONSE_INVALID',502);}
}

export function createSemanticClient({serverOrigin,originHeader,timeoutMs=10_000,fetcher=globalThis.fetch}){
  serverOrigin=checkedOrigin(serverOrigin,'serverOrigin');originHeader=checkedOrigin(originHeader,'originHeader');
  if(typeof fetcher!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>60_000)throw new TypeError('Invalid remote client options.');
  const request=async(kind,input)=>{
    let response;
    try{response=await fetcher.call(globalThis,serverOrigin+paths[kind],{method:'POST',redirect:'error',signal:AbortSignal.timeout(timeoutMs),headers:{accept:'application/json','content-type':'application/json',origin:originHeader},body:JSON.stringify(input)});}
    catch(error){throw new RecommenderError(error?.name==='TimeoutError'?'SEMANTIC_TIMEOUT':'SEMANTIC_PROVIDER_UNAVAILABLE',503);}
    const value=await boundedJson(response),mode=response.headers.get('x-hanamesh-semantic-mode')??'unknown';
    if(!response.ok){const code=value?.error?.code??'SEMANTIC_PROVIDER_UNAVAILABLE';throw Object.assign(new RecommenderError(code,response.status,value?.error?.message??code),{retryAfter:response.headers.get('retry-after')});}
    return {value,mode,requestId:response.headers.get('x-request-id')??value?.meta?.requestId??value?.requestId??null};
  };
  return {search:input=>request('search',input),recommend:input=>request('recommend',input),feedback:input=>request('feedback',input)};
}
