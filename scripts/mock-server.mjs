import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';

const candidates=[
  {objectId:'cap.repo-master',hanaId:'repo-master',type:'dsh_plugin',name:'RepoMaster',score:.92,summary:'Analyze repositories and prepare focused code changes.',capabilities:['Repository read','Code modification','Local execution'],metadata:{npmPackageName:'repo-master',githubRepo:'example/repo-master',categories:['coding'],license:'MIT',runtime:['local'],installed:false}},
  {objectId:'cap.local-audit',hanaId:'local-audit',type:'dsh_plugin',name:'Local Audit',score:.81,summary:'Inspect a project locally without shell access.',capabilities:['Static analysis','Local-only workflow'],metadata:{npmPackageName:'local-audit',categories:['security'],license:'MIT',runtime:['local'],installed:false}},
];

function recommendations(query){
  const rows=candidates.map((candidate,index)=>({objectId:candidate.objectId,hanaId:candidate.hanaId,name:candidate.name,matchPercent:Math.round(candidate.score*100),reasons:candidate.capabilities.slice(0,3),checks:[{label:'Current environment compatible',ok:true},{label:'Local runtime',ok:candidate.metadata.runtime.includes('local')}],install:index===1&&/app/iu.test(query)?{kind:'hanamesh_app',libraryUrl:'/hanamesh/library'}:{kind:'dsh_plugin',command:`dsh plugin add ${candidate.metadata.npmPackageName}`},detailsUrl:`https://market.hanamesh.com/hana/${candidate.hanaId}`}));
  return rows;
}

async function body(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>65_536)throw new Error('BODY_TOO_LARGE');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
function send(res,status,value,requestId,extra={}){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-hanamesh-semantic-mode':'stub','x-request-id':requestId,...extra});res.end(JSON.stringify(value));}

export async function createMockServer({host='127.0.0.1',port=0}={}){
  const requests=[];
  const server=createServer(async(req,res)=>{const requestId=randomUUID();try{
    if(req.method!=='POST'||!['/v1/capabilities/search','/v1/capabilities/recommend','/v1/capabilities/feedback'].includes(req.url)){send(res,404,{error:{code:'SEMANTIC_NOT_FOUND',message:'Unknown route.'}},requestId);return;}
    const input=await body(req);requests.push({path:req.url,origin:req.headers.origin??null,body:input});
    if(req.url==='/v1/capabilities/feedback'){send(res,200,{ok:true},requestId);return;}
    if(typeof input.query!=='string'||input.query.length<1||input.query.length>500){send(res,400,{error:{code:'SEMANTIC_INPUT_INVALID',message:'query is required.'}},requestId);return;}
    if(/429/iu.test(input.query)){send(res,429,{error:{code:'SEMANTIC_RATE_LIMITED',message:'Try again later.'}},requestId,{'retry-after':'7'});return;}
    if(req.url==='/v1/capabilities/search'){send(res,200,{candidates,retrieval:{provider:'fixture',model:'deterministic-v1',topK:input.topK??50,filtered:0,mode:'stub'},requestId},requestId);return;}
    const rows=recommendations(input.query),noMatch=/no[- ]?match|没有合适/iu.test(input.query);
    send(res,200,{recommendation:{primary:noMatch?null:rows[0],alternatives:noMatch?rows:rows.slice(1),noMatch,confidence:noMatch?0.18:0.92},candidates,meta:{requestId,latencyMs:2,providers:{embedding:{name:'fixture',mode:'stub'},decision:{name:'fixture',mode:'stub'}}}},requestId);
  }catch{send(res,400,{error:{code:'SEMANTIC_INPUT_INVALID',message:'Malformed request.'}},requestId);}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
  const address=server.address(),origin=`http://${host}:${address.port}`;
  return {origin,requests,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}

if(process.argv[1]===new URL(import.meta.url).pathname){
  const mock=await createMockServer({port:Number(process.env.PORT??0)});console.log(JSON.stringify({status:'ready',origin:mock.origin,mode:'stub'}));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>void mock.close().finally(()=>process.exit(0)));
}
